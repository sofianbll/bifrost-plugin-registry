# Changelog

Release downloads and their exact source commits are listed in [GitHub Releases](https://github.com/sofianbll/bifrost-plugin-registry/releases).

## Unreleased

- Delta on `main` since **v0.3.0-rc.8**, as of October 15, 2026; no new release or production deployment is implied.
- Bifrost catalogue parameter lookups use bounded concurrency (at most eight), retaining deterministic output and cancelling remaining work on failure (#62).
- Registry files can reach **32 MiB** on load/save; an oversized save keeps the previous file and state. Admin API bodies remain capped at **4 MiB** (snapshot import retains its envelope allowance), so a larger file can be exported but cannot be re-imported through that API (#64).
- Catalogue browsing separates saved cards from To add, preserves saved accesses on edit and offers other accesses only through explicit Add; identity, provenance, matching, read-first cards and subscription-oriented browsing are improved (#76, #98).
- Native-key readiness and adoption show prerequisites and provider choices; a provider can stay in Bifrost through `kept_native`. Native permission edits require a token-bound preview, explicit confirmation and readback; kept-native routes pass through the plugin runtime (#98).
- The Impeccable flow and follow-ups align key totals with Bifrost readback, re-read managed keys on open, simplify Basic without removing capabilities, clarify adoption decisions and Datasheet/access-settings wording, and improve focus return, Expert navigation and mobile touch targets (#108, #115). These fixes do not establish a new critique score.
- Removed remaining dead native-menu fixture/build paths, embedded-admin APIs and lazy-init store pointer; `registry_path` is required at plugin initialization (#117, closes #32).
- Split the browser journeys into theme modules and extracted cohesive UI responsibilities from RegistryApp (#105: #118–#123, #125–#131). The suite remains **one sequential test with 49 top-level steps plus one nested call**, not 49 independent tests; assertions, fixture and screenshot baselines are preserved. Shared orchestration stays in App; the owner accepted completion.
- Added `make verify`, session-state and test-copy tooling, fresh-UI-build guards and coding/UI conventions; updated Registry branding and locked UI/tooling dependencies (#111/#112, #114, #116 and dependency PRs).

**Compatibility and rollback:** rc.8's `Policy` has no `kept_native`, and its `Parse` rejects unknown fields. An older plugin cannot reopen a newer Registry file containing this field; switching only the `.so` back is not a safe rollback. Follow [Install: Upgrade and rollback](docs/INSTALL.md#upgrade-and-rollback): stop the gateway and restore the complete saved volume (Bifrost database, plugin URL and Registry data together), plus the prior gateway image if changed. This documents the format boundary and existing rollback procedure, not a new runtime qualification of this delta.

## Historical changes already included by rc.8 — September 24–October 2, 2026

Previously listed as Unreleased, the following entries predate rc.8 (Git history: #13/#15/#18, #27/#28/#31). This is a dated historical summary, not a new release or a claim that they first shipped together. The earlier note that published `v0.2.0-rc.1` binaries were unchanged applied to that working state; later release candidates already include these changes.

- Searchable Model ID, Creator and series selectors with custom values, known metadata/access prefill and atomic reference matching.
- Optional AI suggestions through a selected native virtual key, with field-by-field review before saving; Chat Completions and Responses supported.
- On-demand native virtual-key reveal/copy, visible unknown capabilities and a scrollable model editor.
- Empty model taxonomies now remain arrays after catalogue enrichment, avoiding a crash after Save.
- The panel reads the gateway version; paired builds record and inject an explicit upstream version.

- English and French project landing pages; separate current guides and historical notes.
- Production React source moved to `ui/`; matching build paths updated without changing runtime behavior.
- Source CI, contribution instructions, issue forms and pull request template.
- Clear license attribution and private vulnerability reporting instructions.
- At the October 1–2 checkpoint, the 18 browser journeys were ported to `@playwright/test` (`ui/e2e`) in a new E2E workflow, re-expressed against that UI (the September 25 script no longer matched it), and README screenshots became generated Playwright baselines refreshed by a manual workflow run. `tests/ux_journeys.cjs` and the unreferenced legacy-UI `tests/browser_smoke.py` were removed (Git history).
- Removed the deferred native-menu integration (host patches, `REGISTRY_NATIVE_UI` build flag), four superseded integration probes and `HANDOFF.md`; `.agents/` is no longer tracked. All remain in Git history at `61648dd` (native-menu work stays tracked in issue #7).

## [0.3.0-rc.8] — 2026-10-08

- Pre-release: the Registry rebuilt and qualified natively against the same unmodified Bifrost 2.2.6 as rc.7 (`transports/v2.2.6`, `8b4fce4`), Go 1.27.1, Alpine 3.23, on Linux AMD64 and ARM64 (musl).
- Registry data from v0.1/v0.2 no longer stops the plugin (#53). A key model offered by several accesses without `access_selection` is withheld from that key, logged as a gateway warning and flagged in the panel until an access is chosen; the rest of the key is published. Saves still refuse new ambiguity.
- `GET /api/status` reports the release stamped at build time (the release tag; checked in `abi-smoke.json`) and the real `bifrost_connected` state, matching the workspace connection; the constant `mode`, `native_apply` and `adapter_build` fields are removed (#54).
- Sign-in rejects a pasted token containing spaces or non-ASCII characters with a clear message instead of "Could not connect to Registry" (#55).

## [0.3.0-rc.7] — 2026-10-08

- Pre-release: the Registry rebuilt and qualified natively against unmodified Bifrost 2.2.6 (`transports/v2.2.6`, `8b4fce4`), Go 1.27.1, Alpine 3.23, on Linux AMD64 and ARM64 (musl).
- Bifrost 2.2.5 to 2.2.6. The qualification `models` suite now waits for gateway readiness on the public `/health` route instead of `/api/config`, which Bifrost 2.2.6 locks until dashboard authentication or a setup token is in place (#49, #50); the Registry's own Go code is unchanged.
- With Bifrost 2.2.6, dashboard authentication must be enabled for Registry's native API calls (see the install guide).

## [0.3.0-rc.6] — 2026-10-05

- Pre-release: the Registry rebuilt and qualified natively against unmodified Bifrost 2.2.5 (`transports/v2.2.5`, `77d08f2`), Go 1.27.1, Alpine 3.23, on Linux AMD64 and ARM64 (musl). It supersedes the watcher's pre-release `v0.3.0-bifrost2.2.5-rc.1`.
- Bifrost 2.2.4 to 2.2.5 and UI dependency updates (React 19.3 and 22 minor/patch updates); the Registry's own Go code is unchanged.

## [0.3.0-rc.5] — 2026-10-02

- Pre-release: the `v0.3.0-rc.4` Registry rebuilt and qualified natively against unmodified Bifrost 2.2.4 (`transports/v2.2.4`, `ed8371a`), Go 1.27.1, Alpine 3.23, on Linux AMD64 and ARM64 (musl); rc.4 shipped ARM64 only.
- The gateway image (no plugin) is published as a multi-arch image on GHCR, `ghcr.io/sofianbll/bifrost-dynamic` (digest in the release notes), instead of image archives.

## [0.2.0-rc.1] — 2026-09-24

- Standalone plugin with embedded React UI on its own admin port.
- Bifrost 2.2.2 dynamic gateway image and URL-installable `.so`, delivered separately for Linux ARM64 and AMD64/musl.
- Reference catalog, source provenance, manual overrides, explicit matches and grouped access views.
- Versioned JSON snapshots with preview and backup, flat CSV export and offline legacy datasheet conversion.
- Native virtual-key coexistence, explicit adoption and permission checks.
- Recorded ABI, native HTTP, image persistence, upgrade/rollback, browser and synthetic Hermes validation.

The integrated UI prototype and earlier build evidence are retained in the project history. Hot plugin reactivation, native sidebar integration and the laboratory runner are not part of this release.

[0.3.0-rc.8]: https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.8
[0.3.0-rc.7]: https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.7
[0.3.0-rc.6]: https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.6
[0.3.0-rc.5]: https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.5
[0.2.0-rc.1]: https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1
