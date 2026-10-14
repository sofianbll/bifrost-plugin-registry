import { fixture } from "../../dev/fixtures/registry";
import { filterKeys } from "./key-library-state";

const { groups, models } = fixture;
const makeKey = (id: string, name: string, groupIds: string[], active = true) => ({ ...fixture.keys[0], id, name, client: id.startsWith("a") ? "alpha" : "beta", active, policy: { groups: groupIds, added: [], excluded: [], naming: "model" as const } });
const keys = [makeKey("a1", "Alpha", [groups[0].id]), makeKey("b1", "Beta", [groups[1].id], false), makeKey("b2", "Gamma", [])];
if (filterKeys(keys, groups, models, groups[0].name, "all", "all", "name").map(key => key.id).join() !== "a1") throw new Error("Group search should find a key by its inherited group");
if (filterKeys(keys, groups, models, "", "all", "alpha", "name").map(key => key.id).join() !== "a1") throw new Error("Client filtering should retain only matching keys");
if (filterKeys(keys, groups, models, "", "all", "all", "status").map(key => key.id).join() !== "a1,b2,b1") throw new Error("Status sorting should put active keys first");
