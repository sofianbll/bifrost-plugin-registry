# Security and trust boundaries

English · [Français](fr/SECURITY.md)

To report a vulnerability, follow the [private reporting policy](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/SECURITY.md). The [V1 evidence](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/reports/v1-final/README.md) identifies the binaries and scenarios that were actually qualified.

## What the plugin is not

This project is not an identity provider, a secret manager, a budget implementation or a billing engine. A SHA-256 fingerprint ties a policy to a virtual key; **it does not authenticate the key to Bifrost**. Native governance must still authenticate the key, check its validity and restrictions, select an allowed provider key and apply quotas and budgets.

The `registry.json` files and the admin token are trusted assets: anyone able to modify them can change the policies. IDs and fingerprints are not directly usable authentication secrets, but they remain sensitive administration data. Native permissions must be maintained independently.

## Invariants implemented and tested locally

Ambiguous short aliases are rejected without any preference. Disabled models, or models with no configured native access and no valid historical proof, are not published. Missing metadata creates no permission and does not by itself block a valid access. No group in a policy means no access. Upstream names are not accepted as an implicit shortcut. Unknown references and duplicate JSON keys are rejected. A provider attempt must be one of the routes explicitly accepted for that request.

Snapshots are immutable. An invalid validation does not replace the in-memory state; a save requires the expected revision. Files are written with mode 0600 through a temporary file and rename. The parent-directory fsync is best-effort; this is not a promise of absolute durability on every filesystem.

The panel uses no cookies and no browser storage for its tokens. Virtual-key commands read the secret on stdin, not in arguments. Admin requests require an explicit Bearer token; unexpected hosts and Origins from other sites are refused. No permissive CORS is enabled. A strict CSP, `nosniff`, `no-referrer` and `no-store` are sent. Fields displayed in templates are escaped. Admin JSON requests are limited to 4 MiB and guard requests to 32 MiB.

These protections have code tests, probes in the real gateway and a browser review on a loopback fixture. These checks do not replace qualification of the network, reverse proxy or other plugins in your deployment.

## Native assumptions to verify before production

The HTTP PreHook must receive every protected route. The PreLLMHook must see `provider/alias` before the upstream alias is finally resolved, and must run on every attempt. Governance must publish the authenticated VK ID in the expected context. ListModels responses must be filtered by governance and carry the expected prefixed native IDs. The V1 probes verify these interactions in Bifrost 2.2.2 with a synthetic provider. Other versions, transports and plugin combinations require their own checks.

The plugin requires this authenticated ID before returning successful content. It neither invents it nor deduces it from the fingerprint alone. Native error chunks are preserved, even when authentication produced no identity. PreLLM refusals use an `LLMPluginShortCircuit` with `AllowFallbacks=false`: an ordinary Go error is not a sufficient access control in Bifrost.

Late verification of the ID must not become the main authentication mechanism: if governance were absent or misconfigured, a request could have reached the upstream before its response was refused. **Do not load this plugin on an installation without verified, working native governance.** Staging tests must confirm that authentication refusals produce no provider request.

Other native plugins and the Go host are trusted. A malicious plugin running in the same process has the same memory and configuration access; this code is not a plugin sandbox.

## Operational limits

A single process must write the configuration. Detecting an external change is neither an interprocess lock nor a distributed compare-and-swap: two writers could pass the check simultaneously. Mount a directory and use the plugin's embedded panel for a runtime update. An inference session keeps its initial snapshot; revoking in the registry does not interrupt streams already in progress. Native revocations must be handled by Bifrost.

The `/models` projection refuses duplicate native IDs, invalid envelopes and a missing expected identity. A provider that does not return the expected aliases can produce an empty list: fix the configuration rather than implicitly widening rights.

For a key managed by Registry, unsupported endpoints fail explicitly. Unmanaged native keys stay subject to the native Bifrost pipeline. The HTTP restriction can also block internal SDK calls and probes when they do not go through a Registry session. An integration recipe validated for your version is still needed.

The `.so` has the privileges of the Bifrost process. Load only a build you have examined, keep its checksums, protect the volumes and rebuild the gateway and plugin together on updates. No "impossible to bypass" mechanism or "100%" compatibility is claimed.
