#!/usr/bin/env python3
"""Exercise the proposed native plugin UI on an isolated candidate, never production."""
import argparse
import base64
import copy
from contextlib import ExitStack
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
    parser.add_argument('--legacy-plugin', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--keep-alive', action='store_true', help='Keep disposable fixture for browser QA')
    args = parser.parse_args()
    args.gateway = args.gateway.resolve(strict=True)
    args.plugin = args.plugin.resolve(strict=True)
    args.legacy_plugin = args.legacy_plugin.resolve(strict=True)
    args.out.mkdir(parents=True, exist_ok=True)
    report_path = args.out / 'report.json'
    if report_path.exists():
        raise SystemExit('Choose a fresh output directory')
    interfaces = sorted(p.name for p in Path('/sys/class/net').iterdir())
    if not args.keep_alive and interfaces != ['lo']:
        raise SystemExit('Automated proof requires Docker --network none')
    report = {'scope': 'local candidate only; synthetic provider; no inference',
              'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'official_release_verified': False, 'checks': [],
              'network_interfaces': interfaces,
              'artifacts': {'gateway': digest(args.gateway), 'plugin': digest(args.plugin),
                            'legacy_plugin': digest(args.legacy_plugin)}}
    process = log = None
    servers = []
    prefix = '/plugins/bifrost-registry/'
    base = 'http://127.0.0.1:8080'
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    username, password = 'fixture-admin', secrets.token_urlsafe(24)
    auth = 'Basic ' + base64.b64encode(f'{username}:{password}'.encode()).decode()

    def check(name, condition, **metadata):
        report['checks'].append({'name': name, 'pass': bool(condition), **metadata})
        if not condition:
            raise AssertionError(name)

    def call(path, method='GET', body=None, headers=None, authenticated=True):
        h = {'Authorization': auth} if authenticated else {}
        h.update(headers or {})
        payload = None if body is None else json.dumps(body).encode()
        if payload is not None:
            h['Content-Type'] = 'application/json'
        req = urllib.request.Request(base + path, data=payload, method=method, headers=h)
        try:
            response = opener.open(req, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read(8 << 20)
            try:
                body = json.loads(raw)
            except ValueError:
                body = raw.decode(errors='replace')
            return response.status, body, dict(response.headers)

    def server(handler):
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

    class Asset(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            artifact = {'/registry.so': args.plugin, '/legacy.so': args.legacy_plugin}.get(self.path)
            if artifact is None:
                self.send_error(404)
                return
            payload = artifact.read_bytes()
            self.send_response(200)
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *_args):
            pass

    try:
        with ExitStack() as stack:
            temporary = stack.enter_context(tempfile.TemporaryDirectory(prefix='native-plugin-ui-'))
            stack.callback(stop)
            app = Path(temporary)
            pricing = app / 'pricing.json'
            pricing.write_text('{}')
            (app / 'parameters.json').write_text('{}')
            stub_port = server(Stub)
            asset_port = server(Asset)
            config = {'version': 2,
                      'governance': {'auth_config': {'is_enabled': True, 'admin_username': username, 'admin_password': password}},
                      'client': {'enforce_auth_on_inference': True},
                      'server': {'read_buffer_size': 65536, 'plugin_download_private_allowlist': ['127.0.0.1']},
                      'config_store': {'enabled': True, 'type': 'sqlite', 'config': {'path': str(app / 'config.db')}},
                      'framework': {'pricing': {'pricing_url': pricing.as_uri(), 'model_parameters_url': (app / 'parameters.json').as_uri(), 'pricing_sync_interval': 86400}},
                      'providers': {'openai': {'network_config': {'base_url': f'http://127.0.0.1:{stub_port}', 'allow_private_network': True},
                                               'keys': [{'id': 'fixture-provider-key', 'name': 'Isolated stub', 'value': 'synthetic-provider-key', 'weight': 1, 'models': ['*']}]}},
                      'plugins': []}
            (app / 'config.json').write_text(json.dumps(config))

            def start():
                nonlocal process, log
                log = (app / 'gateway.log').open('ab')
                process = subprocess.Popen([str(args.gateway), '-app-dir', str(app), '-host', '0.0.0.0' if args.keep_alive else '127.0.0.1', '-port', '8080'],
                                           stdout=log, stderr=subprocess.STDOUT,
                                           env={'PATH': os.environ.get('PATH', '/usr/bin:/bin')})
                for _ in range(150):
                    if process.poll() is not None:
                        tail = (app / 'gateway.log').read_text(errors='replace')[-12000:]
                        for secret in (password, auth, 'synthetic-provider-key'):
                            tail = tail.replace(secret, '[redacted]')
                        report['startup_log'] = tail
                        raise RuntimeError('gateway exited before readiness')
                    try:
                        if call('/api/plugins')[0] == 200:
                            return
                    except (OSError, TimeoutError):
                        pass
                    time.sleep(.2)
                raise RuntimeError('gateway readiness timed out')

            start()
            plugin_config = {'name': 'bifrost-registry', 'enabled': True,
                             'path': f'http://127.0.0.1:{asset_port}/registry.so',
                             'placement': 'pre_builtin', 'config': {}}
            status, _, _ = call('/api/plugins', 'POST', plugin_config)
            check('plugin URL install with empty plugin config', status in (200, 201), status=status)
            status, menu, _ = call('/api/plugin-ui')
            check('native contribution listing', status == 200 and 'bifrost-registry' in json.dumps(menu), status=status)
            status, html, _ = call(prefix)
            check('embedded UI served', status == 200 and isinstance(html, str) and '<html' in html, status=status)
            assets = re.findall(r'(?:src|href)="([^"]+\.(?:js|css))"', html)
            check('embedded UI references built assets', bool(assets))
            for asset in assets:
                path = asset if asset.startswith('/') else prefix + asset.removeprefix('./')
                status, _, _ = call(path)
                check('embedded static asset', status == 200, path=path, status=status)
            for path in (prefix, prefix + 'api/workspace', '/api/plugin-ui'):
                status, _, _ = call(path, authenticated=False)
                check('native auth protects plugin surface', status in (401, 403), path=path, status=status)
            status, _, _ = call(prefix, headers={'Authorization': 'Basic aW52YWxpZDppbnZhbGlk'})
            check('invalid session rejected', status in (401, 403), status=status)
            status, _, _ = call(prefix + 'api/workspace', 'PUT', {}, {'Origin': 'https://foreign.invalid'})
            check('cross-origin write rejected', status == 403, status=status)
            status, _, _ = call(prefix + '%2e%2e/config.json')
            check('asset traversal refused', status in (400, 403, 404), status=status)
            status, ws, _ = call(prefix + 'api/workspace')
            check('native API bridge workspace', status == 200 and isinstance(ws, dict) and ws.get('connection', {}).get('connected'), status=status)
            check('synthetic provider discovery', bool(ws.get('discovery')))
            model = copy.deepcopy(ws['discovery'][0])
            model.update(tasks=['Chat'], inputModalities=['Text'], outputModalities=['Text'], kind='Chat')
            ws['data']['models'].append(model)
            ws['data']['groups'].append({'id': 'persisted-proof', 'name': 'Persisted proof', 'description': 'Native plugin UI integration', 'members': [model['id']]})
            status, saved, _ = call(prefix + 'api/workspace', 'PUT', {'data': ws['data']}, {'If-Match': ws['revision']})
            check('workspace write via native route', status == 200, status=status)
            status, fresh, _ = call(prefix + 'api/workspace')
            check('workspace write read back', status == 200 and any(g['id'] == 'persisted-proof' for g in fresh.get('data', {}).get('groups', [])))
            status, created, _ = call(prefix + 'api/keys', 'POST', {'name': 'Isolated proof key', 'client': 'Fixture'})
            check('native virtual key created through plugin', status == 201 and 'workspace' in created, status=status)
            key_id = created['created']['id']
            fresh = created['workspace']
            key = next(k for k in fresh['data']['keys'] if k['id'] == key_id)
            key['policy']['groups'] = ['persisted-proof']
            status, fresh, _ = call(prefix + 'api/workspace', 'PUT', {'data': fresh['data']}, {'If-Match': fresh['revision']})
            check('native key policy published', status == 200, status=status)
            status, fresh, _ = call(prefix + 'api/keys/' + key_id + '/readback', 'POST')
            publication = next(k['publication'] for k in fresh.get('data', {}).get('keys', []) if k['id'] == key_id)
            check('independent models readback preserves VK credentials', status == 200 and publication['state'] == 'verified'
                  and publication['actual'] == publication['expected'] and len(publication['actual']) == 1,
                  state=publication['state'], actual=publication['actual'])
            check('workspace hides virtual key secret', created['created']['secret'] not in json.dumps(fresh))
            status, _, _ = call('/api/plugins/bifrost-registry', 'PUT', {**plugin_config, 'enabled': False})
            check('disable accepted', status == 200, status=status)
            status, _, _ = call(prefix)
            check('disabled plugin has no active UI', status in (403, 404), status=status)
            status, menu, _ = call('/api/plugin-ui')
            check('disabled navigation removed', status == 200 and 'bifrost-registry' not in json.dumps(menu))
            status, reactivation, _ = call('/api/plugins/bifrost-registry', 'PUT', plugin_config)
            check('reactivation accepted', status == 200, status=status,
                  error=reactivation.get('error') if isinstance(reactivation, dict) else None)
            check('reactivated UI restored', call(prefix)[0] == 200)
            stop()
            start()
            status, fresh, _ = call(prefix + 'api/workspace')
            check('workspace and plugin survive restart', status == 200 and any(g['id'] == 'persisted-proof' for g in fresh.get('data', {}).get('groups', [])), status=status)
            status, menu, _ = call('/api/plugin-ui')
            check('single navigation entry after restart', status == 200 and json.dumps(menu).count('"name": "bifrost-registry"') == 1)
            check('native provider API still available', call('/api/providers')[0] == 200)
            status, _, _ = call('/api/plugins/bifrost-registry', 'DELETE')
            check('plugin removal accepted', status == 200, status=status)
            check('removed UI inaccessible', call(prefix)[0] in (403, 404))
            check('removed navigation absent', 'bifrost-registry' not in json.dumps(call('/api/plugin-ui')[1]))
            status, _, _ = call('/api/plugins', 'POST', {'name': 'bifrost-registry', 'enabled': True,
                                                       'path': f'http://127.0.0.1:{asset_port}/missing.so', 'config': {}})
            check('failed install rejected', status >= 400, status=status)
            check('failed install has no UI', call(prefix)[0] in (403, 404))
            check('failed install has no navigation', 'bifrost-registry' not in json.dumps(call('/api/plugin-ui')[1]))
            status, _, _ = call('/api/plugins', 'POST', {'name': 'legacy-hook-proof', 'enabled': True,
                                                       'path': f'http://127.0.0.1:{asset_port}/legacy.so',
                                                       'placement': 'pre_builtin', 'config': {}})
            check('plugin without UI extension loads', status in (200, 201), status=status)
            status, result, headers = call('/v1/chat/completions', 'POST', {'model': 'synthetic', 'messages': []},
                                            {'X-Legacy-Plugin-Probe': '1'})
            check('legacy hook executes without provider', status == 200 and isinstance(result, dict) and result.get('id') == 'legacy-hook-proof', status=status)
            check('legacy plugin has no UI contribution', 'legacy-hook-proof' not in json.dumps(call('/api/plugin-ui')[1]))
            check('legacy plugin removed', call('/api/plugins/legacy-hook-proof', 'DELETE')[0] == 200)
            status, _, _ = call('/api/plugins', 'POST', {'name': 'bifrost-registry', 'enabled': True,
                                                       'path': f'http://127.0.0.1:{asset_port}/registry.so',
                                                       'placement': 'pre_builtin', 'config': {}})
            check('reinstall after removal accepted', status in (200, 201), status=status)
            status, fresh, _ = call(prefix + 'api/workspace')
            check('reinstall retains workspace', status == 200 and any(g['id'] == 'persisted-proof' for g in fresh.get('data', {}).get('groups', [])))
            check('provider never received inference', all(hit['method'] == 'GET' for hit in Stub.hits))
            report['passed'] = True
            report_path.write_text(json.dumps(report, indent=2) + '\n')
            print(json.dumps({'passed': True, 'checks': len(report['checks'])}), flush=True)
            if args.keep_alive:
                private = args.out / 'browser-auth.json'
                private.write_text(json.dumps({'username': username, 'password': password}))
                private.chmod(0o600)
                print('Disposable browser fixture ready on port 8080.', flush=True)
                try:
                    while True:
                        time.sleep(1)
                finally:
                    private.unlink(missing_ok=True)
    except Exception as error:
        report['passed'] = False
        report['error'] = type(error).__name__ + ': ' + str(error)
        raise
    finally:
        stop()
        for srv in servers:
            srv.shutdown()
            srv.server_close()
        report['gateway_stopped'] = process is None
        report_path.write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
