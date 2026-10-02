#!/usr/bin/env bash
#
# One-off, idempotent wizard for the GitHub settings that files cannot carry.
# Per stage: read the current state, say what would change, ask, then call `gh api`.
# Needs `gh auth login` with admin rights on the repository, and jq. Declining a prompt sends nothing.
#
#   scripts/github-setup.sh                     target: the `origin` remote of this checkout
#   scripts/github-setup.sh --repo OWNER/NAME   target: that repository
#
# Run it after the workflows have landed on main: the ruleset picks its required
# checks from check runs that actually exist. Re-running is safe.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# The target is never taken from the environment: an inherited REPO must not retarget admin writes.
REPO=""; SRC=""
case "$#:${1:-}" in
  0:) ;;
  2:--repo) REPO=$2; SRC="--repo" ;;
  *) echo "usage: scripts/github-setup.sh [--repo OWNER/NAME]" >&2; exit 2 ;;
esac
if [[ -z $SRC ]]; then
  SRC="git remote origin"
  REPO=$(git remote get-url origin 2>/dev/null | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##' || true)
fi
[[ $REPO =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]] \
  || { echo "no GitHub OWNER/NAME from $SRC ('$REPO'): pass --repo OWNER/NAME" >&2; exit 2; }

# ──────────────────────────────────────────────────────────────────────────
# Wizard helpers, after the mattpocock-skills wizard template. Dropped: the env-file
# and secret helpers (no value is captured) and screen clearing and pauses (each
# stage prints state a maintainer may want to scroll back to).
# ──────────────────────────────────────────────────────────────────────────

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""
fi

TOTAL_STAGES=7
_STAGE_INDEX=0
CHANGED=()   # changes applied this run
TODO=()      # declined, failed or UI-only: still to do by hand

stage() {
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  printf '\n%s%s▸ Stage %s/%s · %s%s\n' "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET"
}

say()  { printf '  %s\n' "$1"; }
step() { printf '  %s•%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

confirm() {
  local reply=""
  printf '  %s? %s [y/N] %s' "$YELLOW" "$1" "$RESET"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}

# change "Question?" METHOD PATH [JSON]: show the call, ask, send it.
# Returns 0 when sent, 1 when declined or failed.
change() {
  local q="$1" method="$2" path="$3" body="${4:-}" out rc=0
  say "will run: gh api --method $method $path${body:+ --input -}"
  [[ -n "$body" ]] && note "body: $body"
  if ! confirm "$q"; then TODO+=("declined: $q"); return 1; fi
  if [[ -n "$body" ]]; then
    out=$(printf '%s' "$body" | gh api --method "$method" "$path" --input - 2>&1) || rc=$?
  else
    out=$(gh api --method "$method" "$path" 2>&1) || rc=$?
  fi
  if (( rc )); then
    warn "failed: $(printf '%s' "$out" | head -n1)"
    TODO+=("failed: $q")
    return 1
  fi
  CHANGED+=("$q")
  printf '  %s✓ done%s\n' "$GREEN" "$RESET"
}

finish() {
  printf '\n%s%s▸ Done%s\n' "$BOLD" "$GREEN" "$RESET"
  if (( ${#CHANGED[@]} )); then
    note "changed:"
    for s in "${CHANGED[@]}"; do note "  - $s"; done
  fi
  if (( ${#TODO[@]} )); then
    printf '\n'; warn "still to do by hand:"
    for s in "${TODO[@]}"; do note "  - $s"; done
  fi
  printf '\n'
}

# ──────────────────────────────────────────────────────────────────────────
# Preflight
# ──────────────────────────────────────────────────────────────────────────

command -v gh >/dev/null 2>&1 || { echo "gh CLI not found: https://cli.github.com" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq not found: https://jqlang.org" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "not signed in: run 'gh auth login'" >&2; exit 1; }
[[ "$(gh api "repos/$REPO" --jq .permissions.admin)" == true ]] \
  || { echo "admin rights on $REPO are required to change these settings" >&2; exit 1; }

printf '\n%s%sGitHub settings for %s (from %s)%s\n' "$BOLD" "$BLUE" "$REPO" "$SRC" "$RESET"
note "  $TOTAL_STAGES stages. Each shows the current state first and asks before changing anything."

# ──────────────────────────────────────────────────────────────────────────
# STAGES
# ──────────────────────────────────────────────────────────────────────────

# gh prints the error body on stdout for a non-2xx answer, so `$(gh ... || echo X)` would keep that body in
# the variable: the lookups below take the value only when gh succeeded.
# 1 ── Dependabot alerts and security updates ────────────────────────────────
stage "Dependabot alerts and security updates"
alerts=disabled
gh api "repos/$REPO/vulnerability-alerts" --silent 2>/dev/null && alerts=enabled
fixes=unknown; v=$(gh api "repos/$REPO/automated-security-fixes" --jq .enabled 2>/dev/null) && fixes=$v
say "alerts:           $alerts"
say "security updates: enabled=$fixes"
note "Version-update PRs come from .github/dependabot.yml, not from these switches."
if [[ $alerts != enabled ]]; then
  change "Enable Dependabot alerts?" PUT "repos/$REPO/vulnerability-alerts" || true
fi
if [[ $fixes != true ]]; then
  change "Enable Dependabot security updates?" PUT "repos/$REPO/automated-security-fixes" || true
fi

# 2 ── Secret scanning and push protection ───────────────────────────────────
sec_state() {
  gh api "repos/$REPO" --jq '(.security_and_analysis // {}) | "\(.secret_scanning.status // "unknown") \(.secret_scanning_push_protection.status // "unknown")"'
}
stage "Secret scanning and push protection"
read -r ss pp <<<"$(sec_state)"
say "secret scanning: $ss"
say "push protection: $pp"
note "The docs call both automatic and free on public repos, yet the API reports them disabled."
note "UNCONFIRMED which switches a personal-account public repo can set: this tries, then re-reads."
if [[ $ss != enabled || $pp != enabled ]]; then
  if change "Enable secret scanning and push protection?" PATCH "repos/$REPO" \
    '{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}'; then
    read -r ss pp <<<"$(sec_state)"
    say "now: secret scanning=$ss, push protection=$pp"
    if [[ $ss != enabled || $pp != enabled ]]; then
      warn "not enabled through the API."
      TODO+=("secret scanning / push protection: check https://github.com/$REPO/settings/security_analysis")
    fi
  fi
fi

# 3 ── Actions may create pull requests ──────────────────────────────────────
stage "Actions: create and approve pull requests"
read -r perm approve <<<"$(gh api "repos/$REPO/actions/permissions/workflow" --jq '"\(.default_workflow_permissions) \(.can_approve_pull_request_reviews)"')"
say "default GITHUB_TOKEN permissions: $perm"
say "Actions may create and approve pull requests: $approve"
note "One switch covers both. The default token permission stays '$perm'."
note "PRs opened with GITHUB_TOKEN do create their pull_request runs, but the runs wait in an approval-required"
note "state until someone with write access clicks 'Approve workflows to run', so required checks stay pending."
note "The upstream watcher (issue #23) avoids that approval with a PAT or GitHub App token."
if [[ $approve != true ]]; then
  change "Allow GitHub Actions to create and approve pull requests?" PUT "repos/$REPO/actions/permissions/workflow" \
    "{\"default_workflow_permissions\":\"$perm\",\"can_approve_pull_request_reviews\":true}" || true
fi

# 4 ── CodeQL default setup must stay off ────────────────────────────────────
stage "Code scanning: CodeQL default setup"
state=unknown; v=$(gh api "repos/$REPO/code-scanning/default-setup" --jq .state 2>/dev/null) && state=$v
say "default setup: $state"
note ".github/workflows/codeql.yml is the advanced setup; GitHub rejects its results while default setup is on."
if [[ $state == configured ]]; then
  change "Turn CodeQL default setup off?" PATCH "repos/$REPO/code-scanning/default-setup" '{"state":"not-configured"}' || true
fi

# 5 ── Pages ─────────────────────────────────────────────────────────────────
stage "Pages: source = GitHub Actions"
build=none; v=$(gh api "repos/$REPO/pages" --jq .build_type 2>/dev/null) && build=$v
say "Pages build type: $build (none = Pages not enabled; wanted: workflow)"
case $build in
  workflow) ;;
  none) change "Enable Pages with source GitHub Actions?" POST "repos/$REPO/pages" '{"build_type":"workflow"}' || true ;;
  *)    change "Switch the Pages source to GitHub Actions?" PUT "repos/$REPO/pages" '{"build_type":"workflow"}' || true ;;
esac
note "docs.yml does the deploy. The site is public: https://${REPO%%/*}.github.io/${REPO#*/}/"

# 6 ── Ruleset on main ───────────────────────────────────────────────────────
stage "Ruleset on main"
say "Wanted: pull request required with 0 approvals (a solo maintainer cannot approve their own PR),"
say "no force-push, no deletion, listed status checks must pass (reported by the GitHub Actions app)."
say "No bypass list: admins use PRs too. Rules this wizard does not manage are kept."

# NORM: the fields this wizard owns, in comparable form (current response and wanted body alike).
# Only the parameters the wizard sends are compared, so fields GitHub adds later do not read as drift.
NORM='def p:
    if .type == "pull_request" then {type, parameters: (.parameters | {required_approving_review_count, dismiss_stale_reviews_on_push, require_code_owner_review, require_last_push_approval, required_review_thread_resolution})}
    elif .type == "required_status_checks" then {type, strict: .parameters.strict_required_status_checks_policy, checks: ([.parameters.required_status_checks[] | {context, integration_id}] | sort_by(.context))}
    else . end;
  {enforcement, target, ref_name: .conditions.ref_name, bypass_actors: (.bypass_actors // []), rules: ([.rules[] | p] | sort_by(.type))}'
# WANT: the ruleset body from --argjson cur (current ruleset or null) and picked (check names).
# Existing integration_ids are kept (15368 = the GitHub Actions app); rules it does not manage are carried over.
WANT='($cur.rules // []) as $old
  | ($old | map(select(.type == "required_status_checks") | .parameters.required_status_checks[]) | map({(.context): .integration_id}) | add // {}) as $ids
  | {name: "main", target: "branch", enforcement: "active", bypass_actors: [],
     conditions: {ref_name: {include: ["~DEFAULT_BRANCH"], exclude: []}},
     rules: ([{type: "deletion"}, {type: "non_fast_forward"},
              {type: "pull_request", parameters: {required_approving_review_count: 0, dismiss_stale_reviews_on_push: false, require_code_owner_review: false, require_last_push_approval: false, required_review_thread_resolution: false}}]
            + (if ($picked | length) > 0 then [{type: "required_status_checks", parameters: {strict_required_status_checks_policy: false, required_status_checks: [$picked[] | {context: ., integration_id: ($ids[.] // 15368)}]}}] else [] end)
            + [$old[] | select(.type | IN("deletion", "non_fast_forward", "pull_request", "required_status_checks") | not)])}'

rid=$(gh api "repos/$REPO/rulesets" --jq '.[] | select(.name == "main") | .id' 2>/dev/null | head -n1 || true)
cur=null
cur_checks=""
if [[ -n $rid ]]; then
  cur=$(gh api "repos/$REPO/rulesets/$rid")
  cur_checks=$(jq -r '[.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context] | .[]' <<<"$cur")
fi

# Candidates: check runs that succeeded on main's head or on the last 5 PR heads (the 7-day rule is why).
# A failed lookup only skips that commit.
cands=$(
  { gh api "repos/$REPO/commits/main" --jq .sha || true
    gh pr list --repo "$REPO" --state all --limit 5 --json headRefOid --jq '.[].headRefOid' || true
  } 2>/dev/null | sort -u | while read -r sha; do
    gh api "repos/$REPO/commits/$sha/check-runs?per_page=100" \
      --jq '.check_runs[] | select(.conclusion == "success") | .name' 2>/dev/null </dev/null || true
  done | LC_ALL=C sort -u
)
if [[ -n $cands ]]; then
  say "Check names seen succeeding recently:"
  printf '%s\n' "$cands" | awk '{ printf "    %d) %s\n", NR, $0 }'
else
  warn "no successful check runs found yet (open a PR and let CI finish first)."
fi
note "Require only jobs of workflows that always run: a required check that never reports blocks merging."
note "So no job from a workflow with a paths: filter, or one that runs only on schedule or workflow_dispatch."
note "Leave CodeQL out for now."
filtered=$(grep -lE '^[[:space:]]+paths(-ignore)?:' .github/workflows/*.yml 2>/dev/null || true)
[[ -n $filtered ]] && warn "workflows with a paths: filter in this checkout: $(printf '%s' "$filtered" | tr '\n' ' ')"

picked=$cur_checks
if [[ -z $rid ]]; then   # first run: start from this repo's CI jobs, when they have run
  for c in go ui scripts; do
    if grep -qx "$c" <<<"$cands"; then picked+="$c"$'\n'; fi
  done
fi
if [[ -n $cands ]]; then
  printf '  %sNumbers to require, space-separated (Enter keeps: %s)%s ' "$BOLD" "$(printf '%s' "${picked:-none}" | tr '\n' ' ')" "$RESET"
  read -r picks || true
  new=""
  for num in ${picks:-}; do
    [[ $num =~ ^[0-9]+$ ]] || { warn "ignored '$num'"; continue; }
    name=$(printf '%s\n' "$cands" | awk -v n="$num" 'NR == n')
    if [[ -n $name ]]; then new+="$name"$'\n'; else warn "no check number $num"; fi
  done
  if [[ -n $new ]]; then picked=$new; elif [[ -n ${picks:-} ]]; then warn "no valid number: keeping the current selection."; fi
fi
picked=$(printf '%s\n' "$picked" | sed '/^$/d' | LC_ALL=C sort -u)

nochk=""
if [[ -z $picked ]]; then
  nochk=" with NO required status checks"
  warn "no required status checks selected: merges would only need a pull request."
fi
names=$(printf '%s\n' "$picked" | jq -Rnc '[inputs | select(length > 0)]')
body=$(jq -nc --argjson cur "$cur" --argjson picked "$names" "$WANT")
want=$(jq -S "$NORM" <<<"$body")

if [[ -z $rid ]]; then
  say "No ruleset named main yet. Wanted (owned fields):"
  printf '%s\n' "$want" | sed 's/^/    /'
  change "Create the ruleset on main$nochk?" POST "repos/$REPO/rulesets" "$body" || true
elif delta=$(diff <(jq -S "$NORM" <<<"$cur") <(printf '%s\n' "$want")); then
  say "Ruleset already matches (enforcement, target, branch conditions, bypass list, rules and their parameters)."
else
  say "Ruleset $rid differs (< current, > wanted):"
  printf '%s\n' "$delta" | sed 's/^/    /'
  change "Update ruleset $rid to the wanted state$nochk?" PUT "repos/$REPO/rulesets/$rid" "$body" || true
fi
note "Not covered: the Evaluate enforcement mode (availability on the Free plan is UNCONFIRMED), linear history."

# 7 ── GHCR package visibility (manual, irreversible) ────────────────────────
stage "GHCR package: make it public (manual)"
warn "Not automated: UI only, and a public package can never be made private again."
say "After the first image push from the release workflow (new packages start private):"
step "Open https://github.com/${REPO%%/*}?tab=packages and click the container package."
step "Check it is linked to ${REPO} (the image carries org.opencontainers.image.source)."
step "Package settings > Danger Zone > Change package visibility > Public."
step "Type the package name to confirm."
step "Check: docker pull ghcr.io/${REPO%%/*}/<package>:<tag> works while signed out."
TODO+=("GHCR package: make it public after the first push (steps above)")

finish
