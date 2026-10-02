# Project status

Current release: **[v0.3.0-rc.5](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.5)** (pre-release) — October 2, 2026 (supersedes `v0.3.0-rc.1`–`rc.4`). Previous release: [v0.3.0-rc.4](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.4); first release candidate: [v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1). This page is the entry point for the current release; sections marked superseded are kept for history. The [September 26 project reconciliation](docs/reviews/2026-09-26-project-state.md) records the historical evidence and gaps.

## v0.3.0-rc.5 — published (October 2, 2026)

[v0.3.0-rc.5](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.5) is a **pre-release**: the v0.3.0-rc.4 Registry code rebuilt and tested against unmodified Bifrost 2.2.4 (`transports/v2.2.4`, commit `ed8371a9779bfbc8aa689d4d77964cf8ce9308bf`), Go 1.27.1, Alpine 3.23, for **linux/amd64 and linux/arm64** (musl). It adds the AMD64 pair that rc.4 lacked.

- **Plugin assets:** `bifrost-registry-v0.3.0-rc.5-linux-amd64.so` (`509cd20f703a587c455ba6506415ea60a1112ae258d1bd20bd65c15b875d2c72`) and `bifrost-registry-v0.3.0-rc.5-linux-arm64.so` (`4ad032161e00fba69486895fe02d603bff2d2e0acbe808f945bb0db02f8b7ad4`), plus `SHA256SUMS`, `manifest.json`, `reports-linux-<arch>.tar.gz` and `licenses.tar.gz`. There are no image archives.
- **Gateway image** (gateway only, no plugin): multi-arch index `ghcr.io/sofianbll/bifrost-dynamic@sha256:ef56067e2bf807930270d2d6318ba9e9996ed914c9469db46068078d3c06e7b2`, matching the release notes. The release workflow also tags it `2.2.4` and `2.2.4-go1.27.1`; only the digest was checked when this section was written. Each `.so` and the image index carry one attestation (checked through the API).
- **Evidence:** [release run](https://github.com/sofianbll/bifrost-plugin-registry/actions/runs/37011831292), all jobs successful: metadata, native qualification on amd64 and arm64 runners, image build, start and probe per architecture, multi-arch merge with attestations, release. The suites use synthetic providers only; per-architecture reports are release assets.
- **Not done, not claimed:** real-provider inference, any production deployment, native-menu integration ([#7](https://github.com/sofianbll/bifrost-plugin-registry/issues/7)). No installation of this release is recorded here.

Registry V1 is implemented and published as a release candidate. It uses an unmodified Bifrost gateway (2.2.4 in v0.3.0-rc.5, 2.2.3 in v0.3.0-rc.4, 2.2.2 in v0.2.0-rc.1) compiled with dynamic loading, distributed separately from the Registry `.so`. The plugin embeds the React UI and serves its own admin port, `8099`.

## v0.3.0-rc.4 — previous release (September 28, 2026)

The September 27–28 continuation is delivered as an ARM64 Bifrost 2.2.3 pair (final commit `d588a9f`, merged into `main` as `60d7dd8`, PR [#18](https://github.com/sofianbll/bifrost-plugin-registry/pull/18)): the dynamic gateway from the pinned unmodified `transports/v2.2.3` source (`411d62b`, 2,745 tracked files re-verified) with a **reproducible** gateway hash (`80d17483…`) and its separately distributed plugin (`.so` `ff21df8f…`). Five synthetic-provider suites pass: **42/42** isolated per-key models, **55/55** standalone/restart, **72/72** standalone/assistant, **19/19** native-key adoption, and **34/34 assertions** for the new capabilities (native price overrides, restricted per-key access, shared native alias routing) — 188 HTTP checks, above the previous 133. Native qualification also found and fixed six product defects the source tests had missed (alias key re-posting, semantic alias comparison, `provider_key` scope, required `request_types`, `pricing_patch` read-back, shared-alias projection), each with a regression test; the interface is English-first (French one toggle or `?lang=fr` away), the model/group/key flows are localized, and the READMEs ship language-matched screenshots (`docs/images/en`, `docs/images/fr`). Evidence: [reports/bifrost-2.2.3-arm64-869e251](reports/bifrost-2.2.3-arm64-869e251/README.md) · [final audit](docs/reviews/2026-09-28-final-audit.md). Limits: ARM64 only, synthetic providers only (no real inference), adoption suite on loopback bridge; AMD64 2.2.3 and real-provider inference remain unqualified, and no production deployment was performed.

## Implemented after the release — unreleased

> **Superseded by the v0.3.0-rc.4 section above — kept for history.** This work was later merged and released there; "unreleased", "not merged", "local" and open design gates describe this dated checkpoint only.

[#14](https://github.com/sofianbll/bifrost-plugin-registry/issues/14), delivered in merged [PR #15](https://github.com/sofianbll/bifrost-plugin-registry/pull/15), adds searchable model/creator/series selectors with custom values, explicit reference mapping, reviewed AI assistance and on-demand key copy. Its [#16 UX repairs](docs/reviews/2026-09-25-ux-audit.md) are merged too. These changes are not in the published `v0.2.0-rc.1` artifacts. See the [scope and usage](docs/design/catalog-assistance.md).

The exact `e25de3d` gateway/plugin pair passes native ABI checks and **133/133 HTTP checks** (42 models, 72 standalone/assistant, 19 adoption) on **Bifrost 2.2.3, Linux ARM64/musl**, using synthetic providers. Browser checks cover selection, mapping, reviewed suggestions, key copy and responsive layout. [Qualification and artifact hashes](reports/bifrost-2.2.3/README.md) · [2.2.3 compatibility review](docs/design/bifrost-2.2.3-compatibility.md). AMD64 2.2.3 and real-provider inference remain unqualified; the existing local pilot and published release are unchanged.

The September 25 audit in [#16](https://github.com/sofianbll/bifrost-plugin-registry/issues/16), also delivered in PR #15, repairs draft protection, provider access setup, catalog pagination/fallback, key selection origins and publication state, mobile editors, clipboard recovery and assistant key-detail lookup. The corrected candidate passes `make check`, **18/18 browser journeys**, and a freshly compiled **133/133 native HTTP qualification** on Bifrost 2.2.3 ARM64/musl. The [audit report](docs/reviews/2026-09-25-ux-audit.md) records the final source snapshot, binary hashes, visual review and synthetic scope; the previous `e25de3d` evidence above remains historical. These corrections are unreleased.

## Current local development — not merged or released

> **Superseded by the v0.3.0-rc.4 section above — kept for history.** This work was later merged and released there; "unreleased", "not merged", "local" and open design gates describe this dated checkpoint only.

The September 27 continuation ([#17](https://github.com/sofianbll/bifrost-plugin-registry/issues/17)) embeds a reproducible Models.dev source snapshot and replaces the model-wide operation mapping with explicit endpoint selections per provider access. Existing endpoint sets survive workspace round trips; new accesses require a selection. Chat Completions and Responses are independent, and the Registry JSON guard also recognizes `decisions`, `rerank` and `ocr`. Canonical links, authored access differences, supported omissions, manual corrections and source provenance are retained by the local catalog adapter. [Contract and remaining scope](docs/design/model-card-bifrost-contract.md#reprise-modelsdev-et-opérations--27-septembre-2026). Source tests and browser evidence apply to this local candidate only, not the published release, a new native binary or real-provider inference.

The latest annotated review reopened visual acceptance. The local repair now shares model/group journey layout, aligns rem-based controls, preserves key drafts through adoption review, and repairs provider settings responsiveness. The [active repair checklist](docs/reviews/2026-09-27-ui-repair-checklist.md) tracks implementation separately from rendered verification. Final repair checks covered the loaded two-model key draft, the 21 actual adoption prerequisites, required fields and preserved state in model/group journeys, and provider settings at mobile/intermediate/desktop widths. Earlier checks below are scoped observations, not user acceptance of the complete interface.

The complete Registry interface is being finalized under the current [UI contract](docs/design/component-library.md). This is active design and implementation work; it is not a delivery, release or production-readiness claim. The laboratory stays outside the final navigation and user journeys.

The September 25–26 model-card work explores reuse of Models.dev inside Registry, a single card with distinct provider accesses, native property application, per-group and per-key access selections, and Bifrost-native routing limited to each key's selected accesses. The [product decisions](docs/design/product-direction.md#recadrage-des-fiches--décisions-du-26-septembre-2026-implémentation-à-qualifier), [native model-card contract](docs/design/model-card-bifrost-contract.md), [Models.dev research](docs/design/models-dev-reuse-research.md) and [project reconciliation](docs/reviews/2026-09-26-project-state.md) separate confirmed direction, existing code, experiments and gaps. This work has no new release or production qualification.

The September 27 UI integration composes the production catalog, model editor, groups and virtual keys from the shared component library. Basic and Expert use the same controlled key policy; below 1280 CSS px the interface uses Basic. Catalog cards support wider, equal-height Grid, 1:1 Square without internal scrolling, and Table views, shared modality/capability panels, and provider Accesses menus. Documentary data, import/export and settings remain connected to their existing APIs. Laboratory code is retained for history and checks but is not exposed in navigation; its legacy route returns to Models. The gateway snapshot inventory remains available only when its review API exists. See the current [UI contract](docs/design/component-library.md).

Local browser checks observed model rename/save, group creation with filtered selections preserved, and key publication/readback against the synthetic `tests/ui-fixture` server. The key check retained an inherited exclusion and a direct addition, then independently read back the two expected model IDs. Grid/Square/Table, the 1279/1280 breakpoint, 400 px layout, language and theme controls were also inspected. These checks do not establish native plugin ABI compatibility or real-provider inference. The current policy API still selects complete models with all linked accesses; access-by-access permissions and native property application remain separate product work. The consolidated source now lives in the main project checkout, on `codex/prototype-model-card-modelsdev`; the source worktree is retained. `npm run check`, `npm run check:key-composer`, `npm run build`, `make script-check` and `git diff --check` pass in that checkout. Vite reports a approximately 753 kB minified JavaScript chunk (228 kB gzip); this warning is not a build failure. No production deployment or release was performed.

The latest September 27 local UX pass adds categorized Settings, actual catalog-source status, browser-local provider logo preferences, optional user help, and tree/detail views of the captured gateway configuration. Model registration now checks required identity, operation and access fields before Review; the shared sheet supports full width and a keyboard-accessible width control. Snapshot adoption preview is available again, with explicit limitations: the Bifrost CLI key in the captured dataset uses dynamic allowlists unsupported by the current adoption backend. No permissions were changed during the browser review.

The requested Grid/Table → Rectangle/Square → three-density structure is accepted, but Sofian requested further card rendering adjustments. Its six variants remain isolated in `ui/display-options-review.html`; the active card controls have not been migrated. The [UI contract](docs/design/component-library.md) records this gate and [the user guide](docs/USER-GUIDE.md) explains the current journeys. Browser QA covered the real dated snapshot, source counts (58 references, 119 accesses), all 9 provider appearance rows, logo selection/reset, required-operation blocking followed by a valid unsaved review, panel expansion/width with draft preservation, routing/tree details, adoption blockers, and Settings at 1393/800/400 CSS px. `npm run check`, `npm run build` and `git diff --check` pass; the main chunk warning remains (approximately 794 kB minified, 238 kB gzip). No new native plugin binary was compiled or deployed, no live inference was performed, and production remains untouched.

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
