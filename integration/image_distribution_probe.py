#!/usr/bin/env python3
"""Probe a packaged, plugin-free Bifrost image plus a separately hosted .so.

Run on the Docker host with --image, --plugin and a fresh --out directory.
The helper image must already be local. Only disposable named Docker objects are used.
"""
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import http.server
import json
import os
from pathlib import Path
import secrets
import shutil
import sqlite3
import subprocess
import sys
import time
import traceback
import urllib.error
import urllib.request

from isolated_models import Stub, digest


HELPER = 'python:3.13-alpine'
ASSET = Path('/asset/plugin.so')
PREVIOUS_ASSET = Path('/asset/previous.so')
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def docker(*args, input_text=None, timeout=60, env=None):
    result = subprocess.run(['docker', *args], input=input_text, text=True,
                            capture_output=True, timeout=timeout, env=env)
    if result.returncode:
        raise RuntimeError('docker ' + args[0] + ' failed')
    return result.stdout.strip()


def request(base, path, auth=None, method='GET', body=None, headers=None):
    h = dict(headers or {})
    if auth:
        h['Authorization'] = auth
    data = None if body is None else json.dumps(body).encode()
    if data is not None:
        h['Content-Type'] = 'application/json'
    req = urllib.request.Request(base + path, data=data, headers=h, method=method)
    try:
        response = OPENER.open(req, timeout=8)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read(8 << 20)
        try:
            value = json.loads(raw)
        except ValueError:
            value = raw.decode(errors='replace')
        return response.status, value


def fixture():
    class Handler(Stub):
        downloads = 0
        previous_downloads = 0
        served = []

        def do_GET(self):
            if self.path in ('/plugin.so', '/previous.so'):
                asset = ASSET if self.path == '/plugin.so' else PREVIOUS_ASSET
                payload = asset.read_bytes()
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                if self.path == '/plugin.so':
                    Handler.downloads += 1
                else:
                    Handler.previous_downloads += 1
                Handler.served.append({'path': self.path, 'sha256': hashlib.sha256(payload).hexdigest()})
            elif self.path == '/__stats':
                payload = json.dumps({'downloads': Handler.downloads,
                                      'previous_downloads': Handler.previous_downloads,
                                      'served': Handler.served,
                                      'inference': any(hit['method'] == 'POST' for hit in Stub.hits)}).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            else:
                super().do_GET()

    http.server.ThreadingHTTPServer(('0.0.0.0', 9000), Handler).serve_forever()


def init_volume():
    config = json.load(sys.stdin)
    app = Path('/app/data')
    app.chmod(0o700)
    os.chown(app, 1000, 0)
    for name, value in (('config.json', config), ('pricing.json', {}), ('parameters.json', {})):
        path = app / name
        path.write_text(json.dumps(value) + '\n')
        os.chown(path, 1000, 0)
        path.chmod(0o600)


def copy_volume():
    source, target = Path('/source'), Path('/target')
    for child in target.iterdir():
        shutil.rmtree(child) if child.is_dir() and not child.is_symlink() else child.unlink()
    files = {}

    def copy(source_path, target_path):
        if source_path.is_symlink():
            raise RuntimeError('volume contains a symlink')
        if source_path.is_dir():
            target_path.mkdir(exist_ok=True)
            for child in source_path.iterdir():
                copy(child, target_path / child.name)
        else:
            shutil.copy2(source_path, target_path)
            files[str(source_path.relative_to(source))] = digest(target_path)
        shutil.copystat(source_path, target_path)
        os.chown(target_path, source_path.stat().st_uid, source_path.stat().st_gid)

    copy(source, target)
    registry = json.loads((source / 'registry/registry.json').read_text())
    print(json.dumps({'files': files, 'registry_has_catalog': 'catalog' in registry}))


def switch_url(old, new):
    with sqlite3.connect('/app/data/config.db') as db:
        row = db.execute('SELECT path FROM config_plugins WHERE name = ?', ('bifrost-registry',)).fetchone()
        if row != (old,):
            raise RuntimeError('saved plugin URL differs from expected prior URL')
        changed = db.execute('UPDATE config_plugins SET path = ? WHERE name = ?',
                             (new, 'bifrost-registry')).rowcount
        if changed != 1:
            raise RuntimeError('expected exactly one plugin row')


def host(args):
    plugin = args.plugin.resolve(strict=True)
    previous = args.previous_plugin.resolve(strict=True) if args.previous_plugin else None
    if not plugin.is_file() or (previous and not previous.is_file()) or args.out.exists():
        raise SystemExit('Plugins must be files and --out must be fresh')
    args.out.mkdir(parents=True)
    suffix = secrets.token_hex(6)
    network, volume = 'registry-probe-net-' + suffix, 'registry-probe-data-' + suffix
    backup = 'registry-probe-backup-' + suffix
    gateway, fixture_name = 'registry-probe-gateway-' + suffix, 'registry-probe-fixture-' + suffix
    names = (gateway, fixture_name)
    image = args.image
    password, panel_token = secrets.token_urlsafe(24), secrets.token_urlsafe(32)
    basic = 'Basic ' + base64.b64encode(('fixture-admin:' + password).encode()).decode()
    report = {'scope': 'packaged image plus separate plugin URL; synthetic provider; no inference',
              'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'image': image, 'plugin_sha256': digest(plugin), 'checks': [],
              'prior_probe': 'reports/plugin-standalone/final/report.json (38 checks; separate binary proof)'}
    if previous:
        report['previous_plugin_sha256'] = digest(previous)
        report['scope'] += '; stopped-volume upgrade and rollback'
    created = {'network': False, 'volume': False, 'backup': False}

    def check(name, passed, **details):
        report['checks'].append({'name': name, 'pass': bool(passed), **details})
        if not passed:
            raise AssertionError(name)

    def plugin_state(base):
        code, listed = request(base, '/api/plugins', basic)
        loaded_code, loaded = request(base, '/api/plugins/loaded', basic)
        rows = listed.get('plugins', []) if isinstance(listed, dict) else []
        names = loaded.get('plugins', []) if isinstance(loaded, dict) else []
        return code, loaded_code, rows, names

    def stats():
        raw = docker('exec', fixture_name, 'python', '-c',
                     "import json,urllib.request; print(urllib.request.urlopen('http://127.0.0.1:9000/__stats').read().decode())")
        return json.loads(raw)

    def copy_data(source, target):
        raw = docker('run', '--rm', '--pull', 'never', '--network', 'none', '--user', '0',
                     '-v', source + ':/source:ro', '-v', target + ':/target',
                     '-v', str(Path(__file__).resolve()) + ':/probe.py:ro',
                     '-v', str(Path(__file__).with_name('isolated_models.py').resolve()) + ':/isolated_models.py:ro',
                     HELPER, 'python', '/probe.py', '--copy-volume')
        return json.loads(raw)

    def set_saved_url(old, new):
        docker('run', '--rm', '--pull', 'never', '--network', 'none', '--user', '0',
               '-v', volume + ':/app/data',
               '-v', str(Path(__file__).resolve()) + ':/probe.py:ro',
               '-v', str(Path(__file__).with_name('isolated_models.py').resolve()) + ':/isolated_models.py:ro',
               HELPER, 'python', '/probe.py', '--switch-url', '--old-url', old, '--new-url', new)

    def start_gateway():
        docker('run', '--pull', 'never', '-d', '--name', gateway, '--network', network,
               '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
               '-v', volume + ':/app/data', '-p', '127.0.0.1::8080',
               '-p', '127.0.0.1::8099', '-e', 'REGISTRY_ADMIN_TOKEN',
               '-e', 'BIFROST_ADMIN_AUTH', image,
               env={**os.environ, 'REGISTRY_ADMIN_TOKEN': panel_token,
                    'BIFROST_ADMIN_AUTH': basic})
        ports = json.loads(docker('inspect', '-f', '{{json .NetworkSettings.Ports}}', gateway))
        check('published ports bound only to loopback',
              all(ports.get(key) and ports[key][0]['HostIp'] == '127.0.0.1'
                  for key in ('8080/tcp', '8099/tcp')))
        base = 'http://127.0.0.1:' + ports['8080/tcp'][0]['HostPort']
        panel = 'http://127.0.0.1:' + ports['8099/tcp'][0]['HostPort']
        for _ in range(120):
            if docker('inspect', '-f', '{{.State.Running}}', gateway) != 'true':
                raise RuntimeError('gateway exited before readiness')
            try:
                if plugin_state(base)[0] == 200:
                    return base, panel
            except (OSError, ValueError):
                pass
            time.sleep(.25)
        raise RuntimeError('gateway readiness timed out')

    try:
        metadata = json.loads(docker('image', 'inspect', image))[0]
        config = metadata['Config']
        report['image_id'] = metadata['Id']
        report['architecture'] = metadata['Os'] + '/' + metadata['Architecture']
        check('packaged entrypoint and command', config.get('Entrypoint') == ['/app/docker-entrypoint.sh']
              and config.get('Cmd') == ['/app/main'])
        check('packaged app directory and user', config.get('User') in ('1000:0', '1000')
              and config.get('Env') is not None
              and 'APP_DIR=/app/data' in config['Env'])
        check('image exposes gateway port', '8080/tcp' in (config.get('ExposedPorts') or {}))
        binary_hash = docker('run', '--rm', '--pull', 'never', '--network', 'none',
                             '--entrypoint', '/bin/sh', image, '-c', 'sha256sum /app/main')
        report['packaged_binary_sha256'] = binary_hash.split()[0]
        check('packaged gateway binary hashed', len(report['packaged_binary_sha256']) == 64)
        app_so = docker('run', '--rm', '--pull', 'never', '--network', 'none',
                        '--entrypoint', '/bin/sh', image, '-c', "find /app -type f -name '*.so' -print")
        check('no plugin shared object bundled under /app', not app_so)
        docker('network', 'create', network)
        created['network'] = True
        docker('volume', 'create', volume)
        created['volume'] = True
        config_json = {
            'version': 2,
            'governance': {'auth_config': {'is_enabled': True,
                                           'admin_username': 'fixture-admin',
                                           'admin_password': password}},
            'client': {'enforce_auth_on_inference': True},
            'server': {'read_buffer_size': 65536,
                       'plugin_download_private_allowlist': ['fixture']},
            'config_store': {'enabled': True, 'type': 'sqlite',
                             'config': {'path': '/app/data/config.db'}},
            'framework': {'pricing': {'pricing_url': 'file:///app/data/pricing.json',
                                      'model_parameters_url': 'file:///app/data/parameters.json',
                                      'pricing_sync_interval': 86400}},
            'providers': {'openai': {'network_config': {'base_url': 'http://fixture:9000',
                                                        'allow_private_network': True},
                                     'keys': [{'id': 'fixture-provider-key', 'name': 'Synthetic fixture',
                                               'value': 'synthetic-provider-key', 'weight': 1,
                                               'models': ['*']}]}},
            'plugins': []}
        docker('run', '--rm', '--pull', 'never', '--network', 'none', '-i', '--user', '0',
               '-v', volume + ':/app/data', '-v', str(Path(__file__).resolve()) + ':/probe.py:ro',
               '-v', str(Path(__file__).with_name('isolated_models.py').resolve()) + ':/isolated_models.py:ro',
               HELPER, 'python', '/probe.py', '--init', input_text=json.dumps(config_json))
        fixture_mounts = ['-v', str(plugin) + ':' + str(ASSET) + ':ro']
        if previous:
            fixture_mounts += ['-v', str(previous) + ':' + str(PREVIOUS_ASSET) + ':ro']
        docker('run', '--pull', 'never', '-d', '--name', fixture_name, '--network', network,
               '--network-alias', 'fixture', '--cap-drop', 'ALL',
               '--security-opt', 'no-new-privileges', *fixture_mounts,
               '-v', str(Path(__file__).resolve()) + ':/probe.py:ro',
               '-v', str(Path(__file__).with_name('isolated_models.py').resolve()) + ':/isolated_models.py:ro',
               HELPER, 'python', '/probe.py', '--fixture')
        base, panel = start_gateway()
        code, loaded_code, rows, loaded = plugin_state(base)
        check('initial custom plugin list empty', code == loaded_code == 200
              and rows == [], list_status=code, loaded_status=loaded_code,
              saved_names=[row.get('name') for row in rows], loaded_names=loaded)
        try:
            request(panel, '/')
            panel_absent = False
        except (OSError, TimeoutError):
            panel_absent = True
        check('registry panel absent before URL installation', panel_absent)
        initial_url = 'http://fixture:9000/previous.so' if previous else 'http://fixture:9000/plugin.so'
        current_url = 'http://fixture:9000/plugin.so'
        plugin_config = {'name': 'bifrost-registry', 'enabled': True,
                         'path': initial_url,
                         'placement': args.placement, 'order': 0,
                         'config': {'registry_path': '/app/data/registry/registry.json',
                                    'admin_listen': '0.0.0.0:8099',
                                    'admin_token_env': 'REGISTRY_ADMIN_TOKEN',
                                    'bifrost_url': 'http://127.0.0.1:8080',
                                    'bifrost_auth_env': 'BIFROST_ADMIN_AUTH'}}
        code, _ = request(base, '/api/plugins', basic, 'POST', plugin_config)
        first_stats = stats()
        first_count = first_stats['previous_downloads'] if previous else first_stats['downloads']
        first_hash = report['previous_plugin_sha256'] if previous else report['plugin_sha256']
        check('plugin installed through separate fixture URL', code == 201 and first_count == 1
              and first_stats['served'][-1] == {'path': '/previous.so' if previous else '/plugin.so',
                                                'sha256': first_hash},
              status=code)
        code, loaded_code, rows, loaded = plugin_state(base)
        row = next((r for r in rows if r.get('name') == 'bifrost-registry'), None)
        check('installed plugin active and loaded', code == loaded_code == 200
              and row is not None and row.get('path') == plugin_config['path']
              and row.get('status', {}).get('status') == 'active'
              and 'bifrost-registry' in loaded)
        code, html = request(panel, '/')
        check('standalone panel served from plugin', code == 200 and isinstance(html, str)
              and 'Model Registry' in html, status=code)
        code, _ = request(panel, '/api/workspace')
        check('anonymous panel API refused', code == 401, status=code)
        code, workspace = request(panel, '/api/workspace', 'Bearer ' + panel_token)
        check('workspace connected to packaged gateway', code == 200
              and isinstance(workspace, dict)
              and workspace.get('connection', {}).get('connected') is True
              and bool(workspace.get('discovery')), status=code)
        model = dict(workspace['discovery'][0])
        model.update(tasks=['Chat'], inputModalities=['Text'], outputModalities=['Text'], kind='Chat')
        workspace['data']['models'].append(model)
        workspace['data']['groups'].append({'id': 'image-proof', 'name': 'Image proof',
                                             'description': 'Separate plugin distribution',
                                             'members': [model['id']]})
        code, _ = request(panel, '/api/workspace', 'Bearer ' + panel_token, 'PUT',
                          {'data': workspace['data']}, {'If-Match': workspace['revision']})
        check('model and group saved to persistent volume', code == 200, status=code)
        if previous:
            old_catalog_status, _ = request(panel, '/api/catalog', 'Bearer ' + panel_token)
            check('previous plugin has no catalogue API', old_catalog_status == 404,
                  status=old_catalog_status)
            docker('rm', '-f', gateway)
            docker('volume', 'create', backup)
            created['backup'] = True
            saved = copy_data(volume, backup)
            report['stopped_backup_files'] = saved['files']
            check('stopped backup includes SQLite and legacy Registry JSON',
                  'config.db' in saved['files'] and 'registry/registry.json' in saved['files']
                  and saved['registry_has_catalog'] is False)
            set_saved_url(initial_url, current_url)
            base, panel = start_gateway()
            code, loaded_code, rows, loaded = plugin_state(base)
            row = next((r for r in rows if r.get('name') == 'bifrost-registry'), None)
            served = stats()
            check('candidate loaded after restart from a different URL',
                  code == loaded_code == 200 and row is not None
                  and row.get('status', {}).get('status') == 'active'
                  and row.get('path') == current_url and 'bifrost-registry' in loaded
                  and served['downloads'] == 1
                  and {'path': '/plugin.so', 'sha256': report['plugin_sha256']} in served['served'])
            code, fresh = request(panel, '/api/workspace', 'Bearer ' + panel_token)
            check('candidate reads legacy model and group', code == 200
                  and any(m.get('id') == model['id'] for m in fresh.get('data', {}).get('models', []))
                  and any(g.get('id') == 'image-proof' for g in fresh.get('data', {}).get('groups', [])),
                  status=code)
            catalog_status, catalog = request(panel, '/api/catalog', 'Bearer ' + panel_token)
            check('candidate exposes catalogue after legacy load', catalog_status == 200
                  and isinstance(catalog, dict) and 'revision' in catalog, status=catalog_status)
            docker('rm', '-f', gateway)
            restored = copy_data(backup, volume)
            check('complete stopped-volume backup restored before rollback',
                  restored == saved)
            base, panel = start_gateway()
            code, loaded_code, rows, loaded = plugin_state(base)
            row = next((r for r in rows if r.get('name') == 'bifrost-registry'), None)
            served = stats()
            check('previous plugin URL and exact bytes restored after restart',
                  code == loaded_code == 200 and row is not None
                  and row.get('status', {}).get('status') == 'active'
                  and row.get('path') == initial_url and 'bifrost-registry' in loaded
                  and served['previous_downloads'] == 2
                  and served['served'][-1] == {'path': '/previous.so',
                                              'sha256': report['previous_plugin_sha256']})
            code, fresh = request(panel, '/api/workspace', 'Bearer ' + panel_token)
            check('previous plugin reads restored group', code == 200
                  and any(g.get('id') == 'image-proof' for g in fresh.get('data', {}).get('groups', [])),
                  status=code)
            old_catalog_status, _ = request(panel, '/api/catalog', 'Bearer ' + panel_token)
            check('rollback restored legacy API shape', old_catalog_status == 404,
                  status=old_catalog_status)
        else:
            docker('rm', '-f', gateway)
            base, panel = start_gateway()
            code, loaded_code, rows, loaded = plugin_state(base)
            row = next((r for r in rows if r.get('name') == 'bifrost-registry'), None)
            check('URL plugin reloaded after container recreation', code == loaded_code == 200
                  and row is not None and row.get('status', {}).get('status') == 'active'
                  and row.get('path') == plugin_config['path']
                  and 'bifrost-registry' in loaded and stats()['downloads'] == 2)
            code, fresh = request(panel, '/api/workspace', 'Bearer ' + panel_token)
            check('panel and saved workspace persist after recreation', code == 200
                  and any(m.get('id') == model['id'] for m in fresh.get('data', {}).get('models', []))
                  and any(g.get('id') == 'image-proof' for g in fresh.get('data', {}).get('groups', [])),
                  status=code)
        check('synthetic fixture received no inference', stats()['inference'] is False)
    except Exception as error:
        report['error'] = (str(error) if isinstance(error, (AssertionError, RuntimeError))
                           else type(error).__name__)
        report['error_at'] = [{'function': frame.name, 'line': frame.lineno}
                              for frame in traceback.extract_tb(error.__traceback__)
                              if Path(frame.filename).resolve() == Path(__file__).resolve()]
    finally:
        cleanup = {}
        for name in names:
            cleanup[name] = subprocess.run(['docker', 'rm', '-f', name], capture_output=True).returncode == 0
        if created['network']:
            cleanup['network'] = subprocess.run(['docker', 'network', 'rm', network],
                                                capture_output=True).returncode == 0
        if created['volume']:
            cleanup['volume'] = subprocess.run(['docker', 'volume', 'rm', volume],
                                               capture_output=True).returncode == 0
        if created['backup']:
            cleanup['backup'] = subprocess.run(['docker', 'volume', 'rm', backup],
                                               capture_output=True).returncode == 0
        report['cleanup'] = cleanup
        report['passed'] = ('error' not in report and len(report['checks']) >= 10
                            and all(item['pass'] for item in report['checks'])
                            and all(cleanup.values()))
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        (args.out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--init', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--copy-volume', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--switch-url', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--old-url', help=argparse.SUPPRESS)
    parser.add_argument('--new-url', help=argparse.SUPPRESS)
    parser.add_argument('--image', help='Already built packaged gateway image')
    parser.add_argument('--plugin', type=Path)
    parser.add_argument('--previous-plugin', type=Path,
                        help='Prior compatible .so for stopped-volume upgrade and rollback proof')
    parser.add_argument('--out', type=Path)
    parser.add_argument('--placement', choices=('pre_builtin', 'post_builtin'), default='post_builtin')
    args = parser.parse_args()
    if args.fixture:
        fixture()
    elif args.init:
        init_volume()
    elif args.copy_volume:
        copy_volume()
    elif args.switch_url and args.old_url and args.new_url:
        switch_url(args.old_url, args.new_url)
    elif args.image and args.plugin and args.out:
        sys.exit(host(args))
    else:
        parser.error('--image, --plugin and --out are required')
