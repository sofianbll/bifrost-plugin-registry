#!/usr/bin/env bash
# Puts a plugin build on the owner's TEST COPY gateway: a docker compose project on the host alias `pulsar`
# (folder ~/build/bifrost-registry-test, container bifrost-registry-test, plugin mounted from
# plugins/bifrost-registry-dev.so). The steps are in docs/agents/test-copy.md.
#   scripts/test-copy-install.sh <dir with bifrost-registry.so and SHA256SUMS>            dry run: prints the plan, changes nothing
#   scripts/test-copy-install.sh <dir with bifrost-registry.so and SHA256SUMS> --apply   runs it
# --apply: checks the local SHA256SUMS line, backs up the mounted plugin and data/registry/registry.json on the host
# (label from BACKUP_LABEL, default `install`), copies the new file next to the mounted one, compares its checksum on
# the host and stops if it differs, swaps it in, runs `docker compose up -d --force-recreate` in the test copy's folder,
# waits up to ~90 s for the container to be healthy, prints the plugin status log line and the rollback commands.
# Overrides, for another test copy only: TEST_COPY_HOST (default pulsar), TEST_COPY_DIR (default
# build/bifrost-registry-test, relative to the host's home), TEST_COPY_CONTAINER (must stay bifrost-registry-test).
# Never: touches the production container `bifrost` or port 9208 (any override that names them is refused), runs
# `docker restart` or `docker rm`, reads or prints an env or secret file, or contacts anything but the one host.
set -euo pipefail

echo "TEST COPY ONLY: this never touches the production gateway"

HOST=${TEST_COPY_HOST:-pulsar}
DIR=${TEST_COPY_DIR:-build/bifrost-registry-test}
CONTAINER=${TEST_COPY_CONTAINER:-bifrost-registry-test}
LABEL=${BACKUP_LABEL:-install}
BACKUPS=Data/backups/cleanup-20261008
DIR=${DIR#'~/'}
DIR=${DIR%/}

die() { echo "$1" >&2; exit 1; }
refuse() { echo "refused: $1" >&2; exit 2; }
usage() { echo "usage: $0 <dir with bifrost-registry.so and SHA256SUMS> [--apply]" >&2; exit 2; }

# Hard safety, before anything else: the production container is `bifrost` as a whole word (bifrost-registry-test is
# fine), its port is 9208, and the three names end up inside remote shell commands, so their characters are restricted.
prod_re='(^|[^A-Za-z0-9_-])bifrost($|[^A-Za-z0-9_-])'
for v in "$HOST" "$DIR" "$CONTAINER"; do
  if [[ $v =~ $prod_re || $v == *9208* ]]; then refuse "'$v' names the production gateway"; fi
done
[[ $CONTAINER == bifrost-registry-test ]] || refuse "the container must be exactly bifrost-registry-test"
[[ $DIR == bifrost-registry-test || $DIR == */bifrost-registry-test ]] || refuse "the folder must end with bifrost-registry-test"
[[ $DIR =~ ^[A-Za-z0-9._/-]+$ && $DIR != *..* ]] || refuse "the folder has characters outside A-Z a-z 0-9 . _ / -"
[[ $HOST =~ ^[A-Za-z0-9][A-Za-z0-9._@-]*$ ]] || refuse "the host has characters outside A-Z a-z 0-9 . _ @ -"
[[ $LABEL =~ ^[A-Za-z0-9._-]+$ ]] || refuse "BACKUP_LABEL has characters outside A-Z a-z 0-9 . _ -"

src="" apply=0
for a in "$@"; do
  case $a in
    --apply) apply=1 ;;
    -*) usage ;;
    *) [[ -z $src ]] || usage; src=$a ;;
  esac
done
[[ -n $src ]] || usage

sha256() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi | awk '{ print $1 }'; }

# 1. The local file against its SHA256SUMS line (only the bifrost-registry.so line; the pair also lists the gateway).
[[ -d $src ]] || die "$src is not a directory"
src=$(cd "$src" && pwd)
so=$src/bifrost-registry.so
[[ -f $so && -f $src/SHA256SUMS ]] || die "$src needs bifrost-registry.so and SHA256SUMS"
want=$(awk '{ f = $2; sub(/^\*/, "", f); sub(/^\.\//, "", f); if (f == "bifrost-registry.so") print $1 }' "$src/SHA256SUMS")
[[ $want =~ ^[0-9a-f]{64}$ ]] || die "SHA256SUMS has no single valid line for bifrost-registry.so"
have=$(sha256 "$so")
[[ $have == "$want" ]] || die "checksum mismatch: bifrost-registry.so is $have, SHA256SUMS says $want; nothing was sent"

PLUGIN=$DIR/plugins/bifrost-registry-dev.so
REGISTRY=$DIR/data/registry/registry.json
NEW=$PLUGIN.new
ts=$(date -u +%Y%m%dT%H%M%SZ)
BK_PLUGIN=$BACKUPS/test-plugin.before-$LABEL-$ts.so
BK_REGISTRY=$BACKUPS/test-registry.before-$LABEL-$ts.json

# Remote commands; every path is relative to the host's home. The login shell of the host runs them.
backup_cmd="set -e; mkdir -p $BACKUPS; cp -p $PLUGIN $BK_PLUGIN; cp -p $REGISTRY $BK_REGISTRY; ls -l $BK_PLUGIN $BK_REGISTRY"
sha_cmd="(sha256sum $NEW 2>/dev/null || shasum -a 256 $NEW) | cut -d' ' -f1"
swap_cmd="cd $DIR && mv -f plugins/bifrost-registry-dev.so.new plugins/bifrost-registry-dev.so && docker compose up -d --force-recreate"
read -r -d '' health_tpl <<'EOF' || true
i=0; s=
while [ "$i" -lt 45 ]; do
  s=$(docker inspect -f '{{.State.Health.Status}}' CONTAINER 2>/dev/null) || s=
  [ "$s" = healthy ] && break
  i=$((i + 1)); sleep 2
done
docker logs CONTAINER 2>&1 | grep 'plugin status: bifrost-registry' | tail -n 1
echo "health=$s"
EOF
health_cmd=${health_tpl//CONTAINER/$CONTAINER}
# The registry file is copied back in place (the container may own it); the plugin goes through a rename, like the install.
rollback_cmd="cp -p $BK_PLUGIN $PLUGIN.rollback && mv -f $PLUGIN.rollback $PLUGIN && cp -p $BK_REGISTRY $REGISTRY && cd $DIR && docker compose up -d --force-recreate"

echo
echo "Plan for host alias '$HOST', folder ~/$DIR, container $CONTAINER:"
echo "  1. local checksum of bifrost-registry.so matches SHA256SUMS: ok ($have)"
echo "  2. ssh $HOST, back up the mounted plugin and registry.json (label '$LABEL', $ts):"
echo "       $backup_cmd"
echo "  3. scp $so -> $HOST:$NEW"
echo "  4. ssh $HOST, checksum of the copy must equal $have, else stop:"
echo "       $sha_cmd"
echo "  5. ssh $HOST, swap it in and recreate the test copy only:"
echo "       $swap_cmd"
echo "  6. ssh $HOST, wait up to ~90 s for $CONTAINER to be healthy, print its plugin status line:"
printf '%s\n' "$health_cmd" | sed 's/^/       /'
echo "  7. rollback (printed again at the end):"
echo "       ssh $HOST '$rollback_cmd'"
if (( ! apply )); then
  echo
  echo "Dry run: nothing was changed. Add --apply to run these steps."
  exit 0
fi

ssh_opts=(-o BatchMode=yes -o ConnectTimeout=10)
rssh() { ssh "${ssh_opts[@]}" "$HOST" "$1"; }
step() { printf '\n[%s] %s\n' "$1" "$2"; }

# Once the swap starts, every way out (failure included) ends with the rollback commands.
swapping=0
finish() {
  local rc=$?
  if (( swapping )); then
    echo
    echo "Rollback (restores the previous plugin and registry.json, then recreates the test copy):"
    echo "  ssh $HOST '$rollback_cmd'"
  fi
  exit "$rc"
}
trap finish EXIT

step 2 "backups on $HOST"
rssh "$backup_cmd"
step 3 "copy the new plugin next to the mounted one"
scp "${ssh_opts[@]}" -- "$so" "$HOST:$NEW"
step 4 "compare checksums"
remote=$(rssh "$sha_cmd") || die "could not read the checksum of $NEW on $HOST"
remote=$(printf '%s\n' "$remote" | awk 'NR == 1 { print $1 }')
[[ $remote == "$have" ]] || die "checksum on $HOST is '$remote', local is $have: stopped before replacing anything; $NEW is left on the host"
echo "checksums match"
step 5 "swap in and recreate the test copy"
swapping=1
rssh "$swap_cmd"
step 6 "wait for $CONTAINER to be healthy"
out=$(rssh "$health_cmd") || true
plugin_line=$(printf '%s\n' "$out" | grep 'plugin status: bifrost-registry' || true)
echo "${plugin_line:-no 'plugin status: bifrost-registry' line in the container logs}"
if printf '%s\n' "$out" | grep -qx 'health=healthy'; then
  echo "$CONTAINER is healthy"
else
  die "$CONTAINER did not become healthy in ~90 s; consider the rollback below"
fi
