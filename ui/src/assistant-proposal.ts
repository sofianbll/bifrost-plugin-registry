import type { Model } from "./demo";

export type Suggestion = { referenceId?: string; fields: Record<string, unknown> };
export type SuggestionRow = { key: string; label: string; current: string; proposed: string; checked: boolean; value: string | string[]; capability?: string };

const knownModalities = new Map(["text", "image", "audio", "video", "vector"].map(value => [value, value[0].toUpperCase() + value.slice(1)]));
const knownStrings = [{ key: "name", label: "Display name", current: (model: Model) => model.name }, { key: "creator", label: "Creator", current: (model: Model) => model.creator }, { key: "family", label: "Model series", current: (model: Model) => model.family }];
const missing = (value: string) => !value.trim() || value === "Unknown";

export function normalizeSuggestion(raw: unknown): Suggestion {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("The assistant returned an invalid proposal.");
  const proposal = (raw as { proposal?: unknown }).proposal;
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) throw new Error("The assistant returned an invalid proposal.");
  const fields = (proposal as { fields?: unknown }).fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) throw new Error("The assistant returned an invalid proposal.");
  const referenceId = (proposal as { referenceId?: unknown }).referenceId;
  return { fields: fields as Record<string, unknown>, ...(typeof referenceId === "string" && referenceId.trim() ? { referenceId: referenceId.trim() } : {}) };
}

export function suggestionRows(model: Model, suggestion: Suggestion): SuggestionRow[] {
  const rows: SuggestionRow[] = [];
  for (const { key, label, current } of knownStrings) {
    const value = suggestion.fields[key];
    const existing = current(model);
    if (typeof value === "string" && value.trim() && value.trim() !== existing) rows.push({ key, label, current: existing || "Unknown", proposed: value.trim(), checked: missing(existing), value: value.trim() });
  }
  const context = suggestion.fields.context_length;
  if (typeof context === "number" && Number.isSafeInteger(context) && context > 0 && String(context) !== model.context) rows.push({ key: "context", label: "Context window", current: model.context || "Unknown", proposed: String(context), checked: missing(model.context), value: String(context) });
  for (const [key, label, current] of [["input_modalities", "Input modalities", model.inputModalities], ["output_modalities", "Output modalities", model.outputModalities]] as const) {
    const raw = suggestion.fields[key];
    if (!Array.isArray(raw) || !raw.length || !raw.every(value => typeof value === "string" && knownModalities.has(value.toLowerCase()))) continue;
    const values = [...new Set(raw.map(value => knownModalities.get(value.toLowerCase())!))];
    if (JSON.stringify(values) !== JSON.stringify(current)) rows.push({ key, label, current: current.join(", ") || "Unknown", proposed: values.join(", "), checked: current.length === 0, value: values });
  }
  for (const [key, capability] of [["reasoning", "Reasoning"], ["tool_call", "Tools"], ["structured_output", "Structured output"]] as const) {
    if (suggestion.fields[key] !== true || model.capabilities[capability] === "Declared") continue;
    const current = model.capabilities[capability] || "Unknown";
    rows.push({ key, label: capability, current, proposed: "Declared (AI suggestion)", checked: current === "Unknown", value: "Declared", capability });
  }
  if (suggestion.referenceId && model.accesses.some(access => access.referenceId !== suggestion.referenceId)) {
    rows.push({ key: "referenceId", label: "Reference match for all accesses", current: [...new Set(model.accesses.map(access => access.referenceId || "Unmapped"))].join(", "), proposed: suggestion.referenceId, checked: false, value: suggestion.referenceId });
  }
  return rows;
}

export function applySuggestion(model: Model, rows: SuggestionRow[], selected: ReadonlySet<string>): Model {
  const next: Model = { ...model, capabilities: { ...model.capabilities } };
  for (const row of rows) {
    if (!selected.has(row.key)) continue;
    if (row.capability) next.capabilities[row.capability] = "Declared";
    else if (row.key === "referenceId") next.accesses = model.accesses.map(access => ({ ...access, referenceId: row.value as string }));
    else if (row.key === "input_modalities") next.inputModalities = [...row.value as string[]];
    else if (row.key === "output_modalities") next.outputModalities = [...row.value as string[]];
    else if (row.key === "name" || row.key === "creator" || row.key === "family" || row.key === "context") next[row.key] = row.value as string;
  }
  return next;
}
