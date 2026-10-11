import { exposed, members, type Group, type Key, type Model } from "../../domain/registry";
import { readinessState, type ReadinessState } from "./key-readiness";

// The worklist: what can be adopted now, then what is blocked, then what is empty, then what is done.
const worklist: ReadinessState[] = ["ready", "blocked", "unknown", "empty", "managed"];

export function filterKeys(keys: Key[], groups: Group[], models: Model[], search: string, groupFilter: string, clientFilter: string, sort: string, readinessFilter = "all") {
  const query = search.trim().toLocaleLowerCase();
  return keys.filter(key => {
    const selected = members(key.policy, groups);
    const groupNames = key.policy.groups.map(id => groups.find(group => group.id === id)?.name || id);
    const modelNames = selected.map(id => models.find(model => model.id === id)?.name || id);
    const haystack = [key.name, key.client, key.id, ...groupNames, ...modelNames, ...exposed(key.policy, groups, models)].join(" ").toLocaleLowerCase();
    return haystack.includes(query) && (groupFilter === "all" || key.policy.groups.includes(groupFilter)) && (clientFilter === "all" || key.client === clientFilter) && (readinessFilter === "all" || readinessState(key) === readinessFilter);
  }).sort((a, b) => sort === "readiness" ? worklist.indexOf(readinessState(a)) - worklist.indexOf(readinessState(b)) || a.name.localeCompare(b.name) : sort === "client" ? a.client.localeCompare(b.client) || a.name.localeCompare(b.name) : sort === "models" ? members(b.policy, groups).length - members(a.policy, groups).length : sort === "status" ? Number(b.active) - Number(a.active) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
}
