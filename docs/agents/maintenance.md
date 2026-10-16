# Maintenance

Since v0.4.0 (October 2026) the project is in maintenance: no new features; keep the gateway/plugin pair current and the checks green. GitHub does the routine work. A weekly agent pass handles what needs judgement and brings Sofian only the decisions.

## What runs on its own

| Workflow | When | Result |
|---|---|---|
| [Watch Bifrost](../../.github/workflows/watch-bifrost.yml) | daily | A new stable upstream Bifrost becomes a pin commit on `bump/bifrost-vX.Y.Z`, a natively qualified pre-release `v<last>-bifrost<X.Y.Z>-rc.<n>`, an issue and a pin PR. |
| Dependabot ([config](../../.github/dependabot.yml)) | weekly | One grouped PR per ecosystem for minor and patch updates; majors and security updates come alone. |
| [Dependabot merge](../../.github/workflows/dependabot-merge.yml) | when the checks finish | Merges every Dependabot PR (groups, majors, security updates) once every check on it passed, with the `DEPENDABOT_MERGE_TOKEN` secret that [setup-dependabot-merge-token.sh](../../scripts/setup-dependabot-merge-token.sh) creates. |
| [CodeQL](../../.github/workflows/codeql.yml) | Mondays | Code scanning alerts. |

## The weekly pass

An OpenChamber scheduled task starts it every Monday at 09:00 Europe/Paris, in a new session of this project. Do all the work first; ask once, at the end.

1. **Read the state.** `git fetch origin --prune`; if the main checkout is clean and on `main`, fast-forward it (`git pull --ff-only`). Then `scripts/session-state.sh`, open PRs and issues, failed runs (`gh run list --branch main --status failure --limit 10`, `gh run list --workflow watch-bifrost.yml --limit 7`), and open alerts (`gh api 'repos/{owner}/{repo}/code-scanning/alerts?state=open'`, `gh api 'repos/{owner}/{repo}/dependabot/alerts?state=open'`).
2. **Act without asking.**
   - A Dependabot PR still open with all checks passed: the merge workflow did not run or could not merge. Read its last run (`gh run list --workflow dependabot-merge.yml --limit 5`), merge the PR (`gh pr merge <n> --merge`) and say why in the summary. A failure on a PR that changes `.github/workflows` means `DEPENDABOT_MERGE_TOKEN` is missing, expired or revoked: ask Sofian to run `scripts/setup-dependabot-merge-token.sh`.
   - A Dependabot PR with a failed check, a failed run on `main` or of the watcher: re-run it once if it looks transient. Otherwise diagnose it with the `diagnosing-bugs` skill in a new worktree from `origin/main`, open a fix PR and leave it open.
   - A watcher pin PR: read its qualification run and the upstream release notes for anything touching plugins, activation or the database, and summarize them.
3. **Never** merge any other PR, create a tag or a release, touch Pulsar or any gateway, or change repository settings or secrets.
4. **Finish.** Nothing for Sofian: title the session `[Bifrost Registry] - 🔴 - Maintenance du <date>` and stop, without a notification. Otherwise title it with 🟡 and send one OpenChamber notification: what happened, what you prepared (links), the decision needed.

## Sofian's decisions

- **A new Bifrost version:** merge the pin PR, then publish from `main` with [release.yml](../../.github/workflows/release.yml): `gh workflow run release.yml -f tag=vX.Y.Z` (a dry run by default), then the same with `-f dry_run=false`.
- **A fix PR:** review and merge it.
- **The merge token**, when the pass reports it failing: run `scripts/setup-dependabot-merge-token.sh`.
- **A real gateway:** [the test copy](test-copy.md) first; production by hand.
