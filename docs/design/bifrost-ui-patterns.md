# Bifrost UI patterns for the registry prototype

Focused inventory against the locally pinned upstream Bifrost UI commit `6493abd3d1422c9bfde95f242fd57b38e73ce881` at `/private/tmp/bifrost-ui-upstream/ui`. Paths below are relative to that `ui/` directory. They identify native source to reuse or follow; they do not imply that runtime integration is already wired.

## Reusable native patterns

1. **Serving-provider identity and marks** — `components/provider.tsx` renders a provider label with `lib/constants/icons.tsx`'s `RenderProviderIcon`; `ProviderIcons` contains native marks for configured/routed providers such as OpenAI, Anthropic, Bedrock, Azure, Vertex and others. Reuse for the *serving provider* attached to an access/route. It is not a model-creator catalog.

2. **Model selector** — `components/ui/modelMultiselect.tsx` queries `lib/store/apis/providersApi.ts` and consumes model records with `name`, `provider`, and `is_deprecated`; `components/modelAccess/modelAccessSelector.tsx` wraps it for allow/block selection, wildcard, regex and chips. Useful existing primitives: async search, serving-provider-scoped suggestions, deprecation state, `react-select`. No creator/publisher/logo field for LLM model makers was found in this path; showing creator and serving provider separately needs an explicit model catalog/source.

3. **Native MCP marketplace/gallery** — `app/workspace/mcp-registry/library/page.tsx` composes `views/mcpLibraryServerCard.tsx` and `views/mcpLibraryServersTable.tsx`. The page has debounced search, pagination, URL-backed search/filter state, and a persisted grid/table toggle. `package.json` already pins `nuqs`, `@tanstack/react-table`, `react-select`, `lucide-react`, and the Radix primitives used by this UI.

4. **Marketplace logos and attribution** — MCP cards/table use each catalog entry's `icon_url`, with `/images/mcp.svg` as a broken/missing-image fallback. The upstream also ships many provider/server logos under `public/images/mcp-servers/` (for example `figma.svg`, `slack.svg`, `filesystem.png`, `context7.svg`). The card separately shows `server.name`, the server icon and `by {server.publisher}`. These are MCP server/publisher assets; they do not establish LLM model creators.

5. **Native marketplace filters** — `app/workspace/mcp-registry/library/views/mcpLibraryFilterSidebar.tsx` provides collapsible checkbox sections for category, connection type, auth type and tags, counts active values, and has reset/collapsed states. The page serializes those facets into the catalog query. The reusable collapsed/mobile trigger is `components/filters/filterSidebarTrigger.tsx`; filter composition primitives are in `components/filters/primitives.tsx`. Extending facets requires source data and query support, not just extra chips.

6. **CEL routing graph** — `app/workspace/routing-rules/tree/views/routingTreeView.tsx` + `graphBuilder.ts` render source → conditions → rule → provider targets as a left-to-right React Flow graph. `celParser.ts` and `lib/utils/celConverterRouting.ts` handle CEL parsing/conversion; CEL field/operator registries are in `lib/config/celFieldsRouting.ts` and `celOperatorsRouting.ts`; the existing editor is under `components/ui/custom/celBuilder/`. The route graph is a read-only exploration/visualization, not a model-access editor. Existing dependencies are `@xyflow/react` 12.10.1 and `@dagrejs/dagre` 3.0.0.

7. **Generic nested tree renderer** — `components/ui/treeView.tsx` is a separate lightweight tree component: caller passes nested `TreeNode` data and a `renderItem` callback, while the component handles indentation, connector lines, expand/collapse and optional external expansion state. The renderer itself does not mutate tree structure; callers can supply row-level controls (as the Skills file manager does). Reuse for a hierarchy/list view when node rows need custom or editable contents, without adding React Flow to that surface.

## Harness and plugin boundaries

- The [official provider harness coverage page](https://docs.getbifrost.ai/providers/test-harness-coverage) describes Postman/Newman E2E coverage in `tests/e2e/api/collections/provider-harness.json`: 725 requests across 12 folders and native, drop-in, cross-model, modality and passthrough surfaces. `✅` means exercised; `✅*` means an external resource is required (often preview-gated); `❌` means a known provider feature is not yet exercised. Therefore a coverage mark is evidence about harness execution, not a promise that every deployment/account has that capability. MCP-toolset cases need a reachable MCP server and are preview tagged.
- The [JSON Parser plugin docs](https://docs.getbifrost.ai/features/plugins/jsonparser) describe a Go `LLMPlugin` that repairs incomplete JSON in streaming chunks only. It runs either for all stream requests or when a per-request context key enables it; invalid/unrepairable content falls back to original content. This is a runtime request/response hook, not a registry or catalog feature.
- The [Mocker plugin docs](https://docs.getbifrost.ai/features/plugins/mocker) describe a Go plugin added to `schemas.BifrostConfig.LLMPlugins`; it can return configured success/error responses for chat-completion and Responses requests, match rules, and simulate latency. Its mock result validates a simulated flow only, not real provider capability. The docs do not expose an admin UI/API contract that this registry can assume.
- No screenshot/image embed was present in the retrieved harness, JSON Parser or Mocker page text; no official screenshot URL was identified for these references. The pages are useful as textual behavior/source references.

## Official Bifrost interface screenshots

The [official Claude Code + Gemini guide](https://getbifrost.ai/guides/claude-code/use-claude-code-with-gemini-models) embeds these two dashboard screenshots:

**Model catalog dashboard** (Gemini and Anthropic providers):

![Bifrost model catalog dashboard with Gemini and Anthropic](https://bifrost-website.getmaxim.workers.dev/gemini-model-catalog-v3.png)

**Virtual key budgets and limits dashboard:**

![Bifrost virtual key budget and limits dashboard](https://bifrost-website.getmaxim.workers.dev/virtual-key-step-dashboard.jpg)

The official [Routing Rules documentation](https://docs.getbifrost.ai/providers/routing-rules) describes the rules table, scope filters, rule sheet, visual/manual CEL editor and draggable priority, but has no embedded interface image. A focused search of the official docs and Bifrost docs sources found no published MCP Library/marketplace dashboard screenshot or dedicated screenshot page. The upstream UI's MCP Library components remain the concrete native visual reference above.

## Upstream source links

The source inventory is pinned to [Bifrost commit `6493abd`](https://github.com/maximhq/bifrost/tree/6493abd3d1422c9bfde95f242fd57b38e73ce881/ui). Main files: [`modelMultiselect.tsx`](https://github.com/maximhq/bifrost/blob/6493abd3d1422c9bfde95f242fd57b38e73ce881/ui/components/ui/modelMultiselect.tsx), [`icons.tsx`](https://github.com/maximhq/bifrost/blob/6493abd3d1422c9bfde95f242fd57b38e73ce881/ui/lib/constants/icons.tsx), [`MCP library page`](https://github.com/maximhq/bifrost/blob/6493abd3d1422c9bfde95f242fd57b38e73ce881/ui/app/workspace/mcp-registry/library/page.tsx), [`MCP server card`](https://github.com/maximhq/bifrost/blob/6493abd3d1422c9bfde95f242fd57b38e73ce881/ui/app/workspace/mcp-registry/library/views/mcpLibraryServerCard.tsx), and [`routing tree`](https://github.com/maximhq/bifrost/tree/6493abd3d1422c9bfde95f242fd57b38e73ce881/ui/app/workspace/routing-rules/tree/views).

## Search interaction reference

[Apple — Design intuitive search experiences, WWDC26](https://developer.apple.com/videos/play/wwdc2026/292/) recommends making the search scope clear through placement and wording, starting broadly before narrowing results, showing contextual filters, and keeping recognizable search/clear controls. Applied here as interaction guidance: a search field belongs beside the collection it filters, filters remain visible when active, and changing the visible results preserves a user's existing selection. The visual system remains Bifrost's.

## Suggested client test packs — removed from the prototype

Historical proposal, removed after Sofian clarified that the laboratory should centre on Bifrost's own test collection. These locally composed recipes were not imported upstream test packs or certifications. Their source references are retained here as research history.

| Client / configured variant | Protocol to exercise | Primary reference |
| --- | --- | --- |
| Hermes Agent, custom endpoint | OpenAI Chat Completions: reply, streaming, emitted tool call | [NousResearch provider configuration](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/integrations/providers.md) |
| Codex | OpenAI Responses: reply, streaming, emitted tool call | [Codex configuration reference](https://developers.openai.com/codex/config-reference) |
| Claude Code, gateway | Anthropic Messages: reply, streaming, emitted tool use | [Claude Code LLM gateway](https://code.claude.com/docs/en/llm-gateway) |
| OpenCode, `@ai-sdk/openai-compatible` | OpenAI Chat Completions; other provider packages need their corresponding protocol | [OpenCode providers](https://opencode.ai/docs/providers/) |

These recipes were a product proposal informed by the documented protocols. A real acceptance run must additionally configure the isolated client, check model visibility with its virtual key, execute a tool and submit its result to verify continuation. Harness coverage of a gateway API alone cannot establish client compatibility or that full round trip. The former 13 illustrative scenarios and their provider mappings have now been removed.

The pinned upstream [Makefile](https://github.com/maximhq/bifrost/blob/6493abd3d1422c9bfde95f242fd57b38e73ce881/Makefile) also defines a separate real `run-cli-harness-test` for Claude Code, Codex and OpenCode, with CLI/provider/model/scenario filters. That suite is distinct from the removed local recipes. The API runner exposes provider, folder and feature filters.

## Verified provider collection and report contract

The full [pinned collection](https://github.com/maximhq/bifrost/blob/6493abd3d1422c9bfde95f242fd57b38e73ce881/tests/e2e/api/collections/provider-harness.json) was downloaded and inspected: **3,530 requests, 114 top-level folders**, SHA-256 `3330c41792b3ec93dd70c50f12c6547803a57ee76869b639bff70a096ad719b0`. This differs from the documentation page's older 725/12 summary. The prototype's All tests / Custom now uses this actual collection. Positional IDs retain repeated names; request previews retain source bodies and inherited assertion names. Conditional assertions are not all guaranteed to execute. Source model values and external prerequisites prevent blindly multiplying every test across arbitrary targets.

The pinned `harness-viewer.mjs` consumes Newman `run.executions`: request method/URL/headers/body, response status/time/headers/stream, assertions and failures. `response.stream` may be a Buffer-shaped JSON object. No captured response examples exist in this source collection. The bundled prototype demo is a real Newman 6.2.1 report recorded against a local stub using three unchanged official requests and inherited assertions; the stub's responses are synthetic and include an intentional failure.

The pinned `harness-monitor.mjs` tails logs and aggregates progress; it does not expose a live prompt/token event API. [Newman emits request lifecycle events](https://github.com/postmanlabs/newman#newmanrunevents), which the local recorder captures with timestamps. The viewer buffers responses, including SSE bodies. The prototype replays recorded data and imports reports locally; a bridge to a running Bifrost harness and live provider execution remain unimplemented. Mocker and JSON Parser are not connected.
