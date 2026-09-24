#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir "$TMP/bin"
cat > "$TMP/bin/docker" <<'SH'
#!/bin/sh
test "$1" = build && test "$2" = --pull=false && test "$3" = --platform && test "$4" = linux/arm64
SH
chmod +x "$TMP/bin/docker"
PATH="$TMP/bin:$PATH" "$ROOT/scripts/package-release.sh" test-rc local/test:rc "$TMP/out"
test "$(find "$TMP/out/image-context" -type f | wc -l | tr -d ' ')" = 5
test ! -e "$TMP/out/image-context/bifrost-registry.so"
test -f "$TMP/out/plugin/bifrost-registry-test-rc-linux-arm64.so"
(cd "$TMP/out/plugin" && sha256sum -c SHA256SUMS >/dev/null)
python3 - "$TMP/out/manifest.json" <<'PY'
import json, pathlib, sys
manifest = json.loads(pathlib.Path(sys.argv[1]).read_text())
assert manifest["release_id"] == "test-rc"
assert manifest["image_tag"] == "local/test:rc"
assert manifest["platform"] == "linux/arm64 musl"
assert manifest["gateway_sha256"] != manifest["plugin_sha256"]
PY

# A proof for another architecture must fail before staging or building.
mkdir "$TMP/bad-proof"
cp "$ROOT/reports/plugin-standalone/"{SHA256SUMS,build-environment.txt,source-verification.json} "$TMP/bad-proof/"
python3 - "$TMP/bad-proof/source-verification.json" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
proof = json.loads(path.read_text())
proof["platform"] = "linux/amd64 musl"
path.write_text(json.dumps(proof))
PY
if PYTHONOPTIMIZE=1 PROOF_DIR="$TMP/bad-proof" PATH="$TMP/bin:$PATH" "$ROOT/scripts/package-release.sh" test-rc local/test:bad "$TMP/bad-out" > /dev/null 2>&1; then
  echo "Mismatched architecture was accepted" >&2
  exit 1
fi
test ! -e "$TMP/bad-out"
