#!/usr/bin/env bash
# Builds the gateway AND plugin in one resolved Go module. Does not deploy anything.
# Requires an existing Bifrost checkout, its real built UI assets, matching Go,
# a C compiler, and access to dependencies. No prebuilt gateway ABI is assumed.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ $# -ge 1 && $# -le 2 ]] || fail "usage: $0 /path/to/bifrost-checkout [NEW-output-directory]"
BF=$(cd "$1" && pwd)
[[ -f "$BF/transports/go.mod" && -d "$BF/transports/bifrost-http" ]] || fail "Expected Bifrost checkout with transports/go.mod and transports/bifrost-http"
command -v go >/dev/null || fail "Go is required"
command -v python3 >/dev/null || fail "Python 3 is required for staging"
command -v npm >/dev/null || fail "npm is required to build the embedded Registry UI"
[[ $(go env GOOS) == "linux" || $(go env GOOS) == "darwin" ]] || fail "Go plugins require Linux or macOS"
[[ $(go env GOOS) == $(go env GOHOSTOS) && $(go env GOARCH) == $(go env GOHOSTARCH) ]] || fail "Use a native matching builder, not cross-compilation"
[[ -z ${GOFLAGS:-} ]] || fail "Unset GOFLAGS to avoid hidden build flag mismatches"
if ! [[ -f "$BF/transports/bifrost-http/ui/index.html" ]]; then
 fail "Real Bifrost UI assets missing. Build the UI from this SAME checkout and copy its output to transports/bifrost-http/ui (see docs/BUILD.md). No placeholder UI is generated."
fi
OUT=${2:-"$ROOT/dist/native"}
[[ ! -e "$OUT" ]] || fail "Output directory already exists; choose a new directory (nothing is overwritten)"
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)
STAGE="$BF/transports/registry-plugin"
[[ ! -e "$STAGE" ]] || fail "Staging path already exists: $STAGE"
mkdir "$STAGE"
trap 'rm -rf -- "$STAGE"' EXIT
MODULE=$(awk '$1 == "module" {print $2; exit}' "$BF/transports/go.mod")
[[ -n "$MODULE" ]] || fail "Cannot read transports module path"
REG_UI="$ROOT/docs/design/registry-prototype"
npm --prefix "$REG_UI" ci
npm --prefix "$REG_UI" run build
[[ -f "$REG_UI/dist/index.html" ]] || fail "Registry UI build did not produce dist/index.html"
# Use actual transport dependencies; never go get core@latest or patch dependency versions.
python3 - "$ROOT" "$STAGE" "$MODULE" "$REG_UI/dist" <<'PY'
import pathlib,shutil,sys
root,stage=map(pathlib.Path,sys.argv[1:3]); module=sys.argv[3]; ui=pathlib.Path(sys.argv[4])
shutil.copytree(root/'internal',stage/'internal')
shutil.copytree(ui,stage/'internal/admin/web/react')
shutil.copy(root/'native/main.go',stage/'main.go')
shutil.copy(root/'native/main_test.go',stage/'main_test.go')
(stage/'abi-probe').mkdir()
shutil.copy(root/'integration/native_probe.go',stage/'abi-probe/main.go')
(stage/'legacy-proof').mkdir()
shutil.copy(root/'integration/legacy_plugin.go',stage/'legacy-proof/main.go')
for f in stage.rglob('*.go'):
    f.write_text(f.read_text().replace('"bifrost-registry/internal/', '"'+module+'/registry-plugin/internal/'))
PY
cd "$BF/transports"
export GOWORK=off CGO_ENABLED=1
# Both packages are loaded together before build, so the same dependency versions
# are selected. -mod=readonly stops silent go.mod/go.sum edits.
FLAGS=(-mod=readonly -trimpath -buildvcs=false -tags=bifrost)
go list "${FLAGS[@]}" -deps ./bifrost-http ./registry-plugin ./registry-plugin/abi-probe ./registry-plugin/legacy-proof >/dev/null
go test -mod=readonly -tags=bifrost ./registry-plugin
{
 printf 'Bifrost checkout: '; git -c safe.directory='*' -C "$BF" rev-parse HEAD 2>/dev/null || printf 'unknown (git safe.directory)'
 printf 'Go: '; go version
 printf 'Toolchain env: '; go env GOVERSION GOOS GOARCH CGO_ENABLED GOWORK
 printf 'Build flags: '; printf '%s ' "${FLAGS[@]}"; printf '\n'
 printf '\nResolved dependencies:\n'; go list -m all
} > "$OUT/build-environment.txt"
printf 'Building native Bifrost and registry plugin from the same module…\n'
go build "${FLAGS[@]}" -ldflags='-w -s' -o "$OUT/bifrost-http" ./bifrost-http
go build "${FLAGS[@]}" -ldflags='-w -s' -buildmode=plugin -o "$OUT/bifrost-registry.so" ./registry-plugin
go build "${FLAGS[@]}" -ldflags='-w -s' -buildmode=plugin -o "$OUT/legacy-hook-proof.so" ./registry-plugin/legacy-proof
go build "${FLAGS[@]}" -ldflags='-w -s' -o "$OUT/native-probe" ./registry-plugin/abi-probe
"$OUT/native-probe" "$OUT/bifrost-registry.so" > "$OUT/abi-smoke.json"
go version -m "$OUT/bifrost-http" > "$OUT/gateway-build-info.txt"
go version -m "$OUT/bifrost-registry.so" > "$OUT/plugin-build-info.txt"
go version -m "$OUT/legacy-hook-proof.so" > "$OUT/legacy-plugin-build-info.txt"
python3 - "$OUT" <<'PY'
import hashlib,pathlib,sys
p=pathlib.Path(sys.argv[1]);names=['bifrost-http','bifrost-registry.so','legacy-hook-proof.so','native-probe']
(p/'SHA256SUMS').write_text(''.join(hashlib.sha256((p/n).read_bytes()).hexdigest()+'  '+n+'\n' for n in names))
PY
printf '\nBuilt artifacts: %s\n' "$OUT"
printf 'ABI smoke passed. No deployment or live inference test was performed.\n'
printf 'Run the gateway and .so together on a matching OS/architecture/libc.\n'
