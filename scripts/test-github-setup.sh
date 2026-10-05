#!/usr/bin/env bash
# Exercises scripts/github-setup.sh end to end against a fake `gh`: canned answers, a 404 that prints its
# error body on stdout like the real CLI, and a log of every write. Nothing touches GitHub.
#   scripts/test-github-setup.sh              test scripts/github-setup.sh
#   WIZARD=/path/to/old.sh scripts/test-github-setup.sh   test another copy (e.g. to replay a past bug)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
WIZARD=${WIZARD:-scripts/github-setup.sh}
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir "$T/bin"
cat > "$T/bin/gh" <<'STUB'
#!/usr/bin/env bash
FX=$FAKE_GH_DIR
[[ $1 == auth || $1 == pr ]] && exit 0
[[ $1 == api ]] || { echo "fake gh: unexpected call: $*" >&2; exit 99; }
shift; method=GET path="" expr="" silent=0 input=0
while [[ $# -gt 0 ]]; do
  case $1 in
    --method) method=$2; shift 2 ;;
    --jq) expr=$2; shift 2 ;;
    --silent) silent=1; shift ;;
    --input) input=1; shift 2 ;;
    *) path=$1; shift ;;
  esac
done
if [[ $method != GET ]]; then
  body=""; if (( input )); then body=$(cat); fi
  printf '%s %s %s\n' "$method" "$path" "$body" >> "$FX/writes.log"; echo '{}'; exit 0
fi
file="$FX/$(printf '%s' "${path%%\?*}" | tr '/' '_').json"
if [[ ! -f $file ]]; then
  if (( ! silent )); then echo '{"message":"Not Found","status":"404"}'; fi
  exit 1
fi
if (( silent )); then exit 0; fi
if [[ -n $expr ]]; then jq -r "$expr" "$file"; else cat "$file"; fi
STUB
chmod +x "$T/bin/gh"

# A repository where nothing is set up yet: no alerts, no Pages site (the API answers 404), no ruleset.
fx() { printf '%s' "$2" > "$T/fx/$1.json"; }
fresh() {
  rm -rf "$T/fx"; mkdir "$T/fx"
  fx repos_o_r '{"permissions":{"admin":true},"security_and_analysis":{"secret_scanning":{"status":"disabled"},"secret_scanning_push_protection":{"status":"disabled"}}}'
  fx repos_o_r_automated-security-fixes '{"enabled":false}'
  fx repos_o_r_actions_permissions_workflow '{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}'
  fx repos_o_r_code-scanning_default-setup '{"state":"not-configured"}'
  fx repos_o_r_rulesets '[]'
  fx repos_o_r_commits_main '{"sha":"abc"}'
  fx repos_o_r_commits_abc_check-runs '{"check_runs":[{"name":"go","conclusion":"success"},{"name":"ui","conclusion":"success"},{"name":"scripts","conclusion":"success"},{"name":"e2e","conclusion":"success"}]}'
}
run() { # answers on stdin; the wizard's own output is kept for diagnosis
  PATH="$T/bin:$PATH" FAKE_GH_DIR="$T/fx" bash "$WIZARD" --repo o/r > "$T/out.txt" 2>&1 || { cat "$T/out.txt"; echo "wizard exited non-zero"; return 1; }
}
fails=0
pass() { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

# 1. Everything fresh, "y" to every question, Enter at the check picker.
fresh; run <<< $'y\ny\ny\ny\ny\n\ny\n' || fails=$((fails + 1))
want='PUT repos/o/r/vulnerability-alerts
PUT repos/o/r/automated-security-fixes
PATCH repos/o/r
PUT repos/o/r/actions/permissions/workflow
POST repos/o/r/pages
POST repos/o/r/rulesets'
t1="fresh repo: the seven stages send exactly these writes (Pages is created with POST, not PUT)"
[[ "$(cut -d' ' -f1,2 "$T/fx/writes.log")" == "$want" ]] && pass "$t1" || fail "$t1"
t2="fresh repo: the ruleset requires go, scripts and ui from the Actions app and has no bypass"
grep '^POST repos/o/r/rulesets' "$T/fx/writes.log" | cut -d' ' -f3- \
  | jq -e '(.bypass_actors == []) and ([.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks[] | select(.integration_id == 15368) | .context] | sort) == ["go","scripts","ui"]' >/dev/null \
  && pass "$t2" || fail "$t2"
t3="fresh repo: no error body leaked into the Pages state line"
! grep 'Pages build type' "$T/out.txt" | grep -q 'Not Found' && pass "$t3" || fail "$t3"

# 2. Same repository, "n" to every question: nothing may be written.
fresh; run <<< $'n\nn\nn\nn\nn\n\nn\n' || fails=$((fails + 1))
t4="declining every question writes nothing"
[[ ! -s "$T/fx/writes.log" ]] && pass "$t4" || fail "$t4"

if (( fails == 0 )); then echo "github-setup: all checks passed"; else echo "github-setup: $fails check(s) failed"; exit 1; fi
