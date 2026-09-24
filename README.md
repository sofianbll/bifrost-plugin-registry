# Bifrost Registry

**A model catalog and access policies for Bifrost virtual keys.**

[![CI](https://github.com/sofianbll/bifrost-plugin-registry/actions/workflows/ci.yml/badge.svg)](https://github.com/sofianbll/bifrost-plugin-registry/actions/workflows/ci.yml)
[![Release](https://img.shields.io/badge/release-v0.2.0--rc.1-blue)](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

English · [Français](README.fr.md)

Organize models into reusable groups, choose what each virtual key can access, and compare the published catalog with the actual `/v1/models` response. Registry adds a management interface to [Bifrost](https://github.com/maximhq/bifrost); Bifrost continues to handle inference, credentials, routing and budgets.

> **Release candidate.** `v0.2.0-rc.1` is qualified with Bifrost 2.2.2 on Linux ARM64 and AMD64/musl. Provider capability certification and production deployment are outside those checks. This is an independent project, not an official Maxim/Bifrost product.

## What it does

- **Catalog:** reference models and provider accesses, Bifrost/Models.dev metadata, field provenance and manual corrections that survive refreshes.
- **Groups and keys:** shared selections, additions and exclusions per key, naming formats, preview, publication and independent readback.
- **Native coexistence:** existing Bifrost keys retain their behavior until explicitly adopted; Registry cannot expand their native permissions.
- **Import and export:** versioned JSON snapshots with preview and backup, flat CSV export and an offline legacy datasheet converter.
- **Administration:** embedded React interface, light/dark themes, a separate admin token and persistent configuration.

## Install

The release contains **two separate artifacts** for each architecture:

| Artifact | Purpose |
| --- | --- |
| Bifrost Docker image archive | The complete Bifrost 2.2.2 gateway compiled with dynamic loading from unmodified upstream sources. **No Registry plugin inside.** |
| Registry `.so` | Install through its direct, versioned URL in Bifrost. Includes the UI and serves it on port `8099`. |

1. Download the matching image archive from [Releases](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1), verify its checksum and load it with `docker load -i <archive.tar.gz>`.
2. Configure persistent storage and the two admin credentials, then add the matching `.so` URL through Bifrost's plugin settings.
3. Open the Registry panel on `http://127.0.0.1:8099/model-registry`.

**[Installation, configuration and rollback →](docs/INSTALL.md)**

The published `.so` requires the compatible gateway build. It is not a drop-in plugin for the tested static official image. Plugin updates require a gateway restart; native sidebar integration is deferred.

## Develop

See [CONTRIBUTING.md](CONTRIBUTING.md) for requirements and the full check command. Start with:

```bash
git clone https://github.com/sofianbll/bifrost-plugin-registry.git
cd bifrost-plugin-registry
make check
```

The standalone Go CLI is a separate configuration tool. Compiling the native `.so` requires a matching Bifrost checkout and Go/C toolchain; follow [the native build guide](docs/BUILD.md).

```text
cmd/registry/      Standalone administration CLI
internal/          Registry engine, persistence and admin API
native/            Bifrost plugin hooks
ui/                React interface and its upstream attribution
configs/           Empty configuration, synthetic example and plugin fragment
integration/       Native HTTP, image and client probes
packaging/         Gateway image recipe
scripts/           Build, test, import and packaging commands
docs/              Guides, design decisions and historical notes
reports/           Dated validation evidence
```

## Documentation and validation

[Documentation index](docs/README.md) · [Current status](STATUS.md) · [Changelog](CHANGELOG.md) · [Security](SECURITY.md)

The [release evidence](reports/v1-final/README.md) records the pinned source and artifact hashes, ABI checks, per-key catalogs, persistence, adoption and rollback. ARM64 and AMD64 each passed 42 catalog and 54 standalone-plugin checks. Hermes was exercised with a synthetic provider; this is not a claim about real provider inference. Routine CI validates the source without rebuilding or certifying the native gateway/plugin pair.

## Contribute and report issues

Use [GitHub Issues](https://github.com/sofianbll/bifrost-plugin-registry/issues) for bugs and feature proposals. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report vulnerabilities privately through [SECURITY.md](SECURITY.md).

## License

Project-authored code is [MIT licensed](LICENSE). Vendored Bifrost UI code and assets retain their [Apache-2.0 license](ui/LICENSE); Geist fonts retain their [SIL Open Font License](ui/public/static/fonts/OFL.txt). See [third-party notices](THIRD_PARTY_NOTICES.md) and [upstream provenance](ui/PROVENANCE.md).
