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

With a fresh fixture running, run from the repository root:

```sh
node tests/ux_journeys.cjs
```

The script uses an existing Playwright installation. Set `PLAYWRIGHT_MODULE` to
its module path if it is not on Node's resolution path, and `CHROMIUM_PATH` to an
installed Chromium executable when needed. It refuses non-fixture workspaces.
The browser target is fixed to `http://127.0.0.1:4174/`.
It writes its report and screenshots to `dist/checks/ux-audit/` and exercises
only disposable fixture data. Restart the fixture before another full run.
