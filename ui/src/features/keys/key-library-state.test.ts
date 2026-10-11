import { fixture } from "../../dev/fixtures/registry";
import { filterKeys } from "./key-library-state";

const { groups, models } = fixture;
const makeKey = (id: string, name: string, groupIds: string[], active = true) => ({ ...fixture.keys[0], id, name, client: id.startsWith("a") ? "alpha" : "beta", active, policy: { groups: groupIds, added: [], excluded: [], naming: "model" as const } });
const keys = [makeKey("a1", "Alpha", [groups[0].id]), makeKey("b1", "Beta", [groups[1].id], false), makeKey("b2", "Gamma", [])];
if (filterKeys(keys, groups, models, groups[0].name, "all", "all", "name").map(key => key.id).join() !== "a1") throw new Error("Group search should find a key by its inherited group");
if (filterKeys(keys, groups, models, "", "all", "alpha", "name").map(key => key.id).join() !== "a1") throw new Error("Client filtering should retain only matching keys");
if (filterKeys(keys, groups, models, "", "all", "all", "status").map(key => key.id).join() !== "a1,b2,b1") throw new Error("Status sorting should put active keys first");

// #87: the Keys page triages unmanaged keys by readiness; managed keys are their own bucket.
const triage = [
  { ...makeKey("a2", "Codex", []), managed: false, readiness: { state: "ready" as const, blockers: [] } },
  { ...makeKey("a3", "Hermes", []), managed: false, readiness: { state: "blocked" as const, blockers: [] } },
  { ...makeKey("b3", "Blank", []), managed: false, readiness: { state: "empty" as const, blockers: [] } },
  { ...makeKey("b4", "Unread", []), managed: false },
  { ...makeKey("b5", "Adopted", []), managed: true },
];
for (const [state, ids] of [["all", "b5,b3,a2,a3,b4"], ["ready", "a2"], ["blocked", "a3"], ["empty", "b3"], ["unknown", "b4"], ["managed", "b5"]] as const) {
  const shown = filterKeys(triage, groups, models, "", "all", "all", "name", state).map(key => key.id).join();
  if (shown !== ids) throw new Error(`Readiness filter ${state} should show ${ids}, got ${shown}`);
}
if (filterKeys(triage, groups, models, "", "all", "all", "name").length !== 5) throw new Error("Without a readiness filter every key stays");

// The default order is the worklist: ready, blocked, not read yet, empty, then managed keys; by name inside each.
const worklist = filterKeys([...triage, { ...makeKey("a4", "Zed", []), managed: false, readiness: { state: "ready" as const, blockers: [] } }], groups, models, "", "all", "all", "readiness").map(key => key.id).join();
if (worklist !== "a2,a4,a3,b4,b3,b5") throw new Error(`Readiness sorting should read ready, blocked, unknown, empty, managed, got ${worklist}`);
