// PROTOTYPE — key-composer state engine. Synthetic data, in-memory only.
// Implements the September 26 selection rules: configured accesses are active
// by default at selection time, late arrivals stay off until activated,
// local exclusion wins over groups and direct adds, restore is explicit.
import type { Access, Model } from "../../domain/registry";

export type AccessFact = { label: string; value: string | null; source: string; kind: "declared" | "unknown" };
export type ProtoAccess = Access & { configured: boolean; addedAt: string; facts: AccessFact[] };
export type ProtoModel = Omit<Model, "accesses"> & { commonId: string; accesses: ProtoAccess[] };
export type ProtoGroup = { id: string; name: string; description: string; members: { modelId: string; accesses: string[] }[] };

export type KeyDraft = {
  name: string;
  client: string;
  groups: string[];
  added: { modelId: string; accesses: string[] }[];
  excludedModels: string[];
  excludedAccesses: string[];
  activatedAccesses: string[];
  naming: "model" | "provider/model" | "both";
};

export const emptyDraft = (): KeyDraft => ({ name: "", client: "", groups: [], added: [], excludedModels: [], excludedAccesses: [], activatedAccesses: [], naming: "model" });

const access = (provider: string, model: ProtoModel["id"], nativeModel: string, configured: boolean, addedAt: string, facts: AccessFact[]): ProtoAccess =>
  ({ provider, id: `${provider}/${model}`, route: "Direct provider", status: configured ? "Configured" : "Unknown", nativeModel, configured, addedAt, facts });

const declared = (label: string, value: string, source: string): AccessFact => ({ label, value, source, kind: "declared" });
const unknown = (label: string): AccessFact => ({ label, value: null, source: "", kind: "unknown" });

// Synthetic catalog. Names and identifiers are illustrative; no live gateway data.
export const fixtureModels: ProtoModel[] = [
  {
    id: "gpt-5", name: "GPT-5", creator: "OpenAI", family: "GPT", commonId: "gpt-5",
    inputModalities: ["Text", "Image"], outputModalities: ["Text"], tasks: ["Chat", "Code", "Reasoning"], kind: "Chat",
    summary: "General reasoning and coding model for complex workflows.", context: "Unknown",
    capabilities: { Chat: "Declared", Streaming: "Declared", "Tool calling": "Declared", Reasoning: "Declared", "Structured output": "Unknown" },
    accesses: [
      access("openai", "gpt-5", "gpt-5", true, "2026-09-10", [declared("Context length", "400,000 tokens", "Models.dev datasheet · imported 2026-09-19"), unknown("p50 latency")]),
      access("azure", "gpt-5", "gpt-5", true, "2026-09-10", [declared("Context length", "400,000 tokens", "Models.dev datasheet · imported 2026-09-19"), unknown("Provisioned throughput")]),
    ],
  },
  {
    id: "claude-sonnet-4.6", name: "Claude Sonnet 4.6", creator: "Anthropic", family: "Claude", commonId: "claude-sonnet-4.6",
    inputModalities: ["Text", "Image"], outputModalities: ["Text"], tasks: ["Chat", "Code", "Reasoning"], kind: "Chat",
    summary: "Balanced model for code, writing, and agent tasks.", context: "Unknown",
    capabilities: { Chat: "Declared", Streaming: "Declared", "Tool calling": "Declared", Reasoning: "Declared", "Structured output": "Unknown" },
    accesses: [
      access("anthropic", "claude-sonnet-4.6", "claude-sonnet-4-6", true, "2026-09-10", [declared("Context length", "200,000 tokens", "Models.dev datasheet · imported 2026-09-19"), unknown("p50 latency")]),
      access("bedrock", "claude-sonnet-4.6", "us.anthropic.claude-sonnet-4-6-v1:0", false, "2026-09-10", [declared("Context length", "200,000 tokens", "AWS Bedrock model page · read 2026-09-21"), unknown("p50 latency")]),
    ],
  },
  {
    id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", creator: "Google", family: "Gemini", commonId: "gemini-2.5-pro",
    inputModalities: ["Text", "Image"], outputModalities: ["Text"], tasks: ["Chat", "Vision", "Reasoning"], kind: "Vision",
    summary: "Multimodal reasoning with a large input context.", context: "Unknown",
    capabilities: { Chat: "Declared", Streaming: "Declared", "Tool calling": "Unknown", Vision: "Declared", Reasoning: "Declared" },
    accesses: [
      access("google", "gemini-2.5-pro", "gemini-2.5-pro", true, "2026-09-10", [declared("Context length", "1,048,576 tokens", "Bifrost datasheet · synced 2026-09-18"), unknown("p50 latency")]),
    ],
  },
  {
    id: "kimi-k2", name: "Kimi K2", creator: "Moonshot AI", family: "Kimi", commonId: "kimi-k2",
    inputModalities: ["Text"], outputModalities: ["Text"], tasks: ["Chat", "Code"], kind: "Chat",
    summary: "Open weight model tuned for agent and coding tasks.", context: "Unknown",
    capabilities: { Chat: "Declared", Streaming: "Unknown", "Tool calling": "Declared", Reasoning: "Unknown" },
    accesses: [
      access("moonshot", "kimi-k2", "kimi-k2-0905-preview", true, "2026-09-10", [declared("Context length", "262,144 tokens", "Models.dev datasheet · imported 2026-09-19"), unknown("p50 latency")]),
      access("openrouter", "kimi-k2", "moonshotai/kimi-k2", true, "2026-09-10", [declared("Context length", "262,144 tokens", "Models.dev datasheet · imported 2026-09-19"), unknown("Upstream provider")]),
    ],
  },
  {
    id: "gpt-5-mini", name: "GPT-5 mini", creator: "OpenAI", family: "GPT", commonId: "gpt-5-mini",
    inputModalities: ["Text"], outputModalities: ["Text"], tasks: ["Chat", "Code"], kind: "Chat",
    summary: "Smaller model for frequent lightweight requests.", context: "Unknown",
    capabilities: { Chat: "Declared", Streaming: "Declared", "Tool calling": "Declared", Reasoning: "Unknown" },
    accesses: [
      access("openai", "gpt-5-mini", "gpt-5-mini", true, "2026-09-10", [declared("Context length", "400,000 tokens", "Models.dev datasheet · imported 2026-09-19"), unknown("p50 latency")]),
    ],
  },
  {
    id: "claude-opus-4", name: "Claude Opus 4", creator: "Anthropic", family: "Claude", commonId: "claude-opus-4",
    inputModalities: ["Text", "Image"], outputModalities: ["Text"], tasks: ["Chat", "Reasoning"], kind: "Chat",
    summary: "High capability model for demanding reasoning.", context: "Unknown",
    capabilities: { Chat: "Declared", Streaming: "Unknown", "Tool calling": "Declared", Reasoning: "Declared" },
    accesses: [
      access("anthropic", "claude-opus-4", "claude-opus-4", true, "2026-09-10", [declared("Context length", "200,000 tokens", "Models.dev datasheet · imported 2026-09-19"), unknown("p50 latency")]),
    ],
  },
  {
    id: "imagen-4", name: "Imagen 4", creator: "Google", family: "Imagen", commonId: "imagen-4",
    inputModalities: ["Text"], outputModalities: ["Image"], tasks: ["Image generation"], kind: "Image",
    summary: "Image generation access through Google.", context: "Not applicable",
    capabilities: { "Image generation": "Declared", Editing: "Unknown" },
    accesses: [
      access("google", "imagen-4", "imagen-4.0-generate-001", true, "2026-09-10", [declared("Max output images", "4 per request", "Bifrost datasheet · synced 2026-09-18"), unknown("Generation time")]),
    ],
  },
  {
    id: "text-embedding-3-large", name: "Text Embedding 3 Large", creator: "OpenAI", family: "Embedding", commonId: "text-embedding-3-large",
    inputModalities: ["Text"], outputModalities: ["Vector"], tasks: ["Embeddings"], kind: "Embedding",
    summary: "High dimensional vector embeddings.", context: "Unknown",
    capabilities: { Embeddings: "Declared", Dimensions: "Unknown" },
    accesses: [
      access("openai", "text-embedding-3-large", "text-embedding-3-large", true, "2026-09-10", [declared("Max input", "8,191 tokens", "Models.dev datasheet · imported 2026-09-19"), unknown("p50 latency")]),
    ],
  },
];

export const fixtureGroups: ProtoGroup[] = [
  { id: "code", name: "Code", description: "Models available to coding clients", members: [
    { modelId: "gpt-5", accesses: ["openai/gpt-5", "azure/gpt-5"] },
    { modelId: "claude-sonnet-4.6", accesses: ["anthropic/claude-sonnet-4.6"] },
    { modelId: "gpt-5-mini", accesses: ["openai/gpt-5-mini"] },
  ] },
  { id: "reasoning", name: "Reasoning", description: "Complex research and planning", members: [
    { modelId: "gpt-5", accesses: ["openai/gpt-5"] },
    { modelId: "claude-opus-4", accesses: ["anthropic/claude-opus-4"] },
    { modelId: "gemini-2.5-pro", accesses: ["google/gemini-2.5-pro"] },
  ] },
  { id: "vision", name: "Vision", description: "Visual inputs and generation", members: [
    { modelId: "gemini-2.5-pro", accesses: ["google/gemini-2.5-pro"] },
    { modelId: "imagen-4", accesses: ["google/imagen-4"] },
  ] },
];

// Witness key: inherits Code only. Never mutated by prototype actions; used to
// show that local exclusions on the draft key do not touch other keys.
export const witnessDraft: KeyDraft = { ...emptyDraft(), name: "Witness key", client: "Isolation check", groups: ["code"] };

// --- Resolution ---

export type AccessResolution = { access: ProtoAccess; state: "active" | "off" | "excluded" | "unavailable"; origins: string[] };
export type ModelResolution = { model: ProtoModel; state: "active" | "excluded"; groups: string[]; direct: boolean; accesses: AccessResolution[] };

export function groupsProviding(modelId: string, draft: KeyDraft, groups: ProtoGroup[]): ProtoGroup[] {
  return groups.filter(g => draft.groups.includes(g.id) && g.members.some(m => m.modelId === modelId));
}

export function directAdd(modelId: string, draft: KeyDraft): { modelId: string; accesses: string[] } | undefined {
  return draft.added.find(a => a.modelId === modelId);
}

export function isSelected(modelId: string, draft: KeyDraft, groups: ProtoGroup[]): boolean {
  return (groupsProviding(modelId, draft, groups).length > 0 || !!directAdd(modelId, draft)) && !draft.excludedModels.includes(modelId);
}

export function resolveDraft(draft: KeyDraft, groups: ProtoGroup[], models: ProtoModel[]): ModelResolution[] {
  const resolved: ModelResolution[] = [];
  for (const model of models) {
    const viaGroups = groupsProviding(model.id, draft, groups);
    const direct = directAdd(model.id, draft);
    if (!viaGroups.length && !direct) continue;
    const modelExcluded = draft.excludedModels.includes(model.id);
    const accesses: AccessResolution[] = model.accesses.map(a => {
      const origins: string[] = [
        ...viaGroups.filter(g => g.members.find(m => m.modelId === model.id)?.accesses.includes(a.id)).map(g => `Inherited · ${g.name}`),
        ...(direct?.accesses.includes(a.id) ? ["Direct pick"] : []),
      ];
      if (modelExcluded || draft.excludedAccesses.includes(a.id)) return { access: a, state: "excluded", origins };
      if (!a.configured) return { access: a, state: "unavailable", origins };
      if (draft.activatedAccesses.includes(a.id)) return { access: a, state: "active", origins: [...origins, "Activated directly"] };
      if (origins.length) return { access: a, state: "active", origins };
      return { access: a, state: "off", origins };
    });
    resolved.push({ model, state: modelExcluded ? "excluded" : "active", groups: viaGroups.map(g => g.name), direct: !!direct, accesses });
  }
  return resolved;
}

export function plannedExposures(draft: KeyDraft, groups: ProtoGroup[], models: ProtoModel[]): string[] {
  const ids: string[] = [];
  for (const r of resolveDraft(draft, groups, models)) {
    if (r.state !== "active") continue;
    const active = r.accesses.filter(a => a.state === "active");
    if (!active.length) continue;
    if (draft.naming !== "provider/model") ids.push(r.model.commonId);
    if (draft.naming !== "model") ids.push(...active.map(a => a.access.id));
  }
  return ids;
}

// --- Draft actions (pure; return a new draft) ---

const clone = (d: KeyDraft): KeyDraft => structuredClone(d);

function dropAccessOverrides(draft: KeyDraft, model: ProtoModel) {
  const ids = new Set(model.accesses.map(a => a.id));
  draft.excludedAccesses = draft.excludedAccesses.filter(id => !ids.has(id));
  draft.activatedAccesses = draft.activatedAccesses.filter(id => !ids.has(id));
}

export function toggleModel(draft: KeyDraft, model: ProtoModel, groups: ProtoGroup[]): KeyDraft {
  const next = clone(draft);
  const inherited = groupsProviding(model.id, next, groups).length > 0;
  const direct = !!directAdd(model.id, next);
  const excluded = next.excludedModels.includes(model.id);
  if (excluded) {
    next.excludedModels = next.excludedModels.filter(id => id !== model.id);
  } else if (direct && !inherited) {
    next.added = next.added.filter(a => a.modelId !== model.id);
    dropAccessOverrides(next, model);
  } else if (inherited) {
    // Inherited (with or without a direct pick): only a local exclusion removes it.
    next.excludedModels.push(model.id);
  } else {
    next.added.push({ modelId: model.id, accesses: model.accesses.filter(a => a.configured).map(a => a.id) });
  }
  return next;
}

export function toggleGroup(draft: KeyDraft, groupId: string): KeyDraft {
  const next = clone(draft);
  next.groups = next.groups.includes(groupId) ? next.groups.filter(id => id !== groupId) : [...next.groups, groupId];
  return next;
}

export function toggleAccess(draft: KeyDraft, resolution: AccessResolution): KeyDraft {
  const next = clone(draft);
  const id = resolution.access.id;
  if (resolution.state === "active") {
    next.excludedAccesses.push(id);
    next.activatedAccesses = next.activatedAccesses.filter(x => x !== id);
  } else if (resolution.state === "off" && resolution.access.configured) {
    next.activatedAccesses.push(id);
  } else if (resolution.state === "excluded") {
    next.excludedAccesses = next.excludedAccesses.filter(x => x !== id);
  }
  return next;
}

export function reconcileSelection(draft: KeyDraft, targetIds: string[], groups: ProtoGroup[], models: ProtoModel[]): KeyDraft {
  let next = draft;
  for (const model of models) {
    if (isSelected(model.id, next, groups) !== targetIds.includes(model.id)) next = toggleModel(next, model, groups);
  }
  return next;
}

// Demo control: a new configured access appears on a card after selections exist.
export const lateAccess: Record<string, () => ProtoAccess> = {
  "kimi-k2": () => access("azure", "kimi-k2", "kimi-k2", true, "2026-09-26", [declared("Context length", "262,144 tokens", "Azure AI Foundry catalog · appeared 2026-09-26"), unknown("Provisioned throughput")]),
};

export const sameDraft = (a: KeyDraft, b: KeyDraft) => JSON.stringify(a) === JSON.stringify(b);
