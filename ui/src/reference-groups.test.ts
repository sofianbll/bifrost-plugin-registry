import { filterReferenceGroups, filterReferenceModels, groupReferenceModels } from "./reference-groups";
import type { Catalog } from "./catalog-api";
import { emptyModelFilters, type Model } from "./demo";

const model = (id: string, provider: string, nativeModel: string): Model => ({
  id, name: "Same display name", creator: "Unknown", family: "Unknown", inputModalities: [], outputModalities: [], tasks: [], kind: "Unknown", summary: "", context: "Unknown", capabilities: {},
  accesses: [{ provider, id: `${provider}/${id}`, nativeModel, route: "Direct provider", status: "Configured" }],
});
const models = [model("alias-one", "alpha", "native-a"), model("alias-two", "beta", "native-b"), model("alias-three", "gamma", "native-c"), model("alias-four", "delta", "native-d")];
const before = JSON.stringify(models);
const catalog: Catalog = {
  revision: "r1", sources: [], references: [{ id: "ref/shared", fields: { name: { value: "Shared reference", source: "models.dev", updatedAt: "2026-01-01", kind: "declared" } }, overrides: {} }],
  accesses: [
    { id: "alpha/native-a", provider: "alpha", model: "native-a", configured: true, referenceId: "ref/shared", fields: {}, overrides: {} },
    { id: "beta/native-b", provider: "beta", model: "native-b", configured: true, referenceId: "ref/shared", fields: {}, overrides: {} },
    { id: "gamma/native-c", provider: "gamma", model: "native-c", configured: true, fields: {}, overrides: {} },
    { id: "delta/native-d", provider: "delta", model: "native-d", configured: true, fields: {}, overrides: {} },
  ],
};
const groups = groupReferenceModels(models, catalog);
if (groups.length !== 3) throw new Error(`Expected 3 fiches, got ${groups.length}`);
const linked = groups.find(group => group.reference?.id === "ref/shared");
if (linked?.entries.length !== 2 || linked.entries.map(entry => entry.catalogAccess?.id).join(",") !== "alpha/native-a,beta/native-b") throw new Error("Exact linked accesses were not grouped");
if (!groups.some(group => group.key === "model:alias-three") || !groups.some(group => group.key === "model:alias-four")) throw new Error("Unmatched models were implicitly merged");
if (JSON.stringify(models) !== before || linked.entries.map(entry => entry.model.id).join(",") !== "alias-one,alias-two") throw new Error("Workspace model IDs changed");
console.log("Reference display grouping preserves exact access and workspace IDs: OK");

const multi = { ...models[0], accesses: [...models[0].accesses, ...models[1].accesses] };
const filtered = groupReferenceModels([multi], catalog, "alpha");
if (filtered.length !== 1 || filtered[0].entries.length !== 1 || filtered[0].entries[0].access?.provider !== "alpha" || multi.accesses.length !== 2) throw new Error("Provider filter leaked another access or changed the model");

catalog.references[0].fields = {
  name: { value: "Imported shared reference QA", source: "manual", updatedAt: "2026-01-01", kind: "declared" },
  creator: { value: "Reference creator", source: "manual", updatedAt: "2026-01-01", kind: "declared" },
  family: { value: "Reference family", source: "manual", updatedAt: "2026-01-01", kind: "declared" },
};
for (const search of ["shared reference", "ref/shared", "reference creator", "reference family"]) {
  const found = filterReferenceModels(models, catalog, { ...emptyModelFilters, search }).map(row => row.id);
  if (found.join(",") !== "alias-one,alias-two") throw new Error(`Reference search ${search} returned ${found}`);
}
const providerMatches = filterReferenceModels(models, catalog, { ...emptyModelFilters, search: "shared reference", provider: "alpha" });
if (providerMatches.map(row => row.id).join(",") !== "alias-one") throw new Error("Reference search ignored the provider filter");
const otherProvider = filterReferenceModels([multi], catalog, { ...emptyModelFilters, search: "shared reference", provider: "beta" });
if (otherProvider.length !== 1 || groupReferenceModels(otherProvider, catalog, "beta")[0].entries[0].access?.provider !== "beta") throw new Error("Reference search exposed the wrong provider access");
catalog.accesses[1].referenceId = undefined;
if (filterReferenceModels([multi], catalog, { ...emptyModelFilters, search: "shared reference", provider: "beta" }).length) throw new Error("Reference search leaked metadata from an excluded provider");
if (JSON.stringify(models) !== before) throw new Error("Reference search changed workspace models");
console.log("Reference name, ID, creator and family search preserves workspace IDs and provider scope: OK");

const splitCatalog: Catalog = {
  ...catalog,
  references: [...catalog.references, { id: "ref/other", fields: { name: { value: "Other reference", source: "manual", updatedAt: "2026-01-01", kind: "declared" } }, overrides: {} }],
  accesses: catalog.accesses.map(access => access.id === "beta/native-b" ? { ...access, referenceId: "ref/other" } : access),
};
const splitFilters = { ...emptyModelFilters, search: "shared reference" };
const splitGroups = filterReferenceGroups([multi], splitCatalog, splitFilters);
if (splitGroups.map(group => group.key).join(",") !== "reference:ref/shared" || splitGroups[0].entries[0].access?.provider !== "alpha") throw new Error("Reference search displayed a second reference from the same workspace model");
if (filterReferenceModels([multi], splitCatalog, splitFilters)[0] !== multi || multi.accesses.length !== 2) throw new Error("Reference search changed the editable workspace model");
if (filterReferenceGroups([multi], splitCatalog, { ...emptyModelFilters, search: "same display name" }).length !== 2) throw new Error("Workspace name search hid an access");
if (filterReferenceGroups([multi], splitCatalog, { ...splitFilters, provider: "beta" }).length) throw new Error("Reference search leaked an excluded provider's reference");
console.log("One workspace model with two references displays only the matching fiche: OK");
