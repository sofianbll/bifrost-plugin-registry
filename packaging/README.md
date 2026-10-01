# Delivery package

`scripts/package-release.sh` stages one architecture of a qualified pair. `release.yml` runs it on each native runner, builds `image-context/`, starts that image with `integration/image_distribution_probe.py`, then pushes it to GHCR by digest and attaches the plugin to the GitHub Release. To stage and build locally, point it at an extracted qualified pair (`pair-linux-<arch>` from the qualify workflow) and at the Bifrost checkout of the same commit, choose a new output directory, then build the context:

```bash
RELEASE_ID='your-release-id'
PAIR_DIR=/path/to/pair SOURCE_DIR=/path/to/bifrost-checkout \
  ./scripts/package-release.sh "$RELEASE_ID" ./dist/new-release
docker build --platform linux/<arch> -t "local/bifrost-dynamic:${RELEASE_ID}" ./dist/new-release/image-context
```

The Bifrost tag, commit and Go version come from [`bifrost.pin`](../bifrost.pin). The pair must have been qualified at `REGISTRY_SOURCE_COMMIT` (default: this checkout's `HEAD`).

The command checks the pair's SHA-256 sums and Registry commit, the pinned Bifrost source and Go version, and Linux ARM64 or AMD64 musl metadata and ELF headers for the detected architecture. Run `npm --prefix ui ci` first so the exact locked dependency license files are available. The Docker context contains the unchanged gateway, Bifrost's official entrypoint, its Apache license and third-party notices. The plugin directory contains `bifrost-registry-<release-id>-linux-<arch>.so`, its SHA-256, the Registry MIT license, and a relocatable `THIRD_PARTY_NOTICES.md` with full available Bifrost UI, Geist font, and npm dependency license texts under `licenses/`. Its npm inventory covers the locked runtime dependency closure and Tailwind CSS; packages without a distributed license file are identified and linked to common MIT terms. `manifest.json` and `provenance/` tie the two outputs to the verified compilation. This command does not build or push an image, or upload the plugin.

Install the plugin from an immutable, direct HTTP(S) URL to the versioned `.so` on this exact gateway build; a release page URL will not work. Verify the published bytes against `plugin/SHA256SUMS`. Add that URL through Bifrost's native plugin UI or `POST /api/plugins`; starting the gateway does not install it. The `.so` needs the matching Go version, OS, architecture, libc, and shared dependencies. Keep `/app/data` writable and persistent for Bifrost; the Registry path can live beneath it so atomic saves use the same persistent volume. The plugin's admin server uses a separate port and needs `REGISTRY_ADMIN_TOKEN` plus `REGISTRY_BIFROST_AUTH`; see [the installation contract](../docs/BUILD.md#mode-standard-prioritaire--plugin-avec-son-propre-serveur-web).
