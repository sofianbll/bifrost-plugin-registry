import type { Capability, Demo, Model } from "../../domain/registry";

const cap = (chat: Capability, stream: Capability, tools: Capability, vision: Capability, reasoning: Capability = "Unknown"): Record<string, Capability> => ({ Chat: chat, Streaming: stream, Tools: tools, Vision: vision, Reasoning: reasoning, "Structured output": "Unknown" });
export const fixture: Demo = {
  models: [
    { id: "gpt-5", name: "GPT-5", creator: "OpenAI", family: "GPT", inputModalities: ["Text", "Image"], outputModalities: ["Text"], tasks: ["Chat", "Code", "Reasoning"], kind: "Chat", summary: "General reasoning and coding model for complex workflows.", context: "Unknown", capabilities: cap("Declared", "Observed in simulated campaign", "Observed in simulated campaign", "Unknown", "Declared"), accesses: [{ provider: "openai", id: "openai/gpt-5", route: "Direct provider", status: "Configured" }, { provider: "azure", id: "azure/gpt-5", route: "Direct provider", status: "Configured" }] },
    { id: "claude-sonnet-4", name: "Claude Sonnet 4", creator: "Anthropic", family: "Claude", inputModalities: ["Text", "Image"], outputModalities: ["Text"], tasks: ["Chat", "Code", "Reasoning"], kind: "Chat", summary: "Balanced model for code, writing, and agent tasks.", context: "Unknown", capabilities: cap("Declared", "Observed in simulated campaign", "Declared", "Declared"), accesses: [{ provider: "anthropic", id: "anthropic/claude-sonnet-4", route: "Direct provider", status: "Configured" }, { provider: "bedrock", id: "bedrock/claude-sonnet-4", route: "Direct provider", status: "Unknown" }] },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", creator: "Google", family: "Gemini", inputModalities: ["Text", "Image"], outputModalities: ["Text"], tasks: ["Chat", "Vision", "Reasoning"], kind: "Vision", summary: "Multimodal reasoning with a large input context.", context: "Unknown", capabilities: cap("Declared", "Declared", "Unknown", "Declared", "Declared"), accesses: [{ provider: "google", id: "google/gemini-2.5-pro", route: "Direct provider", status: "Configured" }] },
    { id: "kimi-k2", name: "Kimi K2", creator: "Moonshot AI", family: "Kimi", inputModalities: ["Text"], outputModalities: ["Text"], tasks: ["Chat", "Code"], kind: "Chat", summary: "Open weight model tuned for agent and coding tasks.", context: "Unknown", capabilities: cap("Declared", "Unknown", "Unknown", "Unknown"), accesses: [{ provider: "moonshot", id: "moonshot/kimi-k2", route: "Direct provider", status: "Configured" }, { provider: "openrouter", id: "openrouter/kimi-k2", route: "Direct provider", status: "Configured" }] },
    { id: "gpt-5-mini", name: "GPT-5 mini", creator: "OpenAI", family: "GPT", inputModalities: ["Text"], outputModalities: ["Text"], tasks: ["Chat", "Code"], kind: "Chat", summary: "Smaller model for frequent lightweight requests.", context: "Unknown", capabilities: cap("Declared", "Declared", "Unknown", "Unknown"), accesses: [{ provider: "openai", id: "openai/gpt-5-mini", route: "Direct provider", status: "Configured" }] },
    { id: "claude-opus-4", name: "Claude Opus 4", creator: "Anthropic", family: "Claude", inputModalities: ["Text", "Image"], outputModalities: ["Text"], tasks: ["Chat", "Reasoning"], kind: "Chat", summary: "High capability model for demanding reasoning.", context: "Unknown", capabilities: cap("Declared", "Unknown", "Unknown", "Declared", "Declared"), accesses: [{ provider: "anthropic", id: "anthropic/claude-opus-4", route: "Direct provider", status: "Configured" }] },
    { id: "imagen-4", name: "Imagen 4", creator: "Google", family: "Imagen", inputModalities: ["Text"], outputModalities: ["Image"], tasks: ["Image generation"], kind: "Image", summary: "Image generation access through Google.", context: "Not applicable", capabilities: { "Image generation": "Declared", Editing: "Unknown" }, accesses: [{ provider: "google", id: "google/imagen-4", route: "Direct provider", status: "Configured" }] },
    { id: "text-embedding-3-large", name: "Text embedding 3 large", creator: "OpenAI", family: "Embedding", inputModalities: ["Text"], outputModalities: ["Vector"], tasks: ["Embeddings"], kind: "Embedding", summary: "High dimensional vector embeddings.", context: "Unknown", capabilities: { Embeddings: "Declared", Dimensions: "Unknown" }, accesses: [{ provider: "openai", id: "openai/text-embedding-3-large", route: "Direct provider", status: "Configured" }] },
  ],
  groups: [
    { id: "code", name: "Code", description: "Models available to coding clients", members: ["gpt-5", "claude-sonnet-4", "gpt-5-mini"] },
    { id: "reasoning", name: "Reasoning", description: "Complex research and planning", members: ["gpt-5", "claude-opus-4", "gemini-2.5-pro"] },
    { id: "vision", name: "Vision", description: "Visual inputs and generation", members: ["gemini-2.5-pro", "imagen-4"] },
  ],
  keys: [
    { id: "hermes", name: "Hermes", client: "Hermes", active: true, policy: { groups: ["code"], added: [], excluded: [], naming: "model" }, observed: ["gpt-5", "claude-sonnet-4", "gpt-5-mini"], readError: false, revision: 1 },
    { id: "witness", name: "Witness key", client: "Isolation check", active: true, policy: { groups: ["code"], added: [], excluded: [], naming: "model" }, observed: ["gpt-5", "claude-sonnet-4", "gpt-5-mini"], readError: false, revision: 1 },
  ],
  campaigns: [
    { id: "run-104", model: "gpt-5", provider: "openai", accessId: "openai/gpt-5", scenario: "Chat completion", outcome: "Pass", date: "2026-09-21", note: "Illustrative response fixture; no provider request." },
    { id: "run-105", model: "gpt-5", provider: "openai", accessId: "openai/gpt-5", scenario: "Streaming", outcome: "Pass", date: "2026-09-21", note: "Illustrative chunks and final response fixture." },
    { id: "run-106", model: "claude-sonnet-4", provider: "anthropic", accessId: "anthropic/claude-sonnet-4", scenario: "Tool round trip", outcome: "Inconclusive", date: "2026-09-22", note: "Illustrative timeout; capability remains unknown on this access." },
  ],
};

// Illustrative discovery results only; selecting one copies it into local demo state.
export const discoveryModels: Model[] = [
  { id: "gpt-4o", name: "GPT-4o", creator: "OpenAI", family: "GPT", inputModalities: ["Text", "Image"], outputModalities: ["Text"], tasks: ["Chat", "Vision"], kind: "Vision", summary: "Multimodal chat model in the illustrative discovery catalogue.", context: "Unknown", capabilities: { Chat: "Declared", Vision: "Declared", Streaming: "Unknown", Tools: "Unknown" }, accesses: [{ provider: "openai", id: "openai/gpt-4o", route: "Direct provider", status: "Unknown" }] },
  { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", creator: "Anthropic", family: "Claude", inputModalities: ["Text", "Image"], outputModalities: ["Text"], tasks: ["Chat", "Code"], kind: "Chat", summary: "Compact Claude model in the illustrative discovery catalogue.", context: "Unknown", capabilities: { Chat: "Declared", Vision: "Unknown", Streaming: "Unknown", Tools: "Unknown" }, accesses: [{ provider: "anthropic", id: "anthropic/claude-3-5-haiku", route: "Direct provider", status: "Unknown" }] },
];

