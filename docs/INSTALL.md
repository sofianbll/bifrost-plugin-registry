# Install Registry

English · [Français](RELEASE.md)

> **Current release: [v0.3.0-rc.4](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.4)** — Bifrost **2.2.3**, **Linux ARM64/musl** only. Download `bifrost-dynamic-2.2.3-linux-arm64.tar.gz` and `bifrost-registry-v0.3.0-rc.4-linux-arm64.so` from that release, verify `SHA256SUMS`, then follow the steps below (the image tag is `bifrost-dynamic:2.2.3-go1.27.1-arm64`). The interface starts in English; French is one toggle or `?lang=fr` away. AMD64 2.2.3 is not qualified yet — the older `v0.2.0-rc.1` (Bifrost 2.2.2, ARM64 + AMD64) remains available for that pair.

This guide's detailed walkthrough below still targets **[v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1)** with Bifrost 2.2.2; its steps apply unchanged to the current release, only the file names, image tag and version differ. Use a staging instance before migrating an existing deployment.

## 1. Choose an installation mode

**Mode A — Registry image + plugin (recommended).** Run the published Bifrost **2.2.3 dynamic image** (`docker load`, volume on `/app/data`, the two credential variables) and install the `.so` by **direct URL** in Bifrost's plugin settings. The image contains an unmodified Bifrost compiled with dynamic loading and **no plugin**; Registry stays a separate, versioned artifact. Steps below.

**Mode B — Plugin only, on a gateway you already run.** Any Bifrost **compiled with dynamic loading** can host the Registry `.so`: download the matching `.so`, verify its checksum, make it reachable from the gateway either as a **local file path** (`path: "/plugins/bifrost-registry.so"` in the plugin entry, file readable by the Bifrost process) or as an **http(s) URL** (Bifrost downloads it at startup). Requirements: same architecture, Go toolchain, dependency versions, OS and libc as your gateway build; the qualified pair uses Linux ARM64/musl, Go 1.27.1. The official prebuilt static image refuses dynamic plugins (`Dynamic loading not supported`) — see [Troubleshooting](#troubleshooting).

## 2. Download the matching pair (mode A)

Choose `amd64` for an x86_64 Linux host or `arm64` for an ARM64 Linux host (the current 2.2.3 release ships **arm64 only**). The release provides:

- `bifrost-dynamic-2.2.2-linux-{arch}.tar.gz` (v0.2.0-rc.1) or `bifrost-dynamic-2.2.3-linux-arm64.tar.gz` (current): a Docker image containing the complete Bifrost gateway compiled with dynamic loading, **without the Registry plugin**.
- `bifrost-registry-v{release}-linux-{arch}.so`: the separately installed Registry plugin, including its interface.
- `SHA256SUMS` and a provenance/license bundle.

Verify the downloaded files against `SHA256SUMS`. For example, on an AMD64 host:

```bash
sha256sum bifrost-dynamic-2.2.2-linux-amd64.tar.gz
# Compare the result with the same filename in SHA256SUMS.
docker load -i bifrost-dynamic-2.2.2-linux-amd64.tar.gz
```

On macOS, `shasum -a 256 <file>` provides the equivalent checksum. The loaded image tag is `bifrost-dynamic:2.2.2-go1.27.1-amd64` (or `-arm64`).

The gateway and plugin must match architecture, Go toolchain, dependencies, build settings and libc. The published pair uses Linux/musl and Go 1.27.1. The tested static official Bifrost image cannot load this `.so`. These are two separate installation steps; starting the image does not install the plugin.

## 2. Configure the gateway and credentials

Keep the existing Bifrost providers, keys, budgets and routing configuration. Use the image's normal entrypoint and a **writable, persistent** volume mounted at `/app/data`. Before replacing an existing gateway image, stop it and back up the **complete** volume, including SQLite and WAL files. Never run two writers against that volume.

For a new gateway, configure native Bifrost administration and providers first. Supply these separate environment values through your secret manager or a private environment file:

| Variable | Purpose |
| --- | --- |
| `REGISTRY_ADMIN_TOKEN` | At least 32 characters; opens the Registry panel. |
| `REGISTRY_BIFROST_AUTH` | Complete `Authorization` header for the native Bifrost admin API, for example `Basic <base64(username:password)>`. Must match the gateway's configured authentication. |

Keep credentials out of committed JSON and logs. Expose the Registry port only on host loopback, for example `127.0.0.1:8099:8099`. Inside the container, `admin_listen` must be `0.0.0.0:8099` for that mapping to work. The gateway's usual port is `8080`.

## 3. Install the plugin by URL

Use the URL of the **`.so` file**, not the repository or release page. Current release:

**ARM64 (current, Bifrost 2.2.3)**

```text
https://github.com/sofianbll/bifrost-plugin-registry/releases/download/v0.3.0-rc.4/bifrost-registry-v0.3.0-rc.4-linux-arm64.so
```

**AMD64 (previous v0.2.0-rc.1, Bifrost 2.2.2 — AMD64 2.2.3 is not qualified yet)**

```text
https://github.com/sofianbll/bifrost-plugin-registry/releases/download/v0.2.0-rc.1/bifrost-registry-v0.2.0-rc.1-linux-amd64.so
```

Add the plugin through Bifrost's native plugin settings or `POST /api/plugins`. Merge the [plugin fragment](../configs/plugin.fragment.json) into the existing configuration, replacing its placeholder `path` with the matching URL (mode A) or a local `.so` path (mode B). Keep:

- `placement: "post_builtin"` and `order: 0`;
- `registry_path: "/app/data/registry/registry.json"`;
- `admin_listen: "0.0.0.0:8099"`;
- `admin_token_env: "REGISTRY_ADMIN_TOKEN"`;
- `bifrost_auth_env: "REGISTRY_BIFROST_AUTH"`;
- `bifrost_url: "http://127.0.0.1:8080"` when plugin and gateway share the same container.

The plugin initializes a missing Registry file. Its UI assets are embedded; no separate frontend mount is needed. Open **http://127.0.0.1:8099/model-registry** and enter the Registry admin token. It stays in tab memory and must be entered again after reloading.

Verify the plugin is `active` in `GET /api/plugins` and present in `GET /api/plugins/loaded`. Publish a small test catalog and read back `/v1/models` with a dedicated virtual key. Existing native keys remain unmanaged until explicitly adopted; adoption cannot expand their native permissions.

## Upgrade and rollback

Stop the gateway and back up **all of `/app/data`** before an update. Save the new compatible `.so` URL and restart the gateway; Bifrost downloads the saved URL at startup. Disabling and re-enabling a Go plugin without restarting is not a supported update path (`plugin already loaded`). Verify loading, saved data and the test key again.

To roll back, stop the gateway, restore the complete stopped-volume backup, restore the prior gateway image if changed, and restart. This restores the Bifrost database, plugin URL and Registry data together. Pointing an old plugin at already-migrated data is not the tested rollback procedure. Keep the old plugin bytes available at their versioned URL.

## Troubleshooting

**`failed to create temporary file: open /tmp/bifrost-plugin-*.so: permission denied`** when adding a plugin by URL. Bifrost downloads the `.so` into its temporary directory before loading it (`os.TempDir()` — `/tmp`, or `$TMPDIR` when set; source: `framework/plugins/utils.go` in the pinned Bifrost tree). The Bifrost process therefore needs a **writable (and executable) temp directory**. This fails on hardened containers: read-only root filesystem, missing `/tmp`, or a `$TMPDIR` owned by another user. Fixes:

- Docker: mount a writable tmpfs, e.g. `--tmpfs /tmp:rw,exec,nosuid,size=128m`, or point the temp dir at the data volume: `-e TMPDIR=/app/data/tmp` and create `/app/data/tmp` writable by the container's runtime user.
- Kubernetes: add an `emptyDir` volume at `/tmp` when `readOnlyRootFilesystem` is set.
- systemd service: check `PrivateTmp`/hardening options and `Environment=TMPDIR=…` pointing to a writable directory.
- Quick check from the host: `docker exec <container> sh -c 'id; touch /tmp/write-test && rm /tmp/write-test'` must succeed as the Bifrost user.

**`Dynamic loading not supported` (official prebuilt image).** The static official Bifrost image downloads the `.so` but refuses to load it. Use the published dynamic image (mode A) or build your own gateway with dynamic loading matching your Go toolchain, architecture and libc ([native build](BUILD.md)).

**`plugin already loaded` when re-enabling without restart.** Hot reactivation of a Go plugin is not supported; restart the gateway (the panel, data and readback are restored).

**Plugin downloads but fails to activate.** Verify the checksum against `SHA256SUMS`, and that image and `.so` share architecture, Go version, dependencies and libc. Check `GET /api/plugins` and the gateway logs for the activation error.

## Qualification and limits

[Release evidence](../reports/v1-final/README.md) covers both architectures, separate URL installation, persistence, native adoption and an ARM64 upgrade/rollback. The installed Hermes client was tested against a synthetic provider. Real-provider capabilities, a production rollout and native sidebar integration are not certified by these checks.

The previous Bifrost 2.2.1 binary-mount recipe is retained in [the historical archive](archive/installation-2.2.1.md).
