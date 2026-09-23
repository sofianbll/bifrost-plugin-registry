import type { Access, Group, Model } from "./demo";
import type { ViewOptions } from "./ViewOptions";

export type Suite = {
  id: string;
  name: string;
  use: string;
  criterion: string;
  endpoint: string;
  coveredProviders: string[];
  coverageNote?: string;
};

// Illustrative prototype scenarios based on Bifrost's documented harness areas.
// These mappings do not import exact upstream cases or verify configured accesses.
export const suites: Suite[] = [
  { id: "chat", name: "Basic chat", use: "Conversation", criterion: "Assistant returns a usable text reply.", endpoint: "/v1/chat/completions", coveredProviders: ["openai", "azure", "anthropic", "bedrock", "google", "gemini", "vertex"] },
  { id: "stream", name: "Streaming (SSE)", use: "Conversation", criterion: "Response chunks arrive and finish cleanly.", endpoint: "/v1/chat/completions", coveredProviders: ["openai", "azure", "anthropic", "bedrock", "google", "gemini", "vertex"] },
  { id: "tools", name: "Function calling", use: "Agents", criterion: "Tool name and arguments match the requested call.", endpoint: "/v1/chat/completions", coveredProviders: ["openai", "azure", "anthropic", "bedrock", "google", "gemini", "vertex"] },
  { id: "vision", name: "Vision input", use: "Multimodal", criterion: "Text answer uses the supplied image.", endpoint: "/v1/chat/completions", coveredProviders: ["openai", "azure", "anthropic", "bedrock", "google", "gemini", "vertex"] },
  { id: "json", name: "Structured output (json_schema)", use: "Agents", criterion: "Output parses and matches the requested schema.", endpoint: "/v1/chat/completions", coveredProviders: ["openai", "azure", "anthropic", "bedrock", "google", "gemini", "vertex"] },
  { id: "embedding", name: "Embeddings", use: "Retrieval", criterion: "A numeric embedding vector is returned.", endpoint: "/v1/embeddings", coveredProviders: ["openai", "azure", "bedrock", "google", "gemini", "vertex"] },
  { id: "image", name: "Image generation", use: "Multimodal", criterion: "Generated image content is returned.", endpoint: "/v1/images/generations", coveredProviders: ["openai", "azure", "bedrock", "google", "gemini", "vertex"] },
  { id: "responses-chat", name: "Responses: basic answer", use: "API protocols", criterion: "A Responses request returns a final text answer.", endpoint: "/v1/responses", coveredProviders: ["openai"] },
  { id: "responses-stream", name: "Responses: streaming", use: "API protocols", criterion: "Responses events stream and finish cleanly.", endpoint: "/v1/responses", coveredProviders: ["openai"] },
  { id: "responses-tools", name: "Responses: tool call", use: "API protocols", criterion: "Custom tool name and arguments are emitted.", endpoint: "/v1/responses", coveredProviders: ["openai"], coverageNote: "Harness covers tool-call shape; client dispatch and continuation need a real-client check." },
  { id: "messages-chat", name: "Messages: basic answer", use: "API protocols", criterion: "An Anthropic Messages request returns a text answer.", endpoint: "/anthropic/v1/messages", coveredProviders: ["anthropic"] },
  { id: "messages-stream", name: "Messages: streaming", use: "API protocols", criterion: "Message events stream and finish cleanly.", endpoint: "/anthropic/v1/messages", coveredProviders: ["anthropic"] },
  { id: "messages-tools", name: "Messages: tool call", use: "API protocols", criterion: "A tool_use name and input are emitted.", endpoint: "/anthropic/v1/messages", coveredProviders: ["anthropic"], coverageNote: "Harness covers tool_use shape; client dispatch and continuation need a real-client check." },
];

export function selectedSuiteIds(mode: "all" | "custom", customIds: string[]): string[] {
  return mode === "all" ? suites.map(suite => suite.id) : customIds;
}

const legacyScenarioIds: Record<string, string> = { "Chat completion": "chat", Streaming: "stream", "Tool round trip": "tools" };
export const suiteForScenario = (name: string) => suites.find(suite => suite.name === name || suite.id === legacyScenarioIds[name]);

export type LabSelection = {
  modelIds: string[];
  providerIds: string[];
  groupIds: string[];
  creators: string[];
  excludedAccessIds: string[];
};
export type Target = { model: Model; access: Access };
export type Cell = { target: Target; suite: Suite; runnable: boolean; reason: string };

export const emptySelection = (): LabSelection => ({ modelIds: [], providerIds: [], groupIds: [], creators: [], excludedAccessIds: [] });

export function resolveTargets(models: Model[], groups: Group[], selection: LabSelection): Target[] {
  const groupModels = new Set(groups.filter(group => selection.groupIds.includes(group.id)).flatMap(group => group.members));
  return models.flatMap(model => model.accesses.flatMap(access => {
    const included = selection.modelIds.includes(model.id) || groupModels.has(model.id) || selection.creators.includes(model.creator) || selection.providerIds.includes(access.provider);
    return included && !selection.excludedAccessIds.includes(access.id) ? [{ model, access }] : [];
  }));
}

export function planCells(targets: Target[], chosenSuites: Suite[]): Cell[] {
  return targets.flatMap(target => chosenSuites.map(suite => {
    const model = target.model;
    const probedCapability = suite.id === "stream" || suite.id.endsWith("-stream") ? "Streaming"
      : suite.id === "tools" || suite.id.endsWith("-tools") ? "Tools" : "";
    const applicable = suite.id === "embedding" ? model.tasks.includes("Embeddings") && model.outputModalities.includes("Vector")
      : suite.id === "image" ? model.tasks.includes("Image generation") && model.outputModalities.includes("Image")
      : suite.id === "vision" ? model.inputModalities.includes("Image") && model.outputModalities.includes("Text")
      : model.tasks.includes("Chat") && model.outputModalities.includes("Text");
    const reason = !applicable ? "Not applicable to declared task or modality"
      : target.access.status !== "Configured" ? "Access configuration unconfirmed"
      : !suite.coveredProviders.includes(target.access.provider) ? "Provider harness mapping unknown; manual review needed"
      : probedCapability && model.capabilities[probedCapability] === "Unknown" ? `Illustrative mapping; ${probedCapability.toLowerCase()} capability unknown, eligible to probe`
      : "Illustrative harness mapping; this model/access unverified";
    return { target, suite, runnable: reason.startsWith("Illustrative"), reason };
  }));
}

export function limitCells(cells: Cell[], caseCeiling: number): Cell[] {
  let allowed = 0;
  return cells.map(cell => {
    if (!cell.runnable) return cell;
    if (allowed++ < caseCeiling) return cell;
    return { ...cell, runnable: false, reason: "Above this batch's case ceiling" };
  });
}

export function updateViewOverride(base: ViewOptions, previous: Partial<ViewOptions>, next: ViewOptions): Partial<ViewOptions> {
  const current = { ...base, ...previous };
  const override = { ...previous };
  for (const key of Object.keys(next) as (keyof ViewOptions)[]) {
    if (next[key] === current[key]) continue;
    if (next[key] === base[key]) delete override[key];
    else Object.assign(override, { [key]: next[key] });
  }
  return override;
}
