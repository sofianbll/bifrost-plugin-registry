import type { Catalog, CatalogAccess, CatalogRecord } from "./catalog-api";
import { emptyModelFilters, filterModels, type Access, type Model, type ModelFilters } from "./demo";

export type ReferenceGroup = {
  key: string;
  reference?: CatalogRecord;
  entries: { model: Model; access?: Access; catalogAccess?: CatalogAccess }[];
};

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
