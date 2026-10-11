import type { Catalog, CatalogAccess, CatalogRecord } from "./catalog-api";
import { emptyModelFilters, filterModels, knownValue, sameAccess, type Access, type Model, type ModelFilters } from "../../domain/registry";

export type ReferenceGroup = {
  key: string;
  reference?: CatalogRecord;
  entries: { model: Model; access?: Access; catalogAccess?: CatalogAccess }[];
};

// How the UI names a saved card: its saved name, unless empty or equal to the common ID (a slug);
// then the linked reference's name, else the ID. data.models keeps the saved name as is.
export function cardName(model: Model, catalog?: Catalog | null) {
  if (model.name.trim() && model.name !== model.id) return model.name;
  const referenceId = model.accesses.find(access => access.referenceId)?.referenceId;
  return knownValue(catalog?.references.find(reference => reference.id === referenceId)?.fields.name?.value) || model.id;
}

export function sharedReferenceFacts(group: ReferenceGroup) {
  const first = group.entries[0]?.model;
  if (!first) return { modalities: false, capabilities: false, summary: false };
  const sameList = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  const modalities = group.entries.every(({ model }) => sameList(model.inputModalities, first.inputModalities) && sameList(model.outputModalities, first.outputModalities));
  const capabilities = modalities && group.entries.every(({ model }) => Object.keys(model.capabilities).length === Object.keys(first.capabilities).length && Object.entries(first.capabilities).every(([key, value]) => model.capabilities[key] === value));
  const summary = group.entries.every(({ model }) => model.summary === first.summary);
  return { modalities, capabilities, summary };
}

// byCard: one group per model (In Registry, one tile per saved card) instead of one per reference.
export function groupReferenceModels(models: Model[], catalog: Catalog, provider = "", byCard = false): ReferenceGroup[] {
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
      const key = byCard ? `card:${model.id}` : reference ? `reference:${reference.id}` : `model:${model.id}`;
      const group = groups.get(key) ?? { key, reference, entries: [] };
      group.reference ??= reference;
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
    (!access || card.accesses.some(row => sameAccess(row, access))));
  return { card: group.entries.filter(held), available: group.entries.filter(entry => !held(entry)) };
}

// The saved cards holding an access of a whole (cross-scope) group: the cards a To add tile can join.
export const cardsHolding = (whole: ReferenceGroup, saved: Model[]) => saved.filter(card => cardEntries(whole, [card]).card.length);

// What makes a saved card worth a badge, in display order. A new kind (e.g. "inferred-creator") is one more entry here and one more label in the browser.
export type Attention = { kind: "available"; count: number } | { kind: "no-reference" };
export const attentionOf = (group: ReferenceGroup, available: number): Attention[] => [
  ...(available > 0 ? [{ kind: "available" as const, count: available }] : []),
  ...(group.reference ? [] : [{ kind: "no-reference" as const }]),
];

export function filterReferenceGroups(models: Model[], catalog: Catalog, filters: ModelFilters, byCard = false): ReferenceGroup[] {
  const groups = groupReferenceModels(filterModels(models, { ...filters, search: "" }), catalog, filters.provider, byCard);
  const query = filters.search.trim().toLocaleLowerCase();
  if (!query) return groups;
  return groups.filter(group =>
    group.entries.some(({ model }) => filterModels([model], { ...emptyModelFilters, search: query }).length > 0) ||
    !!group.reference && [group.reference.id, group.reference.fields.name?.value, group.reference.fields.creator?.value, group.reference.fields.family?.value]
      .filter((value): value is string => typeof value === "string").join(" ").toLocaleLowerCase().includes(query));
}

export function filterReferenceModels(models: Model[], catalog: Catalog, filters: ModelFilters, byCard = false): Model[] {
  const visible = new Set(filterReferenceGroups(models, catalog, filters, byCard).flatMap(group => group.entries.map(entry => entry.model.id)));
  return models.filter(model => visible.has(model.id));
}
