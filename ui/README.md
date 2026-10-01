# Bifrost Registry UI

React frontend for the standalone Bifrost Registry plugin. The plugin embeds the production build and serves the panel at `/model-registry` on its admin port (default `8099`). See the [installation guide](../docs/INSTALL.md) for installation and authentication.

## Develop and verify

From this directory:

```sh
npm ci
npm run check
npm run build
```

`npm run check` runs the frontend logic checks. `npm run build` runs TypeScript and Vite and writes ignored assets to `dist/`. The repository's build script embeds those assets in the plugin. `npm run dev` starts Vite on `127.0.0.1`; live workspace operations require the plugin API, which the dev server does not supply.

## Current application scope

Models, model editing, groups, virtual keys, documentary data, import/export and settings use the production entry. Key composition shares one draft between Basic and Expert; widths below 1280 CSS px use Basic. Laboratory routes are hidden and their old URL redirects to Models. The snapshot gateway inventory requires the offline review API.

For an isolated visual preview with synthetic, read-only data, open `/component-app-preview.html` under Vite. For actual save/publication checks against the real admin server and an in-memory synthetic Bifrost transport, compile the UI and follow [the UI fixture instructions](../tests/ui-fixture/README.md). The preview does not establish a running plugin or provider compatibility.

## Component review

With Vite running, open `/design-system.html` for accepted shared components and `/component-gallery.html` to compare all existing and historical variants. Both use synthetic examples and are development-only entries. The accepted page imports canonical components from `src/components/registry/`; decisions and remaining choices are recorded in [the component-library contract](../docs/design/component-library.md).

## Source layout

- `src/main.tsx` and `src/globals.css` are the production entry and shared styles; `src/app/App.tsx` composes the pages and shell.
- `src/components/ui/` holds the local shadcn/Radix primitives; `src/components/registry/` holds shared Registry controls.
- `src/features/` groups catalog, groups, keys, assistant, laboratory, snapshot, and gateway UI with their related logic and checks. `src/domain/registry.ts` holds shared model types and rules; `src/data/api.ts` calls the plugin's same-origin `api/` endpoints. View preferences stay in browser storage.
- `src/experiments/` keeps the two interactive prototypes; `src/dev/component-gallery/` keeps the comparison gallery and its archived implementations. `src/dev/fixtures/registry.ts` contains synthetic data. Their HTML entry URLs stay at the UI root. They are not production build inputs.
- `public/` contains logos, fonts, the pinned harness catalog, and a recorded Newman demo report. The report uses synthetic responses; the laboratory does not run provider requests.
- `scripts/` can regenerate the harness catalog and demo report from the pinned upstream source. Their source and limits are recorded in [PROVENANCE.md](PROVENANCE.md).

Vendored Bifrost components and assets retain their [Apache 2.0 license](LICENSE); Geist fonts have a separate [SIL OFL license](public/static/fonts/OFL.txt). Review [PROVENANCE.md](PROVENANCE.md) before changing vendored files.

### Current private-data review

The local review at `http://127.0.0.1:8774/model-registry?lang=fr#/models` uses the production build and the existing offline review server, backed by the private captured gateway data. The original capture and catalog are preserved; its working configuration is under ignored `dist/checks/interface-real-data/`. It is a dated, partial local copy, not a live gateway connection. See [snapshot review](../docs/design/snapshot-review.md) for commands and capabilities. The component gallery remains synthetic.
