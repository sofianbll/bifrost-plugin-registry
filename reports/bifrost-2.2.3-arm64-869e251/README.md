# Bifrost 2.2.3 — ARM64 native qualification (v0.3.0-rc.4)

The Registry plugin at commit `d588a9f` (`869e251` code + README screenshots) was compiled with the unmodified Bifrost `transports/v2.2.3` source. The annotated tag resolves to commit `411d62b28b03b03bd3b4025b2cfab50af45f05f4`. The checkout was clean; all 2,745 tracked `core`, `framework`, `plugins`, `transports` and `ui` files match their Git blob IDs (`source-verification.json`). Built on Linux ARM64/musl with Go 1.27.1, `GOWORK=off`, `CGO_ENABLED=1`, `-mod=readonly`, no upstream patches.

| Artifact | SHA-256 |
| --- | --- |
| `bifrost-http` | `80d17483d6b693340b5b6f742710873a0a3ebfa96c1b419dc5352b76cb3bd6d0` (reproducible) |
| `bifrost-registry.so` | `ff21df8f65756fb5d5e9c00175dbe675fa1b0d7cf2855a987fa374fe62d6b498` |

Only the plugin changed since rc.3: the interface now defaults to English (French one toggle or `?lang=fr` away) and the last French-only model-browser strings were localized.

| Native check | Result | Evidence |
| --- | --- | --- |
| Plugin load, exports, hooks and lifecycle | Pass | `abi-smoke.json` |
| Per-key `/v1/models` and governance, synthetic provider | 42/42 | `models/isolated-models-report.json` |
| Standalone URL installation, persistence, restart, disable | 55/55 | `standalone-restart/report.json` |
| Standalone + synthetic AI assistant | 72/72 | `standalone-assistant/report.json` |
| Explicit native-key adoption without broadening permissions | 19/19 | `adoption/adoption-report.json` (`adoption-fixture-report.json` fixture trace) |
| Per-access capabilities: native price overrides, restricted access per key, shared native alias | 34/34 assertions (39 checks incl. observations) | `capabilities/capabilities-report.json` |

All suites except adoption ran in disposable Docker containers with `--network none` and synthetic provider responses; the adoption fixture used bridge networking with host ports bound to `127.0.0.1` only. No real-provider inference was performed. Build outputs: `build-environment.txt`, `gateway-build-info.txt`, `plugin-build-info.txt`, `SHA256SUMS`, `manifest.json`.

This qualifies this exact ARM64 gateway/plugin pair and the recorded synthetic behavior. It does not qualify AMD64, an official prebuilt image, or real-provider inference. The release image archive is built from this gateway and distributed separately from the `.so`.
