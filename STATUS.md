# Project status

Current release: **[v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1)** — September 24, 2026.

Registry V1 is implemented and published as a release candidate. It uses an unmodified Bifrost 2.2.2 gateway compiled with dynamic loading, distributed separately from the Registry `.so`. The plugin embeds the React UI and serves its own admin port, `8099`.

## In development after the release

[#14](https://github.com/sofianbll/bifrost-plugin-registry/issues/14) adds searchable model/creator/series selectors, reviewed AI assistance and on-demand key copy. These changes are not in the published `v0.2.0-rc.1` artifacts. The [scope and usage](docs/design/catalog-assistance.md) describe the follow-up; [Bifrost 2.2.3 review](docs/design/bifrost-2.2.3-compatibility.md) distinguishes source findings from native qualification.

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

[Product scope](docs/design/core-v1-spec.md) · [Decisions and product history](docs/design/product-direction.md) · [Domain vocabulary](CONTEXT.md)

The previous detailed working log is preserved in [the historical archive](docs/archive/status-through-2026-09-24.md). The early Bifrost 2.2.1 record is [archived with its build evidence](reports/native-build-v1/BUILD_STATUS.json). Historical claims describe their dated checkpoints, not the state of the current release.
