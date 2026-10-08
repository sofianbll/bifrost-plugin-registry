# Changelog

Release downloads and their exact source commits are listed in [GitHub Releases](https://github.com/sofianbll/bifrost-plugin-registry/releases).

## Unreleased

- Registry data from v0.1/v0.2 no longer stops the plugin (#53). A key model offered by several accesses without `access_selection` is withheld from that key, logged as a gateway warning and flagged in the panel until an access is chosen; the rest of the key is published. Saves still refuse new ambiguity.
- Searchable Model ID, Creator and series selectors with custom values, known metadata/access prefill and atomic reference matching.
- Optional AI suggestions through a selected native virtual key, with field-by-field review before saving; Chat Completions and Responses supported.
- On-demand native virtual-key reveal/copy, visible unknown capabilities and a scrollable model editor.
- Empty model taxonomies now remain arrays after catalogue enrichment, avoiding a crash after Save.
- The panel reads the gateway version; paired builds record and inject an explicit upstream version.

- English and French project landing pages; separate current guides and historical notes.
- Production React source moved to `ui/`; matching build paths updated without changing runtime behavior.
- Source CI, contribution instructions, issue forms and pull request template.
- Clear license attribution and private vulnerability reporting instructions.
- The 18 browser journeys now run as `@playwright/test` specs (`ui/e2e`) in a new E2E workflow, re-expressed against the current UI (the September 25 script no longer matched it), and the README screenshots are generated Playwright baselines refreshed by a manual workflow run. `tests/ux_journeys.cjs` and the unreferenced legacy-UI `tests/browser_smoke.py` are removed (Git history).
- Removed the deferred native-menu integration (host patches, `REGISTRY_NATIVE_UI` build flag), four superseded integration probes and `HANDOFF.md`; `.agents/` is no longer tracked. All remain in Git history at `61648dd` (native-menu work stays tracked in issue #7).

The published `v0.2.0-rc.1` binaries are unchanged; these additions require a newly compiled compatible plugin.

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

[0.3.0-rc.7]: https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.7
[0.3.0-rc.6]: https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.6
[0.3.0-rc.5]: https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.5
[0.2.0-rc.1]: https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1
