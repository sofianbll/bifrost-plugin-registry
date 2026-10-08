# Install Registry

English · [Français](fr/INSTALL.md)

Registry is installed as **two separate artifacts**: a Bifrost gateway image compiled with dynamic loading (it contains no plugin), and the Registry plugin, a `.so` file with its interface embedded. Both must come from the same build: same architecture, Go toolchain, dependency versions and libc. Starting the image does not install the plugin. Use a staging instance before migrating an existing deployment.

## Which files for which host

Pick the row for your host.

| Host | Release | Bifrost | Gateway image | Plugin (`.so`) |
| --- | --- | --- | --- | --- |
| Linux AMD64 (x86_64) | [v0.3.0-rc.6](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.6) (current) | 2.2.5 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.5` | `bifrost-registry-v0.3.0-rc.6-linux-amd64.so` |
| Linux ARM64 | [v0.3.0-rc.6](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.6) (current) | 2.2.5 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.5` | `bifrost-registry-v0.3.0-rc.6-linux-arm64.so` |
| Linux AMD64 (x86_64), previous release | [v0.3.0-rc.5](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.5) (previous) | 2.2.4 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.4` | `bifrost-registry-v0.3.0-rc.5-linux-amd64.so` |
| Linux ARM64, previous release | [v0.3.0-rc.5](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.5) (previous) | 2.2.4 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.4` | `bifrost-registry-v0.3.0-rc.5-linux-arm64.so` |
| Linux ARM64, older | [v0.3.0-rc.4](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.4) (older) | 2.2.3 | `bifrost-dynamic-2.2.3-linux-arm64.tar.gz` | `bifrost-registry-v0.3.0-rc.4-linux-arm64.so` |
| Linux AMD64 (x86_64), older | [v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) (older) | 2.2.2 | `bifrost-dynamic-2.2.2-linux-amd64.tar.gz` | `bifrost-registry-v0.2.0-rc.1-linux-amd64.so` |
| Linux ARM64, older | [v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) (older) | 2.2.2 | `bifrost-dynamic-2.2.2-linux-arm64.tar.gz` | `bifrost-registry-v0.2.0-rc.1-linux-arm64.so` |

- Download each `.so` from its release page. The plugin URL is always `https://github.com/sofianbll/bifrost-plugin-registry/releases/download/<release>/<plugin file>`: the URL of the **`.so` file**, not of the repository or the release page. v0.3.0-rc.5 and v0.3.0-rc.6 have no image archive: the gateway image comes from GHCR (see [Mode A](#mode-a-image-and-plugin-url)); older releases ship it as an archive on their release page.
- Every release includes a `SHA256SUMS` file. Verify each download against it.
- The current release covers both architectures. v0.2.0-rc.1 predates the Models.dev catalogue, per-access endpoints and native price and routing capabilities that v0.3.0 adds.
- All listed releases are release candidates. See [Qualification and limits](#qualification-and-limits).

## Choose an installation mode

**Mode A: Registry image and plugin URL (recommended).** Run the published dynamic image and add the `.so` by direct URL in Bifrost's plugin settings. The image holds an unmodified Bifrost compiled with dynamic loading and **no plugin**, so the inference path you trust is never patched and Registry stays a separate, versioned artifact.

**Mode B: plugin only, on a gateway you already run.** Any Bifrost **compiled with dynamic loading** can host the Registry `.so`. It must match your gateway's architecture, Go toolchain, dependency versions, OS and libc; the qualified pairs use Linux/musl and Go 1.27.1. The official prebuilt static image refuses dynamic plugins (`Dynamic loading not supported`); see [Troubleshooting](TROUBLESHOOTING.md).

## Mode A: image and plugin URL

### 1. Download and verify

Download the `.so` for your host from the table, plus `SHA256SUMS`, into one folder, then check it:

```bash
sha256sum -c --ignore-missing SHA256SUMS
```

`SHA256SUMS` lists every asset of the release; `--ignore-missing` skips the ones you did not download. On macOS, `shasum -a 256 <file>` gives the checksum to compare by hand.

For v0.3.0-rc.4 and v0.2.0-rc.1, also download the image archive from the table and check it the same way.

### 2. Get the image and start the gateway

For v0.3.0-rc.6 the gateway image (no plugin) is a multi-arch image on GHCR: Docker picks `linux/amd64` or `linux/arm64` for your host. Pin the digest published in the release notes; the `2.2.5` tag is convenient but moves with each published Bifrost 2.2.5 gateway build.

```bash
# pinned
docker pull ghcr.io/sofianbll/bifrost-dynamic@sha256:7c3354b041e4c06b1797a58adcfe8c6eeb11b270edff2ccf5610c4a98809d367
# convenient
docker pull ghcr.io/sofianbll/bifrost-dynamic:2.2.5
```

For v0.3.0-rc.5 (tag `2.2.4`), pin `ghcr.io/sofianbll/bifrost-dynamic@sha256:ef56067e2bf807930270d2d6318ba9e9996ed914c9469db46068078d3c06e7b2`.

For v0.3.0-rc.4 and v0.2.0-rc.1, load the archive instead:

```bash
docker load -i <image archive>   # prints the loaded image tag
```

Keep the existing Bifrost providers, keys, budgets and routing. Use the image's normal entrypoint and a **writable, persistent** volume mounted at `/app/data`. Before replacing the image of an existing gateway, stop it and back up the **complete** volume, including the SQLite and WAL files. Never run two writers against that volume.

For a new gateway, configure native Bifrost administration and providers first. Supply the two [credentials](#credentials-and-plugin-settings) through your secret manager or a private environment file, then start the container. This command is illustrative; adapt ports, volume and hardening to your environment:

```bash
docker run -d --name bifrost \
  -p 8080:8080 -p 127.0.0.1:8099:8099 \
  -v bifrost-data:/app/data \
  -e REGISTRY_ADMIN_TOKEN -e REGISTRY_BIFROST_AUTH \
  <image reference>
```

The gateway's usual port is `8080`. Publish the Registry port `8099` only on host loopback, as above. Inside the container, `admin_listen` must be `0.0.0.0:8099` for that mapping to work.

### 3. Install the plugin by URL

Add the plugin through Bifrost's native plugin settings or `POST /api/plugins`, using the plugin URL built from the table. Merge the [plugin fragment](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/configs/plugin.fragment.json) into the existing configuration, replacing its placeholder `path` with that URL, and keep the [plugin settings](#credentials-and-plugin-settings) below. Bifrost downloads the saved URL at installation and at every start, so keep the bytes of that version available at that URL.

If the download fails with a temporary-file permission error, see [Troubleshooting](TROUBLESHOOTING.md).

## Mode B: plugin only

1. Download the `.so` matching your gateway from the table and verify its checksum as above. If your gateway was built from a different release, [build the pair yourself](BUILD.md) (French only).
2. Make it reachable by the gateway either as a **local file path** (`path: "/plugins/bifrost-registry.so"` in the plugin entry, file readable by the Bifrost process) or as an **http(s) URL** (Bifrost downloads it at startup).
3. Merge the [plugin fragment](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/configs/plugin.fragment.json) with that `path` and the [plugin settings](#credentials-and-plugin-settings) below, through Bifrost's native plugin settings or `POST /api/plugins`.

## Credentials and plugin settings

Both modes use two separate secrets, supplied as environment values (never committed in JSON or logs):

| Variable | Purpose |
| --- | --- |
| `REGISTRY_ADMIN_TOKEN` | At least 32 characters; opens the Registry panel. |
| `REGISTRY_BIFROST_AUTH` | Complete `Authorization` header for the native Bifrost admin API, for example `Basic <base64(username:password)>`. Must match the gateway's configured authentication. |

In the plugin entry keep:

- `placement: "post_builtin"` and `order: 0`;
- `registry_path: "/app/data/registry/registry.json"`;
- `admin_listen: "0.0.0.0:8099"`;
- `admin_token_env: "REGISTRY_ADMIN_TOKEN"`;
- `bifrost_auth_env: "REGISTRY_BIFROST_AUTH"`;
- `bifrost_url: "http://127.0.0.1:8080"` when plugin and gateway share the same container.

The plugin initializes a missing Registry file. Its UI assets are embedded; no separate frontend mount is needed.

## Verify

Open **http://127.0.0.1:8099/model-registry** and enter the Registry admin token. It stays in tab memory and must be entered again after reloading. The interface of v0.3.0-rc.4 to v0.3.0-rc.6 starts in English; French is one toggle or `?lang=fr` away. v0.2.0-rc.1, installed by the older rows, starts French-first.

Verify the plugin is `active` in `GET /api/plugins` and present in `GET /api/plugins/loaded`. Publish a small test catalog and read back `/v1/models` with a dedicated virtual key. Existing native keys remain unmanaged until explicitly adopted; adoption cannot expand their native permissions.

## Upgrade and rollback

Stop the gateway and back up **all of `/app/data`** before an update. Save the new compatible `.so` URL and restart the gateway; Bifrost downloads the saved URL at startup. Disabling and re-enabling a Go plugin without restarting is not a supported update path (`plugin already loaded`). Verify loading, saved data and the test key again.

To roll back, stop the gateway, restore the complete stopped-volume backup, restore the prior gateway image if changed, and restart. This restores the Bifrost database, plugin URL and Registry data together. Pointing an old plugin at already-migrated data is not the tested rollback procedure. Keep the old plugin bytes available at their versioned URL.

## Qualification and limits

v0.3.0-rc.6 is the Registry rebuilt and qualified natively on Linux AMD64 and ARM64 against Bifrost 2.2.5, with synthetic providers; the per-architecture reports are release assets (`reports-linux-<arch>.tar.gz`). v0.3.0-rc.5 did the same for the v0.3.0-rc.4 Registry against Bifrost 2.2.4. v0.3.0-rc.4 was qualified on Linux ARM64 against Bifrost 2.2.3; see its [ARM64 qualification report](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/reports/bifrost-2.2.3-arm64-869e251/README.md). The evidence of v0.2.0-rc.1 covers both architectures, URL installation, persistence, native adoption and an ARM64 upgrade/rollback ([release evidence](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/reports/v1-final/README.md)). Real-provider inference, a production rollout and native sidebar integration are not certified by these checks. [STATUS](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md) is the authoritative record.

The previous Bifrost 2.2.1 binary-mount recipe is retained in the [historical archive](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/docs/archive/installation-2.2.1.md).
