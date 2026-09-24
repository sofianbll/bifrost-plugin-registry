# Native plugin UI contract candidate

Date: 2026-09-24. Bifrost source pin: `fdeef8e3f31a3b18a61666ba49247d07bae3600a`. This is an isolated development patch, not an upstream release or a production change.

## Contract

A dynamic plugin may export the optional symbol:

```go
func GetAdminUI(host schemas.PluginAdminUIHost) (schemas.PluginAdminUI, error)
```

`PluginAdminUIHost` supplies Bifrost's resolved `DataDir` and a request-scoped `CallNative(parent, req, resp)` callback. The callback dispatches through Bifrost's own router and authentication chain; an explicit virtual-key `Authorization` header remains intact for `/v1/models` readback. `PluginAdminUI` contains `Title string`, `Assets fs.FS` rooted at `index.html`, and an optional `API fasthttp.RequestHandler`. Plugins without the symbol retain their existing loader and hook behavior.

The host serves a contribution at `/plugins/{GetName}/` with assets and `/plugins/{GetName}/api/*` (rewritten to `/api/*` when calling the plugin). `GET /api/plugin-ui` lists active contributions for the sidebar. Names are restricted to lowercase ASCII letters, digits, `_`, `-`; the fixed namespace and duplicate-name checks reject collisions. Embedded `fs.FS` and path validation prevent access outside plugin assets. The page uses native admin authentication, the existing middleware chain, and a same-origin check; when native authentication is disabled, the page and list explicitly return 403. The browser receives no additional admin token.

The router itself redirects `/plugins/{name}` to the slash-suffixed URL with HTTP 301. A separate explicit redirect route caused the first candidate gateway to panic during startup; the revised patch removes that duplicate registration. The regression test registers the real route patterns and verifies this canonical redirect.

Bifrost caches one successful UI contribution per loaded plugin instance. Reload and removal first hide the old route and wait for in-flight handlers, then update the plugin runtime; a failed reload keeps the UI hidden. The native API callback excludes plugin-management endpoints to prevent lifecycle reentry while a handler is active.

## Reproduce

Apply [the UI patch](../../integration/bifrost-native-plugin-ui.patch) with [the apply script](../../integration/apply-bifrost-native-plugin-ui.sh) to a clean checkout at the pin, then apply [the URL reopen patch](../../integration/bifrost-plugin-reopen.patch). For a local paired build, the `transports` module must resolve patched `core` and `framework` via local `replace` directives, and `framework` must resolve patched `core`; these local module edits are deliberately outside the upstream patches. Build host and plugin together with Go 1.27.1 and matching CGO flags.

Focused checks passed in the isolated Linux ARM64 builder:

```text
GOWORK=off go test -mod=readonly ./bifrost-http/server -run 'TestPluginUI|TestFailedReload' -count=1
ok github.com/maximhq/bifrost/transports/bifrost-http/server 0.046s
```

A preceding `go test -mod=mod ./bifrost-http/server ./bifrost-http/handlers` also passed (server 0.156s; handlers 38.427s). Tests cover path/origin boundaries, disabled/reactivated route visibility, native session forwarding, explicit virtual-key authorization, forbidden callback recursion, collision refusal, and failed UI reload hiding the old route.

The final paired build is in ignored `dist/native-plugin-ui-candidate-v3/`. The [full isolated probe](final/report.json) passed **41/41 checks** using that gateway, Registry plugin, and a legacy plugin without `GetAdminUI`. It covers URL installation with empty config, embedded assets and navigation, native session and origin checks, workspace persistence, virtual-key creation with independent `/v1/models` readback, disable/reactivate, restart, removal, failed-install cleanup, legacy hook execution, and reinstall retaining the workspace. The synthetic provider received no inference.

```sh
python3 integration/plugin_ui_probe.py \
  --gateway dist/native-plugin-ui-candidate-v3/bifrost-http \
  --plugin dist/native-plugin-ui-candidate-v3/bifrost-registry.so \
  --legacy-plugin dist/native-plugin-ui-candidate-v3/legacy-hook-proof.so \
  --out reports/plugin-native-ui/final
```

Earlier [attempt 5](attempt-5/report.json) remains failed at reactivation: the original URL loader reopened the same Go plugin under a new temporary filename. The separate reopen patch still fetches the URL on each load and reuses the loaded module only when the bytes match. A changed binary at the same URL requires a process restart; the loader reports this explicitly. UI loading failures hide the route and navigation rather than leaving a stale handler. Browser visual and keyboard checks are separate from this HTTP proof. The official stock 2.2.2 artifact remains outside this proof because it cannot dynamically load plugins on the tested Linux ARM64 image.

## Browser validation

[Visual and keyboard validation](VISUAL-VALIDATION.md) passed on the local v3 candidate at desktop and 320 px widths in light and dark themes. A group edit made in the UI survived page reload and gateway restart; a fresh model readback showed Verified. Temporary browser and container resources were removed. This remains a local preparation proof for #6, not the official release gate in #7.
