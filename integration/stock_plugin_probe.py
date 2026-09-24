#!/usr/bin/env python3
"""Probe stock Bifrost's URL plugin installer in disposable, network-none containers.

No providers, inference, published ports, or existing Bifrost state are used.
The host runs Docker; --inside runs only in the disposable Python helper.
"""
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import http.server
import json
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request


IMAGE = "maximhq/bifrost@sha256:b9f6a43c325146dc11244902703206294866baefcb67d239a2bdd6a4f5ff52c6"
HELPER = "python:3.13-alpine"
ASSET = Path("/asset/bifrost-registry.so")
BASE = "http://127.0.0.1:8080"
PORT = 18089


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
AUTH_HEADER = None
SECRET = None


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe(value):
    """Keep a bounded synthetic response while suppressing credential-like text."""
    raw = json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value
    if SECRET:
        raw = raw.replace(SECRET, "<redacted-fixture-password>")
    raw = re.sub(r"(?i)(bearer\s+|sk-[a-z0-9_-]+|password\s*[:=]\s*|token\s*[:=]\s*)\S+",
                 "<redacted>", raw)
    return raw[:1200]


def http_request(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Authorization": AUTH_HEADER} if AUTH_HEADER else {}
    if data:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(BASE + path, data=data, method=method,
                                     headers=headers)
    try:
        response = OPENER.open(request, timeout=5)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read(4096)
        try:
            parsed = json.loads(raw)
        except ValueError:
            parsed = raw.decode(errors="replace")
        result = {"status": response.status, "body": safe(parsed)}
        if isinstance(parsed, dict):
            plugin = parsed.get("plugin", parsed)
            if isinstance(plugin, dict) and isinstance(plugin.get("status"), dict):
                result["plugin_status"] = plugin["status"].get("status")
        return result


def inside(out):
    global AUTH_HEADER, SECRET
    credentials = json.loads(Path("/auth.json").read_text())
    SECRET = credentials["password"]
    AUTH_HEADER = "Basic " + base64.b64encode(
        (credentials["username"] + ":" + credentials["password"]).encode()).decode()
    report = {"started_at_utc": datetime.now(timezone.utc).isoformat(),
              "network_interfaces": sorted(path.name for path in Path("/sys/class/net").iterdir()),
              "asset_sha256": sha256(ASSET), "asset_gets": 0, "asset_bytes_written": 0}
    if report["network_interfaces"] != ["lo"]:
        report["error"] = "network namespace is not loopback-only"
        (out / "report.json").write_text(json.dumps(report, indent=2) + "\n")
        return 1

    class AssetHandler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path != "/bifrost-registry.so":
                self.send_error(404)
                return
            payload = ASSET.read_bytes()
            report["asset_gets"] += 1
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            self.wfile.flush()
            report["asset_bytes_written"] += len(payload)

        def log_message(self, *_args):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), AssetHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        for _ in range(100):
            try:
                report["before"] = http_request("/api/plugins")
                break
            except (OSError, TimeoutError):
                time.sleep(0.2)
        else:
            report["error"] = "stock gateway did not answer /api/plugins within 20 seconds"
            return 1
        # GET readiness is observed first. A 403 is still a live auth-policy result.
        report["post"] = http_request("/api/plugins", "POST", {
            "name": "bifrost-registry", "enabled": True,
            "path": f"http://127.0.0.1:{PORT}/bifrost-registry.so",
            "placement": "pre_builtin", "order": 0,
            "config": {"registry_path": "/app/data/registry.json"},
        })
        report["after"] = http_request("/api/plugins/bifrost-registry")
        report["download_observed"] = report["asset_gets"] > 0
        if not report["download_observed"]:
            report["local_control_post"] = http_request("/api/plugins", "POST", {
                "name": "bifrost-registry-local-control", "enabled": True,
                "path": "/probe/bifrost-registry.so", "placement": "pre_builtin", "order": 0,
                "config": {"registry_path": "/app/data/registry.json"},
            })
            report["after_local_control"] = http_request("/api/plugins/bifrost-registry-local-control")
        # Status must be interpreted from the API response; HTTP acceptance alone is insufficient.
        return 0
    except (OSError, ValueError) as error:
        report["error"] = safe(str(error))
        return 1
    finally:
        server.shutdown()
        (out / "report.json").write_text(json.dumps(report, indent=2) + "\n")


def docker(*args, timeout=30):
    return subprocess.run(["docker", *args], check=True, capture_output=True,
                          text=True, timeout=timeout).stdout.strip()


def host(plugin, out):
    global SECRET
    plugin = plugin.resolve(strict=True)
    out = out.resolve()
    if (out / "host.json").exists() or (out / "report.json").exists():
        raise RuntimeError("output already contains a probe report; use a fresh --out directory")
    out.mkdir(parents=True, exist_ok=True)
    probe = Path(__file__).resolve()
    suffix = secrets.token_hex(5)
    stock, helper = "stock-plugin-probe-" + suffix, "stock-plugin-helper-" + suffix
    host_report = {"started_at_utc": datetime.now(timezone.utc).isoformat(),
                   "scope": "stock 2.2.2 URL plugin install; synthetic loopback asset; no inference",
                   "image": IMAGE, "plugin_sha256": sha256(plugin),
                   "fixture_allowlist": ["127.0.0.1"]}
    started = False
    temporary = None
    try:
        metadata = json.loads(docker("image", "inspect", IMAGE))[0]
        host_report["image_metadata"] = {key: metadata.get(key) for key in ("Id", "Architecture", "Os", "RepoDigests")}
        if metadata.get("Architecture") != "arm64" or metadata.get("Os") != "linux":
            raise RuntimeError("stock image is not Linux ARM64")
        docker("image", "inspect", HELPER)
        temporary = tempfile.TemporaryDirectory(prefix="stock-plugin-probe-")
        app = Path(temporary.name)
        (app / "registry.json").write_text(json.dumps({"schema_version": 1,
            "default_naming": "provider/model", "models": [], "groups": [], "policies": []}) + "\n")
        (app / "pricing.json").write_text("{}\n")
        (app / "model-parameters.json").write_text("{}\n")
        username, password = "isolated-admin", secrets.token_urlsafe(24)
        SECRET = password
        auth_file = app / "auth.json"
        auth_file.write_text(json.dumps({"username": username, "password": password}))
        (app / "config.json").write_text(json.dumps({
            "version": 2,
            "governance": {"auth_config": {"is_enabled": True,
                "admin_username": username, "admin_password": password}},
            "server": {"read_buffer_size": 65536,
                       "plugin_download_private_allowlist": ["127.0.0.1"]},
            "config_store": {"enabled": True, "type": "sqlite",
                             "config": {"path": "/app/data/config.db"}},
            "framework": {"pricing": {
                "pricing_url": "file:///app/data/pricing.json",
                "model_parameters_url": "file:///app/data/model-parameters.json",
                "pricing_sync_interval": 86400}},
            "plugins": [],
        }) + "\n")
        docker("run", "--pull", "never", "-d", "--name", stock, "--network", "none",
               "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
               "-v", f"{app}:/app/data", "-v", f"{plugin}:/probe/bifrost-registry.so:ro",
               "--entrypoint", "/app/main", IMAGE,
               "-host", "127.0.0.1", "-port", "8080", "-app-dir", "/app/data")
        started = True
        docker("run", "--pull", "never", "--rm", "--name", helper,
               "--network", "container:" + stock, "--cap-drop", "ALL",
               "--security-opt", "no-new-privileges",
               "-v", f"{probe}:/probe.py:ro", "-v", f"{plugin}:{ASSET}:ro",
               "-v", f"{auth_file}:/auth.json:ro",
               "-v", f"{out}:/out", HELPER, "python", "/probe.py", "--inside", "--out", "/out",
               timeout=55)
        host_report["helper_completed"] = True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError, RuntimeError, ValueError) as error:
        host_report["error"] = safe(str(error))
        if isinstance(error, subprocess.CalledProcessError):
            host_report["error_detail"] = safe(error.stderr or error.stdout or "")
        if started:
            try:
                logs = subprocess.run(["docker", "logs", "--tail", "30", stock],
                                      capture_output=True, text=True, timeout=10)
                lines = (logs.stdout + logs.stderr).splitlines()
                errors = [line for line in lines if re.search(r"(?i)error|fail|panic", line)]
                host_report["startup_error"] = safe(errors[-1]) if errors else None
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                pass
    finally:
        for name in (helper, stock):
            try:
                removed = subprocess.run(["docker", "rm", "-f", name], capture_output=True, timeout=10)
                if name == stock and started:
                    host_report["stock_container_removed"] = removed.returncode == 0
            except (OSError, subprocess.TimeoutExpired) as error:
                host_report["cleanup_error"] = safe(str(error))
        if started and not host_report.get("stock_container_removed"):
            host_report["cleanup_error"] = "stock container removal was not confirmed"
        if temporary is not None:
            temporary.cleanup()
        (out / "host.json").write_text(json.dumps(host_report, indent=2) + "\n")
    return 1 if "error" in host_report or "cleanup_error" in host_report else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inside", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--plugin", type=Path, default=Path("dist/native-v2.2.2-live-v5/bifrost-registry.so"))
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    sys.exit(inside(args.out) if args.inside else host(args.plugin, args.out))
