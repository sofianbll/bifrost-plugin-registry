#!/usr/bin/env bash
# Prints, at the start of a session, the repository state a handoff note may not mention: this checkout's branch
# against origin/<default>, whether the main checkout is behind, uncommitted files, every worktree (branch, dirty,
# unpushed commits), stashes, and open pull requests when `gh` is installed and signed in. Under 30 lines, plain text.
# It reads only. Its single write is the remote-tracking refs updated by `git fetch`; it never edits a file, switches
# a branch, deletes, pushes or prompts. A fetch or `gh` failure prints one line and the report goes on; the exit
# status is always 0, so there is no `set -e`: a failing probe must not cut the report short.
#   scripts/session-state.sh          (a SessionStart hook in .claude/settings.json runs it)
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 0

# A network call gets 15 s where `timeout` exists (not on stock macOS), else only the tool's own limits.
bound() {
  if command -v timeout >/dev/null 2>&1; then timeout 15 "$@"
  elif command -v gtimeout >/dev/null 2>&1; then gtimeout 15 "$@"
  else "$@"; fi
}
count() { awk 'END { print NR }'; }

echo "Session state (read-only):"

fetched=1
bound env GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=8' GIT_TERMINAL_PROMPT=0 \
  git fetch --quiet --no-tags origin >/dev/null 2>&1 || fetched=0
[ "$fetched" = 1 ] || echo "fetch failed: remote state below may be stale"

base=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)
[ -n "$base" ] || base=origin/main
branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || echo "(detached HEAD)")
if git rev-parse --verify --quiet "$base" >/dev/null; then
  read -r ahead behind < <(git rev-list --left-right --count "HEAD...$base" 2>/dev/null || echo "? ?")
  echo "branch: $branch, ${ahead:-?} ahead / ${behind:-?} behind $base"
else
  echo "branch: $branch ($base not found, no ahead/behind)"
fi

main_path=$(git worktree list --porcelain 2>/dev/null | awk '/^worktree / { sub(/^worktree /, ""); print; exit }')
if [ -n "$main_path" ] && git rev-parse --verify --quiet "$base" >/dev/null; then
  main_branch=$(git -C "$main_path" symbolic-ref --quiet --short HEAD 2>/dev/null || echo "(detached HEAD)")
  main_behind=$(git -C "$main_path" rev-list --count "HEAD..$base" 2>/dev/null || echo "?")
  if [ "$main_behind" = 0 ]; then
    echo "main checkout: on $main_branch, up to date with $base"
  else
    echo "main checkout: on $main_branch, BEHIND $base by $main_behind commit(s)"
  fi
fi

echo "uncommitted or untracked files here: $(git status --porcelain 2>/dev/null | count)"

# One line per worktree; the ones with something to flag (dirty, unpushed, missing) sort first. Unpushed = commits
# that no remote-tracking branch contains.
rows=""
emit() {
  [ -n "$wt_path" ] || return 0
  local flag=1 state unpushed shown=$wt_path
  if [ ! -d "$wt_path" ]; then
    state=missing unpushed=- flag=0
  else
    if [ -n "$(git -C "$wt_path" status --porcelain 2>/dev/null | head -n 1)" ]; then state=dirty flag=0; else state=clean; fi
    unpushed=$(git -C "$wt_path" rev-list --count HEAD --not --remotes 2>/dev/null || echo "?")
    [ "$unpushed" = 0 ] || flag=0
  fi
  # shellcheck disable=SC2088  # the literal ~ below is display text, not a path
  case $shown in
    "$main_path") shown=. ;;
    "$main_path"/*) shown=${shown#"$main_path"/} ;;
    "$HOME"/*) shown="~/${shown#"$HOME"/}" ;;
  esac
  [ "${#shown}" -le 50 ] || shown="...${shown: -47}"
  rows="$rows$flag  $shown [$wt_branch] $state, $unpushed unpushed
"
}
wt_path="" wt_branch=""
while IFS= read -r line; do
  case $line in
    "worktree "*) wt_path=${line#worktree }; wt_branch="(detached)" ;;
    "branch "*) wt_branch=${line#branch refs/heads/} ;;
    "") emit; wt_path="" ;;
  esac
done < <(git worktree list --porcelain 2>/dev/null; echo)
total=$(printf '%s' "$rows" | count)
echo "worktrees ($total, flagged first):"
printf '%s' "$rows" | sort -s -k1,1 | head -n 10 | cut -c4- | sed 's/^/  /'
[ "$total" -le 10 ] || echo "  ... $((total - 10)) more: git worktree list"

echo "stashes: $(git stash list 2>/dev/null | count)"

if command -v gh >/dev/null 2>&1 && bound gh auth status --hostname github.com >/dev/null 2>&1; then
  # REST, not `gh pr list`: Claude Code cloud sessions block GraphQL.
  prs=$(bound gh api 'repos/{owner}/{repo}/pulls?state=open&per_page=30' \
    --jq '.[] | "#\(.number) \(.head.ref)\(if .draft then " (draft)" else "" end)"' 2>/dev/null) || prs="!"
  if [ "$prs" = "!" ]; then
    echo "open pull requests: unavailable (gh api failed)"
  elif [ -z "$prs" ]; then
    echo "open pull requests: none"
  else
    n=$(printf '%s\n' "$prs" | count)
    echo "open pull requests ($n):"
    printf '%s\n' "$prs" | head -n 6 | sed 's/^/  /'
    [ "$n" -le 6 ] || echo "  ... $((n - 6)) more: gh pr list"
  fi
else
  echo "open pull requests: skipped (gh missing or not signed in)"
fi
exit 0
