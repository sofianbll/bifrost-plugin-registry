import { copy, delta, exposed, fixture, keyImpact, members, toggleModel } from "./demo";

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
console.log("Demo state checks passed");
