#!/usr/bin/env python3
"""Isolated GET models proof for two fresh Bifrost virtual keys.

Run inside a network-none Linux container with the matching gateway and
plugin mounted read-only. Only --out is writable. No inference is sent.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import http.server
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request


MODELS_PATH = "/v1/models"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())


def port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def request(url, token=None, method="GET", body=None, headers=None):
    headers = dict(headers or {})
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(body, separators=(",", ":")).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with OPENER.open(req, timeout=5) as response:
            return response.status, json.load(response), {k.lower(): v for k, v in response.headers.items()}
    except urllib.error.HTTPError as error:
        try:
            data = json.load(error)
        except ValueError:
            data = None
        return error.code, data, {k.lower(): v for k, v in error.headers.items()}


def ids(status, body, native=False):
    if status != 200 or not isinstance(body, dict) or (not native and body.get("object") != "list"):
        return None
    data = body.get("data")
    if not isinstance(data, list) or any(not isinstance(item, dict) or not isinstance(item.get("id"), str) for item in data):
        return None
    names = [item["id"] for item in data]
    return sorted(names) if len(names) == len(set(names)) else None


def error_code(body):
    error = body.get("error") if isinstance(body, dict) else None
    code = error.get("code") if isinstance(error, dict) else None
    return code if isinstance(code, str) and re.fullmatch(r"[a-z0-9_.-]{1,80}", code) else None


def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


class Stub(http.server.BaseHTTPRequestHandler):
    hits = []

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        self.hits.append({"method": "GET", "path": path})
        if path not in ("/models", "/v1/models"):
            self.send_error(404)
            return
        data = json.dumps({"object": "list", "data": [
            {"id": name, "object": "model", "created": 0, "owned_by": "stub"}
            for name in ("upstream-alpha", "upstream-beta", "upstream-shared", "upstream-native-hidden")
        ]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        self.hits.append({"method": "POST", "path": urllib.parse.urlsplit(self.path).path})
        self.send_error(405)

    def log_message(self, *_args):
        pass


def check(report, name, observed, expected):
    result = {"name": name, "pass": observed == expected, "observed": observed, "expected": expected}
    report["checks"].append(result)
    return result["pass"]


def wait_ready(url, process, timeout=20):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        if process.poll() is not None:
            raise RuntimeError("gateway exited before ready")
        try:
            status, _, _ = request(url + "/api/config")
            if status == 200:
                return
        except (OSError, ValueError):
            pass
        time.sleep(0.1)
    raise RuntimeError("gateway readiness timed out")


def run_gateway(binary, app_dir, listen_port, env):
    # The temporary log is private and removed with the sandbox directory.
    log = open(app_dir / "gateway.log", "wb")
    process = subprocess.Popen(
        [str(binary), "-app-dir", str(app_dir), "-host", "127.0.0.1", "-port", str(listen_port),
         "-log-level", "error", "-log-style", "json"],
        env=env, stdout=log, stderr=subprocess.STDOUT, cwd=app_dir,
    )
    try:
        wait_ready(f"http://127.0.0.1:{listen_port}", process)
        return process, log
    except BaseException as error:
        stop_gateway(process, log)
        detail = ""
        for line in reversed((app_dir / "gateway.log").read_text(errors="replace").splitlines()):
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            message = entry.get("error") or entry.get("msg") or entry.get("message")
            if isinstance(message, str):
                detail = re.sub(r"sk-bf-[A-Za-z0-9_-]+", "<redacted-vk>", message)
                if env.get("REGISTRY_ADMIN_TOKEN"):
                    detail = detail.replace(env["REGISTRY_ADMIN_TOKEN"], "<redacted-admin>")
                detail = detail.replace("test-only-stub", "<redacted-stub>")[:300]
                break
        raise RuntimeError(str(error) + (": " + detail if detail else "")) from None


def stop_gateway(process, log):
    try:
        try:
            process.terminate()
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
    finally:
        log.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gateway", type=Path, required=True)
    parser.add_argument("--plugin", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True,
                        help="JSON with bifrost_version, bifrost_commit and artifact SHA-256s")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(args.manifest.read_text())
    expected_hashes = manifest["artifacts"]
    report = {
        "scope": "isolated Bifrost HTTP " + MODELS_PATH + "; mocked provider; no inference",
        "verified_endpoint": MODELS_PATH,
        "bifrost_version": manifest["bifrost_version"],
        "bifrost_commit": manifest["bifrost_commit"],
        "checks": [],
        "artifacts": {},
        "started_at_utc": datetime.now(timezone.utc).isoformat(),
        "network_isolation": "Docker --network none required; only loopback interface accepted",
    }
    try:
        check(report, "target Bifrost version", manifest["bifrost_version"], "2.2.2")
        if not report["checks"][-1]["pass"]:
            raise RuntimeError("manifest targets a different Bifrost version")
        for name, path in (("bifrost-http", args.gateway), ("bifrost-registry.so", args.plugin)):
            observed = digest(path)
            report["artifacts"][name] = observed
            check(report, name + " SHA-256", observed, expected_hashes[name])
        if any(not item["pass"] for item in report["checks"]):
            raise RuntimeError("artifact hash mismatch")
        interfaces = sorted(path.name for path in Path("/sys/class/net").iterdir())
        check(report, "network namespace has only loopback", interfaces, ["lo"])
        if not report["checks"][-1]["pass"]:
            raise RuntimeError("container network namespace is not isolated")

        with tempfile.TemporaryDirectory(prefix="isolated-models-", dir=args.out) as root:
            work = Path(root)
            app = work / "app"
            app.mkdir()
            config_file = app / "config.json"
            pricing_file = work / "pricing.json"
            pricing_file.write_text(json.dumps({"upstream-" + name: {
                "provider": "openai", "mode": "chat", "base_model": "upstream-" + name,
                "max_input_tokens": 128, "max_output_tokens": 128,
                "input_cost_per_token": 0, "output_cost_per_token": 0,
            } for name in ("alpha", "beta", "shared", "native-hidden")}) + "\n")
            params_file = work / "model-parameters.json"
            params_file.write_text("{}\n")
            native_keys = [{"id": "vk-" + name, "value": "sk-bf-" + secrets.token_urlsafe(24)}
                           for name in ("hermes", "witness", "legacy")]
            managed_keys, legacy_key = native_keys[:2], native_keys[2]
            provider_key_id = "isolated-provider-key"
            stub = http.server.ThreadingHTTPServer(("127.0.0.1", port()), Stub)
            thread = threading.Thread(target=stub.serve_forever, daemon=True)
            thread.start()
            try:
                base = f"http://127.0.0.1:{port()}"
                gateway_config = {
                    "version": 2,
                    "client": {"enforce_auth_on_inference": True},
                    "config_store": {"enabled": True, "type": "sqlite",
                                     "config": {"path": str(app / "config.db")}},
                    "framework": {"pricing": {"pricing_url": pricing_file.as_uri(),
                                               "model_parameters_url": params_file.as_uri(),
                                               "pricing_sync_interval": 86400}},
                    "providers": {"openai": {"network_config": {
                        "base_url": f"http://127.0.0.1:{stub.server_port}", "allow_private_network": True},
                        "keys": [{"id": provider_key_id, "name": "Isolated stub only", "value": "test-only-stub",
                                  "weight": 1, "models": ["*"], "aliases": {
                                      name: {"model_id": "upstream-" + name, "model_name": "upstream-" + name,
                                             "model_family": "openai"}
                                      for name in ("alpha", "beta", "shared", "native-hidden")}}]}},
                    "governance": {"virtual_keys": [
                        {"id": vk["id"], "name": vk["id"], "is_active": True,
                         "value": "env.VK_" + vk["id"].removeprefix("vk-").upper(),
                         "provider_configs": [{"provider": "openai", "key_ids": [provider_key_id],
                                               "allowed_models": ["alpha", "beta", "shared"], "weight": 1}]}
                        for vk in native_keys]},
                    "plugins": [{"name": "governance", "enabled": True,
                                 "config": {"is_vk_mandatory": True}}],
                }
                config_file.write_text(json.dumps(gateway_config) + "\n")
                gateway_env = {"PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin")}
                gateway_env.update({"VK_" + vk["id"].removeprefix("vk-").upper(): vk["value"]
                                    for vk in native_keys})
                gateway, log = run_gateway(args.gateway, app, int(base.rsplit(":", 1)[1]), gateway_env)
                try:
                    baseline = []
                    for vk in native_keys:
                        status, body, _ = request(base + MODELS_PATH, vk["value"])
                        baseline.append({"status": status, "ids": ids(status, body, native=True)})
                    for index, item in enumerate(baseline):
                        check(report, f"native baseline key {index + 1} status", item["status"], 200)
                    check(report, "native baseline valid key 1", baseline[0]["ids"] is not None, True)
                    check(report, "native baseline valid key 2", baseline[1]["ids"] is not None, True)
                    check(report, "native baseline valid legacy key", baseline[2]["ids"] is not None, True)
                    check(report, "native baseline same allowlist",
                          all(item["ids"] == baseline[0]["ids"] for item in baseline)
                          and baseline[0]["ids"] is not None, True)
                    native_ids = baseline[0]["ids"]
                    if native_ids is None:
                        raise RuntimeError("native baseline listing invalid")
                    report["native_baseline_ids"] = [item["ids"] for item in baseline]
                    check(report, "native baseline exact IDs", native_ids,
                          ["openai/alpha", "openai/beta", "openai/shared"])
                    for name in ("alpha", "beta", "shared"):
                        check(report, "native has " + name, "openai/" + name in native_ids, True)
                    check(report, "native permission excludes hidden", "openai/native-hidden" in native_ids, False)
                finally:
                    stop_gateway(gateway, log)

                token = secrets.token_urlsafe(32)
                registry = {
                    "schema_version": 1, "default_naming": "provider/model",
                    "models": [{"id": name, "alias": name, "provider": "openai",
                                "provider_key_ids": [provider_key_id], "upstream_model": "upstream-" + name,
                                "endpoints": ["chat/completions"], "enabled": True, "verified": True,
                                "evidence": "isolated stub fixture only; no inference"}
                               for name in ("alpha", "beta", "shared", "native-hidden", "registry-absent")],
                    "groups": [{"id": "common", "name": "Shared", "model_ids": ["shared", "native-hidden"]},
                               {"id": "hermes-only", "name": "Hermes", "model_ids": ["alpha", "registry-absent"]},
                               {"id": "witness-only", "name": "Witness", "model_ids": ["beta"]}],
                    "policies": [{"virtual_key_id": vk["id"], "name": "isolated-" + name,
                                  "token_sha256": hashlib.sha256(vk["value"].encode()).hexdigest(),
                                  "naming": naming, "groups": ["common", name + "-only"], "enabled": True}
                                 for vk, name, naming in zip(managed_keys, ("hermes", "witness"),
                                                              ("model", "provider/model"))],
                }
                registry_file = work / "registry.json"
                registry_file.write_text(json.dumps(registry) + "\n")
                gateway_config["plugins"].insert(0, {
                    "name": "bifrost-registry", "enabled": True, "path": str(args.plugin),
                    "placement": "pre_builtin", "order": 0,
                    "config": {"registry_path": str(registry_file), "admin_listen": f"127.0.0.1:{port()}",
                               "admin_token_env": "REGISTRY_ADMIN_TOKEN"},
                })
                config_file.write_text(json.dumps(gateway_config) + "\n")
                admin_port = json.loads(config_file.read_text())["plugins"][0]["config"]["admin_listen"].rsplit(":", 1)[1]
                env = gateway_env.copy()
                env["REGISTRY_ADMIN_TOKEN"] = token
                gateway, log = run_gateway(args.gateway, app, int(base.rsplit(":", 1)[1]), env)
                try:
                    expected = [["alpha", "shared"], ["openai/beta", "openai/shared"]]
                    report["registry_responses"] = []
                    for index, vk in enumerate(managed_keys):
                        status, body, _ = request(base + MODELS_PATH, vk["value"])
                        report["registry_responses"].append({"case": f"key {index + 1}", "status": status,
                                                             "error_code": error_code(body)})
                        check(report, f"registry key {index + 1} status", status, 200)
                        check(report, f"registry key {index + 1} exact IDs", ids(status, body), expected[index])
                    status, body, _ = request(base + MODELS_PATH, native_keys[0]["value"])
                    report["registry_responses"].append({"case": "key 1 reread", "status": status,
                                                         "error_code": error_code(body)})
                    check(report, "key 1 unchanged after key 2 read", ids(status, body), expected[0])
                    status, body, _ = request(base + "/openai/v1/models", native_keys[0]["value"])
                    report["registry_responses"].append({"case": "prefixed alias", "status": status,
                                                         "error_code": error_code(body)})
                    check(report, "prefixed alias status", status, 200)
                    check(report, "prefixed alias same key 1 IDs", ids(status, body), expected[0])
                    for label, key_value in (("no key", None), ("unbound key", "sk-bf-intentionally-unbound-test-token")):
                        status, _, _ = request(base + MODELS_PATH, key_value)
                        check(report, label + " refused", status in (401, 403), True)
                    status, legacy_body, _ = request(base + MODELS_PATH, legacy_key["value"])
                    check(report, "existing native key without policy refused", status, 403)
                    code = error_code(legacy_body)
                    check(report, "existing key refusal is Registry policy", code, "registry_policy_missing")

                    admin = f"http://127.0.0.1:{admin_port}"
                    status, current, headers = request(admin + "/api/config", token)
                    check(report, "admin GET status", status, 200)
                    revision = headers.get("etag", "").strip('"')
                    if not revision or not isinstance(current, dict):
                        raise RuntimeError("admin revision unavailable")
                    report["revision_before"] = revision
                    current["groups"][0]["model_ids"].append("alpha")
                    status, saved, _ = request(admin + "/api/config", token, "PUT", current,
                                               {"If-Match": revision})
                    check(report, "group save status", status, 200)
                    if status != 200 or not isinstance(saved, dict) or not saved.get("revision"):
                        raise RuntimeError("group save failed")
                    report["revision_group"] = saved["revision"]
                    check(report, "group revision advanced", report["revision_group"] != revision, True)
                    grouped = [["alpha", "shared"], ["openai/alpha", "openai/beta", "openai/shared"]]
                    for index, vk in enumerate(managed_keys):
                        status, body, _ = request(base + MODELS_PATH, vk["value"])
                        check(report, f"grouped key {index + 1} status", status, 200)
                        check(report, f"grouped key {index + 1} exact IDs", ids(status, body), grouped[index])
                    current["policies"][0]["naming"] = "both"
                    status, saved, _ = request(admin + "/api/config", token, "PUT", current,
                                               {"If-Match": report["revision_group"]})
                    check(report, "naming save status", status, 200)
                    if status != 200 or not isinstance(saved, dict) or not saved.get("revision"):
                        raise RuntimeError("naming save failed")
                    report["revision_after"] = saved["revision"]
                    revised = [["alpha", "openai/alpha", "openai/shared", "shared"], grouped[1]]
                    for index, vk in enumerate(managed_keys):
                        status, body, _ = request(base + MODELS_PATH, vk["value"])
                        check(report, f"renamed key {index + 1} status", status, 200)
                        check(report, f"renamed key {index + 1} exact IDs", ids(status, body), revised[index])
                    # Swap bindings after native identities were fixed; projection must reject.
                    first = current["policies"][0]["token_sha256"]
                    current["policies"][0]["token_sha256"] = current["policies"][1]["token_sha256"]
                    current["policies"][1]["token_sha256"] = first
                    status, saved, _ = request(admin + "/api/config", token, "PUT", current,
                                               {"If-Match": report["revision_after"]})
                    check(report, "binding swap saved", status, 200)
                    if status == 200 and isinstance(saved, dict):
                        report["revision_identity_probe"] = saved.get("revision")
                        status, _, _ = request(base + MODELS_PATH, native_keys[0]["value"])
                        check(report, "native identity mismatch refused", status, 403)
                finally:
                    stop_gateway(gateway, log)
            finally:
                stub.shutdown()
                stub.server_close()
                thread.join(timeout=3)
    except Exception as error:
        report["error"] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
    check(report, "no inference to stub", any(hit["method"] == "POST" for hit in Stub.hits), False)
    report["stub_get_paths"] = sorted({re.sub(r"sk-bf-[A-Za-z0-9_-]+", "<redacted-vk>", hit["path"])[:128]
                                       for hit in Stub.hits if hit["method"] == "GET"})
    report["all_passed"] = "error" not in report and bool(report["checks"]) and all(item["pass"] for item in report["checks"])
    report["finished_at_utc"] = datetime.now(timezone.utc).isoformat()
    (args.out / "isolated-models-report.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"all_passed": report["all_passed"], "checks": len(report["checks"]),
                      "report": str(args.out / "isolated-models-report.json")}))
    return 0 if report["all_passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
