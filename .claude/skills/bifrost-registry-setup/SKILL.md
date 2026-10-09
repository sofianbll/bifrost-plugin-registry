---
name: bifrost-registry-setup
description: Audits, cleans up and sets up a Bifrost gateway with the Registry plugin together with its owner, through a read-only audit and human-approved change batches rehearsed on a test copy. Use for a Bifrost or Registry audit, cleanup, repricing or Registry rebuild.
---

# Bifrost + Registry setup

You run one loop with the human who owns the gateway:

**audit → propose a batch → human approves → apply on the test copy → verify → apply on production → verify**, then the next batch.

The human decides. You gather evidence, write each batch as an exact list, and prepare the scripts. Before the audit, confirm with the human: host, container name, data directory (often a Docker volume), published ports, a backup root, and a notes folder for the audit report and scripts outside this repository.

## Guardrails

These hold for the whole run.

- **Read-only until approval.** Open SQLite as a read-only URI (`file:<path>?mode=ro`), call only GET endpoints, plus Registry readback (it only records an in-memory state). Everything else waits for an approved batch, including creating the test copy.
- **The human runs every write to a gateway** (Bifrost API or Registry), through a human-run script you prepare (contract in step 4) or in the Registry panel. The Bifrost admin password stays with the human: you never type, read or store it, nor `REGISTRY_BIFROST_AUTH`, which encodes it.
- **Secrets stay unprinted.** Show IDs and names, never key values or tokens. When you need one value from a token-bearing file (for example `REGISTRY_ADMIN_TOKEN` for read-only Registry calls), extract exactly that line into a shell variable with `grep` or `sed`, never through a pager or highlighter: a `bat`-wrapped copy once broke a token with its `│` gutter.
- **Removal means archive.** Move files into `<backup root>/<YYYY-MM-DD>/`, keeping their original path below it. Root-owned leftovers go on a list the human handles with `sudo`.
- **Disable before delete.** A deletion runs only after the human types the batch's confirmation word; when they hesitate, propose disabling instead.
- **Test copy first.** Each batch runs on the test copy, is verified, then runs on production with the same script and steps.

## 1. Audit (read-only)

Write one audit report covering three layers. The audit is done when every object in each layer has a row: what it is, the evidence, and a proposed fate (keep, archive, disable, delete, change, or ask the human). Present the report and let the human read it before proposing any batch.

Sources: the data directory (`/app/data` in the container) holds `config.db` (tables `config_*`, `governance_*`), `logs.db` (`logs`, `mcp_tool_logs`) and the Registry file (`registry_path` in the plugin settings). Read schemas with `.tables` and `.schema <table>`. Reading a Docker volume usually needs root: give the human the exact read-only command when it does. Read the Registry through its panel API. The matching Bifrost and Registry endpoints are in [reference.md](reference.md).

### Layer 1: the host, outside Bifrost and the plugin

- Every user's crontab, `/etc/cron*`, systemd timers and the scripts they call. Flag anything that writes into the data directory or calls the admin API, such as a generator for a local pricing file that `pricing_url` reads through `file://`.
- Leftover build folders, `.bak` and dated copies, old `.so` files and stale compose or env files near the deployment.

Default fate: archive whatever is neither native Bifrost nor the Registry plugin. The human confirms each item in its batch.

### Layer 2: native Bifrost

- **Provider keys**: provider, key ID and name, enabled state (an absent `enabled` means enabled), and billing model: pay-per-use, subscription behind a proxy, or plan with quotas. Ask the human when the configuration does not say.
- **Virtual keys**: provider configs (allowed models and keys), MCP configs, budgets and rate limits.
- **Routing rules, model configs, budgets**, and what each budget is attached to: model config, virtual key or provider key.
- **MCP clients** and the virtual keys that use their tools.
- **Pricing source**: `pricing_url` and `model_parameters_url` in the framework config. A `file://` URL points back to a layer-1 generator.
- **Pricing overrides**: name, scope, pattern, patch. Names starting with `registry/` belong to the plugin; any other name is hand-made.
- **Usage over the last 30 days**, per virtual key and per model. This is the most decisive input: it usually shows most keys unused. On `logs.db`:

```sql
SELECT MIN(timestamp) FROM logs;  -- coverage; report it when under 30 days
SELECT virtual_key_id, COALESCE(alias, model) AS requested, provider, selected_key_id,
       COUNT(*) AS requests, SUM(status = 'error') AS errors
FROM logs WHERE timestamp >= datetime('now', '-30 days')
GROUP BY 1, 2, 3, 4 ORDER BY 1, requests DESC;
SELECT virtual_key_id, server_label, tool_name, COUNT(*) AS calls
FROM mcp_tool_logs WHERE timestamp >= datetime('now', '-30 days')
GROUP BY 1, 2, 3;
```

A virtual key is **unused** only when it appears in neither query: keys that serve MCP tools never reach `logs`. A provider key whose recent requests fail with an account error (HTTP 402, for example) is a disable candidate.

### Layer 3: Registry

From `GET /api/workspace`:

- Catalogue models with empty fields, groups no key uses, and managed keys (`managed: true`).
- Publication state of each managed key. Run its readback first, because states live in memory and read `not_verified` after every restart. `verified` means `/v1/models` matches; `drift` lists `missing` and `unexpected` IDs; `not_verified` carries an `error`.
- Keys with `pendingAccessSelection` (**Access choice needed** in the panel).
- `registry/…` pricing overrides for keys or models the current Registry file no longer covers. The plugin cleans up only the keys it still syncs.

## 2. Propose a batch

A batch is a small, coherent set of changes the human can judge in one sitting. Show:

- the exact list: object ID, name, current state → new state;
- the audit evidence for each line;
- the script steps in order, and how each will be verified;
- what cannot be undone.

The human approves, edits or rejects it. Apply exactly the approved list.

The batches that worked, in order:

0. **Test copy**: create it (step 3).
1. **Host cleanup**: archive the layer-1 items; save each crontab into the backup before disabling entries that write into Bifrost.
2. **Keys**: delete unused virtual keys, disable provider keys whose account fails, keep MCP keys. A key the Registry manages leaves the Registry first (or the Registry starts empty first): once a managed key disappears from Bifrost, every panel save fails with "Managed key is missing from workspace".
3. **Pricing**, decided per provider:
   - pay-per-use: Bifrost's official datasheet, no override;
   - subscription behind a proxy: price 0;
   - plan whose quotas are mirrored by budgets: native pricing overrides at the plan's current published rates, fetched and dated during the run, never copied from an old file, including off-peak and long-context tiers.

   Then point `pricing_url` and `model_parameters_url` back to the official datasheet. Bodies and tier limits: [reference.md](reference.md#pricing-overrides).
4. **Registry rebuild**: rebuild from current reality instead of repairing the old file. Start empty ([reference.md](reference.md#registry-panel-api)), then register models from discovery, compose groups, adopt or create keys, publish and read back. A key whose client relies on native routing rules stays unmanaged unless its adoption review or `/api/preview` exposes every name in the client's `requested` column: a managed key blocks the names it does not expose.

## 3. Test copy

1. Record the production container's image digest, environment variable names, port mappings and volume (`docker inspect`).
2. Copy `config.db` with SQLite's online backup API, which stays consistent while production runs: `src = sqlite3.connect("file:<prod>/config.db?mode=ro", uri=True); src.backup(sqlite3.connect("<copy>/config.db"))`. Copy the Registry folder, and `config.json` if present, as plain files.
3. Before the first start, disable every MCP client in the copy: `UPDATE config_mcp_clients SET disabled = 1;`. A copy that refreshes an OAuth token can rotate production's token.
4. Check that the copied plugin settings point `bifrost_url` at the copy itself (`http://127.0.0.1:8080` inside its container). An address that reaches production makes the copy's Registry write to production.
5. Start a new container from the same image digest and environment, with its own name, the copy mounted at `/app/data`, and other host ports on loopback.
6. Check `/health` and the copy's Registry `GET /api/status` (`bifrost_connected: true`).

The copy holds real provider keys: send only the requests verification needs. After production is done, stop the copy and archive its folder.

## 4. Apply through a human-run script

Write one script per batch (Python standard library or POSIX shell) in the notes folder. It takes the gateway and Registry base URLs as arguments, so the same file runs on the copy and on production. The script:

1. Prompts for the Bifrost admin username and password without echo (`getpass`, `read -s`), and takes no secret from arguments, files or history.
2. Prints the exact plan (every object ID, name and change) and continues only when the human types the batch's confirmation word.
3. Before the first write, backs up `config.db` with the online backup API into the dated backup folder, and exports the Registry snapshot when the batch touches Registry.
4. Applies the steps in order and stops at the first failure: a later step runs only after every earlier step succeeded.
5. Re-reads every changed object and prints expected against actual.

Writes outside a running gateway (archive moves on user-owned files, building the test copy) need no credentials: after approval, run them yourself and list what changed.

## 5. Verify

A batch is done when the script's re-read matches the plan on the copy and then on production, and:

- every managed key reads back `verified`, or its `drift` is explained and approved;
- deleted keys are gone from their GET list, and disabled provider keys read `"enabled": false`;
- pricing overrides re-read with the planned patch, and the framework config shows the official URLs.

Record the result in the audit report, then propose the next batch.
