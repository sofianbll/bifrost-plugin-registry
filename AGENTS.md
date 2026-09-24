# Agent instructions

## Before making changes

Read [STATUS.md](STATUS.md) for current release scope and evidence. For product behavior or UI changes, read [the active specification](docs/design/core-v1-spec.md) and [product decisions](docs/design/product-direction.md); dated prototype notes describe historical states.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for commands and repository layout. The production frontend is in `ui/`. Routine checks write to ignored `dist/checks/`; do not overwrite dated release reports or commit credentials and private runtime data.

The native Go plugin has a separate build and qualification path. Passing source CI does not establish gateway/plugin ABI compatibility or production readiness. Preserve the distinction between the dynamic Bifrost image and the separately installed `.so`.

## Delegation

For this project, delegate bounded implementation to GPT-6 Sol and focused audits to GPT-6 Luna, as requested by Sofian. Keep the coordinating agent focused on decisions and integration; avoid Astra subagents.

## Project conventions

- Track specs and work in [GitHub Issues](docs/agents/issue-tracker.md).
- Use the [five triage labels](docs/agents/triage-labels.md).
- Before changing domain behavior, read [the root context and ADR conventions](docs/agents/domain.md).
