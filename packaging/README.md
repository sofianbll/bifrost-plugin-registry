# Local delivery package

Build from the verified `dist/standalone-v1` pair with a release ID and an explicit image tag. Choose a new output directory:

```bash
./scripts/package-release.sh 0.1.0-rc.1 local/bifrost-dynamic:0.1.0-rc.1 ./dist/release-0.1.0-rc.1
```

For a newly compiled pair and its matching proof, set `PAIR_DIR` and `PROOF_DIR`:

```bash
RELEASE_ID='your-release-id'
IMAGE_TAG="local/bifrost-dynamic:${RELEASE_ID}"
PAIR_DIR=/path/to/new-pair PROOF_DIR=/path/to/new-proof \
  ./scripts/package-release.sh "$RELEASE_ID" "$IMAGE_TAG" ./dist/new-release
```

The command checks matching SHA-256 reports, Go 1.27.1, the pinned Bifrost source, and Linux ARM64 or AMD64 musl metadata and ELF headers before building for the detected architecture. The Docker context contains the unchanged gateway, Bifrost's official entrypoint, its Apache license and third-party notices. The plugin is only in `plugin/bifrost-registry-<release-id>-linux-<arch>.so`, with its SHA-256 and MIT license. `manifest.json` and `provenance/` tie the two outputs to the verified compilation. This command does not push an image or upload the plugin.

Install the plugin from an immutable, direct HTTP(S) URL to the versioned `.so` on this exact gateway build; a release page URL will not work. Verify the published bytes against `plugin/SHA256SUMS`. Add that URL through Bifrost's native plugin UI or `POST /api/plugins`; starting the gateway does not install it. The `.so` needs the matching Go 1.27.1, OS, architecture, libc, and shared dependencies. Keep `/app/data` writable and persistent for Bifrost; the Registry path can live beneath it so atomic saves use the same persistent volume. The plugin's admin server uses a separate port and needs `REGISTRY_ADMIN_TOKEN` plus `REGISTRY_BIFROST_AUTH`; see [the installation contract](../docs/BUILD.md#mode-standard-prioritaire--plugin-avec-son-propre-serveur-web).
