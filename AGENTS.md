# Agent instructions

## Project context

Before planning changes, read `STATUS.md` for the audited implementation state. For UI/UX and product scope, read `docs/design/product-direction.md`; the next step is a prototype reviewed by Sofian before final specs and implementation tickets.

For this project, delegate bounded implementation to GPT-6 Sol and focused audits to GPT-6 Luna, as requested by Sofian. Keep the coordinating agent focused on decisions and integration; avoid Astra subagents for this work.

## Agent skills

### Issue tracker

Track specs and work in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Use one root context and its ADRs when they exist. See `docs/agents/domain.md`.
