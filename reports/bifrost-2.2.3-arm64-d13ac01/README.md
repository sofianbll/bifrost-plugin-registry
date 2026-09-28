# Bifrost 2.2.3 — ARM64 native qualification (registry `d13ac01`)

This folder is the qualification record for the ARM64 gateway/plugin pair whose plugin was compiled at Registry commit `d13ac015580f01d3527f66a83800a1831c275279` (branch `main`, the commit that defaults the interface to English with French one toggle or `?lang=fr` away, so the plugin binary is rebuilt from a new commit while the gateway source is unchanged). It serves the `v0.3.0-rc.3` release candidate. The gateway was compiled from the unmodified Bifrost `transports/v2.2.3` checkout pinned at commit `411d62b28b03b03bd3b4025b2cfab50af45f05f4`, recorded by the build as `Bifrost checkout: 411d62b28b03b03bd3b4025b2cfab50af45f05f4`. For that same Bifrost pin, all 2,745 selected `core`, `framework`, `plugins`, `transports`, and `ui` source files matched their upstream Git blob IDs before and after compilation and no tracked file was modified; that verification is recorded in [source-verification.json](source-verification.json) and is identical to the previous pairs' (same tree digest `7a51cbad28deead409360abf6afa3d5a45f4aededc6c0ac0adac2960034fd19b`).

The gateway and plugin were built together on Linux ARM64/musl with Go 1.27.1, `GOWORK=off`, `CGO_ENABLED=1`, `-mod=readonly`, `-trimpath`, and `-tags=bifrost`, with no module replacements or upstream patches. Resolved modules include `core v1.10.2` and `framework v1.7.4`. Full build record: [build environment](build-environment.txt) · [gateway build info](gateway-build-info.txt) · [plugin build info](plugin-build-info.txt)

| Artifact | SHA-256 |
| --- | --- |
| `bifrost-http` | `80d17483d6b693340b5b6f742710873a0a3ebfa96c1b419dc5352b76cb3bd6d0` |
| `bifrost-registry.so` | `835f79b8f49ef038f2fc68de464ccd88f6393f18a96571ac56697f22bcb34ddb` |

The gateway hash is identical to the previous pairs, as expected for an unchanged Bifrost source; the plugin hash differs because the embedded UI changed. These hashes are the ones recorded in [manifest.json](manifest.json) and [SHA256SUMS](SHA256SUMS), and were re-computed on the qualification artifacts during assembly of this folder. The raw artifacts themselves remain in the ignored `dist/qual-223-arm64-d13ac01/`; only these reports are published.

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
