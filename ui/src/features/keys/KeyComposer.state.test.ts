import { fixture } from "../../dev/fixtures/registry";
import { emptyModelFilters, exposed, filterModels, members, type Policy } from "../../domain/registry";
import { accessOrigin, keyComposition, modelOrigin, preserveAdoptionDraft, toggleAccess, toggleVisibleModels } from "./KeyComposer.state";

const groups = fixture.groups.slice(0, 2);
const models = fixture.models;
const policy: Policy = { groups: [groups[0].id], added: [models[3].id], excluded: [models[0].id], naming: "both" };
const visible = filterModels(models, { ...emptyModelFilters, search: models[1].id }).map(model => model.id);
const changed = toggleVisibleModels(policy, visible, [], models, groups);
if (!changed.added.includes(models[3].id) || !changed.excluded.includes(models[0].id)) throw new Error("Visible selection changed models outside the filter");
if (members(changed, groups).includes(models[1].id)) throw new Error("A deselected inherited model stayed selected");
if (!modelOrigin(models[0].id, policy, groups).excluded || !modelOrigin(models[0].id, policy, groups).inherited.length) throw new Error("Local exclusion origin is missing");
const composition = keyComposition(policy, groups, models);
if (!composition.selected.includes(models[3].id) || !composition.excluded.includes(models[0].id) || !composition.ids.length) throw new Error("Key composition summary does not match its policy");
const adopted: Policy = { groups: [], added: [models[0].id], excluded: [], naming: "provider/model" };
const staged: Policy = { groups: [groups[1].id], added: [models[1].id], excluded: [models[2].id], naming: "both" };
const rebased = preserveAdoptionDraft(adopted, staged);
if (!rebased.added.includes(models[0].id) || !rebased.added.includes(models[1].id) || !rebased.groups.includes(groups[1].id) || !rebased.excluded.includes(models[2].id) || rebased.naming !== "both") throw new Error("Adoption did not retain native selection and the staged draft");

// Access selection: gpt-5 has two accesses (openai/gpt-5 and azure/gpt-5).
const gpt5 = models.find(m => m.id === "gpt-5")!;
if (gpt5.accesses.length !== 2) throw new Error("Fixture expects two gpt-5 accesses");
const gpt5Policy: Policy = { groups: [groups[0].id], added: [], excluded: [], naming: "both", accessSelection: { "gpt-5": { added: [gpt5.accesses[0].id], excluded: [gpt5.accesses[1].id] } } };
const gpt5Composition = keyComposition(gpt5Policy, groups, models);
const gpt5State = gpt5Composition.byModel.get("gpt-5");
if (!gpt5State || gpt5State.retained.length !== 1 || gpt5State.excluded.length !== 1) throw new Error("Access selection did not split gpt-5 accesses");
if (accessOrigin(gpt5.accesses[0].id, "gpt-5", gpt5Policy, groups) !== "added") throw new Error("Access in added list should show added origin");
if (accessOrigin(gpt5.accesses[1].id, "gpt-5", gpt5Policy, groups) !== "excluded") throw new Error("Excluded access should show excluded origin");
if (!exposed(gpt5Policy, groups, models).includes("openai/gpt-5") || exposed(gpt5Policy, groups, models).includes("azure/gpt-5")) throw new Error("Exposed IDs must reflect access selection");

// Toggle an access: excluding one access of a two-access model creates accessSelection.
const toggled = toggleAccess({ groups: [groups[0].id], added: [], excluded: [], naming: "both" }, "gpt-5", gpt5.accesses[1].id, models, groups);
if (!toggled.accessSelection?.["gpt-5"].excluded.includes(gpt5.accesses[1].id)) throw new Error("Toggle did not exclude the access");
if (toggled.accessSelection["gpt-5"].added.length !== 0) throw new Error("Toggle should not add accesses");
const toggledIds = exposed(toggled, groups, models);
if (!toggledIds.includes("openai/gpt-5") || toggledIds.includes("azure/gpt-5")) throw new Error("Toggled exposure is wrong");

// Re-include the same access removes the exclusion; because both accesses are retained, the selector is cleaned up.
const restored = toggleAccess(toggled, "gpt-5", gpt5.accesses[1].id, models, groups);
if (restored.accessSelection?.["gpt-5"]) throw new Error("Restoring all accesses should remove accessSelection");
if (exposed(restored, groups, models).length !== exposed({ groups: [groups[0].id], added: [], excluded: [], naming: "both" }, groups, models).length) throw new Error("Restored policy should expose the same IDs as no selection");

// Access selection origins for a directly added model.
const addedPolicy: Policy = { groups: [], added: ["gpt-5"], excluded: [], naming: "both", accessSelection: { "gpt-5": { added: [gpt5.accesses[0].id], excluded: [] } } };
if (accessOrigin(gpt5.accesses[0].id, "gpt-5", addedPolicy, groups) !== "added") throw new Error("Added model access should show added origin");

// Access selection merged during adoption preserves both sets.
const adoptedWithAccess: Policy = { groups: [], added: ["gpt-5"], excluded: [], naming: "model", accessSelection: { "gpt-5": { added: [gpt5.accesses[0].id], excluded: [] } } };
const stagedWithAccess: Policy = { groups: [], added: ["gpt-5"], excluded: [], naming: "model", accessSelection: { "gpt-5": { added: [gpt5.accesses[1].id], excluded: [] } } };
const merged = preserveAdoptionDraft(adoptedWithAccess, stagedWithAccess);
if (!merged.accessSelection?.["gpt-5"].added.includes(gpt5.accesses[0].id) || !merged.accessSelection["gpt-5"].added.includes(gpt5.accesses[1].id)) throw new Error("Adoption draft did not merge access selections");

// Unknown added access is surfaced by keyComposition and ignored by exposed.
const unknownPolicy: Policy = { groups: [groups[0].id], added: [], excluded: [], naming: "both", accessSelection: { "gpt-5": { added: ["unknown/access"], excluded: [] } } };
const unknownComposition = keyComposition(unknownPolicy, groups, models);
const unknownState = unknownComposition.byModel.get("gpt-5");
if (!unknownState || unknownState.unknown.length !== 1 || unknownState.unknown[0] !== "unknown/access") throw new Error("Unknown added access not exposed");
if (exposed(unknownPolicy, groups, models).includes("unknown/access")) throw new Error("Unknown access must not be exposed");

console.log("Key composer state checks passed");
