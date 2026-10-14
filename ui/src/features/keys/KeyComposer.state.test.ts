import { fixture } from "../../dev/fixtures/registry";
import { emptyModelFilters, filterModels, members, type Policy } from "../../domain/registry";
import { keyComposition, modelOrigin, toggleVisibleModels } from "./KeyComposer.state";

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
