#!/usr/bin/env python3
"""Prove URL installation on a paired dynamic Bifrost build in disposable Docker.

Run from the repository root. Docker containers have loopback networking only;
the fixture, gateway and client share that namespace. No ports are published.
"""
import argparse
import base64
from datetime import datetime, timezone
import http.server
import json
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

from stock_plugin_probe import NoRedirect, docker, safe, sha256


BASE = "http://127.0.0.1:8080"
ASSET = Path("/asset/bifrost-registry.so")
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())


def request(path, auth=None, method="GET", body=None):
    headers = {}
    if auth:
        headers["Authorization"] = "Basic " + base64.b64encode(
            (auth["username"] + ":" + auth["password"]).encode()).decode()
    data = json.dumps(body).encode() if body is not None else None
    if data is not None:
        headers["Content-Type"] = "application/json"
    try:
        response = OPENER.open(urllib.request.Request(BASE + path, data=data,
                                                      headers=headers, method=method), timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read(8192)
        try:
            payload = json.loads(raw)
        except ValueError:
            payload = {"raw": raw.decode(errors="replace")[:1000]}
        return {"http": response.status, "body": payload}


def snapshot(auth):
    listed = request("/api/plugins", auth)
    loaded = request("/api/plugins/loaded", auth)
    rows = listed["body"].get("plugins", []) if isinstance(listed["body"], dict) else []
    names = loaded["body"].get("plugins", []) if isinstance(loaded["body"], dict) else []
    return {"list_http": listed["http"], "loaded_http": loaded["http"],
            "saved": [{"name": row["name"], "enabled": row["enabled"],
                       "status": row["status"]["status"], "path": row.get("path")}
                      for row in rows if row["name"].startswith("delivery-")],
            "loaded": names}


def serve():
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            asset_path = "/sha256-" + sha256(ASSET) + ".so"
            if self.path == asset_path:
                payload = ASSET.read_bytes()
            elif self.path == "/incompatible.so":
                payload = b"invalid Go plugin fixture\n"
            else:
                self.send_error(404)
                return
            with Path("/app/data/asset-requests.jsonl").open("a") as log:
                log.write(json.dumps({"path": self.path, "bytes": len(payload)}) + "\n")
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *_args):
            pass

    http.server.ThreadingHTTPServer(("127.0.0.1", 18089), Handler).serve_forever()


def inside(phase):
    assert sorted(path.name for path in Path("/sys/class/net").iterdir()) == ["lo"]
    auth = json.loads(Path("/app/data/auth.json").read_text())
    asset_url = "http://127.0.0.1:18089/sha256-" + sha256(ASSET) + ".so"
    result = {"phase": phase, "before": None, "after": None}
    for _ in range(120):
        try:
            result["before"] = snapshot(auth)
            break
        except (OSError, TimeoutError):
            time.sleep(0.25)
    else:
        raise RuntimeError("gateway did not answer authenticated plugin API within 30 seconds")
    if phase == "install":
        body = lambda name, path: {"name": name, "enabled": True,
                                   "path": path, "placement": "pre_builtin", "order": 0,
                                   "config": {"registry_path": "/app/data/registry.json"}}
        result["unauthenticated"] = request("/api/plugins", method="POST",
                                             body=body("delivery-unauthorized", asset_url))
        result["invalid_download"] = request("/api/plugins", auth, "POST",
                                              body("delivery-missing", "http://127.0.0.1:18089/missing.so"))
        result["incompatible"] = request("/api/plugins", auth, "POST",
                                         body("delivery-invalid", "http://127.0.0.1:18089/incompatible.so"))
        result["install"] = request("/api/plugins", auth, "POST", body("delivery-registry", asset_url))
    result["after"] = snapshot(auth)
    result["asset_requests"] = [json.loads(line) for line in
                                Path("/app/data/asset-requests.jsonl").read_text().splitlines()]
    return result


def host(gateway, plugin, out):
    gateway, plugin, out = gateway.resolve(strict=True), plugin.resolve(strict=True), out.resolve()
    if out.exists():
        raise RuntimeError("output already exists; use a fresh --out directory")
    out.mkdir(parents=True)
    suffix = secrets.token_hex(5)
    fixture, server = "delivery-fixture-" + suffix, "delivery-gateway-" + suffix
    report = {"date_utc": datetime.now(timezone.utc).isoformat(),
              "scope": "paired dynamic Linux ARM64 URL install; no providers or inference",
              "gateway_sha256": sha256(gateway), "plugin_sha256": sha256(plugin),
              "runtime_image": "golang:1.27.1-alpine", "fixture_image": "python:3.13-alpine",
              "loopback_allowlist": ["127.0.0.1"], "checks": {}}
    try:
        for image in ("golang:1.27.1-alpine", "python:3.13-alpine"):
            metadata = json.loads(docker("image", "inspect", image))[0]
            if (metadata["Architecture"], metadata["Os"]) != ("arm64", "linux"):
                raise RuntimeError(image + " is not Linux ARM64")
        with tempfile.TemporaryDirectory(prefix="bifrost-delivery-") as temp:
            app = Path(temp)
            (app / "registry.json").write_text(json.dumps({"schema_version": 1,
                "default_naming": "provider/model", "models": [], "groups": [], "policies": []}) + "\n")
            (app / "pricing.json").write_text("{}\n")
            (app / "model-parameters.json").write_text("{}\n")
            (app / "auth.json").write_text(json.dumps({"username": "disposable-admin",
                                                     "password": secrets.token_urlsafe(24)}))
            (app / "asset-requests.jsonl").write_text("")
            auth = json.loads((app / "auth.json").read_text())
            (app / "config.json").write_text(json.dumps({
                "version": 2, "governance": {"auth_config": {"is_enabled": True,
                    "admin_username": auth["username"], "admin_password": auth["password"]}},
                "server": {"read_buffer_size": 65536,
                           "plugin_download_private_allowlist": ["127.0.0.1"]},
                "config_store": {"enabled": True, "type": "sqlite",
                                 "config": {"path": "/app/data/config.db"}},
                "framework": {"pricing": {"pricing_url": "file:///app/data/pricing.json",
                    "model_parameters_url": "file:///app/data/model-parameters.json",
                    "pricing_sync_interval": 86400}}, "plugins": []}) + "\n")
            script = Path(__file__).resolve()
            stock = script.with_name("stock_plugin_probe.py")
            docker("run", "--pull", "never", "-d", "--name", fixture,
                   "--network", "none", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
                   "-v", f"{app}:/app/data", "-v", f"{plugin}:{ASSET}:ro",
                   "-v", f"{script}:/probe.py:ro", "-v", f"{stock}:/stock_plugin_probe.py:ro",
                   "python:3.13-alpine", "python", "/probe.py", "--serve")
            def start_gateway():
                docker("run", "--pull", "never", "-d", "--name", server,
                       "--network", "container:" + fixture, "--cap-drop", "ALL",
                       "--security-opt", "no-new-privileges", "-v", f"{app}:/app/data",
                       "-v", f"{gateway}:/probe/bifrost-http:ro",
                       "--entrypoint", "/probe/bifrost-http", "golang:1.27.1-alpine",
                       "-host", "127.0.0.1", "-port", "8080", "-app-dir", "/app/data")
            start_gateway()
            for phase in ("install", "restart"):
                if phase == "restart":
                    docker("rm", "-f", server)
                    start_gateway()
                output = docker("exec", fixture, "python", "/probe.py", "--inside", phase,
                                timeout=100)
                report[phase] = json.loads(output)
            requests = report["restart"]["asset_requests"]
            good_path = "/sha256-" + report["plugin_sha256"] + ".so"
            saved = report["install"]["after"]["saved"]
            restarted = report["restart"]["after"]["saved"]
            checks = report["checks"]
            checks["auth_enforced"] = report["install"]["unauthenticated"]["http"] in (401, 403)
            checks["empty_before"] = report["install"]["before"]["saved"] == []
            checks["invalid_rejected"] = (report["install"]["invalid_download"]["http"] == 500
                                          and "HTTP 404" in report["install"]["invalid_download"]["body"]["error"]["message"])
            checks["incompatible_rejected"] = (report["install"]["incompatible"]["http"] == 500
                                               and "plugin.Open" in report["install"]["incompatible"]["body"]["error"]["message"])
            checks["no_failed_rows"] = all(row["name"] == "delivery-registry" for row in saved)
            checks["install_201"] = report["install"]["install"]["http"] == 201
            checks["active"] = len(saved) == 1 and saved[0]["status"] == "active"
            checks["loaded"] = "bifrost-registry" in report["install"]["after"]["loaded"]
            checks["restart_active"] = len(restarted) == 1 and restarted[0]["status"] == "active"
            checks["restart_loaded"] = "bifrost-registry" in report["restart"]["after"]["loaded"]
            checks["url_unchanged"] = saved and restarted and saved[0]["path"] == restarted[0]["path"] == "http://127.0.0.1:18089" + good_path
            checks["downloaded_twice"] = sum(item["path"] == good_path for item in requests) == 2
            report["passed"] = all(checks.values())
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError,
            subprocess.TimeoutExpired) as error:
        report["error"] = safe(str(error))
        if isinstance(error, subprocess.CalledProcessError):
            report["error_detail"] = safe(error.stderr or error.stdout or "")
    finally:
        for name in (server, fixture):
            removed = subprocess.run(["docker", "rm", "-f", name], capture_output=True, timeout=15)
            report.setdefault("cleanup", {})[name.split("-")[1]] = removed.returncode == 0
        (out / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    return 0 if report.get("passed") and all(report["cleanup"].values()) else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serve", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--inside", choices=("install", "restart"), help=argparse.SUPPRESS)
    parser.add_argument("--gateway", type=Path,
                        default=Path("dist/native-v2.2.2-live-v5/bifrost-http"))
    parser.add_argument("--plugin", type=Path,
                        default=Path("dist/native-v2.2.2-live-v5/bifrost-registry.so"))
    parser.add_argument("--out", type=Path, default=Path("reports/plugin-delivery-loading"))
    args = parser.parse_args()
    if args.serve:
        serve()
    elif args.inside:
        print(json.dumps(inside(args.inside)))
    else:
        raise SystemExit(host(args.gateway, args.plugin, args.out))
