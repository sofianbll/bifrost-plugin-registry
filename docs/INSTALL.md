# Install Registry

English · [Français](RELEASE.md)

This guide targets **[v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1)** with Bifrost 2.2.2. Use a staging instance before migrating an existing deployment.

## 1. Download the matching pair

Choose `amd64` for an x86_64 Linux host or `arm64` for an ARM64 Linux host. The release provides:

- `bifrost-dynamic-2.2.2-linux-{arch}.tar.gz`: a Docker image containing the complete Bifrost gateway compiled with dynamic loading, **without the Registry plugin**.
- `bifrost-registry-v0.2.0-rc.1-linux-{arch}.so`: the separately installed Registry plugin, including its interface.
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

Use the URL of the **`.so` file**, not the repository or release page:

**AMD64**

```text
https://github.com/sofianbll/bifrost-plugin-registry/releases/download/v0.2.0-rc.1/bifrost-registry-v0.2.0-rc.1-linux-amd64.so
```

**ARM64**

```text
https://github.com/sofianbll/bifrost-plugin-registry/releases/download/v0.2.0-rc.1/bifrost-registry-v0.2.0-rc.1-linux-arm64.so
```

Add the plugin through Bifrost's native plugin settings or `POST /api/plugins`. Merge the [plugin fragment](../configs/plugin.fragment.json) into the existing configuration, replacing its placeholder `path` with the matching URL. Keep:

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

## Qualification and limits

[Release evidence](../reports/v1-final/README.md) covers both architectures, separate URL installation, persistence, native adoption and an ARM64 upgrade/rollback. The installed Hermes client was tested against a synthetic provider. Real-provider capabilities, a production rollout and native sidebar integration are not certified by these checks.

The previous Bifrost 2.2.1 binary-mount recipe is retained in [the historical archive](archive/installation-2.2.1.md).
