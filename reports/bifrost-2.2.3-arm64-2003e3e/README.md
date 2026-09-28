# Bifrost 2.2.3 — ARM64 native qualification (registry `2003e3e`)

This folder is the qualification record for the final ARM64 gateway/plugin pair whose plugin was compiled at Registry commit `2003e3ea77636316e9e3e7b52d5a4ddd2e80aae7` (branch `codex/prototype-model-card-modelsdev`). The gateway was compiled from the unmodified Bifrost `transports/v2.2.3` checkout pinned at commit `411d62b28b03b03bd3b4025b2cfab50af45f05f4`, recorded by the build as `Bifrost checkout: 411d62b28b03b03bd3b4025b2cfab50af45f05f4`. For that same Bifrost pin, all 2,745 selected `core`, `framework`, `plugins`, `transports`, and `ui` source files matched their upstream Git blob IDs before and after compilation and no tracked file was modified; that verification is recorded in the companion [2.2.3 source verification](../bifrost-2.2.3/arm64/source-verification.json). The registry commit named in that file is the earlier `e25de3d`; the Bifrost pin, its tree, and the module set are identical for both pairs.

The gateway and plugin were built together on Linux ARM64/musl with Go 1.27.1, `GOWORK=off`, `CGO_ENABLED=1`, `-mod=readonly`, `-trimpath`, and `-tags=bifrost`, with no module replacements or upstream patches. Resolved modules include `core v1.10.2` and `framework v1.7.4`. Full build record: [build environment](build-environment.txt) · [gateway build info](gateway-build-info.txt) · [plugin build info](plugin-build-info.txt)

| Artifact | SHA-256 |
| --- | --- |
| `bifrost-http` | `80d17483d6b693340b5b6f742710873a0a3ebfa96c1b419dc5352b76cb3bd6d0` |
| `bifrost-registry.so` | `91ec902f4f0289840acb3bba6dceaf11312e2ee2d1b3ebf7a7e4c2ed83e2f58d` |

These hashes are the ones recorded in [manifest.json](manifest.json) and [SHA256SUMS](SHA256SUMS), and were re-computed on the qualification artifacts during assembly of this folder. The raw artifacts themselves remain in the ignored `dist/qual-223-arm64-2003e3e/`; only these reports are published.

| Suite | Result | Assertions | Evidence |
| --- | --- | --- | --- |
| Native capabilities (access selection, shared-alias routing, pricing overrides) | Pass | 39 total / 34 passed, 5 informational, 0 failed | [capabilities report](capabilities/capabilities-report.json) |
| Per-key `/v1/models` isolation and governance | Pass | 42/42 | [models report](models/isolated-models-report.json) |
| Standalone URL installation, persistence, restart | Pass | 55/55 | [standalone-restart report](standalone-restart/report.json) |
| Standalone URL installation, key reveal, scoped AI Chat/Responses, mapping, empty taxonomy Save | Pass | 72/72 | [standalone-assistant report](standalone-assistant/report.json) |
| Explicit native-key adoption without broadening native permissions | Pass | 19/19 | [adoption report](adoption/adoption-report.json) |

The plugin load, export signatures, hook lifecycle and fail-closed nil-context checks are recorded in the [ABI smoke](abi-smoke.json); the smoke ran with `real_bifrost_pipeline_tested = false`. The adoption run ([adoption/adoption-report.json](adoption/adoption-report.json), scope "disposable loopback fixture; no provider inference") was first stood up by the paired dynamic-bifrost fixture whose own transcript — a full standalone-assistant pass of 72/72 — is kept as a fixture trace at [adoption-fixture/report.json](adoption-fixture/report.json).

Scope of the probes: all suites ran in disposable Docker containers with `--network none`, with only the loopback interface present, against synthetic providers; no real inference was performed. The adoption suite runs its disposable fixture over bridge networking limited to loopback (`127.0.0.1`, gateway `:18180`, registry panel `:18099`), which is why its report records `eth0` in addition to `lo`; it uses synthetic provider responses only and performs no inference. Temporary auth files and application state were removed after each run. Every artifact here is Linux ARM64 only.

This qualifies this exact ARM64 gateway/plugin pair and the synthetic behavior recorded in these reports. It does not qualify AMD64, real-provider inference, or a production rollout. It does not include the Docker distribution image for this commit: the image is built and qualified separately and is **not** part of this folder.
