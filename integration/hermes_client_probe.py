#!/usr/bin/env python3
"""Exercise Hermes model discovery and one chat turn against a local gateway.

Credentials JSON (mode 0600): gateway_url (ending /v1), api_key, model,
expected_reply. Optional panel_url and panel_token are accepted for the
caller's fixture bookkeeping; this probe does not call the Registry panel.
"""
import argparse
from datetime import datetime, timezone
import ipaddress
import json
import os
from pathlib import Path
import socket
import stat
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit


DEFAULT_SOURCE = Path.home() / '.hermes/hermes-agent'
DEFAULT_PYTHON = DEFAULT_SOURCE / 'venv/bin/python'
MARKER = 'HERMES_PROBE_RESULT='


def loopback_url(value):
    try:
        url = urlsplit(value)
        return (url.scheme == 'http' and url.hostname in ('127.0.0.1', '::1')
                and url.port is not None and not url.username and not url.password
                and not url.query and not url.fragment and url.path.rstrip('/').endswith('/v1'))
    except ValueError:
        return False


def inside(source):
    """Run only under the isolated Hermes venv, with credentials on stdin."""
    phase = 'startup'
    try:
        credentials = json.load(sys.stdin)
        sys.path.insert(0, str(source))
        base = credentials['gateway_url'].rstrip('/')
        key = credentials['api_key']
        model = credentials['model']

        # Defense in depth: a misrouted Hermes request cannot reach a public API.
        original_connect = socket.socket.connect
        original_connect_ex = socket.socket.connect_ex

        def local_address(address):
            if not isinstance(address, tuple):
                return True  # local Unix sockets
            try:
                return ipaddress.ip_address(address[0]).is_loopback
            except ValueError:
                return False

        def guarded_connect(sock, address):
            if not local_address(address):
                raise OSError('non-loopback socket blocked')
            return original_connect(sock, address)

        def guarded_connect_ex(sock, address):
            if not local_address(address):
                raise OSError('non-loopback socket blocked')
            return original_connect_ex(sock, address)

        socket.socket.connect = guarded_connect
        socket.socket.connect_ex = guarded_connect_ex

        phase = 'discovery'
        from hermes_cli.models import fetch_api_models
        discovered = fetch_api_models(key, base, timeout=5)
        listed = isinstance(discovered, list) and model in discovered
        if not listed:
            result = {'phase': phase, 'discovered': listed,
                      'model_count': len(discovered) if isinstance(discovered, list) else None}
        else:
            phase = 'chat'
            from run_agent import AIAgent
            agent = AIAgent(base_url=base, api_key=key, provider='openai',
                            api_mode='chat_completions', model=model,
                            max_iterations=1, enabled_toolsets=[], disabled_toolsets=[],
                            save_trajectories=False, quiet_mode=True,
                            skip_context_files=True, skip_memory=True,
                            skip_background_review=True, session_db=None)
            tool_count = len(agent.tools or [])
            if tool_count:
                result = {'phase': phase, 'discovered': True,
                          'model_count': len(discovered), 'tool_count': tool_count,
                          'reply_matches': False}
            else:
                reply = agent.chat('Reply with the exact fixture marker and no other text.')
                result = {'phase': phase, 'discovered': True,
                          'model_count': len(discovered), 'tool_count': 0,
                          'reply_matches': isinstance(reply, str)
                          and reply.strip() == credentials['expected_reply']}
    except BaseException as error:
        result = {'phase': phase, 'error_type': type(error).__name__}
    print(MARKER + json.dumps(result, separators=(',', ':')))


def host(args):
    if args.out.exists():
        raise SystemExit('Choose a fresh --out directory')
    if not args.credentials.is_file() or stat.S_IMODE(args.credentials.stat().st_mode) & 0o077:
        raise SystemExit('--credentials must be an existing owner-only file (mode 0600)')
    credentials = json.loads(args.credentials.read_text())
    if not loopback_url(credentials.get('gateway_url', '')):
        raise SystemExit('gateway_url must be a literal loopback HTTP URL ending /v1')
    if any(not isinstance(credentials.get(name), str) or not credentials[name]
           for name in ('api_key', 'model', 'expected_reply')):
        raise SystemExit('api_key, model and expected_reply must be nonempty strings')
    args.out.mkdir(parents=True)
    report = {'scope': 'installed Hermes source against caller-supplied local gateway; provider provenance out of scope',
              'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'hermes_source': 'installed Hermes checkout (local path omitted)', 'checks': []}

    def check(name, passed, **details):
        report['checks'].append({'name': name, 'pass': bool(passed), **details})

    try:
        with tempfile.TemporaryDirectory(prefix='hermes-client-', dir=args.out) as temp:
            root = Path(temp)
            hermes_home = root / 'hermes-home'
            hermes_home.mkdir(mode=0o700)
            (hermes_home / 'config.yaml').write_text(
                'model:\n  streaming: false\nplatform_toolsets:\n  cli: []\n')
            (hermes_home / 'config.yaml').chmod(0o600)
            cwd = root / 'cwd'
            cwd.mkdir()
            env = {key: os.environ[key] for key in ('PATH', 'LANG', 'LC_ALL', 'SSL_CERT_FILE')
                   if key in os.environ}
            env.update({'HERMES_HOME': str(hermes_home), 'PYTHONNOUSERSITE': '1',
                        'NO_PROXY': '*', 'no_proxy': '*', 'HERMES_IGNORE_RULES': '1'})
            run = subprocess.run([str(args.python), str(Path(__file__).resolve()),
                                  '--inside', '--source', str(args.source)],
                                 input=json.dumps(credentials), text=True, capture_output=True,
                                 env=env, cwd=cwd, timeout=90)
            lines = [line[len(MARKER):] for line in run.stdout.splitlines()
                     if line.startswith(MARKER)]
            child = json.loads(lines[-1]) if lines else {}
            check('Hermes child completed', run.returncode == 0 and bool(child),
                  returncode=run.returncode)
            check('Hermes discovered selected model', child.get('discovered') is True,
                  model_count=child.get('model_count'))
            check('Hermes loaded zero tools', child.get('tool_count') == 0)
            check('Hermes chat returned fixture marker', child.get('reply_matches') is True)
            if child.get('error_type'):
                report['client_error'] = {'phase': child.get('phase'),
                                          'type': child['error_type']}
    except Exception as error:
        report['error_type'] = type(error).__name__
    report['passed'] = len(report['checks']) == 4 and all(item['pass'] for item in report['checks'])
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
    (args.out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inside', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--python', type=Path, default=DEFAULT_PYTHON)
    parser.add_argument('--credentials', type=Path)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    if args.inside:
        inside(args.source)
    elif args.credentials and args.out:
        sys.exit(host(args))
    else:
        parser.error('--credentials and --out are required')
