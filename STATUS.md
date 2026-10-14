# Project status

Current release: **[v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1)** — September 24, 2026. This page is the entry point for the current release, merged follow-up and local development. The [September 26 project reconciliation](docs/reviews/2026-09-26-project-state.md) records their evidence and remaining gaps.

Registry V1 is implemented and published as a release candidate. It uses an unmodified Bifrost 2.2.2 gateway compiled with dynamic loading, distributed separately from the Registry `.so`. The plugin embeds the React UI and serves its own admin port, `8099`.

## Implemented after the release — unreleased

[#14](https://github.com/sofianbll/bifrost-plugin-registry/issues/14), delivered in merged [PR #15](https://github.com/sofianbll/bifrost-plugin-registry/pull/15), adds searchable model/creator/series selectors with custom values, explicit reference mapping, reviewed AI assistance and on-demand key copy. Its [#16 UX repairs](docs/reviews/2026-09-25-ux-audit.md) are merged too. These changes are not in the published `v0.2.0-rc.1` artifacts. See the [scope and usage](docs/design/catalog-assistance.md).

The exact `e25de3d` gateway/plugin pair passes native ABI checks and **133/133 HTTP checks** (42 models, 72 standalone/assistant, 19 adoption) on **Bifrost 2.2.3, Linux ARM64/musl**, using synthetic providers. Browser checks cover selection, mapping, reviewed suggestions, key copy and responsive layout. [Qualification and artifact hashes](reports/bifrost-2.2.3/README.md) · [2.2.3 compatibility review](docs/design/bifrost-2.2.3-compatibility.md). AMD64 2.2.3 and real-provider inference remain unqualified; the existing local pilot and published release are unchanged.

The September 25 audit in [#16](https://github.com/sofianbll/bifrost-plugin-registry/issues/16), also delivered in PR #15, repairs draft protection, provider access setup, catalog pagination/fallback, key selection origins and publication state, mobile editors, clipboard recovery and assistant key-detail lookup. The corrected candidate passes `make check`, **18/18 browser journeys**, and a freshly compiled **133/133 native HTTP qualification** on Bifrost 2.2.3 ARM64/musl. The [audit report](docs/reviews/2026-09-25-ux-audit.md) records the final source snapshot, binary hashes, visual review and synthetic scope; the previous `e25de3d` evidence above remains historical. These corrections are unreleased.

## Current local development — not merged or released

The complete Registry interface is being finalized under the current [UI contract](docs/design/component-library.md). This is active design and implementation work; it is not a delivery, release or production-readiness claim. The laboratory stays outside the final navigation and user journeys.

The September 25–26 model-card work explores reuse of Models.dev inside Registry, a single card with distinct provider accesses, native property application, per-group and per-key access selections, and Bifrost-native routing limited to each key's selected accesses. The [product decisions](docs/design/product-direction.md#recadrage-des-fiches--décisions-du-26-septembre-2026-implémentation-à-qualifier), [native model-card contract](docs/design/model-card-bifrost-contract.md), [Models.dev research](docs/design/models-dev-reuse-research.md) and [project reconciliation](docs/reviews/2026-09-26-project-state.md) separate confirmed direction, existing code, experiments and gaps. This work has no new release or production qualification.

The September 27 UI integration composes the production catalog, model editor, groups and virtual keys from the shared component library. Basic and Expert use the same controlled key policy; below 1280 CSS px the interface uses Basic. Catalog cards support content-height Grid, 1:1 Square and Table views, shared modality/capability panels, and provider Accesses menus. Documentary data, import/export and settings remain connected to their existing APIs. Laboratory code is retained for history and checks but is not exposed in navigation; its legacy route returns to Models. The gateway snapshot inventory remains available only when its review API exists. See the current [UI contract](docs/design/component-library.md).

Local browser checks observed model rename/save, group creation with filtered selections preserved, and key publication/readback against the synthetic `tests/ui-fixture` server. The key check retained an inherited exclusion and a direct addition, then independently read back the two expected model IDs. Grid/Square/Table, the 1279/1280 breakpoint, 400 px layout, language and theme controls were also inspected. These checks do not establish native plugin ABI compatibility or real-provider inference. The current policy API still selects complete models with all linked accesses; access-by-access permissions and native property application remain separate product work. The consolidated source now lives in the main project checkout, on `codex/prototype-model-card-modelsdev`; the source worktree is retained. `npm run check`, `npm run check:key-composer`, `npm run build`, `make script-check` and `git diff --check` pass in that checkout. Vite reports a approximately 753 kB minified JavaScript chunk (228 kB gzip); this warning is not a build failure. No production deployment or release was performed.

## Delivered

- Reference catalog and distinct provider accesses; Bifrost/Models.dev sources, provenance, protected corrections and explicit matching.
- Model groups, per-key additions/exclusions, naming, publication and independent `/v1/models` readback.
- Native key coexistence and explicit adoption within native permissions.
- Versioned JSON import/export with preview, revision checks and backup; flat CSV and offline legacy conversion.
- Separate Linux ARM64 and AMD64/musl gateway images and plugin URLs, with checksums and provenance.

## Evidence

| Area | Recorded result |
| --- | --- |
| Native ABI and unmodified Bifrost source | Both architectures; 2,744 upstream files verified |
| Per-key HTTP catalog | 42/42 on each architecture |
| Standalone plugin, catalog and persistence | 54/54 on each architecture |
| Packaged image | 18/18 AMD64; 26/26 ARM64 including upgrade/rollback |
| Native adoption | 19/19 ARM64 |
| Installed Hermes client | 4/4 with a synthetic provider; excluded model rejected before provider |
| Published plugin URLs | Anonymous downloads match the tested SHA-256 hashes |

[Full reports and scope](reports/v1-final/README.md) · [Public download verification](reports/v1-final/public-downloads.json)

The [CI workflow](.github/workflows/ci.yml) checks Go, the React UI and local scripts. It does not rebuild or requalify the native Bifrost/plugin pair. Build artifacts and routine test output stay in ignored `dist/`; dated release evidence is retained in `reports/`.

## Limits and follow-up

- This is a release candidate, not a blanket production or provider certification.
- Plugin updates require a gateway restart; hot reactivation is not supported by the tested loader.
- Native Bifrost menu integration is [deferred](https://github.com/sofianbll/bifrost-plugin-registry/issues/7). The laboratory runner is also deferred.
- Any new Bifrost/toolchain/architecture combination requires native qualification.
- Production deployment and personal data migration require a separate rollout.

## Project records

[V1 release scope and historical criteria](docs/design/core-v1-spec.md) · [Current decisions and product history](docs/design/product-direction.md) · [September 26 reconciliation](docs/reviews/2026-09-26-project-state.md) · [Domain vocabulary](CONTEXT.md)

The previous detailed working log is preserved in [the historical archive](docs/archive/status-through-2026-09-24.md). The early Bifrost 2.2.1 record is [archived with its build evidence](reports/native-build-v1/BUILD_STATUS.json). Historical claims describe their dated checkpoints, not the state of the current release.
