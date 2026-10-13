#!/usr/bin/env bash
# Exercises scripts/verify.sh with `true`/`false` in place of `make check` and the journeys (VERIFY_CHECK_CMD,
# VERIFY_E2E_CMD). It runs a copy of the script inside a temporary tree, so the repository's dist/ is untouched
# and no real check, browser or network is involved.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir "$T/scripts"
cp scripts/verify.sh "$T/scripts/verify.sh"

fails=0
pass() { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
run() { # check command, e2e command; sets rc, keeps the output in $T/out.txt
  rm -f "$T/e2e-ran"
  rc=0
  VERIFY_CHECK_CMD=$1 VERIFY_E2E_CMD=$2 bash "$T/scripts/verify.sh" > "$T/out.txt" 2>&1 || rc=$?
}
last() { tail -n 1 "$T/out.txt"; }

run true "touch $T/e2e-ran"
t1="both pass: exit 0, both PASSED, final line VERIFY PASSED"
[[ $rc == 0 && $(last) == "VERIFY PASSED" && -e $T/e2e-ran ]] \
  && grep -q '^check: PASSED$' "$T/out.txt" && grep -q '^journeys: PASSED$' "$T/out.txt" && pass "$t1" || fail "$t1"

run 'echo check-went-wrong; false' "touch $T/e2e-ran"
t2="check fails: nonzero, journeys SKIPPED and never run, final line VERIFY FAILED (check), log tail shown"
[[ $rc != 0 && $(last) == "VERIFY FAILED (check)" && ! -e $T/e2e-ran ]] \
  && grep -q '^check: FAILED$' "$T/out.txt" && grep -q '^journeys: SKIPPED' "$T/out.txt" \
  && grep -q 'check-went-wrong' "$T/out.txt" && pass "$t2" || fail "$t2"

run true 'echo journeys-went-wrong; false'
t3="check passes and journeys fail: nonzero, final line VERIFY FAILED (journeys)"
[[ $rc != 0 && $(last) == "VERIFY FAILED (journeys)" ]] \
  && grep -q '^check: PASSED$' "$T/out.txt" && grep -q '^journeys: FAILED$' "$T/out.txt" \
  && grep -q 'journeys-went-wrong' "$T/out.txt" && pass "$t3" || fail "$t3"

if (( fails == 0 )); then echo "verify: all checks passed"; else echo "verify: $fails check(s) failed"; exit 1; fi
