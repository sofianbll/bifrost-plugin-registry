# Configuration reference

English · [Français](fr/CONFIGURATION.md)

## Registry model

`id` is the model's stable local identifier. `alias` is the name that can be exposed; this version requires lowercase identifiers without slashes. `provider` is the exact name of the provider configured in Bifrost. `provider_key_ids` holds the non-secret identifiers of the EXISTING provider keys where this alias must be declared.

`upstream_model` is the exact target sent by the native alias. `canonical_model` is exported as `model_name` for native canonical/pricing mapping. `model_family` is exported as the native protocol family: it is **not** a classification label and must not be guessed. `creator`, `family`, `capabilities` and `metadata` are administration metadata. The classification family can be `Claude`, for example, without matching the native value `anthropic`.

`endpoints` is an explicit list of the endpoints allowed for this model; declaring one does not prove that the provider implements it. To enter the compiled view or the alias plan, a model must have `enabled: true` and **at least one** of `configured: true` or `verified: true`. `configured` indicates a configured native Bifrost access; it proves no inference or capability. `verified: true` requires a non-empty `evidence`: it is an administrator declaration, with no automatic verification. Native Bifrost permissions and lists still limit effective access.

## Groups

`model_ids` and `filter` are combined by UNION. A filter holds the optional lists `sources`, `creators`, `families` and `capabilities`.

Within sources, creators or families, one match is enough. Across categories, every condition must be met. For capabilities, every requested capability must be present. `exclude` then subtracts the listed identifiers. Disabled models, and models that are neither configured nor verified, are still removed when each view is compiled.

A group with no explicit models and no non-empty filter is invalid. A policy with no group is valid and denies everything. Group members are local IDs, not aliases.

## Virtual key policies

`virtual_key_id` is the key's native identifier. `token_sha256` is the fingerprint of the **full token**; this field must never hold the raw token. The client SDK keeps sending its real `sk-bf-…` token to Bifrost through `Authorization: Bearer …` or `x-bf-vk`.

To produce the fingerprint without leaving a secret in the shell history (build the CLI first with `make build`):

```bash
read -r -s -p 'Bifrost virtual key: ' BF_VK; printf '\n'
printf '%s' "$BF_VK" | ./dist/registry hash
unset BF_VK
```

The `read -p` prompt in this example is meant for Bash; keep the input secret in a compatible shell. The panel also offers a local WebCrypto hash on localhost/HTTPS; that path was not tested in a secure browser context for this delivery.

`groups` allows the chosen groups. `sources` further restricts their union; empty means "no additional source filter", not "the whole catalog". `naming` overrides `default_naming`.

| Format | Examples | Collisions |
| --- | --- | --- |
| `provider/model` | `codex/reasoning` | Each source keeps its prefix. |
| `model` | `reasoning` | One winner is allowed for each short name. |
| `both` | Both | All prefixed names, plus one winner for the short name. |

`prefer` selects a **local ID**: `{"reasoning":"codex-reasoning"}`. In `model` format, a losing source does not implicitly become reachable through its prefixed name; only the names actually exposed are accepted. In `both` format, the other sources stay reachable with their prefix. A disabled key is rejected, even if its fingerprint remains in the configuration.

## How a request flows

The engine reads the virtual key, finds an enabled policy and takes an immutable snapshot. It resolves the exposed name to `provider/alias`, then validates the endpoint and the explicit fallbacks. It does not itself resolve to `upstream_model`: that work belongs to the native aliases. All other JSON fields are preserved semantically, including tools, reasoning, signatures, `prompt_cache_key` and `previous_response_id`. JSON formatting and property order may change.

Each attempt is limited to the primary or to the fallbacks explicitly requested in that request. A native rule that adds another fallback is refused, even if that model is in another allowed group. The `fallbacks` body must be a list of exposed names, at most 16. The connection and provider-key overrides documented in the code are refused; native Bifrost security remains essential.

Requests accepted by Registry are still subject to Bifrost's authentication, provider-key selection, budgets and limits. Registry never sets the authenticated identity: it verifies the one Bifrost produces, before returning a successful response to the client.

## Public catalog

The projection engine requires an authorized native response whose entries carry `provider/alias`. It publishes only exact matches; an alias absent from the native list is not fabricated. Only `id`, `object`, `created`, `owned_by` and, when present, `shutdown_date` are rendered. The exact behavior of the native `/models` format for each version and provider must be validated: otherwise the projection stays empty or fails explicitly.

The preview in the administration is only the computed view of the registry. It does not have the list authorized by the real Bifrost and therefore proves no upstream access.

## Plan and merge

```bash
./dist/registry plan --config configs/registry.json --out plan.json
./dist/registry merge-aliases \
  --config configs/registry.json \
  --bifrost-config /copy/config.json \
  --out /copy/config.registry.json
```

The plan is our deployment schema, not that of a Bifrost endpoint. The merge reads a `config.json` with `providers` as an object and existing `keys` that have an `id`. It refuses missing providers, ambiguous keys and alias collisions, including case and contradictory definitions on another key of the same provider. It does not change virtual-key permissions. It preserves secrets and settings in the COPY, which therefore stays sensitive. Existing output files are never overwritten.

## Panel API

Every `/api/*` route requires a Bearer admin token, distinct from Bifrost keys. JSON bodies are limited to 4 MiB; duplicate JSON keys and unknown configuration properties are refused.

| Route | Contract |
| --- | --- |
| `GET /api/config` | Configuration and revision ETag. |
| `PUT /api/config` | New configuration with a mandatory `If-Match`. 428 if absent, 409 on conflict, 422 if invalid. |
| `POST /api/validate` | `{"config":{…}}`; structural check of the draft. |
| `POST /api/preview` | `{"config":{…},"virtual_key_id":"…"}`; computed view with no upstream access. |
| `POST /api/plan` | `{"config":{…}}`; compilation of the expected native primitives. |
| `GET /api/status` | Local control status; it does not claim an administrative connection to Bifrost or a verified `.so` load. |

## Importing legacy Bifrost datasheets

First export the Registry JSON snapshot, then convert the two files produced by `datasheet-sync.py` into a **new** file:

```bash
python3 scripts/import-bifrost-datasheets.py \
  --snapshot registry-snapshot.json --pricing pricing.json \
  --parameters model-parameters.json --out registry-with-datasheets.json
```

Import the result in the panel through the preview, then apply it with its revision. The converter keeps the complete price and parameter rows in `catalog.accesses[].overrides.legacy_datasheet`, including tiers and off-peak schedules. It requires `provider` and `base_model` to agree with the `Provider/model` key when one exists, refuses ambiguous matches, and reads neither keys nor the Bifrost database. New accesses are `configured: false`; models, groups and policies stay unchanged.
