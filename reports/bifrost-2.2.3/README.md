# Bifrost 2.2.3 — ARM64 native qualification

The Registry at commit `e25de3d67e7269ae1d1581ace0d1f2b743954463` was compiled with the unmodified Bifrost `transports/v2.2.3` source. The annotated tag object `fe2a68533589ea880f803108739480a4e6f47f63` resolves to commit `411d62b28b03b03bd3b4025b2cfab50af45f05f4` (tree `6b0dc1e98a96427aabcbc86df615fc8c3f62869c`). All 2,745 selected `core`, `framework`, `plugins`, `transports`, and `ui` source files matched their Git blob IDs before and after compilation; the checkout had no modified tracked files. The real Bifrost UI was built from that checkout and embedded in the gateway; the Registry React UI was embedded in the plugin.

The gateway and plugin were built together on Linux ARM64/musl with Go 1.27.1, `GOWORK=off`, `CGO_ENABLED=1`, `-mod=readonly`, and no module replacements or upstream patches. Resolved modules include `core v1.10.2` and `framework v1.7.4`. The gateway's `/api/version` returned `v2.2.3`, injected with the release tag using Bifrost's `main.Version` linker variable. [Source verification](arm64/source-verification.json) · [build environment](arm64/build-environment.txt) · [gateway build info](arm64/gateway-build-info.txt) · [plugin build info](arm64/plugin-build-info.txt)

| Artifact | SHA-256 |
| --- | --- |
| `bifrost-http` | `80d17483d6b693340b5b6f742710873a0a3ebfa96c1b419dc5352b76cb3bd6d0` |
| `bifrost-registry.so` | `8f9a9af20f2690d608b6d7cb39c45f45befca86ab8d45b8f28083d537c698bbc` |

The files remain in ignored `dist/catalog-assistance-223-arm64-e25de3d/`; they are not published or installed on an existing gateway. [Manifest](arm64/manifest.json) · [all artifact hashes](arm64/SHA256SUMS)

| Native check | Result | Evidence |
| --- | --- | --- |
| Plugin load, exports, hooks and lifecycle | Pass | [ABI smoke](arm64/abi-smoke.json) |
| Per-key `/v1/models` and governance with a synthetic provider | 42/42 | [Models report](arm64/models/isolated-models-report.json) |
| Standalone URL installation, persistence, key reveal, scoped AI Chat/Responses, mapping and empty taxonomy Save | 72/72 | [Standalone report](arm64/standalone/report.json) |
| Explicit native-key adoption without broadening native permissions | 19/19 | [Adoption report](arm64/adoption/adoption-report.json) and [fixture artifact record](arm64/adoption/report.json) |

These native probes ran in disposable Docker containers with `--network none` and synthetic provider responses; their temporary auth files and application state were removed. The separate [browser review](ui-review.md) used a loopback-only preview. Its final synthetic fixture is intentionally left running on `127.0.0.1:8083` (gateway) and `127.0.0.1:8099` (Registry), while the existing 2.2.2 pilot on `8082` remains untouched. The preview uses bridge networking to expose those loopback ports and is not part of the network-none proof.

This qualifies this exact ARM64 gateway/plugin pair and the recorded synthetic behavior. It does not qualify AMD64, an official prebuilt image, a production rollout, or real-provider inference.
