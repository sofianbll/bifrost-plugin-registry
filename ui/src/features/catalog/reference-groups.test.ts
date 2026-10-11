import { attentionOf, cardEntries, cardsHolding, filterReferenceGroups, filterReferenceModels, groupReferenceModels, sectionsOf, sharedReferenceFacts, shownCount, sortItems } from "./reference-groups";
import type { Catalog } from "./catalog-api";
import { emptyModelFilters, type Model } from "../../domain/registry";

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

// A saved card holds only its saved accesses; a discovered access of the same reference, even under
// the card's own ID, is available beside it, not in it.
const saved = models[0];
const offered = { ...models[1], id: saved.id, accesses: [{ ...models[1].accesses[0], id: `beta/${saved.id}` }] };
const sharedGroup = groupReferenceModels([saved, offered], { ...catalog, accesses: catalog.accesses.map(access => ({ ...access, referenceId: "ref/shared" })) })[0];
const split = cardEntries(sharedGroup, [saved]);
if (split.card.map(entry => entry.access?.provider).join(",") !== "alpha" || split.available.map(entry => entry.access?.provider).join(",") !== "beta") throw new Error("A discovered access was counted in the saved card");
if (cardEntries(sharedGroup, []).card.length !== 0) throw new Error("An unsaved group claimed a card");
console.log("Reference groups keep saved and available accesses apart: OK");

// In Registry shows one tile per saved card: two cards on one reference stay apart, and a card
// whose accesses link to two references stays whole. Reference grouping still folds and splits them.
const twoReferences: Model = { ...model("alias-five", "gamma", "native-c"), accesses: [model("alias-five", "gamma", "native-c").accesses[0], model("alias-five", "delta", "native-d").accesses[0]] };
const linkedTo = ["ref/shared", "ref/shared", "ref/other", "ref/shared"];
const cardCatalog: Catalog = { ...splitCatalog, accesses: splitCatalog.accesses.map((access, index) => ({ ...access, referenceId: linkedTo[index] })) };
const cards = [models[0], models[1], twoReferences];
if (groupReferenceModels(cards, cardCatalog).length !== 2) throw new Error("Reference grouping no longer folds by reference");
const tiles = groupReferenceModels(cards, cardCatalog, "", true);
if (tiles.map(group => `${group.key}=${group.entries.length}`).join(",") !== "card:alias-one=1,card:alias-two=1,card:alias-five=2") throw new Error(`Saved cards folded or split: ${tiles.map(group => group.key)}`);
if (tiles[2].reference?.id !== "ref/other") throw new Error("A saved card lost its reference");
if (filterReferenceModels(cards, cardCatalog, { ...emptyModelFilters, search: "same display name" }, true).length !== 3) throw new Error("Card search hid a saved card");
console.log("Saved cards are one tile each, whatever their references: OK");

const facts = { ...models[0], summary: "shared", inputModalities: ["Image", "Text"], outputModalities: ["Text"], capabilities: { Vision: "Declared", Reasoning: "Unknown" } } as Model;
const common = (other: Model) => sharedReferenceFacts({ key: "shared", entries: [{ model: facts }, { model: other }] });
if (Object.values(common({ ...facts })).some(value => !value)) throw new Error("Identical reference facts were hidden");
if (common({ ...facts, inputModalities: ["Text"] }).modalities || common({ ...facts, inputModalities: ["Text"] }).capabilities) throw new Error("Different modalities were presented as shared facts");
if (common({ ...facts, capabilities: { Vision: "Declared", Reasoning: "Declared" } }).capabilities) throw new Error("Different capabilities were presented as shared facts");
if (!common({ ...facts, capabilities: { Reasoning: "Unknown", Vision: "Declared" } }).capabilities) throw new Error("Capability key order changed the facts");
console.log("Reference summaries require shared facts across accesses: OK");

// A To add tile belongs to the saved cards holding an access of its reference (one, or several when
// cards share a reference); a card gets a badge only for what needs attention.
const pair = groupReferenceModels([models[0], models[1]], cardCatalog)[0];
if (cardsHolding(sharedGroup, [saved, models[3]]).map(card => card.id).join(",") !== saved.id) throw new Error("A card holding none of the group's accesses was offered");
if (cardsHolding(pair, [models[0], models[1], models[3]]).map(card => card.id).join(",") !== "alias-one,alias-two") throw new Error("Cards sharing a reference were not all offered");
if (cardsHolding(pair, []).length) throw new Error("A group without a saved card was offered a card");
console.log("To add tiles find the saved cards they could join: OK");

const kinds = (group: Parameters<typeof attentionOf>[0], available: number) => JSON.stringify(attentionOf(group, available));
if (kinds(pair, 0) !== "[]") throw new Error("An ordinary saved card got a badge");
if (kinds(pair, 2) !== JSON.stringify([{ kind: "available", count: 2 }])) throw new Error("Available accesses were not announced");
if (kinds(groupReferenceModels([models[2]], catalog)[0], 0) !== JSON.stringify([{ kind: "no-reference" }])) throw new Error("A card without reference was not announced");
if (kinds(groupReferenceModels([models[2]], catalog)[0], 1) !== JSON.stringify([{ kind: "available", count: 1 }, { kind: "no-reference" }])) throw new Error("Attention badges lost their order");
const guessed = [{ ...models[2], creatorSource: "inferred" as const }];
if (kinds(groupReferenceModels(guessed, catalog)[0], 1) !== JSON.stringify([{ kind: "available", count: 1 }, { kind: "no-reference" }, { kind: "inferred-creator" }])) throw new Error("An inferred creator was not announced after the other badges");
if (kinds(groupReferenceModels([{ ...models[0], creatorSource: "inferred" as const }], catalog)[0], 0) !== JSON.stringify([{ kind: "inferred-creator" }])) throw new Error("An inferred creator needs no missing reference to be announced");
console.log("Saved cards get attention badges only: OK");

// The To add count counts the same tiles before and after the catalogue loads: without it, grouping
// follows the reference each access already carries.
const carried = models.map((row, index) => ({ ...row, accesses: [{ ...row.accesses[0], referenceId: linkedTo[index] }] }));
if (groupReferenceModels(carried, null).length !== 2 || groupReferenceModels(carried, cardCatalog).length !== 2) throw new Error("The tile count moved when the catalogue arrived");
if (groupReferenceModels(carried, null).map(group => group.entries.length).join(",") !== "3,1") throw new Error("Grouping without the catalogue lost accesses");
console.log("Tiles are counted the same way before and after the catalogue loads: OK");

// Sort: name, creator, provider or recently added (the last saved card first); an unknown creator or
// provider goes last, ties fall back to the name, and the list is never mutated.
type Row = { name: string; creator: string; provider: string };
const rows: Row[] = [{ name: "Zed", creator: "Acme", provider: "b" }, { name: "alpha", creator: "", provider: "a" }, { name: "Mid", creator: "Acme", provider: "" }];
const by = { name: (row: Row) => row.name, creator: (row: Row) => row.creator, provider: (row: Row) => row.provider };
const order = (sort: Parameters<typeof sortItems>[1]) => sortItems(rows, sort, by).map(row => row.name).join(",");
if (order("default") !== "Zed,alpha,Mid") throw new Error("Default order changed the list");
if (order("name") !== "alpha,Mid,Zed") throw new Error(`Name sort: ${order("name")}`);
if (order("creator") !== "Mid,Zed,alpha") throw new Error(`Creator sort: ${order("creator")}`);
if (order("provider") !== "alpha,Zed,Mid") throw new Error(`Provider sort: ${order("provider")}`);
if (order("recent") !== "Mid,alpha,Zed") throw new Error(`Recently added sort: ${order("recent")}`);
if (rows.map(row => row.name).join(",") !== "Zed,alpha,Mid") throw new Error("Sorting mutated the list");
console.log("Sorting by name, creator, provider and recently added: OK");

// Sections cover the whole list: an item sits under each of its keys (counted once by the caller),
// sections are sorted by label, shelves come after the others and "last" sections at the very end.
type Card = { name: string; providers: string[] };
const shelfCards: Card[] = [{ name: "shared", providers: ["claude", "codex"] }, { name: "solo", providers: ["codex"] }, { name: "routed", providers: ["openrouter"] }, { name: "free", providers: [] }];
const sections = sectionsOf(shelfCards, card => card.providers.length ? card.providers : [""], key => ({ label: key || "Unknown", shelf: key === "openrouter", last: key === "" }));
if (sections.map(section => `${section.label}:${section.items.map(card => card.name)}`).join("|") !== "claude:shared|codex:shared,solo|openrouter:routed|Unknown:free") throw new Error(`Sections: ${sections.map(section => section.label)}`);
if (sections.map(section => section.shelf).join() !== "false,false,true,false") throw new Error("Only the aggregator is a shelf");
if (new Set(sections.flatMap(section => section.items)).size !== shelfCards.length) throw new Error("A card went missing from the sections");
console.log("Sections hold every card under each of its providers, sorted, shelves after: OK");

// The count line says where the cards not shown are: in a closed shelf, or behind "Show more". A card under
// two providers counts once, and the line says so.
const [claude, codex, openrouter, unknown] = sections;
const counted = shownCount([{ ...claude, open: true, shown: claude.items }, { ...codex, open: true, shown: [] }, { ...openrouter, open: false, shown: [] }, { ...unknown, open: true, shown: unknown.items }]);
if (JSON.stringify(counted) !== JSON.stringify({ total: 4, shown: 2, shelved: 1, paged: 1, repeated: true })) throw new Error(`Count: ${JSON.stringify(counted)}`);
const single = shownCount([{ items: ["a", "b"], open: true, shown: ["a", "b"] }]);
if (JSON.stringify(single) !== JSON.stringify({ total: 2, shown: 2, shelved: 0, paged: 0, repeated: false })) throw new Error(`Count: ${JSON.stringify(single)}`);
console.log("The count line splits what is hidden between shelves and Show more: OK");
