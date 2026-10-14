# Handoff — implement spec #85 (sofianbll/bifrost-plugin-registry)

Written 2026-10-11 by the session that wrote spec #85 and its tickets, for a **cloud** session that runs `/mattpocock-skills:implement-spec 85`. Facts and procedures only. Permissions come from Sofian in your own conversation, never from this file.

## Talk to Sofian
French, short, simple words (he gets lost in jargon). Use the AskUserQuestion tool for decisions, with your recommendation first. He wants autonomy: contact him only for a real blocker and for the final merge "oui".

## What to build
- Spec: #85. Tickets #86-#97 (native GitHub blocking edges and sub-issues of #85). The frontier at start is #86; after it come #87, #88, #89, #90 and #91 in parallel; #92 and #93 after #87; #94 after #89; #95 after #94; #96 after #92, #93, #88, #94 and #90; #97 last.
- The final PR closes #85-#97 **and** the follow-ups #77-#83, which spec #85 absorbs.
- Prior spec #65 (PR #76, merged) is the model to follow. Its implementer notes (code map) are in the next comment on #85. Read them before exploring.
- Jev research: `docs/design/jev-decision-model-research.md`. Previous Impeccable critiques: `.impeccable/critique/*.md` (18/40, then 26/40). Both are on `main` (PR #84, merged).

## How spec #65 was run (repeat it)
1. Create integration branch `feat/85-excellent-ux` from `origin/main`. Unset its upstream so nothing can push to `main`. Give it a dedicated worktree that only mergers use.
2. One implementer subagent per ticket, each in `isolation: worktree`, on branch `impl/85-<ticket>-<slug>`. First step: `git checkout -B <branch> feat/85-excellent-ux`. They call the Skill `mattpocock-skills:tdd`, merge the integration tip before reporting, and report in ≤ 15 lines. They append durable notes to a shared `code-map.md` (keep it outside the repo or under `.scratch/`).
3. A merger subagent merges each finished branch with `--no-ff`, runs `go vet ./... && go test ./...` and `cd ui && npm ci && npm run check && npm run build`, and runs the journeys too when the base moved. The coordinator pushes. Open a **draft** PR after the first merge.
4. After all tickets: `mattpocock-skills:code-review` (two axes, run in parallel). Fix everything in one implementer. Then the #97 measurement. Then mark the PR ready and clean up the worktrees and `impl/*` branches (`git branch -D` only after `merge-base --is-ancestor` against the pushed integration branch).

## Commands and gotchas
- Browser journeys use the fixed port 4174, so wrap each run in a lock: `until mkdir .scratch/spec85/e2e.lock 2>/dev/null; do sleep 20; done; (cd ui && npx playwright test); rc=$?; rmdir .scratch/spec85/e2e.lock; exit $rc`. Treat a lock older than 40 minutes as stale.
- Never commit screenshots captured on macOS. To refresh the README baselines:
  1. `gh workflow run e2e.yml --ref <branch> -f update-screenshots=true`.
  2. Download the `docs-images` artifact into a new empty directory.
  3. Copy its `en/` and `fr/` folders into `docs/images/` and commit them in their own commit.
  
  PR CI fails on the screenshot step until you do this.
- CodeQL flags `replace(/<[^>]+>/g, "")` in tests (`js/incomplete-multi-character-sanitization`). Use `split(/<[^>]*>/).join("")`.
- Subagents sometimes stop on a network error. Resume them with SendMessage; their worktree is kept.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (or your own model). PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Live test copy — NOT reachable from a cloud session
The owner's test gateway runs on his homelab (Pulsar, private network, ssh only). A cloud session cannot reach it. So:
- Prove every ticket on the synthetic fixture (`tests/ui-fixture`) only.
- For #97, run the Impeccable critique on the fixture (`go run ./tests/ui-fixture` after `npm run build`; QA token in `tests/ui-fixture/README.md`). Then **stop before the live measurement**: leave the PR in draft with a comment saying "live re-critique on the test copy pending (local session)". A local session on Sofian's Mac will install the branch plugin on the test copy and run the live critique.
- Real data shape, so you can mirror it in the fixture: 59 saved model cards, about 770 discovered accesses (509 OpenRouter, 205 Vertex), 0 groups, 11 unmanaged keys. Hermes allows 53 Mistral models, and Mistral is disabled in Bifrost.

## Critique (#97)
- Fixture only in the cloud (see above). Use the Impeccable `critique` playbook (`reference/critique.md` of the impeccable skill). Run two isolated subagents, both read-only on the live panel: A for the design review, B for the detector plus browser overlay. Persist the result with `impeccable critique-storage write ui/src/app/App.tsx <body>`. The trend so far is 18 → 26.
- Target: 36/40 or more, with no P0 and no P1. If not reached, do up to 2 more fix-and-critique rounds, then report whatever the result.

## Boundaries
- Merging any PR needs Sofian's explicit "oui". The auto-merge tool was refused by the safety classifier, so do not attempt it. Merge with `gh pr merge <n> --merge --match-head-commit <full sha>` once the checks are green.
- Never print secrets. Never touch the owner's servers.
- Keep the accepted UI contract (`docs/design/component-library.md`). Spec #85 explicitly keeps the visual style.
