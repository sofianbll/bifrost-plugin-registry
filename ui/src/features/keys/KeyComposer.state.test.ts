import { fixture } from "../../dev/fixtures/registry";
import { emptyModelFilters, exposed, filterModels, members, same, type Key, type Policy } from "../../domain/registry";
import { accessOrigin, aliasStatus, keyBaseline, keyComposition, modelOrigin, preserveAdoptionDraft, toggleAccess, toggleVisibleModels } from "./KeyComposer.state";

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

// Alias status: shared when several retained accesses share an alias without Prefer, pinned with Prefer, mono otherwise.
const gpt5Group = { id: "gpt5-group", name: "GPT-5", description: "", members: ["gpt-5"] };
const sharedPolicy: Policy = { groups: [gpt5Group.id], added: [], excluded: [], naming: "model" };
if (aliasStatus(sharedPolicy, [gpt5Group], models)["gpt-5"].status !== "shared") throw new Error("Expected shared alias status for gpt-5");
const pinnedPolicy: Policy = { ...sharedPolicy, prefer: { "gpt-5": "gpt-5" } };
if (aliasStatus(pinnedPolicy, [gpt5Group], models)["gpt-5"].status !== "pinned") throw new Error("Expected pinned alias status");
const monoPolicy: Policy = { groups: [gpt5Group.id], added: [], excluded: [], naming: "model", accessSelection: { "gpt-5": { added: [gpt5.accesses[0].id], excluded: [gpt5.accesses[1].id] } } };
if (aliasStatus(monoPolicy, [gpt5Group], models)["gpt-5"].status !== "mono") throw new Error("Expected mono alias status");
if (Object.keys(aliasStatus({ ...sharedPolicy, naming: "provider/model" }, [gpt5Group], models)).length !== 0) throw new Error("Provider/model naming should not report alias status");

// Prefer and status keys must be the public alias, not the internal model id.
const aliasedModel = { ...gpt5, id: "registry-gpt-5", alias: "gpt-5" };
const aliasedModels = models.map(m => m.id === "gpt-5" ? aliasedModel : m);
const aliasedGroup = { ...gpt5Group, members: ["registry-gpt-5"] };
const aliasedPinned: Policy = { ...sharedPolicy, groups: [aliasedGroup.id], prefer: { "gpt-5": "registry-gpt-5" } };
const aliasedStatus = aliasStatus(aliasedPinned, [aliasedGroup], aliasedModels)["gpt-5"];
if (aliasedStatus?.status !== "pinned" || aliasedStatus?.count !== 2) throw new Error("Expected pinned status keyed by alias when internal id differs");
const aliasedShared = aliasStatus({ ...sharedPolicy, groups: [aliasedGroup.id] }, [aliasedGroup], aliasedModels)["gpt-5"];
if (aliasedShared?.status !== "shared" || aliasedShared?.count !== 2) throw new Error("Expected shared status keyed by alias when internal id differs");

// #69: Review compares the draft with the last verified readback, else the last published plan,
// else what Bifrost allows today (expressed in the key's ID format).
const planned: Key = { ...fixture.keys[0], managed: true, policy: { groups: [groups[0].id], added: [], excluded: [], naming: "provider/model" } };
const plannedBaseline = keyBaseline(planned, groups, models);
if (plannedBaseline.source !== "plan" || !same(plannedBaseline.ids, exposed(planned.policy, groups, models))) throw new Error("Without readback the baseline is the last published plan");
const verifiedBaseline = keyBaseline({ ...planned, publication: { state: "verified", revision: "r", checkedAt: "", expected: [], actual: ["openai/gpt-5"], missing: [], unexpected: [] } }, groups, models);
if (verifiedBaseline.source !== "readback" || !same(verifiedBaseline.ids, ["openai/gpt-5"])) throw new Error("A verified readback is the preferred baseline");
const nativeBaseline = keyBaseline({ ...planned, policy: { groups: [], added: [], excluded: [], naming: "both" }, permissions: { allProviders: false, providers: [{ provider: "openai", allModels: false, models: ["gpt-5"] }] } }, groups, models);
if (nativeBaseline.source !== "native" || !same(nativeBaseline.ids, ["gpt-5", "openai/gpt-5"])) throw new Error(`Without a plan the baseline is the current Bifrost permissions: ${JSON.stringify(nativeBaseline)}`);

console.log("Key composer state checks passed");
