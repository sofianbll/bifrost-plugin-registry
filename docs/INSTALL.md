# Install Registry on a test instance

<a id="install-registry"></a>

English · [Français](fr/INSTALL.md)

Start a new Bifrost instance, load Registry and open its panel connected to the gateway.

## Before you start

Use a Linux AMD64 or ARM64 host with Docker and writable persistent storage. Prepare your Bifrost admin and provider configuration with dashboard authentication enabled.

You need two components: the compatible dynamic Bifrost image and the Registry `.so` plugin. The image contains no plugin; the official static image cannot load it.

**Already running a gateway? Stop here.** Prepare a separate test instance and back up the complete volume with the gateway stopped, including SQLite and WAL files. Never allow two processes to write to that volume at the same time. An in-place upgrade is not established as compatible. Read the [migration limits and coordinated restore procedure](#upgrade-and-rollback).

## 1. Download the compatible files

<a id="_1-download-and-verify"></a>

Use Registry v0.4.0 with unmodified Bifrost 2.3.0, Go 1.27.1 and Alpine 3.23 (musl). Image and plugin must match exactly: architecture, Go toolchain, dependency versions, OS and libc. Choose the plugin for your host below.

Download the plugin and [SHA256SUMS](https://github.com/sofianbll/bifrost-plugin-registry/releases/download/v0.4.0/SHA256SUMS) into the same directory. Run the checksum command there and check that your plugin reports OK; files you did not download are skipped. Then pull the pinned image below. Docker selects the host architecture.

| Linux host | Registry v0.4.0 · Bifrost 2.3.0 |
| --- | --- |
| AMD64 (x86_64) | [bifrost-registry-v0.4.0-linux-amd64.so](https://github.com/sofianbll/bifrost-plugin-registry/releases/download/v0.4.0/bifrost-registry-v0.4.0-linux-amd64.so) |
| ARM64 | [bifrost-registry-v0.4.0-linux-arm64.so](https://github.com/sofianbll/bifrost-plugin-registry/releases/download/v0.4.0/bifrost-registry-v0.4.0-linux-arm64.so) |

```bash
sha256sum -c --ignore-missing SHA256SUMS

docker pull ghcr.io/sofianbll/bifrost-dynamic@sha256:29e026ab80de357938e3e6df5ac1c3c54c3f6877f4daa2c859e980140fdbbaa0
```

**Expected:** The downloaded plugin reports OK and Docker has pulled the image.

## 2. Prepare the credentials

Create a secret of at least 32 characters for `REGISTRY_ADMIN_TOKEN`. You will enter it to open the Registry panel.

Set `REGISTRY_BIFROST_AUTH` to the complete `Authorization` header matching your Bifrost admin authentication, including its scheme (for example `Basic <base64(username:password)>`, with your own credentials). The plugin uses it to reach the native admin API; it is not an application key.

Keep both values in a secret manager or private environment file, never in committed JSON or logs. Make them available in the environment of the shell that will start Docker: the next command passes these two variables into the container.

## 3. Start Bifrost

<a id="_2-get-the-image-and-start-the-gateway"></a>

Replace `<image reference>` below with the full pinned image reference from step 1. Adapt the container name, ports and volume to your test instance; keep the normal image entrypoint and writable persistent storage at `/app/data`.

Bifrost uses port `8080`. The mapping `127.0.0.1:8099:8099` exposes the future Registry panel only on host loopback. Inside the container, its listener must be `0.0.0.0:8099`, as configured in step 4. Starting this image does not install Registry.

```bash
docker run -d --name bifrost \
  -p 8080:8080 -p 127.0.0.1:8099:8099 \
  -v bifrost-data:/app/data \
  -e REGISTRY_ADMIN_TOKEN -e REGISTRY_BIFROST_AUTH \
  <image reference>
```

## 4. Install the Registry plugin

<a id="_3-install-the-plugin-by-url"></a>

Open the native Bifrost plugin settings and the [plugin configuration fragment](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/configs/plugin.fragment.json). Merge that entry into your configuration without replacing the existing settings. Set `path` to the direct URL of your architecture’s `.so` in step 1, not the release-page URL.

Keep `name: "bifrost-registry"`, `enabled: true`, `placement: "post_builtin"` and `order: 0`. In `config`, keep `registry_path: "/app/data/registry/registry.json"`, `admin_listen: "0.0.0.0:8099"`, `admin_token_env: "REGISTRY_ADMIN_TOKEN"`, `bifrost_auth_env: "REGISTRY_BIFROST_AUTH"` and `bifrost_url: "http://127.0.0.1:8080"` for this shared-container setup.

Save the entry. Bifrost downloads the URL at installation and on every start: keep that versioned file available with the same bytes. Registry creates its data file if missing and includes its own interface; no frontend mount is needed.

## 5. Check loading and connection

<a id="verify"></a>

Using authenticated Bifrost administration, check that Registry is `active` in `GET /api/plugins` and also present in `GET /api/plugins/loaded`. Both checks are required.

Open `http://127.0.0.1:8099/model-registry` and enter the **value** of the token you set in `REGISTRY_ADMIN_TOKEN`, not the variable name. The token stays in tab memory; enter it again after a reload. Then query `GET http://127.0.0.1:8099/api/status` with that token as a Bearer token and check for `bifrost_connected: true`; `version` identifies the installed release.

If loading fails or the panel cannot connect, [find the matching error in troubleshooting](TROUBLESHOOTING.md). Once connected, [choose models for an application](USER-GUIDE.md) to publish a test selection and check the list Bifrost returns. Existing native keys remain unmanaged until explicitly adopted; adoption cannot expand their native permissions.

**Expected:** The plugin is active and loaded, the panel opens, and status reports `bifrost_connected: true`.

## Other cases and reference

The following sections retain earlier files, alternative installation modes, recovery and qualification details. [Find another guide](README.md).

**Current stable release:** [v0.4.0](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.4.0), published October 16, 2026 from Registry `ba59b878f824f04e54bdd5e9760352c2727ea245`, pairs unmodified Bifrost 2.3.0 (`transports/v2.3.0`, commit `9237ec06672406e437b3cb33fc793ffd0403b3ae`) with Go 1.27.1 and Alpine 3.23. [The release run](https://github.com/sofianbll/bifrost-plugin-registry/actions/runs/38887602494) natively qualified both architectures and built, started and probed each image with the URL-installed separate plugin before pushing it (container recreation, synthetic provider, no inference). v0.3.0 stays published for Bifrost 2.2.6; never install its plugins on a 2.3 gateway.

## Which files for which host

Pick the row for your host.

| Host | Release | Bifrost | Gateway image | Plugin (`.so`) |
| --- | --- | --- | --- | --- |
| Linux AMD64 (x86_64) | [v0.4.0](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.4.0) (current stable) | 2.3.0 | `ghcr.io/sofianbll/bifrost-dynamic:2.3.0` | `bifrost-registry-v0.4.0-linux-amd64.so` |
| Linux ARM64 | [v0.4.0](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.4.0) (current stable) | 2.3.0 | `ghcr.io/sofianbll/bifrost-dynamic:2.3.0` | `bifrost-registry-v0.4.0-linux-arm64.so` |
| Linux AMD64 (x86_64), previous stable | [v0.3.0](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-linux-amd64.so` |
| Linux ARM64, previous stable | [v0.3.0](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-linux-arm64.so` |
| Linux AMD64 (x86_64), older pre-release | [v0.3.0-rc.8](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.8) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.8-linux-amd64.so` |
| Linux ARM64, older pre-release | [v0.3.0-rc.8](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.8) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.8-linux-arm64.so` |
| Linux AMD64 (x86_64), older | [v0.3.0-rc.7](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.7) (older) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.7-linux-amd64.so` |
| Linux ARM64, older | [v0.3.0-rc.7](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.7) (older) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.7-linux-arm64.so` |
| Linux AMD64 (x86_64), older | [v0.3.0-rc.6](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.6) (older) | 2.2.5 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.5` | `bifrost-registry-v0.3.0-rc.6-linux-amd64.so` |
| Linux ARM64, older | [v0.3.0-rc.6](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.6) (older) | 2.2.5 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.5` | `bifrost-registry-v0.3.0-rc.6-linux-arm64.so` |
| Linux AMD64 (x86_64), older | [v0.3.0-rc.5](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.5) (older) | 2.2.4 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.4` | `bifrost-registry-v0.3.0-rc.5-linux-amd64.so` |
| Linux ARM64, older | [v0.3.0-rc.5](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.5) (older) | 2.2.4 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.4` | `bifrost-registry-v0.3.0-rc.5-linux-arm64.so` |
| Linux ARM64, older | [v0.3.0-rc.4](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.4) (older) | 2.2.3 | `bifrost-dynamic-2.2.3-linux-arm64.tar.gz` | `bifrost-registry-v0.3.0-rc.4-linux-arm64.so` |
| Linux AMD64 (x86_64), older | [v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) (older) | 2.2.2 | `bifrost-dynamic-2.2.2-linux-amd64.tar.gz` | `bifrost-registry-v0.2.0-rc.1-linux-amd64.so` |
| Linux ARM64, older | [v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) (older) | 2.2.2 | `bifrost-dynamic-2.2.2-linux-arm64.tar.gz` | `bifrost-registry-v0.2.0-rc.1-linux-arm64.so` |

- Download each `.so` from its release page. The plugin URL is always `https://github.com/sofianbll/bifrost-plugin-registry/releases/download/<release>/<plugin file>`: the URL of the **`.so` file**, not of the repository or the release page. v0.4.0, v0.3.0 and rc.5 to rc.8 have no image archive: the gateway image comes from GHCR (see [Mode A](#mode-a-image-and-plugin-url)); older releases ship it as an archive on their release page.
- Every release includes a `SHA256SUMS` file. Verify each download against it.
- Current v0.4.0 plugin hashes: AMD64 `5dba39e79417a5c0ab665d80ae26b2a5438190701448ae47714ce899d0469fb9`; ARM64 `843e96afc947159f247a027d7fcb4be10e55f046057e792aea39b0e850522ae5`.
- v0.4.0 is the stable release for both architectures. v0.2.0-rc.1 predates the Models.dev catalogue, per-access endpoints and native price and routing capabilities that v0.3.0 added.
- See [Qualification and limits](#qualification-and-limits).

## Choose an installation mode

**Mode A: Registry image and plugin URL (recommended).** Run the published dynamic image and add the `.so` by direct URL in Bifrost's plugin settings. The image holds an unmodified Bifrost compiled with dynamic loading and **no plugin**, so the inference path you trust is never patched and Registry stays a separate, versioned artifact.

**Mode B: plugin only, on a gateway you already run.** Any Bifrost **compiled with dynamic loading** can host the Registry `.so`. It must match your gateway's architecture, Go toolchain, dependency versions, OS and libc; the qualified pairs use Linux/musl and Go 1.27.1. The official prebuilt static image refuses dynamic plugins (`Dynamic loading not supported`); see [Troubleshooting](TROUBLESHOOTING.md).

## Mode A: image and plugin URL

The five-step procedure above is Mode A for the current release. Use [step 1](#_1-download-and-verify) for downloads, [step 3](#_2-get-the-image-and-start-the-gateway) for startup and [step 4](#_3-install-the-plugin-by-url) for installation. Keep existing Bifrost providers, keys, budgets and routing when preparing a separate test copy.

On macOS, `shasum -a 256 <file>` gives the checksum to compare by hand.

For v0.3.0-rc.4 and v0.2.0-rc.1, also download the image archive from the table and check it the same way.

Convenience tags `2.3.0` and `2.3.0-go1.27.1` currently point to the digest in step 1 but can move; pin the digest instead.

For previous stable v0.3.0 / Bifrost 2.2.6, pin `ghcr.io/sofianbll/bifrost-dynamic@sha256:849fe441be5215a3c4783a9fcdd9989dde1f3c8c201dc6b4c140060880f07a66`; tag `2.2.6` still points to it, not to the 2.3.0 image.

For v0.3.0-rc.8 (same Bifrost 2.2.6), pin `ghcr.io/sofianbll/bifrost-dynamic@sha256:1555e28d4e5adca52d10c54d2e94db18a6c8346fa29b250de50e408ada42d6fe`; for v0.3.0-rc.7 (same Bifrost 2.2.6), pin `ghcr.io/sofianbll/bifrost-dynamic@sha256:d0b4e98c40e22f142c637737507acfb4e181f6dc340c85aba8989b9df0bbf3be`; for v0.3.0-rc.6 (tag `2.2.5`), pin `ghcr.io/sofianbll/bifrost-dynamic@sha256:7c3354b041e4c06b1797a58adcfe8c6eeb11b270edff2ccf5610c4a98809d367`; for v0.3.0-rc.5 (tag `2.2.4`), pin `ghcr.io/sofianbll/bifrost-dynamic@sha256:ef56067e2bf807930270d2d6318ba9e9996ed914c9469db46068078d3c06e7b2`.

For v0.3.0-rc.4 and v0.2.0-rc.1, load the archive instead:

```bash
docker load -i <image archive>   # prints the loaded image tag
```

For API installation, use `POST /api/plugins` with the same merged fragment and [plugin settings](#credentials-and-plugin-settings) as step 4. Keep the bytes of that version available at its saved URL for every start.

If the download fails with a temporary-file permission error, see [Troubleshooting](TROUBLESHOOTING.md).

## Mode B: plugin only

1. Download the `.so` matching your gateway from the table and verify its checksum as above. If your gateway was built from a different release, [build the pair yourself](BUILD.md) (French only).
2. Make it reachable by the gateway either as a **local file path** (`path: "/plugins/bifrost-registry.so"` in the plugin entry, file readable by the Bifrost process) or as an **http(s) URL** (Bifrost downloads it at startup).
3. Merge the [plugin fragment](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/configs/plugin.fragment.json) with that `path` and the [plugin settings](#credentials-and-plugin-settings) below, through Bifrost's native plugin settings or `POST /api/plugins`.

For **v0.4.0 / Bifrost 2.3.0**, an initial local installation can use the same immutable, versioned filename for **disable → restart → enable** recovery. Keep the exact paired `.so` bytes readable at that absolute container path across restarts, preferably on a read-only mount. This does not qualify local hot reactivation. Initial URL installation remains supported, but recovery needs the explicit [URL-to-local transition](#recover-activation-after-disabling) below.

## Credentials and plugin settings

Both modes use two separate secrets, supplied as environment values (never committed in JSON or logs):

| Variable | Purpose |
| --- | --- |
| `REGISTRY_ADMIN_TOKEN` | At least 32 characters; opens the Registry panel. |
| `REGISTRY_BIFROST_AUTH` | Complete `Authorization` header for the native Bifrost admin API, for example `Basic <base64(username:password)>`. Must match the gateway's configured authentication. |

For current v0.4.0 / Bifrost 2.3.0, keep dashboard authentication enabled for Registry's native API calls and use a dedicated virtual-key credential for `/v1/models`, as in the qualified configuration.

With Bifrost 2.2.6 (v0.3.0 and rc.7/rc.8), the native management API (`/api/...`, except public routes such as `/health`) stays locked until dashboard authentication is enabled or a setup token is sent ([upstream release notes](https://github.com/maximhq/bifrost/releases/tag/transports%2Fv2.2.6)). Registry sends only the `Authorization` header from `REGISTRY_BIFROST_AUTH`, never a setup token, so enable dashboard authentication, as the qualified configuration does. 2.2.6 also turns `enforce_auth_on_inference` on by default for fresh deployments, so inference, including the `/v1/models` check under [Verify](#verify), needs a credential such as the dedicated virtual key used there.

In the plugin entry keep:

- `placement: "post_builtin"` and `order: 0`;
- `registry_path: "/app/data/registry/registry.json"`;
- `admin_listen: "0.0.0.0:8099"`;
- `admin_token_env: "REGISTRY_ADMIN_TOKEN"`;
- `bifrost_auth_env: "REGISTRY_BIFROST_AUTH"`;
- `bifrost_url: "http://127.0.0.1:8080"` when plugin and gateway share the same container.

The plugin initializes a missing Registry file. Its UI assets are embedded; no separate frontend mount is needed.

The interface of v0.4.0, v0.3.0 and v0.3.0-rc.4 through rc.8 starts in English; French is one toggle or `?lang=fr` away. v0.2.0-rc.1, installed by the older rows, starts French-first. The release version in `/api/status` is available from v0.3.0.

## Recover activation after disabling

Hot reactivation of a loaded Go `.so` is unsupported (`HTTP 500`, `plugin already loaded`); the Registry panel stays closed after the failed enable.

- **Published v0.3.0 / Bifrost 2.2.6:** the failed enable leaves the saved row `enabled:true`. Restart the gateway to load it again.
- **Current v0.4.0 / Bifrost 2.3.0:** the failed URL enable restores the previous row, `enabled:false`. Restart alone leaves it disabled. Re-enabling the unchanged URL after restart also fails: disabled-start verification has already opened the Go module, and URL activation downloads it to another temporary filename (`plugin already loaded`). Do not repeatedly retry or treat 500 as success.

**v0.4.0 / Bifrost 2.3.0 recovery from a URL installation — explicit switch to local mode:**

1. Provision a local copy of the **same compatible plugin bytes**, verified against the installed artifact's SHA-256, at a new versioned persistent filename. The `path` must be absolute **inside the gateway container**, not on the Docker host. For example, use `/app/data/registry/plugins/sha256-<verified hash>/bifrost-registry.so` on the existing persistent data volume, or a versioned file bind-mounted read-only under `/plugins/`. Keep that file readable and read-only where possible; leave the data directory writable for Registry saves. Never overwrite an already loaded `.so`.
2. Disable through native plugin settings or `PUT /api/plugins/bifrost-registry`. A previous failed URL enable must leave `enabled:false` and the panel closed.
3. **Before restarting**, save the local `path` with `enabled:false` through the native API/settings, preserving all other plugin settings. Read back the disabled flag, exact local path and settings in `GET /api/plugins`; confirm absence from `GET /api/plugins/loaded` and a closed panel. Do not enable the local copy in the old process.
4. Fully stop the gateway process and wait for its exit, then restart with the same file/mount available at the same filename. Confirm the saved row remains disabled/local, the plugin is not in the loaded list and the panel is closed.
5. Enable that **same local path** through native settings/PUT. Require HTTP 200, then perform the verification below. For an initially local installation, keep its existing verified path and use disable → stop/restart → enable; no URL-to-local change is needed.

This changes the saved installation mode to local: Bifrost no longer fetches the old plugin URL at startup. The operator must retain the immutable file and persistent mount; do not silently restore URL mode. No direct database edits or plugin deletion/recreation are part of recovery.

After recovery, verify `enabled:true`, status `active`, the saved **path** in `GET /api/plugins`, membership in `GET /api/plugins/loaded`, the panel, saved models/groups/key policies and the dedicated key's unchanged `/v1/models` readback. Recovery uses the same bytes, not a new artifact, gateway upgrade, volume migration or qualified rollback; it must not expand native permissions. [The public 2.3 checkpoint evidence](https://github.com/sofianbll/bifrost-plugin-registry/issues/109#issuecomment-6203460908) is bounded to its exact pairs, not a blanket compatibility claim.

## Upgrade and rollback

Stop the gateway and back up **all of `/app/data`** before an update. For published v0.3.0 / Bifrost 2.2.6, save the new compatible `.so` URL and restart the gateway; Bifrost downloads the saved URL at startup. Disabling and re-enabling a Go plugin without restarting is not a supported update path (`plugin already loaded`). Verify loading, saved data and the test key again.

For v0.4.0 / Bifrost 2.3.0, the recovery above verifies only the **same existing bytes**, not an update to new plugin bytes or another gateway. A new plugin requires its own compatible versioned file, checksum and update qualification; never replace a loaded file in place. A failed hot update restores the previous row, including its path: do not assume a new URL or local path was saved. Read it back. Never install v0.3.0 assets on the 2.3 gateway. An in-place upgrade from v0.3.0/2.2.6 to v0.4.0/2.3.0 is **not qualified**: stop the gateway, back up the whole volume, then switch image and plugin together. Gateway upgrades may migrate Bifrost's database; activation recovery alone does not qualify such a migration or rollback.

Registry data written before v0.3 has no per-key access selection. From v0.3.0, when a key's model is offered by several provider accesses, the plugin still loads but leaves that model out of the key's catalog: the gateway log shows `bifrost-registry: warning: policy <key>: model <alias> has N accesses and no access_selection`, and the panel marks the key **Access choice needed**. Open the key, uncheck the accesses it must not use in the model's Accesses list, and publish.

To roll back, stop the gateway, restore the complete stopped-volume backup, restore the prior gateway image if changed, and restart. This restores the Bifrost database, plugin URL and Registry data together. Pointing an old plugin at already-migrated data is not the tested rollback procedure. Keep the old plugin bytes available at their versioned URL.

## Qualification and limits

### Previous v0.3.0 evidence (historical)

v0.3.0 was natively qualified on Linux AMD64 and ARM64 against Bifrost 2.2.6 with synthetic providers; native suite results, image distribution probes, asset hashes and provenance are recorded in [STATUS](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md) and the [release run](https://github.com/sofianbll/bifrost-plugin-registry/actions/runs/38761865725). The upstream Bifrost UI `npm ci` reported 9 vulnerabilities (1 low, 5 high, 3 critical) during both native builds; the upstream UI is compiled to static files, not a Node/Next server. No SBOM, bundle trace or exploitability test established a reachable path or exploitation; residual risk is plausible but unproven. The separate Registry UI install reported 0 vulnerabilities. This is not a security guarantee; upstream remediation is not included. Follow-up triage is tracked in [#141](https://github.com/sofianbll/bifrost-plugin-registry/issues/141). The official prebuilt Bifrost image, real-provider inference, production deployment and native sidebar integration are not certified by these checks.

### Current v0.4.0 evidence

Current v0.4.0 was natively qualified on Linux AMD64 and ARM64 (musl) against Bifrost 2.3.0; each published image was built from its qualified pair and probed with the plugin installed by URL, container recreation and a synthetic provider, without inference ([release run](https://github.com/sofianbll/bifrost-plugin-registry/actions/runs/38887602494)). Verify asset provenance with `gh attestation verify <file> --repo sofianbll/bifrost-plugin-registry`. No real gateway or production was touched; real-provider inference, production readiness and local hot reactivation are not qualified. The [historical foundation checkpoint and bounded #141 assessment](https://github.com/sofianbll/bifrost-plugin-registry/issues/109#issuecomment-6203460908) apply to their exact subjects, not a universal security guarantee or remediation of the historical v0.3.0 findings above.

The previous Bifrost 2.2.1 binary-mount recipe is retained in the [historical archive](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/docs/archive/installation-2.2.1.md).
