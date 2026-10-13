#!/usr/bin/env bash
# Honest full verification: `make check`, then the browser journeys, and only if the first one passed.
# Each step writes its whole output to dist/checks/verify/<step>.log (ignored by Git). The summary names every
# step PASSED, FAILED or SKIPPED, shows the last 6 lines of a failed log, and ends with ONE line:
# `VERIFY PASSED` or `VERIFY FAILED (<step>)`. The exit status is 0 only when every step passed, because a
# wrapper that reports just its last command's status once called a failed `make check` a success.
#   scripts/verify.sh                     or: make verify
# Overrides, used by scripts/test-verify.sh: VERIFY_CHECK_CMD and VERIFY_E2E_CMD replace the two commands
# (each runs with `bash -c` from the repository root); FIXTURE_PORT pins the journeys' port, else a free one is picked.
# It never edits tracked files, installs browsers, pushes, or touches the network beyond what `make check` does.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

logs=dist/checks/verify
mkdir -p "$logs"
rm -f "$logs/check.log" "$logs/journeys.log" # a skipped step must not show a stale log

check_cmd=${VERIFY_CHECK_CMD:-make check}
e2e_cmd=${VERIFY_E2E_CMD:-}
if [[ -z $e2e_cmd ]]; then
  # ui/dist is built by `make check`; the fixture reads FIXTURE_PORT too, so the journeys never collide with a running one.
  if [[ -z ${FIXTURE_PORT:-} ]]; then
    FIXTURE_PORT=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])') \
      || { echo "VERIFY FAILED (no free port)"; exit 1; }
  fi
  export FIXTURE_PORT
  e2e_cmd='cd ui && npx playwright test'
fi

names=(check journeys)
cmds=("$check_cmd" "$e2e_cmd")
status=("" "")
failed=""
for i in 0 1; do
  name=${names[$i]}
  if [[ -n $failed ]]; then
    status[i]="SKIPPED because a previous step failed"
    continue
  fi
  echo "==> $name (log: $logs/$name.log)"
  if bash -c "${cmds[$i]}" > "$logs/$name.log" 2>&1; then
    status[i]=PASSED
  else
    status[i]=FAILED
    failed=$name
  fi
done

echo
for i in 0 1; do
  echo "${names[$i]}: ${status[$i]}"
  if [[ ${status[$i]} == FAILED ]]; then
    echo "  last lines of $logs/${names[$i]}.log:"
    tail -n 6 "$logs/${names[$i]}.log" | sed 's/^/    /'
  fi
done
if [[ -n $failed ]]; then
  echo "VERIFY FAILED ($failed)"
  exit 1
fi
echo "VERIFY PASSED"
