import { copy, delta, exposed, filterModels, fixture, keyImpact, kindFor, members, modelImpact, toggleModel, emptyModelFilters } from "./demo";

const assert = (condition: boolean) => { if (!condition) throw Error("Demo state check failed"); };
const deepEqual = (a: unknown, b: unknown) => assert(JSON.stringify(a) === JSON.stringify(b));

const state = copy(fixture);
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
assert(kindFor({ tasks: ["Embeddings"], inputModalities: ["Text"], outputModalities: ["Vector"] }) === "Embedding");
assert(kindFor({ tasks: ["Chat"], inputModalities: ["Text", "Image"], outputModalities: ["Text"] }) === "Vision");
console.log("Demo state checks passed");
