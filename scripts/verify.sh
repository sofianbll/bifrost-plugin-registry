#!/usr/bin/env bash
# Honest full verification: `make check`, then lint, then the browser journeys, each only if the steps before it passed.
# Each step writes its whole output to dist/checks/verify/<step>.log (ignored by Git). The summary names every
# step PASSED, FAILED, SKIPPED or NOT RUN, shows the last 6 lines of a failed log, and ends with ONE line:
# `VERIFY PASSED`, `VERIFY PASSED (<what lint left out>)` or `VERIFY FAILED (<step>)`. The exit status is 0 only when
# every step that could run passed, because a wrapper that reports just its last command's status once called a
# failed `make check` a success. CI runs the same lint, so a step NOT RUN here can still fail there.
#   scripts/verify.sh                     or: make verify
# Lint is `make lint` (actionlint and shellcheck from one pinned image) when docker answers, else `shellcheck` on the
# tracked scripts when it is installed (`brew install shellcheck`), else NOT RUN.
# Overrides, used by scripts/test-verify.sh: VERIFY_CHECK_CMD, VERIFY_LINT_CMD (empty means NOT RUN) and VERIFY_E2E_CMD
# replace the three commands (each runs with `bash -c` from the repository root); FIXTURE_PORT pins the journeys'
# port, else a free one is picked.
# It never edits tracked files, installs browsers, pushes, or touches the network beyond what `make check` does and
# the first pull of the lint image.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

logs=dist/checks/verify
mkdir -p "$logs"
rm -f "$logs/check.log" "$logs/lint.log" "$logs/journeys.log" # a skipped step must not show a stale log

check_cmd=${VERIFY_CHECK_CMD:-make check}

lint_cmd=
lint_left_out=
if [[ -n ${VERIFY_LINT_CMD+x} ]]; then
  lint_cmd=$VERIFY_LINT_CMD
  [[ -n $lint_cmd ]] || lint_left_out="lint NOT RUN"
elif docker info > /dev/null 2>&1; then
  lint_cmd='make lint'
elif command -v shellcheck > /dev/null 2>&1; then
  lint_cmd="shellcheck -S warning \$(git ls-files '*.sh')"
  lint_left_out="lint: shellcheck only, no docker so no actionlint"
else
  lint_left_out="lint NOT RUN: no docker, no shellcheck"
fi

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

names=(check lint journeys)
cmds=("$check_cmd" "$lint_cmd" "$e2e_cmd")
status=("" "" "")
failed=""
for i in 0 1 2; do
  name=${names[$i]}
  if [[ -n $failed ]]; then
    status[i]="SKIPPED because a previous step failed"
    continue
  fi
  if [[ -z ${cmds[$i]} ]]; then
    status[i]="NOT RUN"
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
for i in 0 1 2; do
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
if [[ -n $lint_left_out ]]; then
  echo "VERIFY PASSED ($lint_left_out)"
else
  echo "VERIFY PASSED"
fi
