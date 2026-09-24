# Bifrost Registry UI

React frontend for the standalone Bifrost Registry plugin. The plugin embeds the production build and serves the panel at `/model-registry` on its admin port (default `8099`). See the [release guide](../docs/RELEASE.md) for installation and authentication.

## Develop and verify

From this directory:

```sh
npm ci
npm run check
npm run build
```

`npm run check` runs the frontend logic checks. `npm run build` runs TypeScript and Vite and writes ignored assets to `dist/`. The repository's build script embeds those assets in the plugin. `npm run dev` starts Vite on `127.0.0.1`; live workspace operations require the plugin API, which the dev server does not supply.

## Source layout

- `src/App.tsx` and adjacent components implement the catalog, groups, virtual keys, import/export, settings, and laboratory views.
- `src/api.ts` calls the plugin's same-origin `api/` endpoints. View preferences stay in browser storage.
- `public/` contains logos, fonts, the pinned harness catalog, and a recorded Newman demo report. The report uses synthetic responses; the laboratory does not run provider requests.
- `scripts/` can regenerate the harness catalog and demo report from the pinned upstream source. Their source and limits are recorded in [PROVENANCE.md](PROVENANCE.md).

Vendored Bifrost components and assets retain their [Apache 2.0 license](LICENSE); Geist fonts have a separate [SIL OFL license](public/static/fonts/OFL.txt). Review [PROVENANCE.md](PROVENANCE.md) before changing vendored files.
