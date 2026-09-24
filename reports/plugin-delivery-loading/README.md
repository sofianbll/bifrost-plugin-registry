# URL installation on a paired dynamic Bifrost 2.2.2 build

Local proof on 2026-09-24. The Bifrost source was pinned to `fdeef8e3f31a3b18a61666ba49247d07bae3600a` (`transports/v2.2.2`). The paired gateway and Registry plugin were built in the same Go module with Go 1.27.1, `CGO_ENABLED=1`, `GOWORK=off`, `-mod=readonly -trimpath -buildvcs=false -tags=bifrost -ldflags='-w -s'`, for Linux ARM64 and Alpine musl. The gateway is a dynamically linked ELF executable. The runtime container used the already-local `golang:1.27.1-alpine` image; this was **not** an official Bifrost image.

| Artifact | SHA-256 |
| --- | --- |
| Dynamic gateway | `eab3e220096e2d32cdb6efd1a1a8f081606da3a22dbf23004f7d677525563a97` |
| Paired Registry plugin | `f96515e159a986fb745502f77e73dea1591bae6590c6b01c69284ce22ff151ce` |

The [build environment](build-environment.txt) records every resolved module. [Gateway](gateway-build-info.txt) and [plugin](plugin-build-info.txt) build metadata show the same versions for all 22 shared runtime dependencies, including `github.com/maximhq/bifrost/core v1.10.1`, `github.com/mark3labs/mcp-go v0.43.2` and `github.com/valyala/fasthttp v1.74.0`. [SHA256SUMS](SHA256SUMS) also records the ABI probe; its previous `plugin.Open` self-check passed in the paired build.

## Disposable runtime proof

Run from the repository root with Docker and the two local images above:

```sh
python3 integration/dynamic_plugin_probe.py --out /private/tmp/bifrost-dynamic-new
```

The command creates a fresh app directory and two containers in one loopback-only network namespace. It publishes no ports. It uses native administrator Basic authentication and a deploy-time `127.0.0.1` plugin-download allowlist only for the local fixture. It removes both containers and the app directory. The [asserted report](report.json) from this run passed every check and confirmed both containers were removed.

| Observation | Result |
| --- | --- |
| Unauthenticated `POST /api/plugins` | HTTP 401; no row |
| Missing URL | HTTP 500 after fixture HTTP 404; no row |
| Invalid `.so` bytes | HTTP 500 from `plugin.Open`; no row |
| Valid content-addressed URL | HTTP 201; saved plugin `active` |
| `GET /api/plugins/loaded` | Contains `bifrost-registry`, the plugin's `GetName()` value; the saved row is named `delivery-registry` |
| Gateway recreated with the same SQLite app directory | Same URL re-fetched, saved row `active`, runtime still contains `bifrost-registry` |

The valid URL was served twice from the same mounted `.so`, once during creation and once during startup after restart. Its path includes the SHA-256 and the fixture never changes the file. Bifrost persists the URL, not the downloaded bytes, so a future restart depends on the URL still serving compatible bytes. The test uses no provider credentials or inference. The loopback allowlist is a fixture exception; Bifrost's default private-address download restriction remains in place. This proof validates the local dynamic build. The [stock 2.2.2 ARM64 result](../stock-v2.2.2-plugin-install/README.md) still fails with `Dynamic loading not supported`, and official adoption remains open.

The [proposed upstream Dockerfile patch](../../integration/upstream-dynamic-docker.patch) was checked against the pristine pinned source (`transports/Dockerfile` SHA-256 `923e5a28e173e3e1d8c56666f9226062864d275310b59b2b91bea15ea3a26661`). It adds an opt-in dynamic build path while retaining the stock static path. That Dockerfile variant was not built or tested here. Its pinned builder uses Go 1.27.0, so this Go 1.27.1 plugin artifact must not be paired with it without a matching rebuild.
