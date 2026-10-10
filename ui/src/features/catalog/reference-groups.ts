import type { Catalog, CatalogAccess, CatalogRecord } from "./catalog-api";
import { emptyModelFilters, filterModels, type Access, type Model, type ModelFilters } from "../../domain/registry";

export type ReferenceGroup = {
  key: string;
  reference?: CatalogRecord;
  entries: { model: Model; access?: Access; catalogAccess?: CatalogAccess }[];
};

export function sharedReferenceFacts(group: ReferenceGroup) {
  const first = group.entries[0]?.model;
  if (!first) return { modalities: false, capabilities: false, summary: false };
  const sameList = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  const modalities = group.entries.every(({ model }) => sameList(model.inputModalities, first.inputModalities) && sameList(model.outputModalities, first.outputModalities));
  const capabilities = modalities && group.entries.every(({ model }) => Object.keys(model.capabilities).length === Object.keys(first.capabilities).length && Object.entries(first.capabilities).every(([key, value]) => model.capabilities[key] === value));
  const summary = group.entries.every(({ model }) => model.summary === first.summary);
  return { modalities, capabilities, summary };
}

export function groupReferenceModels(models: Model[], catalog: Catalog, provider = ""): ReferenceGroup[] {
  const references = new Map(catalog.references.map(reference => [reference.id, reference]));
  const accesses = new Map(catalog.accesses.map(access => [access.id, access]));
  const groups = new Map<string, ReferenceGroup>();
  for (const model of models) {
    for (const access of model.accesses.length ? model.accesses : [undefined]) {
      if (provider && access?.provider !== provider) continue;
      const nativeID = access?.nativeModel ? `${access.provider}/${access.nativeModel}` : access?.id;
      const candidate = nativeID ? accesses.get(nativeID) : undefined;
      const exact = candidate && access && candidate.provider === access.provider && (!access.nativeModel || candidate.model === access.nativeModel) ? candidate : undefined;
      const reference = exact?.referenceId ? references.get(exact.referenceId) : undefined;
      const key = reference ? `reference:${reference.id}` : `model:${model.id}`;
      const group = groups.get(key) ?? { key, reference, entries: [] };
      group.entries.push({ model, access, catalogAccess: exact });
      groups.set(key, group);
    }
  }
  return [...groups.values()];
}

// Entries a saved card holds (its ID and exact provider access) apart from the ones only available
// beside it: a matching ID or reference alone does not put an access in the card.
export function cardEntries(group: ReferenceGroup, saved: Model[]) {
  const held = ({ model, access }: ReferenceGroup["entries"][number]) => saved.some(card => card.id === model.id &&
    (!access || card.accesses.some(row => row.provider === access.provider && row.nativeModel === access.nativeModel)));
  return { card: group.entries.filter(held), available: group.entries.filter(entry => !held(entry)) };
}

export function filterReferenceGroups(models: Model[], catalog: Catalog, filters: ModelFilters): ReferenceGroup[] {
  const groups = groupReferenceModels(filterModels(models, { ...filters, search: "" }), catalog, filters.provider);
  const query = filters.search.trim().toLocaleLowerCase();
  if (!query) return groups;
  return groups.filter(group =>
    group.entries.some(({ model }) => filterModels([model], { ...emptyModelFilters, search: query }).length > 0) ||
    !!group.reference && [group.reference.id, group.reference.fields.name?.value, group.reference.fields.creator?.value, group.reference.fields.family?.value]
      .filter((value): value is string => typeof value === "string").join(" ").toLocaleLowerCase().includes(query));
}

export function filterReferenceModels(models: Model[], catalog: Catalog, filters: ModelFilters): Model[] {
  const visible = new Set(filterReferenceGroups(models, catalog, filters).flatMap(group => group.entries.map(entry => entry.model.id)));
  return models.filter(model => visible.has(model.id));
}
