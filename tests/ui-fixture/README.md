# Synthetic browser QA fixture

From the repository root, build the current UI if needed (`npm --prefix ui run build`), then run:

```sh
go run ./tests/ui-fixture
```

Open <http://127.0.0.1:4174/> and sign in with the synthetic admin token
`qa-fixture-admin-token-only-1234567890`. Set `QA_FIXTURE_ADMIN_TOKEN` to override it.
The fixture listens only on `127.0.0.1`, serves `ui/dist` through the real admin
server, and stores its temporary registry under ignored `dist/checks/ux-audit/`.
Stopping the process removes that temporary registry.

The initial workspace has `qa-code`, `qa-chat`, and `qa-vision`; groups **QA
Development** and **QA Visual**; managed keys **QA Development Key** and **QA
Visual Key**; discovered `qa-unregistered`; and **QA Unmanaged Key**. Reference
records exist for all four models. All native Bifrost calls use an in-memory
synthetic transport. No provider endpoint is called.

Run `go test ./tests/ui-fixture` to check workspace save, native permission
updates and readback, key creation and reveal, and reference catalog reads.

## Browser journeys

The Playwright suite in `ui/e2e` starts its own fixture, so stop any fixture you
started by hand (the port is fixed). From `ui/`, with the UI built and Go installed:

```sh
npm ci && npm run build
npx playwright install chromium
npx playwright test
```

This runs the 18 journeys of the [UX audit](../../docs/reviews/2026-09-25-ux-audit.md).
They mutate the fixture and refuse non-fixture workspaces. Every invocation of
`playwright test` builds and starts a fresh fixture and stops it with SIGTERM, which
removes its temporary registry: run the suite again rather than reusing state. Reports
and traces go to `dist/checks/e2e/`. The README screenshots are a second, read-only
config run as its own invocation; see [docs/images](../../docs/images/README.md).

The suite replaces `node tests/ux_journeys.cjs` (last present at `60e859f`), which wrote its
captures and JSON report to `dist/checks/ux-audit/`; only the fixture's temporary registry
still lives there. The dated [UX audit](../../docs/reviews/2026-09-25-ux-audit.md) keeps its
original commands.
