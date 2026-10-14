# Cross-project context — Registry

Date: 2026-10-12. Status: coordination/research input, not a specification or adoption decision.
Mandate: one new documentation note only; no implementation, tracker mutation or deployment.

## Facts and evidence boundaries

- [Registry README](../../README.md) defines a sourced model catalogue, provider accesses and virtual-key composition that configure **Bifrost's runtime**. Registry is neither the inference gateway nor a universal secrets vault.
- [STATUS](../../STATUS.md) records rc.8 as a published pre-release with synthetic-provider qualification, not real-provider inference or production deployment. Current source, published artifacts and running services are distinct evidence.
- Registry works beside dynamically loaded, otherwise unmodified Bifrost; it does **not intrinsically wait for the MCP Apps release**. Joint use still requires qualification of the exact gateway image/toolchain and separate `.so`; a shared Bifrost version number does not prove ABI compatibility. See [installation](../INSTALL.md) and [native build](../BUILD.md).
- Parent handoff, approximately 17:31 Europe/Paris: [#99](https://github.com/sofianbll/bifrost-plugin-registry/issues/99) and [#100](https://github.com/sofianbll/bifrost-plugin-registry/issues/100) already have work. The #99 result is local, not pushed; no merge or published correction is asserted here.
- The same handoff reports native Claude session `7669628e-90ed-4f03-aba2-5abe914a0fc8` with an unclosed assistant return for #99. Execution remains unknown; no Claude CLI process was identified at that observation. This is not a fresh runtime check or permission to redispatch.

## User intent: six existing projects, not a new platform

| Existing project | Relationship to Registry / shared work |
| --- | --- |
| Elson | Provider access for possible audio/transcription and decision-LLM use; corpus, audio contract, quality and budget still need task-specific qualification. |
| Bifrost MCP Apps | Runtime/gateway and rich-tool relay; UI needs a compatible host, but transcription and ordinary API use do not inherently require Apps rendering. |
| Bifrost Plugin Registry | Reviewable catalogue and per-key reachability; corrections improve trustworthy configuration for professional and personal consumers. |
| Decision Lab | Supplies task-specific model comparisons; a general benchmark does not validate Elson transcription or editorial grouping. |
| Agent-OS | Methods, client adapters and possible shared key-management workflows; Registry supplies access configuration, not an orchestrator. |
| Sofian OS / Ecosystem | Personal organization consumes common tools, memory and access while retaining its own product decisions and data authority. |

Shared tooling can help **Elson**; “personal” provenance does not exclude professional usefulness. Elson's audit and Decision Lab have already been shown to **Carine**; repeating that presentation is not the next default action.
The three requested axes are method/reporting, tools/memory and AI access, used on real work across OpenChamber (primary), ChatGPT Web, Codex Desktop/local, Claude Desktop and Claude Code/local.
Common capabilities do not imply common permissions or merged project data. Transverse knowledge must be explicitly selected; per-client access and parity remain to qualify.

## Priorities and next decisions — proposals only

1. Prioritize Elson WordPress and RSS/persistence attention; progress the already-started Bifrost and Registry lots in parallel where independently authorized. Registry corrections are not blocked by a universal tooling rollout.
2. Reconcile the existing #99/#100 artifacts and session outcome **before** any new worker. Then review totals against native readback and understandable EN/FR labels; integration remains a separate authorized action.
3. Qualify the exact runtime/plugin pair before cross-project use. A transcription trial separately needs authorized audio, its provider/API contract, budget and quality measurements; direct provider access remains a possible non-blocking route.
4. Decide access separation, allowed telemetry payloads and retention before any common operational setup. Central key management and telemetry for Agent-OS/Sofian OS/Elson are future uses, **not a proven central deployment**.

No library, SDK, Plane adoption, memory-bank topology or replatforming has been selected. Hindsight is a possible shared memory with private access, not business-data authority or authorization to ingest global chats/audio.
Codex/Claude Cloud, Pulsar and the paid OVH Elson server are possible future execution targets, not a deployment mandate. GitHub remains tracking authority; model choice never approves a mutation.
Suggested future procedures, names only: `code-review`, `handoff`, `implement-spec` on an approved spec, and Ponytail. None is executed by this note.

## Sources and portability

Primary project sources were read above; the public [rc.8 release](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.8) and linked issue URLs identify the owning records, not fresh remote status checks.
Primary sources cited by the parent: machine-local `/Users/sofian/Developer/50-Experiments/bifrost-mcp-apps/core/providers/mistral/mistral.go` (transcription; not a portable clone dependency or proof of the deployed contract), [MCP Apps host/SDK contract](https://apps.extensions.modelcontextprotocol.io/api/).
Local parent reports are **machine-local, outside this clone**, not portable repository dependencies:
`/Users/sofian/.config/openchamber/chats/2026-10-12/session-91c5cc82-08b1-4d94-88f7-87df695df509/`
- `roadmap-chantiers-2026-10-12.md`: corrected six-project map and proposed priorities, not the rejected historical roadmap.
- `recherche-dependances-transversales-2026-10-12.md`: role boundaries, task-specific dependencies and confidentiality.
- `recherche-orchestration-agent-os-2026-10-12.md`: existing workflows and result reconciliation.

Checks here are documentation-only. Existing user changes, correction branches and status records are untouched; no commit/push/fetch, installation, model test, session dispatch, SSH/cloud or production action.
Unknown: live session outcome, correction integration/publication, real inference, five-client isolation/parity and central telemetry. Missing evidence is not evidence of absence.
