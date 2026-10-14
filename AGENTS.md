# Agent instructions

## Before making changes

At the start of a session, read the repository state printed by `scripts/session-state.sh` (a SessionStart hook runs it; run it by hand otherwise) before trusting a handoff note: it shows how far the checkout is behind `origin/main`, the worktrees and the open pull requests.

Read [STATUS.md](STATUS.md) for current release scope and evidence. For product behavior changes, read [the active specification](docs/design/core-v1-spec.md) and [product decisions](docs/design/product-direction.md). Before every visual change, read the current [UI contract](docs/design/component-library.md) and verify relevant accepted decisions there; do not ask again about decisions already recorded.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for commands and repository layout. The production frontend is in `ui/`. Routine checks write to ignored `dist/checks/`; do not overwrite dated release reports or commit credentials and private runtime data.

The native Go plugin has a separate build and qualification path. Passing source CI does not establish gateway/plugin ABI compatibility or production readiness. Preserve the distinction between the dynamic Bifrost image and the separately installed `.so`.

Verify with `make verify` (checks, lint, then the browser journeys) and read its last line: a wrapper's exit code is not evidence.

## Delegation

Delegate bounded implementation and focused audits to subagents, each with a named worktree, a file scope and a completion criterion. Keep the coordinating agent on decisions and integration. In Codex, as requested by Sofian, use GPT-6 Luna for that work and avoid Astra subagents.

## Project conventions

- Track specs and work in [GitHub Issues](docs/agents/issue-tracker.md).
- Use the [five triage labels](docs/agents/triage-labels.md).
- Before changing domain behavior, read [the root context and ADR conventions](docs/agents/domain.md).
- Reviewers apply the [coding standards](CODING_STANDARDS.md).
- UI work follows [the Impeccable flow](docs/agents/ui-work.md); the product and the visual system are described in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md).
- The test copy of the gateway and how to put a plugin build on it: [docs/agents/test-copy.md](docs/agents/test-copy.md). Never touch the production gateway.
