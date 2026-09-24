# Bifrost 2.2.2 stock plugin install audit

Date: 2026-09-24. Source pin: [`fdeef8e3f31a3b18a61666ba49247d07bae3600a`](https://github.com/maximhq/bifrost/tree/fdeef8e3f31a3b18a61666ba49247d07bae3600a).

## Finding

The Bifrost UI accepts a custom plugin's absolute `.so` path **or an HTTP(S) URL**. The server downloads URL content, saves it to a temporary `.so`, and calls Go's `plugin.Open`. The submitted path/URL is what the config store keeps; the downloaded file bytes are not persisted as the plugin artifact. On restart, Bifrost loads the saved path again.

That workflow still fails on the official stock image tested here. The image is statically linked; `plugin.Open` returned `Dynamic loading not supported`. Bifrost's create handler then removed the just-created config row. The exact clean-container proof below reached the loader after the asset request, and `/api/plugins/{name}` returned 404 afterward.

## Exact stock image proof

Tested `maximhq/bifrost@sha256:b9f6a43c325146dc11244902703206294866baefcb67d239a2bdd6a4f5ff52c6`, Linux ARM64 only. The disposable container had only loopback network access, and a deploy-time allowlist entry permitted the local fixture host. No inference request or provider was used.

| Step | Observed result |
| --- | --- |
| `GET /api/plugins` before | HTTP 200, `{"count":0,"plugins":[]}` |
| Authenticated `POST /api/plugins` with fixture URL | HTTP 500 after the URL was fetched once; 19,931,256 bytes written by the fixture server |
| Load error | `plugin.Open("/tmp/bifrost-plugin-2969838642.so"): Dynamic loading not supported` |
| `GET /api/plugins/{name}` after | HTTP 404, `Plugin not found` (create rollback) |

Raw evidence: [host.json](../../reports/stock-v2.2.2-plugin-install/verified/host.json) and [report.json](../../reports/stock-v2.2.2-plugin-install/verified/report.json). The host image identity and source artifact SHA-256 are in these files. The temporary downloaded file hash was not read back. The final host report confirms removal of the disposable Bifrost container.

## Workflow details from the pinned source

| Concern | Verified behavior |
| --- | --- |
| UI input | The install sheet validates `/...`, `http://...`, or `https://...`, then submits `{name,path,enabled:true,config}`. Edit mode makes name and path read-only. ([sheet](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/ui/app/workspace/plugins/sheets/addNewPluginSheet.tsx#L19), [form](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/ui/app/workspace/plugins/fragments/pluginFormFragments.tsx#L26)) |
| Management API | `POST /api/plugins`; JSON fields: `name`, `enabled`, `config`, `path`, optional `placement` (`pre_builtin` or `post_builtin`) and `order`. `GET /api/plugins` lists status; `GET /api/plugins/loaded` lists runtime-loaded names. ([handler](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/transports/bifrost-http/handlers/plugins.go#L48), [routes](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/transports/bifrost-http/handlers/plugins.go#L95)) |
| Authentication | Creating or changing a custom plugin path requires genuinely authenticated admin access. If dashboard auth was bypassed because it is disabled/unconfigured, the handler returns 403 before writing the path. ([create/update guard](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/transports/bifrost-http/handlers/plugins.go#L321)) |
| Download | A path beginning with `http` is fetched; only HTTP(S) is accepted, status must be 200, response body is capped at 200 MiB, timeout is 120 seconds, and redirects are capped at five. The `.so` is written to `os.TempDir()` and chmod 0755 before `plugin.Open`. ([loader](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/framework/plugins/soloader.go#L28), [download helper](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/framework/plugins/utils.go#L18)) |
| SSRF control | Private, loopback, link-local, CGNAT, and unspecified destinations are blocked by default, including redirect targets. The deploy-time `server.plugin_download_private_allowlist` accepts hostnames, IPs, and CIDRs; server startup validates it and passes it to the downloader. It is not settable from the plugin API. ([config schema](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/transports/config.schema.json#L21), [server wiring](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/transports/bifrost-http/server/server.go#L2732)) |
| Save and reload | Create stores the submitted path and config before loading. If enabled-plugin loading fails, it deletes the new row and returns 500; the stock proof confirms that rollback. Updates persist first and return 500 on load failure without rolling the update back. Startup reload reads the saved path. ([create](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/transports/bifrost-http/handlers/plugins.go#L338), [update](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/transports/bifrost-http/handlers/plugins.go#L488), [startup](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/transports/bifrost-http/server/plugins.go#L325)) |
| Loader checks | `plugin.Open` is the load check. Optional `Init` must match `func(config any) error` when exported; required symbols are `GetName() string` and `Cleanup() error`; other hooks are optional but must match their asserted Go signatures. No separate toolchain/ABI compatibility validator appears in the loader. ([loader](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/framework/plugins/soloader.go#L53)) |
| Go compatibility | The Go standard library warns that runtime crashes are likely unless host and plugin use exactly the same Go toolchain, build tags, and relevant flags/environment. `plugin.Open` initializes a plugin once and it cannot be closed. [Go `plugin` docs](https://go.dev/pkg/plugin/). |

## Plugin surfaces and required changes

| Requested capability | Supported in 2.2.2? | What is required |
| --- | --- | --- |
| Implement plugin hooks | Yes | Implement the supported Go interfaces and build the `.so` against the host's exact build inputs. `BasePlugin` is `GetName` + `Cleanup`; optional interfaces add LLM, MCP, observability, or HTTP transport hooks. ([interfaces](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/core/schemas/plugin.go#L213)) |
| Add a new HTTP route | No route-registration interface | `HTTPTransportPlugin` only intercepts a request already routed by the HTTP transport. Bifrost attaches its pre-auth/auth/transport hook middleware to inference routes, not `/api/*` management routes. A plugin can short-circuit a matched inference route, but cannot claim a new method/path. Adding route registration needs a Bifrost host change or maintained host patch. ([hook contract](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/core/schemas/plugin.go#L223), [middleware scope](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/transports/bifrost-http/server/server.go#L2960)) |
| Add sidebar navigation or host-served static assets | No supported contribution interface/config | The UI sidebar is statically declared. A plugin may run its own server as private plugin code, but Bifrost has no plugin contract here to mount its route/assets or add navigation. Host UI/router/static-serving changes are needed. ([sidebar](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/ui/components/sidebar.tsx#L776), [interfaces](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/core/schemas/plugin.go#L213)) |
| Load `.so` in the official stock artifact | No, on tested Linux ARM64 image | Supply a dynamic Bifrost host binary built together with the plugin. This is an artifact/build change, not solvable by the plugin or plugin config alone. |

## Smallest proof of a successful install

Build the dynamic Bifrost host and `.so` together using matching toolchain, tags, and flags. Start a disposable instance with genuine dashboard admin auth and `server.plugin_download_private_allowlist` set only for the trusted fixture host. Install through the existing UI or `POST /api/plugins`, then confirm `GET /api/plugins` reports `active` and `GET /api/plugins/loaded` contains the plugin. Restart with the same app directory, refetch the saved URL, and confirm the same status again. Pin the artifact by immutable URL or verify its checksum before repeating this across restarts.

## Delivery decision — 2026-09-24

Sofian keeps the plugin-only installation requirement. Release depends on an official Bifrost artifact supporting dynamic loading and a native contribution contract for authenticated plugin routes, embedded UI assets and navigation. Local builds can prove proposed changes; they do not satisfy the official distribution gate. Upstream acceptance and release remain external dependencies, and the compatible version is not yet established. The loading proof above is necessary but must be followed by the complete UI installation and lifecycle proof on that official artifact.
