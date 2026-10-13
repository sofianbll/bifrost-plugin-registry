#!/usr/bin/env bash
# Exercises scripts/test-copy-install.sh with stub `ssh` and `scp` first in PATH. The stubs only log their
# arguments to a file and answer with canned text, so nothing here contacts a host.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
INSTALL=scripts/test-copy-install.sh

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir "$T/bin"
cat > "$T/bin/ssh" <<'STUB'
#!/usr/bin/env bash
line=$(printf 'ssh %s' "$*" | tr '\n' ' ')
printf '%s\n' "$line" >> "$STUB_LOG"
case "$*" in
  *sha256sum*) printf '%s\n' "$STUB_REMOTE_SHA" ;;
  *"docker inspect"*) echo '2026-10-14T00:00:00Z INF plugin status: bifrost-registry ready (stub)'; echo 'health=healthy' ;;
esac
STUB
cat > "$T/bin/scp" <<'STUB'
#!/usr/bin/env bash
printf 'scp %s\n' "$*" >> "$STUB_LOG"
STUB
chmod +x "$T/bin/ssh" "$T/bin/scp"

sha256() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi | awk '{ print $1 }'; }
mkdir "$T/good" "$T/bad"
printf 'stub plugin bytes' > "$T/good/bifrost-registry.so"
cp "$T/good/bifrost-registry.so" "$T/bad/"
good=$(sha256 "$T/good/bifrost-registry.so")
# The real pair also lists the gateway; the script must pick only the plugin's line.
printf '%s  bifrost-http\n%s  bifrost-registry.so\n' "$(printf 'x%.0s' {1..64})" "$good" > "$T/good/SHA256SUMS"
printf '%s  bifrost-registry.so\n' "$(printf '0%.0s' {1..64})" > "$T/bad/SHA256SUMS"

LOG=$T/stub.log
run() { # leading VAR=value words are the environment; the rest are the script's arguments
  local envs=()
  while [[ ${1:-} == *=* ]]; do envs+=("$1"); shift; done
  : > "$LOG"; rc=0
  env PATH="$T/bin:$PATH" STUB_LOG="$LOG" STUB_REMOTE_SHA="$good" ${envs[@]+"${envs[@]}"} bash "$INSTALL" "$@" > "$T/out.txt" 2>&1 || rc=$?
}
kinds() { # the order of the calls the stubs saw
  awk '
    /^scp /          { print "scp"; next }
    /docker inspect/ { print "health"; next }
    /force-recreate/ && /mv -f/ { print "swap"; next }
    /sha256sum/      { print "sha"; next }
    /cp -p/          { print "backup"; next }
    { print "other" }' "$LOG" | paste -sd' ' -
}

fails=0
pass() { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
banner='TEST COPY ONLY: this never touches the production gateway'

run "$T/good"
t="dry run: banner first, exit 0, plan printed, neither ssh nor scp called"
[[ $rc == 0 && $(head -n 1 "$T/out.txt") == "$banner" && ! -s $LOG ]] && grep -q '^Dry run: nothing was changed' "$T/out.txt" && pass "$t" || fail "$t"

run "$T/bad" --apply
t="--apply with a wrong checksum: stops before any ssh or scp"
[[ $rc != 0 && ! -s $LOG ]] && grep -q 'checksum mismatch' "$T/out.txt" && pass "$t" || fail "$t"

run BACKUP_LABEL=rc9 "$T/good" --apply
t="--apply: backup, scp, checksum, swap, health in that order; plugin status and rollback printed"
[[ $rc == 0 && $(kinds) == "backup scp sha swap health" && $(head -n 1 "$T/out.txt") == "$banner" ]] \
  && grep -q 'test-plugin.before-rc9-' "$LOG" && grep -q 'plugin status: bifrost-registry' "$T/out.txt" \
  && grep -q '^Rollback' "$T/out.txt" && pass "$t" || fail "$t"
t="--apply: every call is BatchMode, none names the production container, port 9208, restart or rm"
[[ $(grep -c . "$LOG") == 5 && $(grep -c 'BatchMode=yes' "$LOG") == 5 ]] \
  && ! grep -Eq 'bifrost( |$)|9208|docker (restart|rm)|\.env' "$LOG" && pass "$t" || fail "$t"

run STUB_REMOTE_SHA=deadbeef "$T/good" --apply
t="--apply: a different checksum on the host stops before the swap, with no rollback to print"
[[ $rc != 0 && $(kinds) == "backup scp sha" ]] && grep -q 'stopped before replacing anything' "$T/out.txt" \
  && ! grep -q '^Rollback' "$T/out.txt" && pass "$t" || fail "$t"

for override in TEST_COPY_CONTAINER=bifrost TEST_COPY_CONTAINER=bifrost-registry-test2 TEST_COPY_DIR=build/bifrost \
  TEST_COPY_DIR=build/bifrost/bifrost-registry-test TEST_COPY_DIR=build/other TEST_COPY_HOST=bifrost TEST_COPY_HOST=pulsar9208 \
  'TEST_COPY_HOST=-oProxyCommand=x'; do
  run "$override" "$T/good" --apply
  t="$override is refused before any ssh or scp"
  [[ $rc != 0 && ! -s $LOG ]] && grep -q '^refused:' "$T/out.txt" && pass "$t" || fail "$t"
done

if (( fails == 0 )); then echo "test-copy-install: all checks passed"; else echo "test-copy-install: $fails check(s) failed"; exit 1; fi
