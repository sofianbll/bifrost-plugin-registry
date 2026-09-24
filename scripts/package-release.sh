#!/usr/bin/env bash
# Package the verified dynamic gateway and its separately installable plugin.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ $# == 3 ]] || fail "usage: $0 RELEASE_ID IMAGE_TAG NEW_OUTPUT_DIRECTORY"
RELEASE_ID=$1
IMAGE_TAG=$2
OUT=$3
[[ $RELEASE_ID =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ && $RELEASE_ID != *..* ]] || fail "release ID must be a safe filename component"
[[ -n $IMAGE_TAG && $IMAGE_TAG != *[[:space:]]* ]] || fail "image tag is required"
[[ ! -e $OUT ]] || fail "output directory already exists: $OUT"
command -v docker >/dev/null || fail "Docker is required"
command -v python3 >/dev/null || fail "Python 3 is required"
command -v sha256sum >/dev/null || fail "sha256sum is required"
[[ -d $ROOT/ui/node_modules ]] || fail "UI dependencies are required for license notices; run npm --prefix ui ci"

PAIR=${PAIR_DIR:-"$ROOT/dist/standalone-v1"}
REPORT=${PROOF_DIR:-"$ROOT/reports/plugin-standalone"}
SOURCE="$ROOT/dist/source-standalone-222"
LICENSE_SOURCE="$ROOT/dist/source-native-ui"
for file in "$PAIR/bifrost-http" "$PAIR/bifrost-registry.so" "$PAIR/SHA256SUMS" "$PAIR/build-environment.txt" \
  "$PAIR/gateway-build-info.txt" "$PAIR/plugin-build-info.txt" \
  "$REPORT/SHA256SUMS" "$REPORT/build-environment.txt" "$REPORT/source-verification.json" \
  "$SOURCE/transports/docker-entrypoint.sh" "$LICENSE_SOURCE/LICENSE" \
  "$LICENSE_SOURCE/THIRD_PARTY_NOTICES.md" "$ROOT/LICENSE"; do
  [[ -f $file && ! -L $file ]] || fail "missing or linked input: $file"
done
cmp -s "$PAIR/SHA256SUMS" "$REPORT/SHA256SUMS" || fail "paired SHA256 reports differ"
cmp -s "$PAIR/build-environment.txt" "$REPORT/build-environment.txt" || fail "paired build environments differ"
(cd "$PAIR" && sha256sum -c SHA256SUMS >/dev/null) || fail "verified pair checksum failed"
ARCH=$(python3 - "$PAIR" "$REPORT" <<'PY'
import json, pathlib, sys
pair, report = map(pathlib.Path, sys.argv[1:])
provenance = json.loads((report / "source-verification.json").read_text())
expected = {"tag": "transports/v2.2.2", "commit": "fdeef8e3f31a3b18a61666ba49247d07bae3600a", "go": "go1.27.1", "official_prebuilt_image": False, "after_compilation_modified_tracked_files": []}
if not all(provenance.get(k) == v for k, v in expected.items()):
    sys.exit("unexpected source provenance")
platform = provenance.get("platform")
if platform not in ("linux/arm64 musl", "linux/amd64 musl"):
    sys.exit("unsupported platform")
arch = platform.split("/")[1].split()[0]
env = (pair / "build-environment.txt").read_text()
if f"Go: go version go1.27.1 linux/{arch}\n" not in env:
    sys.exit("build environment differs from provenance")
for name, mode in (("gateway", "exe"), ("plugin", "plugin")):
    info = (pair / f"{name}-build-info.txt").read_text()
    if not info.splitlines()[0].endswith(": go1.27.1"):
        sys.exit(f"{name} Go version differs")
    for field in (f"-buildmode={mode}", "CGO_ENABLED=1", f"GOARCH={arch}", "GOOS=linux", "-tags=bifrost"):
        if f"\tbuild\t{field}" not in info:
            sys.exit(f"{name} missing build setting {field}")
print(arch)
PY
) || fail "build metadata does not match a supported Linux/musl pair"
case $ARCH in
  arm64) ELF_ARCH='ARM aarch64'; MUSL_ARCH='aarch64' ;;
  amd64) ELF_ARCH='x86-64'; MUSL_ARCH='x86_64' ;;
  *) fail "unsupported architecture: $ARCH" ;;
esac
file "$PAIR/bifrost-http" | grep -q "ELF 64-bit.*$ELF_ARCH.*dynamically linked.*ld-musl-$MUSL_ARCH" || fail "gateway is not a dynamic Linux $ARCH/musl executable"
file "$PAIR/bifrost-registry.so" | grep -q "ELF 64-bit.*$ELF_ARCH.*dynamically linked" || fail "plugin is not a dynamic Linux $ARCH shared object"

mkdir -p "$OUT/image-context/licenses" "$OUT/plugin" "$OUT/provenance"
cp "$ROOT/packaging/Dockerfile" "$OUT/image-context/Dockerfile"
cp "$PAIR/bifrost-http" "$OUT/image-context/main"
cp "$SOURCE/transports/docker-entrypoint.sh" "$OUT/image-context/docker-entrypoint.sh"
cp "$LICENSE_SOURCE/LICENSE" "$OUT/image-context/licenses/BIFROST-LICENSE"
cp "$LICENSE_SOURCE/THIRD_PARTY_NOTICES.md" "$OUT/image-context/licenses/BIFROST-THIRD_PARTY_NOTICES.md"
cp "$ROOT/LICENSE" "$OUT/plugin/LICENSE"
python3 - "$ROOT" "$OUT/plugin" <<'PY'
import json
import pathlib
import re
import shutil
import sys
from urllib.parse import quote

root, plugin = map(pathlib.Path, sys.argv[1:])
ui = root / "ui"
lock = json.loads((ui / "package-lock.json").read_text())
packages = lock["packages"]
licenses = plugin / "licenses"
licenses.mkdir()
shutil.copyfile(ui / "LICENSE", licenses / "BIFROST-UI-APACHE-2.0.txt")
shutil.copyfile(ui / "PROVENANCE.md", licenses / "BIFROST-UI-PROVENANCE.md")
shutil.copyfile(ui / "public/static/fonts/OFL.txt", licenses / "GEIST-OFL-1.1.txt")

# The dependency closure covers code bundled by Vite; Tailwind also contributes generated CSS.
pending = [f"node_modules/{name}" for name in packages[""]["dependencies"]]
pending.append("node_modules/tailwindcss")
selected = set()
while pending:
    key = pending.pop()
    if key in selected:
        continue
    if key not in packages:
        raise SystemExit(f"missing lockfile package: {key}")
    selected.add(key)
    entry = packages[key]
    for name in entry.get("dependencies", {}):
        parent = key
        while True:
            nested = f"{parent}/node_modules/{name}"
            if nested in packages:
                pending.append(nested)
                break
            if "/node_modules/" not in parent:
                pending.append(f"node_modules/{name}")
                break
            parent = parent.rsplit("/node_modules/", 1)[0]
    for name in entry.get("optionalDependencies", {}):
        candidate = f"node_modules/{name}"
        if (ui / candidate).is_dir():
            pending.append(candidate)

mit = (root / "LICENSE").read_text()
(licenses / "MIT-TERMS.txt").write_text("MIT License\n\n" + mit.split("\n\n", 2)[2])
lines = [
    "# Bifrost Registry plugin third-party notices",
    "",
    "The plugin embeds the compiled Registry UI. Its own code is under the [Registry MIT license](LICENSE).",
    "Vendored Bifrost UI code and assets are under the [Apache 2.0 license](licenses/BIFROST-UI-APACHE-2.0.txt); [source provenance](licenses/BIFROST-UI-PROVENANCE.md) identifies the copied files.",
    "The bundled Geist fonts are under the [SIL Open Font License 1.1](licenses/GEIST-OFL-1.1.txt).",
    "",
    "## npm packages",
    "",
    "This inventory conservatively includes the runtime dependency closure from `ui/package-lock.json` and Tailwind CSS, which generates bundled styles. It is supplementary attribution, not a claim that every listed package's code appears in the final bundle.",
    "",
    "| Package | Version | Declared license | Distributed license text |",
    "| --- | --- | --- | --- |",
]
for key in sorted(selected):
    name = key.rsplit("node_modules/", 1)[1]
    if not re.fullmatch(r"(?:@[-\w.]+/)?[-\w.]+", name):
        raise SystemExit(f"unsafe package name: {name}")
    source = ui / key
    if not source.is_dir() or source.is_symlink():
        raise SystemExit(f"missing installed package: {key}; run npm --prefix ui ci")
    info = json.loads((source / "package.json").read_text())
    version = packages[key]["version"]
    if info["version"] != version:
        raise SystemExit(f"installed version differs from lockfile: {key}")
    license_id = packages[key].get("license") or info.get("license")
    if not isinstance(license_id, str):
        raise SystemExit(f"missing declared license: {key}")
    destination = licenses / "npm" / name / version
    destination.mkdir(parents=True)
    files = sorted(p for p in source.iterdir() if p.is_file() and re.match(r"^(?:licen[sc]e|copying|notice)(?:[.-]|$)|^copyright", p.name, re.I))
    links = []
    for file in files:
        if file.is_symlink():
            raise SystemExit(f"linked license input: {file}")
        shutil.copyfile(file, destination / file.name)
        links.append(f"[{file.name}]({quote((destination / file.name).relative_to(plugin).as_posix())})")
    if not links:
        if license_id != "MIT":
            raise SystemExit(f"no full license text for {key}: {license_id}")
        links = ["[MIT terms](licenses/MIT-TERMS.txt) (package tarball has no license file)"]
    lines.append(f"| `{name}` | `{version}` | `{license_id}` | {', '.join(links)} |")
(plugin / "THIRD_PARTY_NOTICES.md").write_text("\n".join(lines) + "\n")
PY
cp "$PAIR/bifrost-registry.so" "$OUT/plugin/bifrost-registry-${RELEASE_ID}-linux-${ARCH}.so"
cp "$PAIR/SHA256SUMS" "$PAIR/build-environment.txt" "$PAIR/gateway-build-info.txt" \
  "$PAIR/plugin-build-info.txt" "$REPORT/source-verification.json" "$OUT/provenance/"
(
  cd "$OUT/plugin"
  sha256sum "bifrost-registry-${RELEASE_ID}-linux-${ARCH}.so" > SHA256SUMS
)
python3 - "$OUT" "$RELEASE_ID" "$IMAGE_TAG" "$ARCH" <<'PY'
import hashlib, json, pathlib, sys
out, release, tag, arch = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = {
    "release_id": release,
    "image_tag": tag,
    "platform": f"linux/{arch} musl",
    "bifrost_source_commit": "fdeef8e3f31a3b18a61666ba49247d07bae3600a",
    "go": "go1.27.1",
    "gateway_sha256": sha(out / "image-context/main"),
    "plugin_file": f"bifrost-registry-{release}-linux-{arch}.so",
    "plugin_sha256": sha(out / "plugin" / f"bifrost-registry-{release}-linux-{arch}.so"),
    "plugin_install": "URL to the plugin_file; image contains no plugin",
}
(out / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
PY

docker build --pull=false --platform "linux/$ARCH" -t "$IMAGE_TAG" "$OUT/image-context"
printf 'Built %s; plugin ready at %s/plugin/bifrost-registry-%s-linux-%s.so\n' "$IMAGE_TAG" "$OUT" "$RELEASE_ID" "$ARCH"
