export type Capability = "Declared" | "Observed in simulated campaign" | "Unknown";
export type Access = { provider: string; id: string; route: string; status: "Configured" | "Unknown"; nativeModel?: string; referenceId?: string; endpoints?: string[] };
export const registryEndpoints = ["chat/completions", "responses", "completions", "embeddings", "images/generations", "audio/speech", "decisions", "rerank", "ocr"] as const;
export type Model = {
  id: string;
  alias?: string;
  name: string;
  creator: string;
  family: string;
  inputModalities: string[];
  outputModalities: string[];
  tasks: string[];
  kind: "Unknown" | "Chat" | "Vision" | "Image" | "Embedding";
  summary: string;
  context: string;
  capabilities: Record<string, Capability>;
  accesses: Access[];
};
export type AccessSelector = { added: string[]; excluded: string[] };
export type Group = { id: string; name: string; description: string; members: string[] };
export type Policy = { groups: string[]; added: string[]; excluded: string[]; naming: "model" | "provider/model" | "both"; prefer?: Record<string, string>; accessSelection?: Record<string, AccessSelector> };
export type Publication = { state: "verified" | "drift" | "not_verified"; revision: string; checkedAt: string; observedAt?: string; observedRevision?: string; expected: string[]; actual: string[] | null; missing: string[]; unexpected: string[]; error?: string };
export type PricingProof = { access: string; state: string; checkedAt: string; error?: string };
// What Bifrost lets a key use today, from its native provider rows; allModels stands for "*".
export type NativePermissions = { allProviders: boolean; providers: { provider: string; allModels: boolean; models: string[] }[] };
// pendingAccessSelection: saved models withheld until an access is chosen, with their candidate access IDs.
// permissions: absent when Bifrost's answer carried no provider rows (not read yet).
export type Key = { id: string; name: string; client: string; active: boolean; policy: Policy; observed: string[] | null; readError: boolean; revision: number; managed?: boolean; publication?: Publication; pendingAccessSelection?: Record<string, string[]>; permissions?: NativePermissions };
export type Demo = { models: Model[]; groups: Group[]; keys: Key[]; campaigns: Campaign[] };
export type Campaign = { id: string; model: string; provider: string; accessId: string; scenario: string; outcome: "Pass" | "Fail" | "Inconclusive" | "Not run"; date: string; note: string };

export const copy = <T,>(value: T): T => structuredClone(value);
export const catalogModels = (registered: Model[], discovered: Model[]) => {
  const byId = new Map(discovered.map(model => [model.id, model]));
  for (const model of registered) {
    const accesses = new Map((byId.get(model.id)?.accesses || []).map(access => [JSON.stringify([access.provider, access.nativeModel || access.id]), access]));
    for (const access of model.accesses) accesses.set(JSON.stringify([access.provider, access.nativeModel || access.id]), access);
    byId.set(model.id, { ...model, accesses: [...accesses.values()] });
  }
  return [...byId.values()];
};
export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const members = (policy: Policy, groups: Group[]) => [...new Set([...groups.filter(g => policy.groups.includes(g.id)).flatMap(g => g.members), ...policy.added])].filter(id => !policy.excluded.includes(id));
export const origin = (id: string, policy: Policy, groups: Group[]) => groups.filter(g => policy.groups.includes(g.id) && g.members.includes(id)).map(g => g.name);
export const retainedAccesses = (model: Model, policy: Policy) => {
  const sel = policy.accessSelection?.[model.id];
  if (!sel) return { known: model.accesses.map(a => a.id), unknown: [] as string[] };
  const knownIds = new Set(model.accesses.map(a => a.id));
  const retained = new Set(knownIds);
  const unknown: string[] = [];
  for (const id of sel.added) {
    if (knownIds.has(id)) {
      retained.add(id);
    } else {
      unknown.push(id);
    }
  }
  for (const id of sel.excluded) retained.delete(id);
  return { known: model.accesses.filter(a => retained.has(a.id)).map(a => a.id), unknown };
};
export const exposed = (policy: Policy, groups: Group[], models: Model[]) => members(policy, groups).flatMap(id => {
  const model = models.find(m => m.id === id);
  if (!model) return [];
  const { known } = retainedAccesses(model, policy);
  if (!known.length) return [];
  const prefixed = known.map(accessId => model.accesses.find(a => a.id === accessId)?.id || accessId);
  return policy.naming === "model" ? [model.id] : policy.naming === "provider/model" ? prefixed : [model.id, ...prefixed];
});
export const delta = (before: string[], after: string[]) => ({ added: after.filter(x => !before.includes(x)), removed: before.filter(x => !after.includes(x)) });
export const keyImpact = (keys: Key[], oldGroups: Group[], nextGroups: Group[], models: Model[]) => keys.map(key => ({ key, before: exposed(key.policy, oldGroups, models), after: exposed(key.policy, nextGroups, models) })).filter(row => !same(row.before, row.after));
export type ModelFilters = { search: string; creator: string; provider: string; task: string; input: string; output: string; capability: string };
export const emptyModelFilters: ModelFilters = { search: "", creator: "", provider: "", task: "", input: "", output: "", capability: "" };
export const filterModels = (models: Model[], filters: ModelFilters) => models.filter(model => {
  const query = filters.search.trim().toLocaleLowerCase();
  const searchable = [model.name, model.id, model.creator, model.family, ...model.accesses.flatMap(access => [access.provider, access.id])].join(" ").toLocaleLowerCase();
  return (!query || searchable.includes(query)) &&
    (!filters.creator || model.creator === filters.creator) &&
    (!filters.provider || model.accesses.some(access => access.provider === filters.provider)) &&
    (!filters.task || model.tasks.includes(filters.task)) &&
    (!filters.input || model.inputModalities.includes(filters.input)) &&
    (!filters.output || model.outputModalities.includes(filters.output)) &&
    (!filters.capability || model.capabilities[filters.capability] && model.capabilities[filters.capability] !== "Unknown");
});
export const modelImpact = (key: Key, oldGroups: Group[], nextGroups: Group[]) => {
  const before = members(key.policy, oldGroups);
  const after = members(key.policy, nextGroups);
  return { added: after.filter(id => !before.includes(id)), removed: before.filter(id => !after.includes(id)), unchanged: after.filter(id => before.includes(id)), exclusions: key.policy.excluded };
};
export const toggleModel = (policy: Policy, id: string, groups: Group[]): Policy => {
  const next = copy(policy);
  const inherited = origin(id, next, groups).length > 0;
  const active = members(next, groups).includes(id);
  next.added = next.added.filter(x => x !== id);
  next.excluded = next.excluded.filter(x => x !== id);
  if (active && inherited) next.excluded.push(id);
  else if (!active && !inherited) next.added.push(id);
  return next;
};
