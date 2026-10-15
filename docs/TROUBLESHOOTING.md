# Troubleshooting

English · [Français](fr/TROUBLESHOOTING.md)

Problems seen when installing the plugin. For the steps themselves, see the [installation guide](INSTALL.md).

## `failed to create temporary file: open /tmp/bifrost-plugin-*.so: permission denied`

Seen when adding a plugin by URL. Bifrost downloads the `.so` into its temporary directory before loading it (`os.TempDir()`: `/tmp`, or `$TMPDIR` when set; source: `framework/plugins/utils.go` in the pinned Bifrost tree). The Bifrost process therefore needs a **writable (and executable) temp directory**. This fails on hardened containers: read-only root filesystem, missing `/tmp`, or a `$TMPDIR` owned by another user. Fixes:

- Docker: mount a writable tmpfs, for example `--tmpfs /tmp:rw,exec,nosuid,size=128m`, or point the temp dir at the data volume with `-e TMPDIR=/app/data/tmp` and create `/app/data/tmp` writable by the container's runtime user.
- Kubernetes: add an `emptyDir` volume at `/tmp` when `readOnlyRootFilesystem` is set.
- systemd service: check `PrivateTmp` and hardening options, and set `Environment=TMPDIR=…` to a writable directory.
- Quick check from the host: `docker exec <container> sh -c 'id; touch /tmp/write-test && rm /tmp/write-test'` must succeed as the Bifrost user.

## `Dynamic loading not supported` (official prebuilt image)

The static official Bifrost image downloads the `.so` but refuses to load it. Use the published dynamic image (mode A) or build your own gateway with dynamic loading matching your Go toolchain, architecture and libc ([native build](BUILD.md), French only).

## `plugin already loaded` when re-enabling without restart

Hot reactivation of a Go plugin is not supported. With published v0.3.0 / Bifrost 2.2.6, the failed enable leaves `enabled:true`; restart the gateway, then verify the panel, data and readback.

With the **Bifrost 2.3.0 source candidate (final qualification pending)**, the failed URL enable restores `enabled:false`. Restart alone leaves it disabled, and re-enabling the unchanged URL after restart still fails: disabled-start verification already opens the Go module, then URL enable downloads it to another temporary filename. This is not an authentication error or a reason to accept 500 as success.

Use the explicit [URL-to-local recovery procedure](INSTALL.md#recover-activation-after-disabling): provision an immutable, checksum-verified persistent local copy of the **same compatible bytes**, save its absolute container path **disabled before restart**, read it back, fully stop/restart, then enable that same local path. This changes installation mode; retain the file/mount. An initially local installation keeps its existing stable path. No local hot reactivation is claimed. Verify active/loaded state, the exact saved path, panel, saved models/groups/key policies and unchanged dedicated-key readback. A failed path update restores the previous path; recovery is not an artifact upgrade or a complete-volume rollback. Do not edit the database or delete/recreate the plugin.

## The plugin downloads but fails to activate

Verify the checksum against `SHA256SUMS`, and that the image and the `.so` share architecture, Go version, dependencies and libc. Check `GET /api/plugins` and the gateway logs for the activation error.
