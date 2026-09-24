#!/usr/bin/env python3
"""Bounded local UI/API proof; credentials stay in memory and test keys are revoked."""
import argparse
import copy
import datetime
import json
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:8082")
    parser.add_argument("--model", default="gpt-6-luna")
    parser.add_argument("--witness-model", default="gpt-6-sol")
    parser.add_argument("--inference", action="store_true")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    if args.base != "http://127.0.0.1:8082":
        raise SystemExit("This proof is restricted to the isolated local instance")
    records, keys = [], []
    prefix = "/bifrost-registry/api/"

    def call(method, path, data=None, headers=None):
        body = None if data is None else json.dumps(data).encode()
        req = urllib.request.Request(args.base + path, data=body, method=method,
                                     headers={"Content-Type": "application/json", **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=90) as response:
                raw = response.read()
                return response.status, json.loads(raw) if raw else None, dict(response.headers)
        except urllib.error.HTTPError as error:
            raw = error.read()
            try:
                value = json.loads(raw)
            except ValueError:
                value = None
            return error.code, value, dict(error.headers)

    def check(name, condition, **metadata):
        records.append({"check": name, "passed": bool(condition), **metadata})
        if not condition:
            raise AssertionError(name)

    def workspace():
        status, result, _ = call("GET", prefix + "workspace")
        check("workspace read", status == 200, status=status)
        return result

    def save(ws):
        status, result, _ = call("PUT", prefix + "workspace", {"data": ws["data"]}, {"If-Match": ws["revision"]})
        check("workspace save", status == 200, status=status, phase=(result or {}).get("phase"))
        return result

    def readback(ws, key_id, expected):
        status, result, _ = call("POST", prefix + "keys/" + key_id + "/readback")
        check("readback API", status == 200, status=status)
        proof = next(k["publication"] for k in result["data"]["keys"] if k["id"] == key_id)
        check("exact independent readback", proof["state"] == "verified" and sorted(proof["actual"]) == sorted(expected),
              state=proof["state"], expected=sorted(expected), actual=proof["actual"])
        return result

    status, original, original_headers = call("GET", prefix + "config")
    check("registry snapshot", status == 200, status=status)
    try:
        ws = workspace()
        original_revision = ws["revision"]
        selected = []
        for model_id in (args.model, args.witness_model):
            model = copy.deepcopy(next(m for m in ws["discovery"] if m["id"] == model_id))
            model.update(tasks=["Chat"], inputModalities=["Text"], outputModalities=["Text"], kind="Chat")
            if not any(m["id"] == model_id for m in ws["data"]["models"]):
                ws["data"]["models"].append(model)
            selected.append(model)
        ws = save(ws)
        status, _, _ = call("PUT", prefix + "workspace", {"data": ws["data"]}, {"If-Match": original_revision})
        check("stale revision rejected", status == 409, status=status)
        group_id = "local-live-proof"
        check("isolated group name", not any(g["id"] == group_id for g in ws["data"]["groups"]))
        ws["data"]["groups"].append({"id": group_id, "name": "Local live proof", "description": "Temporary verification", "members": [args.model]})
        ws = save(ws)
        for suffix in ("A", "B"):
            status, result, _ = call("POST", prefix + "keys", {"name": "Registry local proof " + suffix, "client": "Temporary API verification"})
            if result and result.get("created"):
                keys.append(result["created"])
            check("native key create", status == 201 and bool(result.get("created", {}).get("secret")), status=status)
            ws = result.get("workspace") or workspace()
        ids = [k["id"] for k in keys]
        for k in ws["data"]["keys"]:
            if k["id"] in ids:
                k["policy"] = {"groups": [group_id], "added": [], "excluded": [], "naming": "model"}
        ws = save(ws)
        for key_id in ids:
            ws = readback(ws, key_id, [args.model])
        native_id = selected[0]["accesses"][0]["id"]
        first = next(k for k in ws["data"]["keys"] if k["id"] == ids[0])
        first["policy"]["naming"] = "both"
        ws = save(ws)
        ws = readback(ws, ids[0], [args.model, native_id])
        ws = readback(ws, ids[1], [args.model])
        next(g for g in ws["data"]["groups"] if g["id"] == group_id)["members"].append(args.witness_model)
        next(k for k in ws["data"]["keys"] if k["id"] == ids[0])["policy"]["excluded"] = [args.witness_model]
        ws = save(ws)
        ws = readback(ws, ids[0], [args.model, native_id])
        ws = readback(ws, ids[1], [args.model, args.witness_model])
        first = next(k for k in ws["data"]["keys"] if k["id"] == ids[0])
        first["policy"] = {"groups": [], "added": [args.model], "excluded": [], "naming": "both"}
        first["name"] = "Registry local proof renamed"
        ws = save(ws)
        check("native key rename", next(k for k in ws["data"]["keys"] if k["id"] == ids[0])["name"] == first["name"])
        ws = readback(ws, ids[0], [args.model, native_id])
        next(k for k in ws["data"]["keys"] if k["id"] == ids[0])["active"] = False
        ws = save(ws)
        status, _, _ = call("GET", "/v1/models", headers={"Authorization": "Bearer " + keys[0]["secret"]})
        check("disabled key denied", status in (401, 403), status=status)
        next(k for k in ws["data"]["keys"] if k["id"] == ids[0])["active"] = True
        ws = save(ws)
        ws = readback(ws, ids[0], [args.model, native_id])
        serialized = json.dumps(ws)
        check("workspace does not disclose native key secrets", all(k["secret"] not in serialized for k in keys))
        status, _, _ = call("GET", "/v1/models")
        check("inference catalog requires key", status in (401, 403), status=status)
        status, _, _ = call("GET", prefix + "workspace", headers={"Origin": "https://foreign.invalid"})
        check("cross origin denied", status == 403, status=status)
        previous_proof = copy.deepcopy(next(k["publication"] for k in ws["data"]["keys"] if k["id"] == ids[0]))
        status, raw_config, headers = call("GET", prefix + "config")
        check("raw config read", status == 200, status=status)
        next(g for g in raw_config["groups"] if g["id"] == group_id)["description"] = "Temporary raw config revision"
        status, _, _ = call("PUT", prefix + "config", raw_config, {"If-Match": headers.get("Etag", headers.get("ETag", ""))})
        check("raw config save", status == 200, status=status)
        ws = workspace()
        proof = next(k["publication"] for k in ws["data"]["keys"] if k["id"] == ids[0])
        check("raw config invalidates old verification", proof["state"] == "not_verified" and proof["revision"] == ws["revision"]
              and ws["revision"] != previous_proof["revision"] and not proof["checkedAt"])
        check("raw config retains historical observation", all(proof.get(field) == previous_proof.get(field)
              for field in ("actual", "observedAt", "observedRevision")))
        ws = readback(ws, ids[0], [args.model, native_id])
        if args.inference:
            for model_id in (args.model, native_id):
                status, response, _ = call("POST", "/v1/chat/completions", {
                    "model": model_id, "messages": [{"role": "user", "content": "Reply with just OK."}],
                    "max_completion_tokens": 24,
                }, {"Authorization": "Bearer " + keys[0]["secret"]})
                check("real bounded chat", status == 200 and bool((response or {}).get("choices")), model=model_id, status=status)
        check("proof complete", True)
    except Exception as error:
        records.append({"check": "proof execution", "passed": False, "error_type": type(error).__name__})
        raise
    finally:
        cleanup = []
        for k in keys:
            status, _, _ = call("DELETE", "/api/governance/virtual-keys/" + k["id"])
            cleanup.append(status in (200, 204))
        status, current, headers = call("GET", prefix + "config")
        if status == 200:
            status, _, _ = call("PUT", prefix + "config", original, {"If-Match": headers.get("Etag", headers.get("ETag", ""))})
        cleanup.append(status == 200)
        records.append({"check": "temporary keys revoked and registry restored", "passed": all(cleanup)})
        report = {"timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(), "target": args.base,
                  "inference_requested": args.inference, "checks": records,
                  "passed": all(r["passed"] for r in records)}
        with open(args.out, "w") as output:
            json.dump(report, output, indent=2)
            output.write("\n")
        print(json.dumps({"passed": report["passed"], "checks": len(records), "report": args.out}))


if __name__ == "__main__":
    main()
