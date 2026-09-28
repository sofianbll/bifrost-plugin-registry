#!/usr/bin/env python3
"""Native capabilities qualification probe for Registry accessSelection, shared-alias routing and pricing overrides.

Prerequisites
-------------
- Run inside a Linux container with Docker --network none (only the loopback interface is accepted).
- Mount a Bifrost gateway binary and the matching bifrost-registry .so as read-only.
- Only --out must be writable. No real inference provider is contacted.

What this probe proves
----------------------
- A virtual key whose policy uses accessSelection can be restricted to a single
  access of a logical model that has two provider accesses.
- A shared short alias mapped to two different upstream models routes to one of
  the two providers; the provider receives the upstream model id, not the alias.
- A manual price correction on a catalogue access triggers a native Bifrost
  pricing override (POST/PUT /api/governance/pricing-overrides) named
  registry/<provider>/<keyID>/<upstream_model>, scope_kind=provider_key,
  match_type=exact, with costs divided by 1e6. Removing the correction deletes
  the override.

What this probe does NOT prove
------------------------------
- It does not exercise real inference (stubs return a static chat completion).
- It does not qualify multi-architecture packaging, gateway restart, UI assets,
  hot plugin reload, or provider-specific protocols.
- It assumes a single architecture and the exact API paths derived from the
  plugin source.

API-path assumptions (verified from this repository)
----------------------------------------------------
- Registry admin endpoints use the DTOs in internal/admin/live.go:
  - GET/PUT /api/workspace (putWorkspace line 260-261, 574-845)
  - POST /api/keys (createKey line 1008-1048)
  - PUT /api/catalog/override (internal/admin/catalog.go:149-172, 273-282)
  - POST /api/catalog/refresh (internal/admin/catalog.go:315-358)
- accessSelection is camelCase in the workspace DTO (internal/admin/live.go:84
  and ui/src/data/api.ts:37-41); inner fields are "added" / "excluded"
  (internal/registry/config.go:80-83).
- Native pricing overrides are managed in internal/admin/pricing_overrides.go:
  - GET /api/governance/pricing-overrides?provider_id=...
  - POST/PUT /api/governance/pricing-overrides
  - DELETE /api/governance/pricing-overrides/<id>
  - Name format line 171-173: registry/<provider>/<keyID>/<upstream_model>.
- Native model details are read from /api/models/details (internal/admin/catalog.go:488).
"""
import argparse
import base64
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
CHAT_PATH = "/v1/chat/completions"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def http_request(url, token=None, method="GET", body=None, headers=None):
    headers = dict(headers or {})
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(body, separators=(",", ":")).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with OPENER.open(req, timeout=15) as response:
            return response.status, json.load(response), {k.lower(): v for k, v in response.headers.items()}
    except urllib.error.HTTPError as error:
        try:
            data = json.load(error)
        except ValueError:
            data = None
        return error.code, data, {k.lower(): v for k, v in error.headers.items()}


def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def make_stub(provider, upstream_model):
    """Factory for a synthetic provider that serves one upstream model and records chat calls."""
    class ProviderStub(http.server.BaseHTTPRequestHandler):
        post_hits = []

        def do_GET(self):
            path = urllib.parse.urlsplit(self.path).path
            if path not in ("/models", "/v1/models"):
                self.send_error(404)
                return
            payload = json.dumps({
                "object": "list",
                "data": [{
                    "id": upstream_model,
                    "object": "model",
                    "created": 0,
                    "owned_by": provider,
                }],
            }).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def do_POST(self):
            path = urllib.parse.urlsplit(self.path).path
            if path not in ("/chat/completions", "/v1/chat/completions"):
                self.send_error(404)
                return
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > (1 << 20):
                self.send_error(413)
                return
            try:
                body = json.loads(self.rfile.read(length))
            except ValueError:
                self.send_error(400)
                return
            model_id = body.get("model") if isinstance(body, dict) else None
            self.post_hits.append({
                "provider": provider,
                "upstream_model": upstream_model,
                "received_model": model_id,
                "path": path,
            })
            reply = {
                "id": "chatcmpl-capabilities-" + provider,
                "object": "chat.completion",
                "created": 0,
                "model": model_id,
                "choices": [{
                    "index": 0,
                    "message": {"role": "assistant", "content": "synthetic"},
                    "finish_reason": "stop",
                }],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            }
            payload = json.dumps(reply).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *_args):
            pass

    return ProviderStub


def run_gateway(binary, app_dir, listen_port, env):
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
                detail = detail.replace("synthetic-key-a", "<redacted-stub>")
                detail = detail.replace("synthetic-key-b", "<redacted-stub>")[:300]
                break
        raise RuntimeError(str(error) + (": " + detail if detail else "")) from None


def wait_ready(url, process, timeout=25):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        if process.poll() is not None:
            raise RuntimeError("gateway exited before ready")
        try:
            status, _, _ = http_request(url + "/health")
            if status == 200:
                return
        except (OSError, ValueError):
            pass
        time.sleep(0.1)
    raise RuntimeError("gateway readiness timed out")


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


def check(report, name, observed, expected):
    ok = observed == expected
    report["checks"].append({
        "name": name,
        "ok": ok,
        "detail": {"observed": observed, "expected": expected},
    })
    return ok


def check_approx(report, name, observed, expected, tolerance):
    ok = abs(observed - expected) <= tolerance
    report["checks"].append({
        "name": name,
        "ok": ok,
        "detail": {"observed": observed, "expected": expected, "tolerance": tolerance},
    })
    return ok


def summarize(report):
    total = len(report["checks"])
    passed = sum(1 for c in report["checks"] if c["ok"])
    report["total"] = total
    report["passed"] = passed
    report["failed"] = total - passed
    report["all_passed"] = (report.get("error") is None and total > 0 and passed == total)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gateway", type=Path, required=True)
    parser.add_argument("--plugin", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--expected-version", default="2.2.2")
    args = parser.parse_args()

    args.gateway = args.gateway.resolve(strict=True)
    args.plugin = args.plugin.resolve(strict=True)
    args.out.mkdir(parents=True, exist_ok=True)

    report = {
        "scope": "network-none synthetic providers; Registry accessSelection, shared-alias routing, pricing overrides; no real inference",
        "bifrost_version_expected": args.expected_version,
        "checks": [],
        "artifacts": {},
        "started_at_utc": datetime.now(timezone.utc).isoformat(),
        "network_isolation": "Docker --network none required; only loopback interface accepted",
    }

    gateway_sha = digest(args.gateway)
    plugin_sha = digest(args.plugin)
    report["artifacts"] = {
        "gateway": gateway_sha,
        "plugin": plugin_sha,
    }

    interfaces = sorted(path.name for path in Path("/sys/class/net").iterdir())
    if not check(report, "network namespace has only loopback", interfaces, ["lo"]):
        raise RuntimeError("container network namespace is not isolated")

    admin_username = "fixture-admin"
    admin_password = secrets.token_urlsafe(24)
    basic = "Basic " + base64.b64encode(f"{admin_username}:{admin_password}".encode()).decode()
    registry_token = secrets.token_urlsafe(32)

    alias = "shared"
    provider_a = "provider-a"
    provider_b = "provider-b"
    upstream_a = "upstream-a"
    upstream_b = "upstream-b"
    key_a_id = "key-a"
    key_b_id = "key-b"

    StubA = make_stub(provider_a, upstream_a)
    StubB = make_stub(provider_b, upstream_b)

    with tempfile.TemporaryDirectory(prefix="capabilities-", dir=args.out) as root:
        work = Path(root)
        app = work / "app"
        app.mkdir()
        pricing_file = work / "pricing.json"
        pricing_file.write_text(json.dumps({
            f"{provider_a}/{upstream_a}": {
                "provider": provider_a, "mode": "chat", "base_model": upstream_a,
                "max_input_tokens": 128, "max_output_tokens": 128,
                "input_cost_per_token": 0, "output_cost_per_token": 0,
            },
            f"{provider_b}/{upstream_b}": {
                "provider": provider_b, "mode": "chat", "base_model": upstream_b,
                "max_input_tokens": 128, "max_output_tokens": 128,
                "input_cost_per_token": 0, "output_cost_per_token": 0,
            },
        }) + "\n")
        params_file = work / "model-parameters.json"
        params_file.write_text("{}\n")
        registry_file = work / "registry.json"
        registry_file.write_text(json.dumps({
            "schema_version": 1,
            "default_naming": "model",
            "models": [],
            "groups": [],
            "policies": [],
        }) + "\n")

        stub_a = http.server.ThreadingHTTPServer(("127.0.0.1", free_port()), StubA)
        stub_b = http.server.ThreadingHTTPServer(("127.0.0.1", free_port()), StubB)
        thread_a = threading.Thread(target=stub_a.serve_forever, daemon=True)
        thread_b = threading.Thread(target=stub_b.serve_forever, daemon=True)
        thread_a.start()
        thread_b.start()

        admin_port = free_port()
        listen_port = free_port()
        base = f"http://127.0.0.1:{listen_port}"
        admin = f"http://127.0.0.1:{admin_port}"

        gateway_config = {
            "version": 2,
            "client": {"enforce_auth_on_inference": True},
            "governance": {
                "auth_config": {
                    "is_enabled": True,
                    "admin_username": admin_username,
                    "admin_password": admin_password,
                },
            },
            "config_store": {"enabled": True, "type": "sqlite", "config": {"path": str(app / "config.db")}},
            "framework": {
                "pricing": {
                    "pricing_url": pricing_file.as_uri(),
                    "model_parameters_url": params_file.as_uri(),
                    "pricing_sync_interval": 86400,
                },
            },
            "providers": {
                provider_a: {
                    "custom_provider_config": {"base_provider_type": "openai"},
                    "network_config": {"base_url": f"http://127.0.0.1:{stub_a.server_port}", "allow_private_network": True},
                    "keys": [{"id": key_a_id, "name": "Stub A", "value": "synthetic-key-a", "weight": 1, "models": ["*"]}],
                },
                provider_b: {
                    "custom_provider_config": {"base_provider_type": "openai"},
                    "network_config": {"base_url": f"http://127.0.0.1:{stub_b.server_port}", "allow_private_network": True},
                    "keys": [{"id": key_b_id, "name": "Stub B", "value": "synthetic-key-b", "weight": 1, "models": ["*"]}],
                },
            },
            "plugins": [{
                "name": "bifrost-registry",
                "enabled": True,
                "path": str(args.plugin),
                "placement": "post_builtin",
                "order": 0,
                "config": {
                    "registry_path": str(registry_file),
                    "admin_listen": f"127.0.0.1:{admin_port}",
                    "admin_token_env": "REGISTRY_ADMIN_TOKEN",
                    "bifrost_url": base,
                    "bifrost_auth_env": "BIFROST_ADMIN_AUTH",
                },
            }],
        }
        (app / "config.json").write_text(json.dumps(gateway_config) + "\n")

        env = {"PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin")}
        env["REGISTRY_ADMIN_TOKEN"] = registry_token
        env["BIFROST_ADMIN_AUTH"] = basic

        gateway, log = run_gateway(args.gateway, app, listen_port, env)
        try:
            # --- a. Configure workspace: one logical model, two keys, one restricted ---
            status, ws, _ = http_request(admin + "/api/workspace", registry_token)
            if status != 200 or not isinstance(ws, dict):
                raise RuntimeError(f"cannot read workspace: {status}")
            check(report, "workspace connected", ws.get("connection", {}).get("connected") is True, True)

            # Create two managed virtual keys.
            status_a, created_a, _ = http_request(admin + "/api/keys", registry_token, "POST",
                                                  {"name": "VK A restricted", "client": "probe-a"})
            status_b, created_b, _ = http_request(admin + "/api/keys", registry_token, "POST",
                                                  {"name": "VK B both", "client": "probe-b"})
            check(report, "create VK A", status_a == 201 and isinstance(created_a, dict), True)
            check(report, "create VK B", status_b == 201 and isinstance(created_b, dict), True)
            if status_a != 201 or status_b != 201:
                raise RuntimeError("virtual key creation failed")

            secret_a = created_a["created"]["secret"]
            id_a = created_a["created"]["id"]
            # Refresh workspace so both keys appear.
            status, ws, _ = http_request(admin + "/api/workspace", registry_token)
            if status != 200:
                raise RuntimeError("workspace refresh failed after key creation")

            # Find key slots and update policies.
            keys = ws.get("data", {}).get("keys", [])
            key_a = next((k for k in keys if k["id"] == id_a), None)
            key_b = next((k for k in keys if k["id"] == created_b["created"]["id"]), None)
            if key_a is None or key_b is None:
                raise RuntimeError("newly created keys missing from workspace")
            secret_b = created_b["created"]["secret"]

            model_dto = {
                "id": alias,
                "name": "Shared alias model",
                "creator": "Fixture",
                "family": "Fixture",
                "inputModalities": ["Text"],
                "outputModalities": ["Text"],
                "tasks": ["Chat"],
                "kind": "Chat",
                "summary": "",
                "context": "Unknown",
                "capabilities": {},
                "accesses": [
                    {
                        "provider": provider_a,
                        "id": f"{provider_a}/{alias}",
                        "nativeModel": upstream_a,
                        "endpoints": ["chat/completions"],
                    },
                    {
                        "provider": provider_b,
                        "id": f"{provider_b}/{alias}",
                        "nativeModel": upstream_b,
                        "endpoints": ["chat/completions"],
                    },
                ],
            }
            group_dto = {
                "id": "shared-group",
                "name": "Shared group",
                "description": "Capabilities probe group",
                "members": [alias],
            }

            key_a["policy"]["groups"] = [group_dto["id"]]
            key_a["policy"]["accessSelection"] = {
                alias: {
                    "added": [f"{provider_a}/{alias}"],
                    "excluded": [f"{provider_b}/{alias}"],
                },
            }
            key_b["policy"]["groups"] = [group_dto["id"]]
            key_b["policy"]["accessSelection"] = {
                alias: {
                    "added": [f"{provider_a}/{alias}", f"{provider_b}/{alias}"],
                    "excluded": [],
                },
            }

            ws["data"]["models"] = [model_dto]
            ws["data"]["groups"] = [group_dto]
            # Keep only the two managed keys we created.
            ws["data"]["keys"] = [key_a, key_b]

            revision = ws["revision"]
            status, saved, _ = http_request(admin + "/api/workspace", registry_token, "PUT",
                                            {"data": ws["data"]}, {"If-Match": revision})
            check(report, "workspace saved", status == 200 and isinstance(saved, dict), True)
            if status != 200:
                raise RuntimeError(f"workspace save failed: {status}: {json.dumps(saved)[:400]}")
            ws = saved

            # Verify the model has two accesses.
            saved_models = ws.get("data", {}).get("models", [])
            saved_model = next((m for m in saved_models if m["id"] == alias), None)
            check(report, "saved model has two accesses",
                  saved_model is not None and len(saved_model.get("accesses", [])) == 2, True)

            # --- b. VK A exposes the alias and routes only to provider A ---
            status, models_a, _ = http_request(base + MODELS_PATH, secret_a)
            ids_a = [item["id"] for item in models_a.get("data", [])] if isinstance(models_a, dict) else []
            check(report, "VK A lists shared alias", alias in ids_a, True)

            hits_a_before = len(StubA.post_hits)
            hits_b_before = len(StubB.post_hits)
            status, _, _ = http_request(base + CHAT_PATH, secret_a, "POST",
                                        {"model": alias, "messages": [{"role": "user", "content": "hi"}], "stream": False})
            check(report, "VK A chat status", status, 200)
            check(report, "VK A routed only to provider A",
                  len(StubA.post_hits) == hits_a_before + 1 and len(StubB.post_hits) == hits_b_before, True)
            if StubA.post_hits:
                check(report, "VK A upstream model is upstream-a",
                      StubA.post_hits[-1].get("received_model"), upstream_a)

            # --- c. VK B routes to either provider with the correct upstream model ---
            status, models_b, _ = http_request(base + MODELS_PATH, secret_b)
            ids_b = [item["id"] for item in models_b.get("data", [])] if isinstance(models_b, dict) else []
            check(report, "VK B lists shared alias", alias in ids_b, True)

            hits_a_before = len(StubA.post_hits)
            hits_b_before = len(StubB.post_hits)
            for _ in range(4):
                status, _, _ = http_request(base + CHAT_PATH, secret_b, "POST",
                                            {"model": alias, "messages": [{"role": "user", "content": "hi"}], "stream": False})
                if status != 200:
                    break
            check(report, "VK B chat calls succeeded", status, 200)
            received = set()
            for hit in StubA.post_hits[hits_a_before:]:
                received.add(hit.get("received_model"))
            for hit in StubB.post_hits[hits_b_before:]:
                received.add(hit.get("received_model"))
            check(report, "VK B received only authorized upstream models",
                  received.issubset({upstream_a, upstream_b}) and len(received) > 0, True)
            check(report, "VK B never sent alias as model", alias not in received, True)

            # --- d. Pricing override via catalogue access ---
            # Refresh catalogue so the access exists for override.
            status, catalog, headers = http_request(admin + "/api/catalog", registry_token)
            check(report, "catalog read", status == 200 and isinstance(catalog, dict), True)
            catalog_revision = headers.get("etag", "").strip('"')

            status, catalog, headers = http_request(admin + "/api/catalog/refresh", registry_token, "POST",
                                              {"sources": ["bifrost"]}, {"If-Match": catalog_revision})
            check(report, "catalog refresh", status == 200 and isinstance(catalog, dict), True)
            catalog_revision = headers.get("etag", "").strip('"')

            access_id_a = f"{provider_a}/{upstream_a}"
            access = next((a for a in catalog.get("accesses", []) if a.get("id") == access_id_a), None)
            check(report, "catalog has access provider-a/upstream-a", access is not None, True)

            status, catalog, headers = http_request(admin + "/api/catalog/override", registry_token, "PUT",
                                              {"target": "access", "id": access_id_a,
                                               "field": "input_cost_usd_per_million", "value": 1.5},
                                              {"If-Match": catalog_revision})
            check(report, "price override applied", status == 200 and isinstance(catalog, dict), True)
            catalog_revision = headers.get("etag", "").strip('"')

            # Trigger native pricing override sync.
            status, ws, _ = http_request(admin + "/api/workspace", registry_token)
            if status != 200:
                raise RuntimeError("workspace read before pricing sync failed")
            status, ws, _ = http_request(admin + "/api/workspace", registry_token, "PUT",
                                         {"data": ws["data"]}, {"If-Match": ws["revision"]})
            if status != 200:
                raise RuntimeError(f"pricing workspace save failed: {status}: {json.dumps(ws)[:400]}")
            check(report, "workspace save triggers pricing sync", status == 200, True)

            override_name = f"registry/{provider_a}/{key_a_id}/{upstream_a}"
            status, overrides_list, _ = http_request(
                base + f"/api/governance/pricing-overrides?provider_id={provider_a}",
                None, "GET", headers={"Authorization": basic})
            check(report, "list pricing overrides", status == 200 and isinstance(overrides_list, dict), True)
            overrides = overrides_list.get("pricing_overrides", []) if isinstance(overrides_list, dict) else []
            override = next((o for o in overrides if o.get("name") == override_name), None)
            check(report, "pricing override exists", override is not None, True)
            if override is not None:
                check(report, "override scope_kind", override.get("scope_kind"), "provider_key")
                check(report, "override match_type", override.get("match_type"), "exact")
                check(report, "override provider_id", override.get("provider_id"), provider_a)
                check(report, "override provider_key_id", override.get("provider_key_id"), key_a_id)
                check(report, "override pattern", override.get("pattern"), upstream_a)
                patch = override.get("patch", {})
                check_approx(report, "override input_cost_per_token",
                             patch.get("input_cost_per_token", 0), 1.5 / 1e6, 1e-15)

            # Check /api/models/details if it exposes overridden_pricing.
            status, details, _ = http_request(
                base + "/api/models/details?unfiltered=true&limit=100",
                None, "GET", headers={"Authorization": basic})
            if status == 200 and isinstance(details, dict):
                detail_model = next((m for m in details.get("models", [])
                                     if (m.get("provider") == provider_a and m.get("name") == upstream_a)), None)
                if detail_model is not None:
                    overridden = detail_model.get("overridden_pricing")
                    check(report, "models/details exposes overridden_pricing", overridden is not None, True)
                    if isinstance(overridden, dict):
                        check_approx(report, "models/details input cost",
                                     overridden.get("input_cost_per_token", 0), 1.5 / 1e6, 1e-15)
                else:
                    report["checks"].append({
                        "name": "models/details exposes overridden_pricing",
                        "ok": None,
                        "detail": {"note": "model not found in details response"},
                    })
            else:
                report["checks"].append({
                    "name": "models/details exposes overridden_pricing",
                    "ok": None,
                    "detail": {"note": f"endpoint returned {status}"},
                })

            # Remove the correction.
            status, catalog, headers = http_request(admin + "/api/catalog/override", registry_token, "PUT",
                                              {"target": "access", "id": access_id_a,
                                               "field": "input_cost_usd_per_million", "value": None},
                                              {"If-Match": catalog_revision})
            check(report, "price override removed", status == 200 and isinstance(catalog, dict), True)
            catalog_revision = headers.get("etag", "").strip('"')

            status, ws, _ = http_request(admin + "/api/workspace", registry_token)
            if status != 200:
                raise RuntimeError("workspace read before pricing removal failed")
            status, ws, _ = http_request(admin + "/api/workspace", registry_token, "PUT",
                                         {"data": ws["data"]}, {"If-Match": ws["revision"]})
            check(report, "workspace save triggers pricing override deletion", status == 200, True)

            status, overrides_after, _ = http_request(
                base + f"/api/governance/pricing-overrides?provider_id={provider_a}",
                None, "GET", headers={"Authorization": basic})
            overrides = overrides_after.get("pricing_overrides", []) if isinstance(overrides_after, dict) else []
            override_gone = next((o for o in overrides if o.get("name") == override_name), None) is None
            check(report, "pricing override deleted", override_gone, True)

            # Final: no provider received any request with the alias as model id.
            all_received = {hit.get("received_model") for hit in StubA.post_hits + StubB.post_hits}
            check(report, "no provider ever received alias as model", alias not in all_received, True)

        finally:
            stop_gateway(gateway, log)
            stub_a.shutdown()
            stub_b.shutdown()
            stub_a.server_close()
            stub_b.server_close()
            thread_a.join(timeout=3)
            thread_b.join(timeout=3)

    summarize(report)
    report["finished_at_utc"] = datetime.now(timezone.utc).isoformat()
    report_path = args.out / "capabilities-report.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"all_passed": report["all_passed"], "checks": report["total"],
                      "passed": report["passed"], "failed": report["failed"],
                      "report": str(report_path)}))
    return 0 if report["all_passed"] else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        # Fallback for catastrophic failures before the report is written.
        print(json.dumps({"all_passed": False, "error": type(error).__name__, "message": str(error)}), flush=True)
        sys.exit(1)
