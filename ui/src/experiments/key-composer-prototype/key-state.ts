// Prototype-only virtual keys. Tokens are inert labels, never credentials.
import { emptyDraft, witnessDraft, type KeyDraft } from "./state";

export type SimulatedKey = { id: string; draft: KeyDraft; demoToken: string; readonly?: boolean };
const example = (name: string, client: string, groups: string[]): KeyDraft => ({ ...emptyDraft(), name, client, groups });
export const initialKeys: SimulatedKey[] = [
  { id: "witness", draft: structuredClone(witnessDraft), demoToken: "", readonly: true },
  { id: "demo-hermes", draft: example("Demo · Hermes", "Hermes (demo)", ["code"]), demoToken: "DEMO_NOT_VALID_HERMES" },
  { id: "demo-research", draft: example("Demo · Research", "Notebook (demo)", ["reasoning"]), demoToken: "DEMO_NOT_VALID_RESEARCH" },
  { id: "demo-vision", draft: example("Demo · Vision", "Gallery (demo)", ["vision"]), demoToken: "DEMO_NOT_VALID_VISION" },
];

export function saveKey(keys: SimulatedKey[], draft: KeyDraft, id: string): SimulatedKey[] {
  const existing = keys.find(key => key.id === id);
  if (existing?.readonly) throw new Error("Witness key is read-only");
  const saved: SimulatedKey = { id, draft: structuredClone(draft), demoToken: existing?.demoToken ?? `DEMO_NOT_VALID_${id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}` };
  return existing ? keys.map(key => key.id === id ? saved : key) : [...keys, saved];
}

export const editDraft = (key: SimulatedKey): KeyDraft => structuredClone(key.draft);
