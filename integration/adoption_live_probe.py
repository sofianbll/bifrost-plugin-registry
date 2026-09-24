#!/usr/bin/env python3
"""Prove explicit native-key adoption against the disposable loopback fixture.

No provider inference is sent. A private owner-only auth file is read in memory;
the report never contains credentials. The one key created by this probe is
removed, along with its Registry policy, when the probe finishes.
"""

import argparse
import base64
import copy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import secrets
import stat
import urllib.error
import urllib.parse
import urllib.request


GATEWAY = "http://127.0.0.1:18180"
PANEL = "http://127.0.0.1:18099"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


def private_credentials(path):
    info = path.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise RuntimeError("auth file must be a regular owner-only file")
    data = json.loads(path.read_text())
    for field in ("username", "password", "panel_token"):
        if not isinstance(data.get(field), str) or not data[field]:
            raise RuntimeError("auth file is missing a required field")
    return data


def model_ids(body):
    if not isinstance(body, dict) or not isinstance(body.get("data"), list):
        return None
    ids = [row.get("id") for row in body["data"]]
    if any(not isinstance(item, str) or not item for item in ids) or len(ids) != len(set(ids)):
        return None
    return sorted(ids)


def native_permissions(vk):
    return {field: copy.deepcopy(vk.get(field)) for field in (
        "id", "name", "description", "value", "is_active", "expires_at",
        "allow_all_providers", "provider_configs", "is_access_profile_managed",
    )}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--auth", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    auth = private_credentials(args.auth)
    if args.out.exists():
        raise RuntimeError("report path must not already exist")
    basic = "Basic " + base64.b64encode((auth["username"] + ":" + auth["password"]).encode()).decode()
    panel_auth = "Bearer " + auth["panel_token"]
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    checks = []
    created_id = None

    def call(base, path, method="GET", body=None, headers=None, authorization=None):
        if not path.startswith("/") or "://" in path:
            raise RuntimeError("invalid local API path")
        data = None if body is None else json.dumps(body).encode()
        request_headers = dict(headers or {})
        if authorization:
            request_headers["Authorization"] = authorization
        if data is not None:
            request_headers["Content-Type"] = "application/json"
        request = urllib.request.Request(base + path, data=data, method=method, headers=request_headers)
        try:
            response = opener.open(request, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read(8 << 20)
            try:
                value = json.loads(raw)
            except (ValueError, UnicodeDecodeError):
                value = None
            return response.status, value

    def native(path, method="GET", body=None, headers=None):
        return call(GATEWAY, path, method, body, headers, basic)

    def panel(path, method="GET", body=None, headers=None):
        return call(PANEL, path, method, body, headers, panel_auth)

    def check(name, valid, **details):
        checks.append({"name": name, "passed": bool(valid), **details})
        if not valid:
            raise AssertionError(name)

    try:
        status, ws = panel("/api/workspace")
        check("workspace available", status == 200 and isinstance(ws, dict), status=status)
        accesses = [a for m in ws["data"]["models"] for a in m.get("accesses", [])
                    if a.get("route") == "Direct provider" and a.get("status") == "Configured"
                    and a.get("nativeModel") and a.get("provider")
                    and a.get("id") == a["provider"] + "/" + a["nativeModel"]]
        check("configured direct native access exists", bool(accesses), count=len(accesses))
        access = accesses[0]
        provider = access["provider"]
        model = access["nativeModel"]
        route = access["id"]

        status, key_rows = native("/api/providers/" + urllib.parse.quote(provider, safe="") + "/keys")
        enabled_ids = [key["id"] for key in (key_rows or {}).get("keys", [])
                       if key.get("id") and key.get("enabled", True)]
        check("native enabled provider key available", status == 200 and bool(enabled_ids), status=status)
        query = urllib.parse.urlencode({"provider": provider, "keys": ",".join(enabled_ids), "limit": "100", "offset": "0"})
        status, model_rows = native("/api/models?" + query)
        matched = [row for row in (model_rows or {}).get("models", [])
                   if row.get("provider") == provider and row.get("name") == model]
        key_ids = [key for key in enabled_ids if any(key in row.get("accessible_by_keys", []) for row in matched)]
        check("direct model has enabled native key", status == 200 and len(matched) == 1 and bool(key_ids), status=status)
        key_id = key_ids[0]

        label = "Registry adoption probe " + secrets.token_hex(4)
        status, created = native("/api/governance/virtual-keys", "POST", {
            "name": label, "description": "Disposable local adoption proof", "is_active": True,
            "allow_all_providers": False,
            "provider_configs": [{"provider": provider, "key_ids": [key_id], "allowed_models": [model]}],
        })
        vk = (created or {}).get("virtual_key", {})
        created_id = vk.get("id")
        secret = vk.get("value")
        check("dedicated native key created", status in (200, 201) and bool(created_id)
              and isinstance(secret, str) and bool(secret), status=status)
        status, before_detail = native("/api/governance/virtual-keys/" + urllib.parse.quote(created_id, safe=""))
        before_vk = (before_detail or {}).get("virtual_key", {})
        check("native permissions readable", status == 200 and before_vk.get("id") == created_id, status=status)
        before_permissions = native_permissions(before_vk)

        status, baseline_body = call(GATEWAY, "/v1/models", authorization="Bearer " + secret)
        baseline = model_ids(baseline_body)
        check("native baseline is exactly one configured route", status == 200 and baseline == [route],
              status=status, routes=baseline)
        status, before_ws = panel("/api/workspace")
        native_key = next((key for key in (before_ws or {}).get("data", {}).get("keys", [])
                           if key.get("id") == created_id), {})
        check("native key is unmanaged before adoption", status == 200 and native_key.get("managed") is False,
              status=status)

        status, preview = panel("/api/keys/adopt", "POST", {"keyId": created_id, "operation": "adopt", "phase": "preview"})
        check("adoption preview is bounded by native baseline", status == 200 and isinstance(preview, dict)
              and preview.get("canApply") is True and preview.get("blocked") == []
              and preview.get("selectedRoutes") == baseline and preview.get("nativeRoutes") == baseline
              and bool(preview.get("previewToken")), status=status)
        status, _ = panel("/api/keys/adopt", "POST", {
            "keyId": created_id, "operation": "adopt", "phase": "apply", "previewToken": preview["previewToken"],
        }, {"If-Match": "stale-revision"})
        check("stale adoption revision refused", status == 409, status=status)
        status, applied = panel("/api/keys/adopt", "POST", {
            "keyId": created_id, "operation": "adopt", "phase": "apply", "previewToken": preview["previewToken"],
        }, {"If-Match": preview["revision"]})
        check("adoption applied at preview revision", status == 200 and (applied or {}).get("managed") is True,
              status=status)

        status, after_body = call(GATEWAY, "/v1/models", authorization="Bearer " + secret)
        after = model_ids(after_body)
        check("native model access unchanged after adoption", status == 200 and after == baseline,
              status=status, routes=after)
        status, after_detail = native("/api/governance/virtual-keys/" + urllib.parse.quote(created_id, safe=""))
        after_vk = (after_detail or {}).get("virtual_key", {})
        check("native VK permissions unchanged without native PUT", status == 200
              and native_permissions(after_vk) == before_permissions, status=status)
        status, cfg = panel("/api/config")
        check("Registry config read", status == 200 and isinstance(cfg, dict), status=status)
        status, view = panel("/api/preview", "POST", {"config": cfg, "virtual_key_id": created_id})
        projected = sorted(row["exposed_id"] for row in (view or {}).get("routes", []))
        check("Registry route selection cannot exceed native access", status == 200
              and set(projected).issubset(set(baseline)) and projected == baseline,
              status=status, routes=projected)
        status, after_ws = panel("/api/workspace")
        adopted_key = next((key for key in (after_ws or {}).get("data", {}).get("keys", [])
                            if key.get("id") == created_id), {})
        check("workspace marks adopted key managed", status == 200 and adopted_key.get("managed") is True,
              status=status)
        status, rebound = panel("/api/keys/adopt", "POST", {
            "keyId": created_id, "operation": "rebind", "phase": "preview",
        })
        check("unchanged native binding cannot rebind", status == 200 and isinstance(rebound, dict)
              and rebound.get("canApply") is False and bool(rebound.get("blocked")), status=status)
    except Exception as error:
        if not checks or checks[-1]["passed"]:
            checks.append({"name": "probe exception", "passed": False, "errorType": type(error).__name__})
    finally:
        if created_id:
            try:
                status, current = panel("/api/config")
                if status == 200 and isinstance(current, dict):
                    policies = current.get("policies", [])
                    if any(p.get("virtual_key_id") == created_id for p in policies):
                        current["policies"] = [p for p in policies if p.get("virtual_key_id") != created_id]
                        status_revision, state = panel("/api/status")
                        if status_revision == 200 and isinstance(state, dict) and state.get("revision"):
                            status, _ = panel("/api/config", "PUT", current, {"If-Match": state["revision"]})
                        else:
                            status = status_revision
                        checks.append({"name": "dedicated Registry policy removed", "passed": status == 200, "status": status})
                status, _ = native("/api/governance/virtual-keys/" + urllib.parse.quote(created_id, safe=""), "DELETE")
                checks.append({"name": "dedicated native key removed", "passed": status in (200, 204), "status": status})
            except Exception as error:
                checks.append({"name": "dedicated key cleanup", "passed": False, "errorType": type(error).__name__})
        report = {"scope": "disposable loopback fixture; no provider inference", "gateway": GATEWAY,
                  "panel": PANEL, "timestamp": datetime.now(timezone.utc).isoformat(),
                  "checks": checks, "passed": all(item["passed"] for item in checks)}
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps({"passed": report["passed"], "checks": len(checks), "report": str(args.out)}))
        if not report["passed"]:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
