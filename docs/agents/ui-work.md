# UI work

Context to read first: [PRODUCT.md](../../PRODUCT.md) (who uses the panel and why), [DESIGN.md](../../DESIGN.md) (the visual system as it exists; its style wording is inferred and may be edited), [the UI contract](../design/component-library.md) (accepted decisions, not reopened without the owner), [CONTEXT.md](../../CONTEXT.md) (the words) and [docs/adr/](../adr/).

## Order of work

1. **Critique once per round.** Two isolated assessments, a design review and a detector/browser pass, run one after the other on the live test copy ([test-copy.md](test-copy.md)). The snapshot goes to `.impeccable/critique/`.
2. **Ask the owner targeted questions about what the critique found** (priority, scope, constraints). Use concrete examples and a recommended answer, never design vocabulary such as "north star" or "tone": the owner decides behaviour and wording, not metaphors.
3. **Fix with the command that fits the finding**, one bounded pass each: `clarify` (words), `distill` (what Basic shows), `harden` (states, edge cases), `adapt` (sizes, touch targets), `layout`, then `polish` last. Each in a named worktree with a file scope.
4. **At most one confirmation critique.** Do not loop critique, fix, critique: the score stayed between 25 and 28 out of 40 over five rounds while every round found something new. If the target is not reached, report it and let the owner decide. Structural questions go to the owner (issue #102).

## Briefs for subagents

Name the worktree and the branch, list the files the agent may edit, list the findings with their source lines, state the owner's decisions as binding, and give a completion criterion the agent can prove: `make verify` ends with a line starting `VERIFY PASSED` (it reads the last line itself; a parenthesis says what lint left out, and CI runs it), one commit, no push. Merge their branches with merge commits.

## Before merging

- `make verify` passes and CI is green, including the e2e "Screenshots" step. If the UI changed visibly, refresh the README images with the workflow and commit them alone: `gh workflow run e2e.yml --ref <branch> -f update-screenshots=true`, download `docs-images` from the run, copy `en/` and `fr/` into `docs/images/`.
- Merge with a merge commit and guard it with the head sha: `gh pr merge <n> --merge --match-head-commit <sha>`.
- Merge only on the owner's explicit yes.
