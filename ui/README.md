# Bifrost Registry UI

React frontend for the standalone Bifrost Registry plugin. The plugin embeds the production build and serves the panel at `/model-registry` on its admin port (default `8099`). See the [installation guide](../docs/INSTALL.md) for installation and authentication.

## Develop and verify

From this directory:

```sh
npm ci
npm run check
npm run build
```

`npm run check` runs the frontend logic checks: tests named `*.test.ts(x)` under `ui/src` run automatically. `npm run build` runs TypeScript and Vite and writes ignored assets to `dist/`. The repository's build script embeds those assets in the plugin. `npm run dev` starts Vite on `127.0.0.1`; live workspace operations require the plugin API, which the dev server does not supply.

## Current application scope

Models, model editing, groups, virtual keys, documentary data, import/export and settings use the production entry. Key composition shares one draft between Basic and Expert; widths below 1280 CSS px use Basic. Laboratory routes are hidden and their old URL redirects to Models. The snapshot gateway inventory requires the offline review API.

For an isolated preview and save/publication checks against the real admin server and an in-memory synthetic Bifrost transport, compile the UI and follow [the UI fixture instructions](../tests/ui-fixture/README.md). This fixture does not establish provider compatibility.

## Component review

The [documentation site](https://sofianbll.github.io/bifrost-plugin-registry/) and [Linux E2E screenshots](../docs/images/README.md) are the visual reference for the accepted UI. [The component-library contract](../docs/design/component-library.md) records the accepted decisions; canonical shared components live in `src/components/registry/`. The prototypes, Laboratory and development review pages were retired after UI acceptance (#19). Use the production UI with the synthetic fixture for further reviews, not historical gallery URLs.

## Source layout

- `src/main.tsx` and `src/globals.css` are the production entry and shared styles; `src/app/App.tsx` composes the pages and shell.
- `src/components/ui/` holds the local shadcn/Radix primitives; `src/components/registry/` holds shared Registry controls.
- `src/features/` groups catalog, groups, keys, assistant, snapshot, and gateway UI with their related logic and checks. `src/domain/registry.ts` holds shared model types and rules; `src/data/api.ts` calls the plugin's same-origin `api/` endpoints. View preferences stay in browser storage.
- `public/` contains production logos, provider images and fonts. Their source and limits are recorded in [PROVENANCE.md](PROVENANCE.md).
- `scripts/` runs frontend checks and checks build freshness.
- `src/test/fixtures/` contains shared synthetic data for unit tests, not production imports.

Vendored Bifrost components and assets retain their [Apache 2.0 license](LICENSE); Geist fonts have a separate [SIL OFL license](public/static/fonts/OFL.txt). Review [PROVENANCE.md](PROVENANCE.md) before changing vendored files.

### Current private-data review

The local review at `http://127.0.0.1:8774/model-registry?lang=fr#/models` uses the production build and the existing offline review server, backed by the private captured gateway data. The original capture and catalog are preserved; its working configuration is under ignored `dist/checks/interface-real-data/`. It is a dated, partial local copy, not a live gateway connection. See [snapshot review](../docs/design/snapshot-review.md) for commands and capabilities.
