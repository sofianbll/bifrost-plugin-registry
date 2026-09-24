#!/usr/bin/env python3
"""Exercise the standard Registry plugin on an isolated dynamic Bifrost 2.2.2 build.

Run inside Docker --network none, except --keep-alive for local browser QA.
The caller supplies a gateway built from unmodified upstream source and its paired .so.
"""
import argparse
import base64
import copy
from datetime import datetime, timezone
import http.server
import json
import os
from pathlib import Path
import re
import secrets
import signal
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request

from isolated_models import Stub, digest


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


def main():
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gateway', type=Path, required=True)
    parser.add_argument('--plugin', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--keep-alive', action='store_true', help='Leave disposable browser fixture on 8080 and 8099')
    parser.add_argument('--hermes-fixture', action='store_true',
                        help='Allow one synthetic chat after the proof; requires --keep-alive')
    args = parser.parse_args()
    if args.hermes_fixture and not args.keep_alive:
        parser.error('--hermes-fixture requires --keep-alive')
    args.gateway = args.gateway.resolve(strict=True)
    args.plugin = args.plugin.resolve(strict=True)
    if args.out.exists():
        raise SystemExit('Choose a fresh --out directory')
    interfaces = sorted(p.name for p in Path('/sys/class/net').iterdir())
    if not args.keep_alive and interfaces != ['lo']:
        raise SystemExit('Automated proof requires Docker --network none')
    args.out.mkdir(parents=True)
    report_path = args.out / 'report.json'
    report = {
        'scope': 'local paired dynamic Bifrost candidate; synthetic provider; no inference',
        'source_provenance': 'caller must verify unmodified official 2.2.2 source',
        'started_at_utc': datetime.now(timezone.utc).isoformat(),
        'network_interfaces': interfaces,
        'artifacts': {'gateway': {'path': str(args.gateway), 'sha256': digest(args.gateway)},
                      'plugin': {'path': str(args.plugin), 'sha256': digest(args.plugin)}},
        'checks': [], 'hot_url_reactivation_supported': None,
    }
    process = log = None
    temporary = None
    servers = []
    gateway = 'http://127.0.0.1:8080'
    panel = 'http://127.0.0.1:8099'
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    username, password = 'fixture-admin', secrets.token_urlsafe(24)
    panel_token = (os.environ.get('REGISTRY_PROBE_BROWSER_TOKEN') if args.keep_alive else None) or secrets.token_urlsafe(32)
    basic = 'Basic ' + base64.b64encode(f'{username}:{password}'.encode()).decode()
    key_secret = ''
    Stub.hits = []

    def check(name, condition, **details):
        report['checks'].append({'name': name, 'pass': bool(condition), **details})
        if not condition:
            raise AssertionError(name)

    def call(base, path, method='GET', body=None, headers=None, auth=None):
        h = dict(headers or {})
        if auth:
            h['Authorization'] = auth
        data = None if body is None else json.dumps(body).encode()
        if data is not None:
            h['Content-Type'] = 'application/json'
        req = urllib.request.Request(base + path, data=data, method=method, headers=h)
        try:
            response = opener.open(req, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read(8 << 20)
            try:
                value = json.loads(raw)
            except ValueError:
                value = raw.decode(errors='replace')
            return response.status, value, {k.lower(): v for k, v in response.headers.items()}

    def native(path, method='GET', body=None, headers=None):
        return call(gateway, path, method, body, headers, basic)

    def admin(path, method='GET', body=None, headers=None, token=panel_token):
        return call(panel, path, method, body, headers, 'Bearer ' + token if token else None)

    def serve(handler):
        srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        servers.append(srv)
        return srv.server_port

    def stop():
        nonlocal process, log
        if process:
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
            process = None
        if log:
            log.close()
            log = None

    def panel_closed():
        for _ in range(40):
            try:
                call(panel, '/')
            except urllib.error.URLError:
                return True
            time.sleep(.1)
        return False

    class Asset(http.server.BaseHTTPRequestHandler):
        gets = 0
        bytes_sent = 0

        def do_GET(self):
            if self.path != asset_path:
                self.send_error(404)
                return
            payload = args.plugin.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            self.wfile.flush()
            Asset.gets += 1
            Asset.bytes_sent += len(payload)

        def log_message(self, *_args):
            pass

    class HermesStub(Stub):
        enabled = False
        post_hits = []
        reply = 'registry-hermes-fixture-ok'

        def do_POST(self):
            path = self.path.split('?', 1)[0]
            if not HermesStub.enabled:
                Stub.hits.append({'method': 'POST', 'path': path})
                self.send_error(405)
                return
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > (1 << 20):
                self.send_error(413)
                return
            try:
                body = json.loads(self.rfile.read(length))
            except ValueError:
                self.send_error(400)
                return
            model_id = body.get('model') if isinstance(body, dict) else None
            HermesStub.post_hits.append({'path': path, 'model': model_id})
            if path not in ('/chat/completions', '/v1/chat/completions'):
                self.send_error(405)
                return
            payload = json.dumps({'id': 'chatcmpl-registry-fixture', 'object': 'chat.completion',
                                  'created': 0, 'model': model_id,
                                  'choices': [{'index': 0, 'message': {'role': 'assistant',
                                               'content': HermesStub.reply}, 'finish_reason': 'stop'}],
                                  'usage': {'prompt_tokens': 1, 'completion_tokens': 1,
                                            'total_tokens': 2}}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    try:
        with tempfile.TemporaryDirectory(prefix='standalone-plugin-') as temporary:
            app = Path(temporary)
            registry_rel = 'app/registry/registry.json'
            registry_file = app / registry_rel
            (app / 'pricing.json').write_text('{}')
            (app / 'parameters.json').write_text('{}')
            stub_port = serve(HermesStub if args.hermes_fixture else Stub)
            asset_path = '/sha256-' + report['artifacts']['plugin']['sha256'] + '.so'
            asset_port = serve(Asset)
            asset_url = f'http://127.0.0.1:{asset_port}{asset_path}'
            config = {'version': 2,
                      'governance': {'auth_config': {'is_enabled': True, 'admin_username': username,
                                                     'admin_password': password}},
                      'client': {'enforce_auth_on_inference': True},
                      'server': {'read_buffer_size': 65536, 'plugin_download_private_allowlist': ['127.0.0.1']},
                      'config_store': {'enabled': True, 'type': 'sqlite', 'config': {'path': str(app / 'config.db')}},
                      'framework': {'pricing': {'pricing_url': (app / 'pricing.json').as_uri(),
                                                'model_parameters_url': (app / 'parameters.json').as_uri(),
                                                'pricing_sync_interval': 86400}},
                      'providers': {'openai': {'network_config': {'base_url': f'http://127.0.0.1:{stub_port}',
                                                                   'allow_private_network': True},
                                               'keys': [{'id': 'fixture-provider-key', 'name': 'Isolated stub',
                                                         'value': 'synthetic-provider-key', 'weight': 1,
                                                         'models': ['*']}]}},
                      'plugins': []}
            (app / 'config.json').write_text(json.dumps(config))

            def start():
                nonlocal process, log
                log = (app / 'gateway.log').open('ab')
                process = subprocess.Popen(
                    [str(args.gateway), '-app-dir', str(app),
                     '-host', '0.0.0.0' if args.keep_alive else '127.0.0.1', '-port', '8080'],
                    stdout=log, stderr=subprocess.STDOUT,
                    env={'PATH': os.environ.get('PATH', '/usr/bin:/bin'),
                         'REGISTRY_ADMIN_TOKEN': panel_token,
                         'BIFROST_ADMIN_AUTH': basic},
                )
                for _ in range(150):
                    if process.poll() is not None:
                        raise RuntimeError('gateway exited before readiness; see disposable gateway log')
                    try:
                        if native('/api/plugins')[0] == 200:
                            return
                    except (OSError, TimeoutError):
                        pass
                    time.sleep(.2)
                raise RuntimeError('gateway readiness timed out')

            def plugin_state():
                status, listed, _ = native('/api/plugins')
                status_loaded, loaded, _ = native('/api/plugins/loaded')
                rows = listed.get('plugins', []) if isinstance(listed, dict) else []
                names = loaded.get('plugins', []) if isinstance(loaded, dict) else []
                row = next((r for r in rows if r.get('name') == 'bifrost-registry'), None)
                return status, status_loaded, row, names

            plugin_config = {'name': 'bifrost-registry', 'enabled': True, 'path': asset_url,
                             'placement': 'post_builtin', 'order': 0,
                             'config': {'registry_path': str(registry_file),
                                        'admin_listen': ('0.0.0.0' if args.keep_alive else '127.0.0.1') + ':8099',
                                        'admin_token_env': 'REGISTRY_ADMIN_TOKEN',
                                        'bifrost_url': gateway,
                                        'bifrost_auth_env': 'BIFROST_ADMIN_AUTH'}}
            try:
                start()
                check('registry starts absent', not registry_file.exists())
                status, _, _ = native('/api/plugins', 'POST', plugin_config)
                check('plugin installed from URL', status == 201, status=status)
                check('URL downloaded completely', Asset.gets == 1 and Asset.bytes_sent == args.plugin.stat().st_size,
                      requests=Asset.gets)
                api_status, loaded_status, row, names = plugin_state()
                check('plugin saved active and loaded', api_status == loaded_status == 200
                      and row is not None and row.get('enabled') is True
                      and row.get('status', {}).get('status') == 'active'
                      and row.get('path') == asset_url and 'bifrost-registry' in names)
                check('registry path auto-created', registry_file.is_file()
                      and json.loads(registry_file.read_text()).get('schema_version') == 1)
                report['registry_relative_path'] = registry_rel

                status, ui_route, _ = native('/api/plugin-ui')
                check('no native plugin UI API contribution',
                      status != 200 or 'bifrost-registry' not in json.dumps(ui_route), status=status)
                status, host_route, _ = native('/plugins/bifrost-registry/')
                check('no native plugin route contribution',
                      status != 200 or not (isinstance(host_route, str)
                                            and 'Bifrost · Model Registry' in host_route), status=status)
                status, host_api, _ = native('/plugins/bifrost-registry/api/workspace')
                check('no native plugin API route contribution',
                      status != 200 or not (isinstance(host_api, dict)
                                            and 'revision' in host_api and 'data' in host_api), status=status)
                status, html, headers = call(panel, '/')
                check('standalone embedded HTML', status == 200 and isinstance(html, str)
                      and '<html' in html.lower() and 'Model Registry' in html
                      and 'text/html' in headers.get('content-type', ''), status=status)
                assets = re.findall(r'(?:src|href)="([^"?#]+\.(?:js|css))"', html)
                check('HTML references embedded JS and CSS', any(x.endswith('.js') for x in assets)
                      and any(x.endswith('.css') for x in assets))
                for asset in assets:
                    path = asset if asset.startswith('/') else '/' + asset.removeprefix('./')
                    status, body, _ = call(panel, path)
                    check('embedded asset ' + path, status == 200 and isinstance(body, str) and len(body) > 0,
                          status=status)
                check('no ui_dir mount required', 'ui_dir' not in plugin_config['config'])

                status, _, _ = admin('/api/workspace', token=None)
                check('anonymous panel API refused', status == 401, status=status)
                status, _, _ = admin('/api/workspace', token='invalid')
                check('wrong panel token refused', status == 401, status=status)
                status, _, _ = admin('/api/workspace', 'PUT', {}, {'Origin': 'https://foreign.invalid'})
                check('cross-origin panel write refused', status == 403, status=status)
                status, body, _ = call(panel, '/%2e%2e/config.json')
                check('asset traversal refused', status in (400, 403, 404)
                      and not (isinstance(body, str) and password in body), status=status)

                status, ws, _ = admin('/api/workspace')
                check('connected workspace and synthetic discovery', status == 200 and isinstance(ws, dict)
                      and ws.get('connection', {}).get('connected') is True
                      and bool(ws.get('discovery')), status=status)

                status, catalog, headers = admin('/api/catalog')
                check('catalogue shares Registry revision', status == 200 and isinstance(catalog, dict)
                      and catalog.get('revision') == ws['revision']
                      and headers.get('etag') == '"' + ws['revision'] + '"', status=status)
                status, catalog, _ = admin('/api/catalog/refresh', 'POST', {'sources': ['bifrost']},
                                           {'If-Match': catalog['revision']})
                source = next((s for s in catalog.get('sources', []) if s.get('id') == 'bifrost'), {})
                accesses = [a for a in catalog.get('accesses', []) if a.get('configured')
                            and a.get('fields', {}).get('name', {}).get('source') == 'bifrost']
                check('Bifrost catalogue refresh discovers configured access', status == 200
                      and bool(source.get('lastSuccess')) and not source.get('error') and bool(accesses),
                      status=status, configured_accesses=len(accesses))
                access = accesses[0]
                native_name = access['fields']['name']['value']
                reference_id = 'fixture-manual-reference'
                status, catalog, _ = admin('/api/catalog/reference', 'PUT',
                                           {'id': reference_id, 'fields': {'name': 'Fixture manual reference'}},
                                           {'If-Match': catalog['revision']})
                reference = next((r for r in catalog.get('references', []) if r.get('id') == reference_id), {})
                check('manual reference stored with exact ID and provenance', status == 200
                      and reference.get('fields', {}).get('name', {}).get('value') == 'Fixture manual reference'
                      and reference.get('fields', {}).get('name', {}).get('source') == 'manual', status=status)
                stale_catalog_revision = catalog['revision']
                status, catalog, _ = admin('/api/catalog/override', 'PUT',
                                           {'target': 'access', 'id': access['id'], 'field': 'name',
                                            'value': 'Fixture override'},
                                           {'If-Match': stale_catalog_revision})
                edited_access = next((a for a in catalog.get('accesses', []) if a.get('id') == access['id']), {})
                check('catalogue override changes effective value and provenance', status == 200
                      and edited_access.get('fields', {}).get('name', {}).get('value') == 'Fixture override'
                      and edited_access.get('fields', {}).get('name', {}).get('source') == 'manual', status=status)
                override_revision = catalog['revision']
                status, _, _ = admin('/api/catalog/override', 'PUT',
                                     {'target': 'access', 'id': access['id'], 'field': 'name', 'value': 42},
                                     {'If-Match': override_revision})
                check('invalid catalogue override rejected', status == 422, status=status)
                status, _, _ = admin('/api/catalog/override', 'PUT',
                                     {'target': 'access', 'id': access['id'], 'field': 'name', 'value': None},
                                     {'If-Match': stale_catalog_revision})
                check('stale catalogue revision rejected', status == 409, status=status)
                status, catalog, _ = admin('/api/catalog/override', 'PUT',
                                           {'target': 'access', 'id': access['id'], 'field': 'name', 'value': None},
                                           {'If-Match': override_revision})
                reverted = next((a for a in catalog.get('accesses', []) if a.get('id') == access['id']), {})
                check('revert restores Bifrost value and provenance', status == 200
                      and reverted.get('fields', {}).get('name', {}).get('value') == native_name
                      and reverted.get('fields', {}).get('name', {}).get('source') == 'bifrost', status=status)

                status, exported, headers = admin('/api/snapshot')
                check('versioned JSON snapshot preserves catalogue', status == 200
                      and isinstance(exported, dict) and exported.get('format_version') == 1
                      and any(r.get('id') == reference_id for r in exported.get('registry', {}).get('catalog', {}).get('references', []))
                      and all(secret not in json.dumps(exported) for secret in (password, panel_token, 'synthetic-provider-key'))
                      and headers.get('etag') == '"' + catalog['revision'] + '"', status=status)
                status, csv_body, csv_headers = admin('/api/snapshot.csv')
                check('flattened CSV has catalogue columns and no credentials', status == 200
                      and isinstance(csv_body, str) and csv_body.startswith('record_type,id,provider,model,configured,reference_id,')
                      and 'name_source' in csv_body.splitlines()[0]
                      and all(secret not in csv_body for secret in (password, panel_token, 'synthetic-provider-key'))
                      and 'text/csv' in csv_headers.get('content-type', ''), status=status)
                status, preview, _ = admin('/api/snapshot/preview', 'POST', exported)
                check('unchanged snapshot preview is idempotent', status == 200
                      and preview.get('unchanged') is True
                      and preview.get('imported_revision') == catalog['revision'], status=status)
                imported = copy.deepcopy(exported)
                imported_ref = next(r for r in imported['registry']['catalog']['references'] if r['id'] == reference_id)
                imported_ref['overrides']['name']['value'] = 'Fixture imported reference'
                status, preview, _ = admin('/api/snapshot/preview', 'POST', imported)
                check('snapshot preview reports reference change', status == 200
                      and preview.get('unchanged') is False
                      and preview.get('changes', {}).get('references', {}).get('updated') == 1, status=status)
                before_import = registry_file.read_bytes()
                status, applied, _ = admin('/api/snapshot/apply', 'POST', imported,
                                            {'If-Match': catalog['revision']})
                backup_name = applied.get('backup', '') if isinstance(applied, dict) else ''
                backup_file = registry_file.parent / backup_name if backup_name else None
                check('snapshot apply writes private pre-import backup', status == 200
                      and applied.get('unchanged') is False and backup_name.startswith('.registry.json.backup-')
                      and backup_file is not None and backup_file.is_file()
                      and backup_file.read_bytes() == before_import
                      and backup_file.stat().st_mode & 0o777 == 0o600, status=status)
                status, after_import, _ = admin('/api/catalog')
                imported_ref_view = next((r for r in after_import.get('references', []) if r.get('id') == reference_id), {})
                check('snapshot import updates live catalogue', status == 200
                      and after_import.get('revision') == applied['revision']
                      and imported_ref_view.get('fields', {}).get('name', {}).get('value') == 'Fixture imported reference',
                      status=status)
                backups_before_repeat = set(registry_file.parent.glob('.registry.json.backup-*'))
                status, repeated, _ = admin('/api/snapshot/apply', 'POST', imported,
                                             {'If-Match': applied['revision']})
                check('repeat snapshot import creates no duplicate or backup', status == 200
                      and repeated.get('unchanged') is True and repeated.get('backup') == ''
                      and repeated.get('revision') == applied['revision']
                      and set(registry_file.parent.glob('.registry.json.backup-*')) == backups_before_repeat,
                      status=status)

                status, ws, _ = admin('/api/workspace')
                check('workspace reloads after catalogue and snapshot writes', status == 200
                      and ws.get('revision') == applied['revision'], status=status)
                model = copy.deepcopy(ws['discovery'][0])
                model.update(tasks=['Chat'], inputModalities=['Text'], outputModalities=['Text'], kind='Chat')
                ws['data']['models'].append(model)
                ws['data']['groups'].append({'id': 'persisted-proof', 'name': 'Persisted proof',
                                             'description': 'Standalone URL integration',
                                             'members': [model['id']]})
                status, saved, _ = admin('/api/workspace', 'PUT', {'data': ws['data']},
                                         {'If-Match': ws['revision']})
                check('model and group saved', status == 200 and isinstance(saved, dict), status=status)
                status, _, _ = admin('/api/workspace', 'PUT', {'data': ws['data']},
                                     {'If-Match': ws['revision']})
                check('stale workspace revision rejected', status == 409, status=status)
                status, fresh, _ = admin('/api/workspace')
                check('model and group read back', status == 200
                      and any(m['id'] == model['id'] for m in fresh.get('data', {}).get('models', []))
                      and any(g['id'] == 'persisted-proof' for g in fresh.get('data', {}).get('groups', [])),
                      status=status)
                status, created, _ = admin('/api/keys', 'POST', {'name': 'Isolated proof key', 'client': 'Fixture'})
                check('native virtual key created', status == 201 and isinstance(created, dict)
                      and 'workspace' in created and bool(created.get('created', {}).get('secret')), status=status)
                key_id = created['created']['id']
                key_secret = created['created']['secret']
                fresh = created['workspace']
                key = next(k for k in fresh['data']['keys'] if k['id'] == key_id)
                key['policy']['groups'] = ['persisted-proof']
                status, fresh, _ = admin('/api/workspace', 'PUT', {'data': fresh['data']},
                                         {'If-Match': fresh['revision']})
                check('virtual key policy saved', status == 200, status=status)
                status, fresh, _ = admin('/api/keys/' + key_id + '/readback', 'POST')
                publication = next(k['publication'] for k in fresh.get('data', {}).get('keys', []) if k['id'] == key_id)
                check('independent /v1/models readback verified', status == 200
                      and publication['state'] == 'verified'
                      and publication['actual'] == publication['expected']
                      and len(publication['actual']) == 1,
                      status=status, exposed_ids=publication['actual'])
                check('workspace omits virtual key secret', key_secret not in json.dumps(fresh))
                status, models, _ = call(gateway, '/v1/models', auth='Bearer ' + key_secret)
                ids = sorted(item['id'] for item in models.get('data', [])) if isinstance(models, dict) else []
                check('native /v1/models matches published policy', status == 200
                      and ids == publication['expected'], status=status, exposed_ids=ids)

                stop()
                start()
                api_status, loaded_status, row, names = plugin_state()
                check('URL plugin survives gateway restart', api_status == loaded_status == 200
                      and row is not None and row.get('enabled') is True
                      and row.get('status', {}).get('status') == 'active'
                      and row.get('path') == asset_url and 'bifrost-registry' in names)
                status, fresh, _ = admin('/api/workspace')
                check('model group and policy survive restart', status == 200
                      and any(m['id'] == model['id'] for m in fresh.get('data', {}).get('models', []))
                      and any(g['id'] == 'persisted-proof' for g in fresh.get('data', {}).get('groups', []))
                      and any(k['id'] == key_id and k['policy']['groups'] == ['persisted-proof']
                              for k in fresh.get('data', {}).get('keys', [])), status=status)
                status, restarted_catalog, _ = admin('/api/catalog')
                restarted_ref = next((r for r in restarted_catalog.get('references', []) if r.get('id') == reference_id), {})
                check('imported reference survives gateway restart', status == 200
                      and restarted_ref.get('fields', {}).get('name', {}).get('value') == 'Fixture imported reference',
                      status=status)
                check('UI survives gateway restart', call(panel, '/')[0] == 200)

                status, _, _ = native('/api/plugins/bifrost-registry', 'PUT',
                                      {**plugin_config, 'enabled': False})
                check('disable accepted', status == 200, status=status)
                check('disable closes standalone server', panel_closed())
                status, reactivation, _ = native('/api/plugins/bifrost-registry', 'PUT', plugin_config)
                report['hot_url_reactivation_supported'] = status == 200
                if status == 200:
                    check('hot URL reactivation reopens panel', call(panel, '/')[0] == 200)
                else:
                    message = reactivation.get('error', {}).get('message', '') if isinstance(reactivation, dict) else ''
                    check('known URL reload limitation reported clearly', status == 500
                          and 'plugin already loaded' in message, status=status,
                          error_class='plugin already loaded' if 'plugin already loaded' in message else 'other')
                    check('failed reactivation leaves panel closed', panel_closed())
                _, _, row, _ = plugin_state()
                check('reactivation config remains enabled for restart', row is not None
                      and row.get('enabled') is True)
                stop()
                start()
                _, _, row, names = plugin_state()
                check('plugin recovers after reactivation restart', row is not None
                      and row.get('status', {}).get('status') == 'active'
                      and 'bifrost-registry' in names and call(panel, '/')[0] == 200)
                status, fresh, _ = admin('/api/workspace')
                check('saved workspace recovers after reactivation restart', status == 200
                      and any(g['id'] == 'persisted-proof' for g in fresh.get('data', {}).get('groups', []))
                      and any(k['id'] == key_id and k['policy']['groups'] == ['persisted-proof']
                              for k in fresh.get('data', {}).get('keys', [])))
                status, fresh, _ = admin('/api/keys/' + key_id + '/readback', 'POST')
                publication = next(k['publication'] for k in fresh.get('data', {}).get('keys', []) if k['id'] == key_id)
                check('native readback recovers after restart', status == 200
                      and publication['state'] == 'verified'
                      and publication['actual'] == publication['expected']
                      and len(publication['actual']) == 1)
                check('provider received no inference', all(hit['method'] == 'GET' for hit in Stub.hits))
                report['asset_downloads'] = Asset.gets
                report['passed'] = True
                if args.keep_alive:
                    if args.hermes_fixture:
                        HermesStub.enabled = True
                    private = args.out / 'browser-auth.json'
                    descriptor = os.open(private, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                    with os.fdopen(descriptor, 'w') as stream:
                        json.dump({'panel_token': panel_token, 'username': username,
                                   'password': password,
                                   **({'api_key': key_secret, 'model': publication['expected'][0],
                                       'expected_reply': HermesStub.reply,
                                       'gateway_url': gateway + '/v1'} if args.hermes_fixture else {})}, stream)
                    report_path.write_text(json.dumps(report, indent=2) + '\n')
                    print('Disposable browser fixture ready on ports 8080 and 8099.', flush=True)
                    assertion_path = args.out / 'hermes-fixture-report.json'
                    trigger = args.out / 'hermes-assert'
                    while True:
                        if args.hermes_fixture and trigger.exists() and not assertion_path.exists():
                            try:
                                denied_model = 'openai/upstream-beta'
                                before = len(HermesStub.post_hits)
                                denied_status, _, _ = call(gateway, '/v1/chat/completions', 'POST',
                                                           {'model': denied_model, 'messages': [
                                                               {'role': 'user', 'content': 'Fixture denial probe'}],
                                                            'stream': False},
                                                           auth='Bearer ' + key_secret)
                                assertion = {'scope': 'Hermes synthetic fixture only; no real provider',
                                             'client_provider_posts': before,
                                             'provider_models': [hit['model'] for hit in HermesStub.post_hits],
                                             'denied_model_status': denied_status,
                                             'denied_reached_provider': len(HermesStub.post_hits) != before}
                                assertion['passed'] = (before == 1
                                                       and all(hit['path'] in ('/chat/completions', '/v1/chat/completions')
                                                               for hit in HermesStub.post_hits)
                                                       and denied_status == 403
                                                       and not assertion['denied_reached_provider'])
                            except Exception as error:
                                assertion = {'passed': False, 'error_type': type(error).__name__}
                            assertion_path.write_text(json.dumps(assertion, indent=2) + '\n')
                        time.sleep(1)
            finally:
                (args.out / 'browser-auth.json').unlink(missing_ok=True)
                stop()
    except Exception as error:
        report['passed'] = False
        detail = str(error)
        for secret in (password, panel_token, basic, key_secret, 'synthetic-provider-key'):
            if secret:
                detail = detail.replace(secret, '[redacted]')
        report['error'] = type(error).__name__ + ': ' + detail[:500]
    finally:
        if process or log:
            stop()
        for srv in servers:
            srv.shutdown()
            srv.server_close()
        report['gateway_stopped'] = process is None
        report['fixture_removed'] = temporary is None or not Path(temporary).exists()
        report['browser_auth_removed'] = not (args.out / 'browser-auth.json').exists()
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        report_path.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'passed': report.get('passed', False), 'checks': len(report['checks']),
                      'report': str(report_path)}), flush=True)
    return 0 if report.get('passed') else 1


if __name__ == '__main__':
    sys.exit(main())
