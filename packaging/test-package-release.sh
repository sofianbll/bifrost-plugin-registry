#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
# Fixture: an ARM64 pair qualified for bifrost.pin (scripts/qualify.sh arm64) and its Bifrost source.
PAIR_DIR=${PAIR_DIR:-$ROOT/dist/qualify/arm64/pair} SOURCE_DIR=${SOURCE_DIR:-$ROOT/dist/qualify/arm64/bifrost}
REGISTRY_SOURCE_COMMIT=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["registry_commit"])' "$PAIR_DIR/manifest.json")
export PAIR_DIR SOURCE_DIR REGISTRY_SOURCE_COMMIT
"$ROOT/scripts/package-release.sh" test-rc "$TMP/out"
test "$(find "$TMP/out/image-context" -type f | wc -l | tr -d ' ')" = 5
test ! -e "$TMP/out/image-context/bifrost-registry.so"
test -f "$TMP/out/plugin/bifrost-registry-test-rc-linux-arm64.so"
(cd "$TMP/out/plugin" && sha256sum -c SHA256SUMS >/dev/null)
python3 - "$ROOT" "$TMP/out" <<'PY'
import json, pathlib, re, sys
from urllib.parse import unquote
root, out = map(pathlib.Path, sys.argv[1:])
plugin = out / "plugin"
manifest = json.loads((out / "manifest.json").read_text())
assert manifest["release_id"] == "test-rc"
assert manifest["platform"] == "linux/arm64 musl"
assert manifest["gateway_sha256"] != manifest["plugin_sha256"]
assert (plugin / "LICENSE").read_bytes() == (root / "LICENSE").read_bytes()
for source, target in (
    ("ui/LICENSE", "BIFROST-UI-APACHE-2.0.txt"),
    ("ui/PROVENANCE.md", "BIFROST-UI-PROVENANCE.md"),
    ("ui/public/static/fonts/OFL.txt", "GEIST-OFL-1.1.txt"),
):
    assert (plugin / "licenses" / target).read_bytes() == (root / source).read_bytes()
notices = (plugin / "THIRD_PARTY_NOTICES.md").read_text()
for name in ("@radix-ui/react-checkbox", "react", "lucide-react", "tailwindcss"):
    assert f"`{name}`" in notices
for link in re.findall(r"\]\(([^)]+)\)", notices):
    target = (plugin / unquote(link)).resolve()
    assert target.is_relative_to(plugin.resolve()) and target.is_file(), link
assert "MIT terms" in notices
assert (plugin / "licenses/npm/react/19.2.3/LICENSE").read_bytes() == (root / "ui/node_modules/react/LICENSE").read_bytes()
assert (plugin / "licenses/npm/tslib/2.8.1/CopyrightNotice.txt").read_bytes() == (root / "ui/node_modules/tslib/CopyrightNotice.txt").read_bytes()
PY

# A pair qualified at another Registry commit must fail before staging.
if REGISTRY_SOURCE_COMMIT=0000000000000000000000000000000000000000 "$ROOT/scripts/package-release.sh" test-rc "$TMP/bad-commit" > /dev/null 2>&1; then
  echo "Pair from another registry commit was accepted" >&2
  exit 1
fi
test ! -e "$TMP/bad-commit"

# A proof for another architecture must fail before staging.
cp -R "$PAIR_DIR" "$TMP/bad-pair"
python3 - "$TMP/bad-pair/source-verification.json" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
proof = json.loads(path.read_text())
proof["platform"] = "linux/amd64 musl"
path.write_text(json.dumps(proof))
PY
if PYTHONOPTIMIZE=1 PAIR_DIR="$TMP/bad-pair" "$ROOT/scripts/package-release.sh" test-rc "$TMP/bad-out" > /dev/null 2>&1; then
  echo "Mismatched architecture was accepted" >&2
  exit 1
fi
test ! -e "$TMP/bad-out"
