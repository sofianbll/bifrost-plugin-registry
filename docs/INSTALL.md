# Install Registry

English · [Français](fr/INSTALL.md)

Registry is installed as **two separate artifacts**: a Bifrost gateway image compiled with dynamic loading (it contains no plugin), and the Registry plugin, a `.so` file with its interface embedded. Both must come from the same build: same architecture, Go toolchain, dependency versions and libc. Starting the image does not install the plugin. Use a staging instance before migrating an existing deployment.

**Source candidate, not a release:** `bifrost.pin` now targets unmodified Bifrost 2.3.0 (`transports/v2.3.0`, commit `9237ec06672406e437b3cb33fc793ffd0403b3ae`), with Go 1.27.1 and Alpine 3.23 unchanged. Compatibility is not established until the exact candidate pair passes native AMD64/ARM64 qualification. The published v0.3.0 files and examples below remain for Bifrost 2.2.6; do not install those plugins on a 2.3 gateway.

## Which files for which host

Pick the row for your host.

| Host | Release | Bifrost | Gateway image | Plugin (`.so`) |
| --- | --- | --- | --- | --- |
| Linux AMD64 (x86_64) | [v0.3.0](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0) (current stable) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-linux-amd64.so` |
| Linux ARM64 | [v0.3.0](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0) (current stable) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-linux-arm64.so` |
| Linux AMD64 (x86_64), previous published release | [v0.3.0-rc.8](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.8) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.8-linux-amd64.so` |
| Linux ARM64, previous published release | [v0.3.0-rc.8](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.8) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.8-linux-arm64.so` |
| Linux AMD64 (x86_64), older | [v0.3.0-rc.7](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.7) (older) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.7-linux-amd64.so` |
| Linux ARM64, older | [v0.3.0-rc.7](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.7) (older) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.7-linux-arm64.so` |
| Linux AMD64 (x86_64), older | [v0.3.0-rc.6](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.6) (older) | 2.2.5 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.5` | `bifrost-registry-v0.3.0-rc.6-linux-amd64.so` |
| Linux ARM64, older | [v0.3.0-rc.6](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.6) (older) | 2.2.5 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.5` | `bifrost-registry-v0.3.0-rc.6-linux-arm64.so` |
| Linux AMD64 (x86_64), older | [v0.3.0-rc.5](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.5) (older) | 2.2.4 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.4` | `bifrost-registry-v0.3.0-rc.5-linux-amd64.so` |
| Linux ARM64, older | [v0.3.0-rc.5](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.5) (older) | 2.2.4 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.4` | `bifrost-registry-v0.3.0-rc.5-linux-arm64.so` |
| Linux ARM64, older | [v0.3.0-rc.4](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.4) (older) | 2.2.3 | `bifrost-dynamic-2.2.3-linux-arm64.tar.gz` | `bifrost-registry-v0.3.0-rc.4-linux-arm64.so` |
| Linux AMD64 (x86_64), older | [v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) (older) | 2.2.2 | `bifrost-dynamic-2.2.2-linux-amd64.tar.gz` | `bifrost-registry-v0.2.0-rc.1-linux-amd64.so` |
| Linux ARM64, older | [v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) (older) | 2.2.2 | `bifrost-dynamic-2.2.2-linux-arm64.tar.gz` | `bifrost-registry-v0.2.0-rc.1-linux-arm64.so` |

- Download each `.so` from its release page. The plugin URL is always `https://github.com/sofianbll/bifrost-plugin-registry/releases/download/<release>/<plugin file>`: the URL of the **`.so` file**, not of the repository or the release page. v0.3.0 and rc.5 to rc.8 have no image archive: the gateway image comes from GHCR (see [Mode A](#mode-a-image-and-plugin-url)); older releases ship it as an archive on their release page.
- Every release includes a `SHA256SUMS` file. Verify each download against it.
- Current v0.3.0 plugin hashes: AMD64 `0361097e8ced195d0377b618aeb99360a5daf0ed1f6457f7a8b770f155e59f60`; ARM64 `0d2bf90386976873d6bc33790378373236a5305f3adb2fcf7ac9efadc5a3a14a`. These match the published manifest.
- v0.3.0 is the stable release for both architectures. v0.2.0-rc.1 predates the Models.dev catalogue, per-access endpoints and native price and routing capabilities that v0.3.0 adds.
- See [Qualification and limits](#qualification-and-limits).

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

For v0.3.0 the gateway image (no plugin) is a multi-arch image on GHCR: Docker picks `linux/amd64` or `linux/arm64` for your host. Pin the published digest below; the `2.2.6` tag is convenient but moves with each published Bifrost 2.2.6 gateway build.

```bash
# pinned
docker pull ghcr.io/sofianbll/bifrost-dynamic@sha256:849fe441be5215a3c4783a9fcdd9989dde1f3c8c201dc6b4c140060880f07a66
# convenient
docker pull ghcr.io/sofianbll/bifrost-dynamic:2.2.6
```

For v0.3.0-rc.8 (same Bifrost 2.2.6), pin `ghcr.io/sofianbll/bifrost-dynamic@sha256:1555e28d4e5adca52d10c54d2e94db18a6c8346fa29b250de50e408ada42d6fe`; for v0.3.0-rc.7 (same Bifrost 2.2.6), pin `ghcr.io/sofianbll/bifrost-dynamic@sha256:d0b4e98c40e22f142c637737507acfb4e181f6dc340c85aba8989b9df0bbf3be`; for v0.3.0-rc.6 (tag `2.2.5`), pin `ghcr.io/sofianbll/bifrost-dynamic@sha256:7c3354b041e4c06b1797a58adcfe8c6eeb11b270edff2ccf5610c4a98809d367`; for v0.3.0-rc.5 (tag `2.2.4`), pin `ghcr.io/sofianbll/bifrost-dynamic@sha256:ef56067e2bf807930270d2d6318ba9e9996ed914c9469db46068078d3c06e7b2`.

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

With Bifrost 2.2.6 (v0.3.0 and rc.7/rc.8), the native management API (`/api/...`, except public routes such as `/health`) stays locked until dashboard authentication is enabled or a setup token is sent ([upstream release notes](https://github.com/maximhq/bifrost/releases/tag/transports%2Fv2.2.6)). Registry sends only the `Authorization` header from `REGISTRY_BIFROST_AUTH`, never a setup token, so enable dashboard authentication, as the qualified configuration does. 2.2.6 also turns `enforce_auth_on_inference` on by default for fresh deployments, so inference, including the `/v1/models` check under [Verify](#verify), needs a credential such as the dedicated virtual key used there.

In the plugin entry keep:

- `placement: "post_builtin"` and `order: 0`;
- `registry_path: "/app/data/registry/registry.json"`;
- `admin_listen: "0.0.0.0:8099"`;
- `admin_token_env: "REGISTRY_ADMIN_TOKEN"`;
- `bifrost_auth_env: "REGISTRY_BIFROST_AUTH"`;
- `bifrost_url: "http://127.0.0.1:8080"` when plugin and gateway share the same container.

The plugin initializes a missing Registry file. Its UI assets are embedded; no separate frontend mount is needed.

## Verify

Open **http://127.0.0.1:8099/model-registry** and enter the Registry admin token. It stays in tab memory and must be entered again after reloading. The interface of v0.3.0 and v0.3.0-rc.4 through rc.8 starts in English; French is one toggle or `?lang=fr` away. v0.2.0-rc.1, installed by the older rows, starts French-first.

Verify the plugin is `active` in `GET /api/plugins` and present in `GET /api/plugins/loaded`. Publish a small test catalog and read back `/v1/models` with a dedicated virtual key. Existing native keys remain unmanaged until explicitly adopted; adoption cannot expand their native permissions. From v0.3.0, `GET http://127.0.0.1:8099/api/status` with the Registry admin token as a Bearer token returns the installed release as `version`, and `bifrost_connected: true` once Registry reaches Bifrost.

## Recover activation after disabling

Hot reactivation of a loaded Go `.so` is unsupported (`HTTP 500`, `plugin already loaded`); the Registry panel stays closed after the failed enable.

- **Published v0.3.0 / Bifrost 2.2.6:** the failed enable leaves the saved row `enabled:true`. Restart the gateway to load it again.
- **Bifrost 2.3.0 source candidate:** the failed enable restores the previous row, `enabled:false`. Restart alone leaves the plugin disabled and the panel closed. Keep the same plugin URL and settings: **disable → restart the gateway → enable** through Bifrost's native plugin settings (or `PUT /api/plugins/bifrost-registry`). Do not repeatedly retry enable before restarting.

After recovery, verify `enabled:true`, status `active`, the saved URL in `GET /api/plugins`, membership in `GET /api/plugins/loaded`, the panel, saved models/groups/key policies and the dedicated key's `/v1/models` readback. Recovery is not an upgrade or a volume rollback; it must not expand native permissions. The 2.3 procedure is a qualification target, not a compatibility claim.

## Upgrade and rollback

Stop the gateway and back up **all of `/app/data`** before an update. For published v0.3.0 / Bifrost 2.2.6, save the new compatible `.so` URL and restart the gateway; Bifrost downloads the saved URL at startup. Disabling and re-enabling a Go plugin without restarting is not a supported update path (`plugin already loaded`). Verify loading, saved data and the test key again.

For a separately built 2.3.0 candidate pair on disposable staging, disable the plugin, restart the gateway, then save the new compatible URL/settings and enable it. A failed hot update restores the previous row, including its URL: do not assume the new URL was saved. Read it back from `GET /api/plugins` and verify loading, data and the test key. Published v0.3.0 assets are not a 2.3 upgrade pair. Gateway upgrades may migrate Bifrost's database; activation recovery alone does not qualify such a migration or rollback.

Registry data written before v0.3 has no per-key access selection. From v0.3.0, when a key's model is offered by several provider accesses, the plugin still loads but leaves that model out of the key's catalog: the gateway log shows `bifrost-registry: warning: policy <key>: model <alias> has N accesses and no access_selection`, and the panel marks the key **Access choice needed**. Open the key, uncheck the accesses it must not use in the model's Accesses list, and publish.

To roll back, stop the gateway, restore the complete stopped-volume backup, restore the prior gateway image if changed, and restart. This restores the Bifrost database, plugin URL and Registry data together. Pointing an old plugin at already-migrated data is not the tested rollback procedure. Keep the old plugin bytes available at their versioned URL.

## Qualification and limits

v0.3.0 was natively qualified on Linux AMD64 and ARM64 against Bifrost 2.2.6 with synthetic providers; native suite results, image distribution probes, asset hashes and provenance are recorded in [STATUS](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md) and the [release run](https://github.com/sofianbll/bifrost-plugin-registry/actions/runs/38761865725). The upstream Bifrost UI `npm ci` reported 9 vulnerabilities (1 low, 5 high, 3 critical) during both native builds; the upstream UI is compiled to static files, not a Node/Next server. No SBOM, bundle trace or exploitability test established a reachable path or exploitation; residual risk is plausible but unproven. The separate Registry UI install reported 0 vulnerabilities. This is not a security guarantee; upstream remediation is not included. Follow-up triage is tracked in [#141](https://github.com/sofianbll/bifrost-plugin-registry/issues/141). The official prebuilt Bifrost image, real-provider inference, production deployment and native sidebar integration are not certified by these checks.

The previous Bifrost 2.2.1 binary-mount recipe is retained in the [historical archive](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/docs/archive/installation-2.2.1.md).
