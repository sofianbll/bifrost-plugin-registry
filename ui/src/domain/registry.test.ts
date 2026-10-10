import { fixture } from "../dev/fixtures/registry";
import { catalogModels, copy, delta, exposed, filterModels, keyImpact, members, modelImpact, toggleModel, emptyModelFilters } from "./registry";

const assert = (condition: boolean) => { if (!condition) throw Error("Demo state check failed"); };
const deepEqual = (a: unknown, b: unknown) => assert(JSON.stringify(a) === JSON.stringify(b));

const state = copy(fixture);
const discovered = { ...state.models[0], name: "Discovery label", summary: "Unreviewed metadata" };
deepEqual(catalogModels([state.models[0]], [discovered, state.models[1], state.models[1]]).map(m => m.id), [state.models[0].id, state.models[1].id]);
deepEqual(catalogModels([state.models[0]], [discovered]).find(m => m.id === discovered.id), state.models[0]);
const additionalAccess = { provider: "second-provider", id: "second-provider/gpt-5", nativeModel: "native-gpt-5", route: "Direct provider", status: "Configured" as const };
const expandedDiscovery = { ...discovered, accesses: [...discovered.accesses, additionalAccess] };
// A discovered access the saved card does not hold is offered beside it, never merged into it.
const [savedCard, offered] = catalogModels([state.models[0]], [expandedDiscovery]);
deepEqual(savedCard, state.models[0]);
deepEqual(offered.accesses, [additionalAccess]);
assert(offered.id === state.models[0].id);
// An access already saved under another card ID is not offered again.
deepEqual(catalogModels([state.models[1]], [{ ...state.models[1], id: "other-id" }]).map(m => m.id), [state.models[1].id]);
assert(state.models[0].accesses.length === 2);
assert(state.campaigns.every(c => state.models.find(m => m.id === c.model)?.accesses.some(a => a.provider === c.provider && a.id === c.accessId)));
const hermes = state.keys[0];
const witness = state.keys[1];
hermes.policy = toggleModel(hermes.policy, "claude-sonnet-4", state.groups);
hermes.policy = toggleModel(hermes.policy, "gemini-2.5-pro", state.groups);
deepEqual(members(hermes.policy, state.groups), ["gpt-5", "gpt-5-mini", "gemini-2.5-pro"]);
deepEqual(members(witness.policy, state.groups), ["gpt-5", "claude-sonnet-4", "gpt-5-mini"]);
const nextGroups = copy(state.groups);
nextGroups[0].members.push("kimi-k2");
deepEqual(keyImpact(state.keys, state.groups, nextGroups, state.models).map(x => x.key.id), ["hermes", "witness"]);
assert(!exposed(hermes.policy, nextGroups, state.models).includes("claude-sonnet-4"));
deepEqual(delta(["a", "b"], ["b", "c"]), { added: ["c"], removed: ["a"] });
deepEqual(filterModels(state.models, { ...emptyModelFilters, search: "azure/gpt-5" }).map(m => m.id), ["gpt-5"]);
deepEqual(filterModels(state.models, { ...emptyModelFilters, creator: "OpenAI", provider: "azure" }).map(m => m.id), ["gpt-5"]);
deepEqual(filterModels(state.models, { ...emptyModelFilters, input: "Image", task: "Reasoning" }).map(m => m.id), ["gpt-5", "claude-sonnet-4", "gemini-2.5-pro", "claude-opus-4"]);
deepEqual(modelImpact(hermes, state.groups, nextGroups), { added: ["kimi-k2"], removed: [], unchanged: ["gpt-5", "gpt-5-mini", "gemini-2.5-pro"], exclusions: ["claude-sonnet-4"] });
assert(state.models.every(model => model.creator && model.family && model.inputModalities.length && model.outputModalities.length && model.tasks.length));
console.log("Demo state checks passed");
