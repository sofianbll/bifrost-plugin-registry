# Bifrost and Registry API reference

Checked against Bifrost `transports/v2.2.6` (the target in `bifrost.pin`) and this repository's `internal/admin`. Re-check an entry against the source when the pin moves.

## Bifrost admin API

Gateway port (`8080` in the container). Bifrost 2.2.6 locks `/api/*` until dashboard authentication is enabled or a setup token is sent; `/health` stays public. Scripts authenticate with `Authorization: Basic base64(username:password)`.

| Purpose | Call | Notes |
| --- | --- | --- |
| Providers | `GET /api/providers` | |
| Provider keys | `GET /api/providers/{provider}/keys` → `{"keys": [...], "total": n}` | `enabled` is omitted when true: absent means enabled. |
| Disable a provider key | `GET`, then `PUT /api/providers/{provider}/keys/{key_id}` with the full key and `"enabled": false` | PUT takes the full key. Masked secret placeholders from the GET are preserved server-side. |
| Virtual keys | `GET /api/governance/virtual-keys` → `{"virtual_keys": [...]}`, `GET /api/governance/virtual-keys/{vk_id}` | |
| Delete a virtual key | `DELETE /api/governance/virtual-keys/{vk_id}` | Irreversible: the token cannot be restored. |
| Budgets, rate limits | `GET /api/governance/budgets`, `GET /api/governance/rate-limits` | |
| Model configs | `GET /api/governance/model-configs` | |
| Routing rules | `GET /api/routing/rules` (alias `/api/governance/routing-rules`) | |
| MCP clients | `GET /api/mcp/clients` | Stored in `config_mcp_clients` (`disabled` column). |
| Usage | `GET /api/logs/stats?virtual_key_ids=<id>&start_time=<RFC3339>` → `total_requests`; `GET /api/mcp-logs/stats?virtual_key_ids=<id>&start_time=…` → `total_executions` | Lists are comma-separated; `models=` and `providers=` also filter. Unix timestamps are ignored. |
| Configuration | `GET /api/config` → `client_config` (redacted) and `framework_config` | |

### Pricing source

`PUT /api/config` with the `{"client_config": …, "framework_config": …}` from the GET, changing only `framework_config.pricing_url` and `framework_config.model_parameters_url`. Omit `auth_config` so the admin account stays untouched. Official sources: `https://getbifrost.ai/datasheet` and `https://getbifrost.ai/datasheet/model-parameters`. That site answers 403 to the default urllib User-Agent; send one such as `curl/8.7.1`.

## Pricing overrides

`GET /api/governance/pricing-overrides` → `{"pricing_overrides": [...]}` (filter with `?provider_key_id=`); each item returns its patch as the JSON string `pricing_patch`. `POST /api/governance/pricing-overrides` creates one; `PUT` and `DELETE /api/governance/pricing-overrides/{id}` change or remove it, and a PUT replaces `patch` in full.

Body fields:

- `name`: any prefix except `registry/`. The plugin owns `registry/…` overrides and deletes those it no longer expects.
- `scope_kind` with exactly its own IDs: `global` (none), `provider` (`provider_id`), `provider_key` (`provider_key_id` only), `virtual_key` (`virtual_key_id`); `virtual_key_provider`, `virtual_key_provider_key` and the `user…` kinds also exist.
- `match_type`: `exact` (no `*`) or `wildcard` (exactly one trailing `*`; `*` alone matches every model in scope).
- `pattern`: the model name.
- `request_types`: required, for example `chat_completion`, `text_completion`, `responses`, `embedding`. Base types cover their streaming variants.
- `patch`: datasheet price fields in USD per token (per-million rate ÷ 1,000,000): `input_cost_per_token`, `output_cost_per_token`, `cache_read_input_token_cost`, `cache_creation_input_token_cost`, and tier fields such as `input_cost_per_token_above_200k_tokens` or `cache_read_input_token_cost_above_272k_tokens`. Copy field names from the datasheet entry of a comparable model; not every field exists at every tier. Overrides also price models absent from the datasheet.

Per billing model:

- **Subscription behind a proxy**: one `provider`-scoped override, `match_type: "wildcard"`, `pattern: "*"`, with zero token costs.
- **Plan rates**: one override per model, from the plan's published pricing page, fetched during the run. Put the page URL and the fetch date in the batch.
- **Off-peak**: `off_peak_cost_multiplier` (for example `0.5`) together with `peak_hours`: `{"timezone": "<IANA name>", "windows": [{"days": [1, 2, 3, 4, 5], "start": "HH:MM", "end": "HH:MM"}]}`. The windows describe the **peak** hours and the multiplier applies outside them; a discount needs both fields. `days` counts 0 = Sunday to 6 = Saturday. An `end` at or before `start` wraps past midnight, and `days` then names the day the window starts. Billing uses the request's start time.
- **Long context**: Bifrost has only 128K, 200K and 272K thresholds. When a plan uses another threshold, tell the human and record the approximation in the batch.

## Registry panel API

Registry port (`8099`, published on host loopback). Every call sends `Authorization: Bearer <REGISTRY_ADMIN_TOKEN>`. Path names overlap with Bifrost's: Registry's `GET /api/config` returns the Registry file, not the gateway configuration.

| Call | Effect |
| --- | --- |
| `GET /api/status` | `version`, `revision`, `bifrost_connected`. |
| `GET /api/workspace` | `revision` (also the ETag); `data.models`, `data.groups`, `data.keys[]` with `managed`, `active`, `policy`, `publication` and `pendingAccessSelection`; `discovery`; `pricingProofs`. |
| `POST /api/keys/{id}/readback` | Lists `/v1/models` with the managed key's own token and records `publication.state`: `verified`, `drift` (`missing`, `unexpected`) or `not_verified` (`error`). Writes nothing to Bifrost. 404 for an unmanaged key. |
| `PUT /api/workspace` with `If-Match: "<revision>"` | Saves `{"data": …}` and publishes native aliases, key permissions and `registry/…` pricing overrides. 409 on a stale revision. Normally done from the panel. |
| `POST /api/keys` with `{"name", "client"}` | Creates a native virtual key and manages it; the response carries its token once. |
| `GET /api/config` (ETag) | The Registry file. |
| `POST /api/preview` with `{"config", "virtual_key_id"}` | One key's computed view for a draft config, with no upstream call. |
| `POST /api/plan` with `{"config"}` | The native primitives the draft compiles to. |
| `GET /api/snapshot` | Export: `{"format_version": 1, "registry": …}`. |
| `POST /api/snapshot/preview`, `POST /api/snapshot/apply` with `If-Match` | Import a snapshot; apply writes a backup of the previous file first. |

**Start empty**: `POST /api/snapshot/apply` with `If-Match` set to the current revision and the body `{"schema_version": 1, "default_naming": "<current value>", "models": [], "groups": [], "policies": []}`. The keys it managed become unmanaged with their native permissions unchanged, and its `registry/…` pricing overrides stay in Bifrost until a batch removes them.
