# Changelog

Release downloads and their exact source commits are listed in [GitHub Releases](https://github.com/sofianbll/bifrost-plugin-registry/releases).

## Unreleased

- Searchable Model ID, Creator and series selectors with custom values, known metadata/access prefill and atomic reference matching.
- Optional AI suggestions through a selected native virtual key, with field-by-field review before saving; Chat Completions and Responses supported.
- On-demand native virtual-key reveal/copy, visible unknown capabilities and a scrollable model editor.
- Empty model taxonomies now remain arrays after catalogue enrichment, avoiding a crash after Save.
- The panel reads the gateway version; paired builds record and inject an explicit upstream version.

- English and French project landing pages; separate current guides and historical notes.
- Production React source moved to `ui/`; matching build paths updated without changing runtime behavior.
- Source CI, contribution instructions, issue forms and pull request template.
- Clear license attribution and private vulnerability reporting instructions.

The published `v0.2.0-rc.1` binaries are unchanged; these additions require a newly compiled compatible plugin.

## [0.2.0-rc.1] — 2026-09-24

- Standalone plugin with embedded React UI on its own admin port.
- Bifrost 2.2.2 dynamic gateway image and URL-installable `.so`, delivered separately for Linux ARM64 and AMD64/musl.
- Reference catalog, source provenance, manual overrides, explicit matches and grouped access views.
- Versioned JSON snapshots with preview and backup, flat CSV export and offline legacy datasheet conversion.
- Native virtual-key coexistence, explicit adoption and permission checks.
- Recorded ABI, native HTTP, image persistence, upgrade/rollback, browser and synthetic Hermes validation.

The integrated UI prototype and earlier build evidence are retained in the project history. Hot plugin reactivation, native sidebar integration and the laboratory runner are not part of this release.

[0.2.0-rc.1]: https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1
