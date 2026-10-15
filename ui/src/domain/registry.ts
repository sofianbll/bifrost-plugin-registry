export type Capability = "Declared" | "Observed in simulated campaign" | "Unknown";
export type Access = {
  provider: string;
  id: string;
  route: string;
  status: "Configured" | "Unknown";
  nativeModel?: string;
  referenceId?: string;
  endpoints?: string[];
};
export const registryEndpoints = [
  "chat/completions",
  "responses",
  "completions",
  "embeddings",
  "images/generations",
  "audio/speech",
  "decisions",
  "rerank",
  "ocr",
] as const;
export type Model = {
  id: string;
  alias?: string;
  name: string;
  creator: string;
  // Where a saved card's creator comes from. "inferred" is a guess from its single first-party provider;
  // a manual edit sets "manual" (with no creator, that clears the guess for good).
  creatorSource?: "manual" | "reference" | "inferred";
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
export type Group = { id: string; name: string; description: string; members: string[]; membersLocked?: boolean };
export type Policy = {
  groups: string[];
  added: string[];
  excluded: string[];
  naming: "model" | "provider/model" | "both";
  prefer?: Record<string, string>;
  accessSelection?: Record<string, AccessSelector>;
  // Providers of an adopted key whose permissions stay in Bifrost (read-only: adoption sets them, and the panel never edits them).
  keptNative?: string[];
};
export type Publication = {
  state: "verified" | "drift" | "not_verified";
  revision: string;
  checkedAt: string;
  observedAt?: string;
  observedRevision?: string;
  expected: string[];
  actual: string[] | null;
  missing: string[];
  unexpected: string[];
  error?: string;
};
export type PricingProof = { access: string; state: string; checkedAt: string; error?: string };
// What Bifrost lets a key use today, from its native provider rows; allModels stands for "*",
// versionDependent for an empty list (all or none depending on the Bifrost version).
export type NativePermissions = {
  allProviders: boolean;
  providers: { provider: string; allModels: boolean; models: string[]; versionDependent?: boolean }[];
};
// Whether an unmanaged key can be adopted, from the adoption plan. A blocker groups one provider's
// models of one kind ("" provider = the whole key): undiscovered = Bifrost does not list them,
// unsaved = discovered but no Registry card, all-providers, dynamic = the provider row allows every model ("*")
// or a regex (kept in Bifrost or replaced by a native edit), other = any other reason (see `reasons`,
// as sent). count = models.length for the first two kinds, reasons.length for the others.
// kept: the adoption preview was asked to keep this provider in Bifrost; the blocker is still listed but blocks nothing.
// with: the other providers of a collision; providerDisabled: Bifrost lists no model of the provider (undiscovered only).
export type ReadinessBlocker = {
  provider: string;
  kind: "undiscovered" | "unsaved" | "all-providers" | "dynamic" | "collision" | "other";
  count: number;
  models: string[];
  reasons?: string[];
  kept?: boolean;
  with?: string[];
  providerDisabled?: boolean;
};
export type Readiness = { state: "ready" | "blocked" | "empty"; blockers: ReadinessBlocker[] };
// pendingAccessSelection: saved models withheld until an access is chosen, with their candidate access IDs.
// permissions: absent when Bifrost's answer carried no provider rows (not read yet).
// readiness: only for unmanaged keys whose permissions were read.
export type Key = {
  id: string;
  name: string;
  client: string;
  active: boolean;
  policy: Policy;
  observed: string[] | null;
  readError: boolean;
  revision: number;
  managed?: boolean;
  publication?: Publication;
  pendingAccessSelection?: Record<string, string[]>;
  permissions?: NativePermissions;
  readiness?: Readiness;
};
export type Demo = { models: Model[]; groups: Group[]; keys: Key[]; campaigns: Campaign[] };
export type Campaign = {
  id: string;
  model: string;
  provider: string;
  accessId: string;
  scenario: string;
  outcome: "Pass" | "Fail" | "Inconclusive" | "Not run";
  date: string;
  note: string;
};

export const copy = <T>(value: T): T => structuredClone(value);
// One access: the same native model at the same provider. A catalogue access names it `model`.
type NativeAccess = { provider: string; nativeModel?: string; model?: string };
export const sameAccess = (a: NativeAccess, b: NativeAccess) =>
  a.provider === b.provider && (a.nativeModel ?? a.model) === (b.nativeModel ?? b.model);
// The "To add" shelf: discovered models minus the accesses saved cards hold. A remainder keeps its
// discovered ID, even when a saved card has the same ID: offered, never merged.
export const unsavedModels = (registered: Model[], discovered: Model[]) => {
  const saved = registered.flatMap(model => model.accesses);
  const seen = new Set<string>();
  return discovered.flatMap(model => {
    if (seen.has(model.id)) return [];
    seen.add(model.id);
    const accesses = model.accesses.filter(access => !saved.some(row => sameAccess(row, access)));
    return accesses.length ? [{ ...model, accesses }] : [];
  });
};
export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const members = (policy: Policy, groups: Group[]) =>
  [...new Set([...groups.filter(g => policy.groups.includes(g.id)).flatMap(g => g.members), ...policy.added])].filter(
    id => !policy.excluded.includes(id),
  );
export const origin = (id: string, policy: Policy, groups: Group[]) =>
  groups.filter(g => policy.groups.includes(g.id) && g.members.includes(id)).map(g => g.name);
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
// The IDs a key exposes for a model, by its naming: the common ID, its provider/model access IDs, or both.
export const namedIds = (naming: Policy["naming"], modelId: string, accessIds: string[]) =>
  naming === "model" ? [modelId] : naming === "provider/model" ? accessIds : [modelId, ...accessIds];
export const exposed = (policy: Policy, groups: Group[], models: Model[]) =>
  members(policy, groups).flatMap(id => {
    const model = models.find(m => m.id === id);
    if (!model) return [];
    const { known } = retainedAccesses(model, policy);
    if (!known.length) return [];
    const prefixed = known.map(accessId => model.accesses.find(a => a.id === accessId)?.id || accessId);
    return namedIds(policy.naming, model.id, prefixed);
  });
export const delta = (before: string[], after: string[]) => ({
  added: after.filter(x => !before.includes(x)),
  removed: before.filter(x => !after.includes(x)),
});
export const keyImpact = (keys: Key[], oldGroups: Group[], nextGroups: Group[], models: Model[]) =>
  keys
    .map(key => ({
      key,
      before: exposed(key.policy, oldGroups, models),
      after: exposed(key.policy, nextGroups, models),
    }))
    .filter(row => !same(row.before, row.after));
// An empty value and "Unknown" are one absence: knownValue reads it as "", creatorKey (filters and
// labels) as "Unknown".
export const knownValue = (value?: unknown) =>
  typeof value === "string" && value.trim() && value !== "Unknown" ? value : "";
export const creatorKey = (creator?: unknown) => knownValue(creator) || "Unknown";
// A display name shared by several items gains their detail (an ID), so actions named after it stay distinct.
export function distinctLabels<T>(items: T[], name: (item: T) => string, detail: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(name(item), (counts.get(name(item)) ?? 0) + 1);
  return (item: T) => ((counts.get(name(item)) ?? 0) > 1 ? `${name(item)} (${detail(item)})` : name(item));
}
// routes: exact "provider/native" accesses, one per line (a key's unsaved models); empty = no restriction.
export type ModelFilters = {
  search: string;
  creator: string;
  provider: string;
  task: string;
  input: string;
  output: string;
  capability: string;
  routes: string;
};
export const emptyModelFilters: ModelFilters = {
  search: "",
  creator: "",
  provider: "",
  task: "",
  input: "",
  output: "",
  capability: "",
  routes: "",
};
export const filterModels = (models: Model[], filters: ModelFilters) =>
  models.filter(model => {
    const query = filters.search.trim().toLocaleLowerCase();
    const searchable = [
      model.name,
      model.id,
      model.creator,
      model.family,
      ...model.accesses.flatMap(access => [access.provider, access.id]),
    ]
      .join(" ")
      .toLocaleLowerCase();
    const routes = filters.routes ? filters.routes.split("\n") : [];
    return (
      (!query || searchable.includes(query)) &&
      (!routes.length || model.accesses.some(access => routes.includes(`${access.provider}/${access.nativeModel}`))) &&
      (!filters.creator || creatorKey(model.creator) === filters.creator) &&
      (!filters.provider || model.accesses.some(access => access.provider === filters.provider)) &&
      (!filters.task || model.tasks.includes(filters.task)) &&
      (!filters.input || model.inputModalities.includes(filters.input)) &&
      (!filters.output || model.outputModalities.includes(filters.output)) &&
      (!filters.capability ||
        (model.capabilities[filters.capability] && model.capabilities[filters.capability] !== "Unknown"))
    );
  });
export const modelImpact = (key: Key, oldGroups: Group[], nextGroups: Group[]) => {
  const before = members(key.policy, oldGroups);
  const after = members(key.policy, nextGroups);
  return {
    added: after.filter(id => !before.includes(id)),
    removed: before.filter(id => !after.includes(id)),
    unchanged: after.filter(id => before.includes(id)),
    exclusions: key.policy.excluded,
  };
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
