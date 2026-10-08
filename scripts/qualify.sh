#!/usr/bin/env bash
# Natively build the Bifrost gateway + Registry plugin pair from the pinned upstream
# source, then run the qualification suites. Output: dist/qualify/<arch>/. Deploys nothing.
# Host: bash, git, python3 and Docker, natively on <arch> (no emulation, no cross-compilation).
# Builds the committed HEAD of this repository; uncommitted changes are not qualified.
# Without a STAGE everything runs; CI runs each stage as its own step.
# REGISTRY_VERSION (build stage): the release stamped into the plugin; release.yml passes its tag.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
SUITES=(models standalone-restart standalone-assistant capabilities adoption)
[[ $# -ge 1 && $# -le 2 && $1 =~ ^(amd64|arm64)$ ]] || fail "usage: $0 amd64|arm64 [STAGE], STAGE: build ${SUITES[*]}"
ARCH=$1 STAGE=${2:-all}
# Every step runs in Docker without --platform, so Docker's architecture is the build's.
[[ $(docker version -f '{{.Server.Arch}}') == "$ARCH" ]] || fail "Docker must run natively on $ARCH (no emulation, no cross-compilation)"
command -v git >/dev/null && command -v python3 >/dev/null || fail "git and python3 are required"

# bifrost.pin is data: only these keys are read, and values are never evaluated.
while IFS= read -r line || [[ -n $line ]]; do
  case $line in
    '' | '#'*) ;;
    BIFROST_TAG=* | BIFROST_COMMIT=* | GO_VERSION=* | ALPINE_VERSION=* | GO_IMAGE=* | PY_IMAGE=*)
      printf -v "${line%%=*}" '%s' "${line#*=}"; export "${line%%=*}" ;;
    *) fail "unexpected line in bifrost.pin: $line" ;;
  esac
done < "$ROOT/bifrost.pin"
[[ ${BIFROST_TAG:-} =~ ^transports/v[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "BIFROST_TAG must be transports/vX.Y.Z"
[[ ${BIFROST_COMMIT:-} =~ ^[0-9a-f]{40}$ ]] || fail "BIFROST_COMMIT must be a full commit SHA"
[[ ${GO_VERSION:-} =~ ^[0-9]+\.[0-9]+\.[0-9]+$ && ${ALPINE_VERSION:-} =~ ^[0-9]+\.[0-9]+$ ]] || fail "invalid GO_VERSION or ALPINE_VERSION"
[[ ${GO_IMAGE:-} =~ ^golang:"$GO_VERSION-alpine$ALPINE_VERSION"@sha256:[0-9a-f]{64}$ ]] || fail "GO_IMAGE must be golang:$GO_VERSION-alpine$ALPINE_VERSION@sha256:<index digest>"
[[ ${PY_IMAGE:-} =~ ^python:3\.[0-9]+-alpine"$ALPINE_VERSION"@sha256:[0-9a-f]{64}$ ]] || fail "PY_IMAGE must be python:3.N-alpine$ALPINE_VERSION@sha256:<index digest>"
VERSION=${BIFROST_TAG#transports/v}
USR=$(id -u):$(id -g)
OUT=$ROOT/dist/qualify/$ARCH
SRC=$OUT/bifrost                 # plain export of the upstream build inputs, without Git metadata
UPSTREAM_GIT=$OUT/upstream.git   # bare clone, never mounted into a container
UPSTREAM_DIRS=(core framework plugins transports ui)
FIXTURE=qualify-adoption-$ARCH-$$
# Every container is disposable and unprivileged, without capabilities.
SAFE=(--rm --user "$USR" --cap-drop ALL --security-opt no-new-privileges)
trap 'docker rm -f "$FIXTURE" >/dev/null 2>&1 || true; rm -f "$OUT/reports/adoption-fixture/browser-auth.json"' EXIT

# The export must be exactly the pinned tree: every tracked file matches its Git blob ID and
# nothing else exists besides the expected build outputs. Git only reads the bare clone.
# Before the build (no argument) it prints the tree digest; after it (given that digest, held by
# this shell) it also writes source-verification.json into pair/, which no container mounts writable.
verify_source() {
  ARCH=$ARCH REGISTRY_COMMIT=$REGISTRY_COMMIT python3 - "$UPSTREAM_GIT" "$SRC" "$OUT/pair/source-verification.json" "${1:-}" "${UPSTREAM_DIRS[@]}" <<'PY'
import hashlib, json, os, stat, subprocess, sys
repo, src, path, digest, *dirs = sys.argv[1:]
env, src = os.environ, os.fsencode(src)
# Created by the Bifrost UI build (npm ci, vite, tsc) and its copy into the gateway.
GENERATED = {b"ui/node_modules", b"ui/out", b"ui/app/routeTree.gen.ts", b"ui/tsconfig.tsbuildinfo", b"transports/bifrost-http/ui"}
git = lambda *args: subprocess.run(["git", "-C", repo, *args], check=True, capture_output=True).stdout
head = git("rev-parse", "HEAD").decode().strip()
listing = git("ls-tree", "-r", "-z", head, "--", *dirs)
tracked, mismatches, unexpected = set(), [], []
for entry in filter(None, listing.split(b"\0")):
    meta, name = entry.split(b"\t", 1)
    mode, _, blob = meta.split()
    tracked.add(name)
    full = os.path.join(src, name)
    try:
        kind = os.lstat(full).st_mode
        link = mode == b"120000"
        data = os.readlink(full) if link and stat.S_ISLNK(kind) else open(full, "rb").read() if not link and stat.S_ISREG(kind) else None
    except OSError:
        data = None
    if data is None or hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest().encode() != blob:
        mismatches.append(os.fsdecode(name))
for top, subdirs, files in os.walk(src, onerror=lambda error: unexpected.append(os.fsdecode(error.filename))):
    for name in subdirs + files:
        rel = os.path.relpath(os.path.join(top, name), src)
        if rel in GENERATED:
            if name in subdirs:
                subdirs.remove(name)
        elif rel not in tracked and not stat.S_ISDIR(os.lstat(os.path.join(top, name)).st_mode):
            unexpected.append(os.fsdecode(rel))
tree = hashlib.sha256(listing).hexdigest()
ok = head == env["BIFROST_COMMIT"] and tracked and not mismatches and not unexpected and digest in ("", tree)
if digest:
    report = {"tag": env["BIFROST_TAG"], "commit": env["BIFROST_COMMIT"], "platform": f"linux/{env['ARCH']} musl",
              "go": "go" + env["GO_VERSION"], "official_prebuilt_image": False, "verified_files": len(tracked),
              "after_compilation_modified_tracked_files": mismatches, "unexpected_files": unexpected,
              "tree_digest": tree, "scope": f"scripts/qualify.sh {env['ARCH']} (registry {env['REGISTRY_COMMIT']})"}
    with open(path, "w") as out:
        json.dump(report, out, indent=2)
        out.write("\n")
else:
    print(tree)
if not ok:
    print(f"upstream HEAD {head}, tree {tree}, mismatches {mismatches[:20]}, unexpected {unexpected[:20]}", file=sys.stderr)
sys.exit(0 if ok else 1)
PY
}

build() {
  [[ ! -e $OUT ]] || fail "$OUT already exists; remove it first (nothing is overwritten)"
  mkdir -p "$OUT/registry" "$OUT/proof" "$SRC" "$OUT/build" "$OUT/pair" "$OUT/reports"
  REGISTRY_COMMIT=$(git -C "$ROOT" rev-parse HEAD)
  # Without a release tag, the commit: every qualification still exercises the version stamp.
  local registry_version=${REGISTRY_VERSION:-dev-${REGISTRY_COMMIT:0:12}}
  [[ -z $(git -C "$ROOT" status --porcelain) ]] || printf 'note: uncommitted changes are not qualified; building %s\n' "$REGISTRY_COMMIT"
  git -C "$ROOT" archive "$REGISTRY_COMMIT" | tar -x -C "$OUT/registry"
  # The suites run the probes from their own export, which the build containers never mount.
  git -C "$ROOT" archive "$REGISTRY_COMMIT:integration" | tar -x -C "$OUT/proof"
  git clone --quiet --bare --depth 1 --branch "$BIFROST_TAG" https://github.com/maximhq/bifrost.git "$UPSTREAM_GIT"
  git -C "$UPSTREAM_GIT" archive HEAD "${UPSTREAM_DIRS[@]}" | tar -x -C "$SRC"
  local digest node_image builder
  digest=$(verify_source) || fail "upstream export does not match $BIFROST_TAG at $BIFROST_COMMIT"

  # Bifrost UI with upstream's own digest-pinned builder image, from its verified transports/Dockerfile.
  node_image=$(awk '$1 == "FROM" && $NF == "ui-builder" {print $2}' "$SRC/transports/Dockerfile")
  [[ $node_image =~ @sha256:[0-9a-f]{64}$ ]] || fail "upstream ui-builder image is not pinned by digest: ${node_image:-none}"
  docker run "${SAFE[@]}" -e HOME=/tmp -v "$SRC:/src" -w /src/ui "$node_image" \
    sh -euc 'npm ci && npm run build-enterprise && cp -r out ../transports/bifrost-http/ui'
  # The toolchain is installed at image build time, so the build itself needs no root.
  builder=$(printf 'FROM %s\nRUN apk add --no-cache bash git python3 nodejs npm gcc musl-dev\n' "$GO_IMAGE" | docker build -q -)
  docker run "${SAFE[@]}" -e HOME=/tmp -e BIFROST_VERSION="v$VERSION" -e REGISTRY_VERSION="$registry_version" \
    -v "$OUT/registry:/q/registry" -v "$SRC:/q/bifrost" -v "$OUT/build:/q/build" "$builder" \
    /q/registry/scripts/build-with-bifrost.sh /q/bifrost /q/build/out
  grep -qx "Go: go version go$GO_VERSION linux/$ARCH" "$OUT/build/out/build-environment.txt" || fail "pair was not built with Go $GO_VERSION on linux/$ARCH"
  verify_source "$digest" || fail "the build changed the upstream export (see $OUT/pair/source-verification.json)"

  # The pair ships the gateway and plugin only, so SHA256SUMS lists just those two.
  cp "$OUT/build/out/"{bifrost-http,bifrost-registry.so,build-environment.txt,gateway-build-info.txt,plugin-build-info.txt,abi-smoke.json} "$OUT/pair/"
  grep -E '  (bifrost-http|bifrost-registry\.so)$' "$OUT/build/out/SHA256SUMS" > "$OUT/pair/SHA256SUMS"
  # Recorded by the host: the images behind the build and the suites, and the builder's packages.
  {
    printf '\nDocker engine: %s\n' "$(docker version --format '{{.Server.Version}}')"
    printf '\nImages (reference, image ID, repository digests):\n'
    for image in "$node_image" "$GO_IMAGE" "$PY_IMAGE"; do
      docker pull -q "$image" >/dev/null
      printf '%s ' "$image"; docker image inspect -f '{{.Id}} {{json .RepoDigests}}' "$image"
    done
    printf '\nGo builder packages (apk info -v):\n'
    docker run "${SAFE[@]}" --network none "$builder" apk info -v | sort
  } >> "$OUT/pair/build-environment.txt"
  sum() { awk -v name="$1" '$2 == name {print $1}' "$OUT/pair/SHA256SUMS"; }
  cat > "$OUT/pair/manifest.json" <<EOF
{
  "bifrost_version": "$VERSION",
  "bifrost_commit": "$BIFROST_COMMIT",
  "registry_commit": "$REGISTRY_COMMIT",
  "artifacts": {
    "bifrost-http": "$(sum bifrost-http)",
    "bifrost-registry.so": "$(sum bifrost-registry.so)"
  }
}
EOF
  tar -czf "$OUT/pair-linux-$ARCH.tar.gz" -C "$OUT/pair" .
}

# Suites: disposable unprivileged containers, read-only pair and probes, synthetic providers only.
RUN=(docker run "${SAFE[@]}" -v "$OUT/proof:/proof:ro" -v "$OUT/pair:/art:ro" -v "$OUT/reports:/out")
PAIR=(--gateway /art/bifrost-http --plugin /art/bifrost-registry.so --expected-version "$VERSION")
suite() {
  local probe
  case $1 in
    models) probe=(isolated_models.py --manifest /art/manifest.json) ;;
    standalone-restart) probe=(standalone_plugin_probe.py) ;;
    standalone-assistant) probe=(standalone_plugin_probe.py --assistant-fixture) ;;
    capabilities) probe=(capabilities_probe.py) ;;
    adoption) adoption; return ;;
    *) fail "unknown stage: $1" ;;
  esac
  "${RUN[@]}" --network none "$PY_IMAGE" python "/proof/${probe[0]}" "${PAIR[@]}" "${probe[@]:1}" --out "/out/$1"
}

# Adoption: the probe joins the fixture's own network namespace, which has loopback only.
adoption() {
  local status=0
  "${RUN[@]}" -d --name "$FIXTURE" --network none "$PY_IMAGE" \
    python /proof/standalone_plugin_probe.py "${PAIR[@]}" --keep-alive --assistant-fixture --out /out/adoption-fixture >/dev/null
  for _ in $(seq 180); do
    [[ -e $OUT/reports/adoption-fixture/report.json ]] || ! docker container inspect "$FIXTURE" >/dev/null 2>&1 && break
    sleep 1
  done
  "${RUN[@]}" --network "container:$FIXTURE" "$PY_IMAGE" python /proof/adoption_live_probe.py \
    --auth /out/adoption-fixture/browser-auth.json --out /out/adoption/adoption-report.json || status=1
  docker stop "$FIXTURE" >/dev/null 2>&1 || true
  python3 -c 'import json, sys; sys.exit(json.load(open(sys.argv[1])).get("passed") is not True)' \
    "$OUT/reports/adoption-fixture/report.json" || status=1
  return $status
}

case $STAGE in
  build) build ;;
  all)
    build
    FAILED=()
    for name in "${SUITES[@]}"; do suite "$name" || FAILED+=("$name"); done
    (( ${#FAILED[@]} == 0 )) || fail "failed suites: ${FAILED[*]} (reports in $OUT/reports)"
    printf 'Qualified Bifrost %s pair on linux/%s: %s\n' "$VERSION" "$ARCH" "$OUT/pair-linux-$ARCH.tar.gz" ;;
  *)
    [[ -f $OUT/pair/manifest.json ]] || fail "run the build stage for $ARCH first"
    suite "$STAGE" ;;
esac
