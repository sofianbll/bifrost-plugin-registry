import { exposed, members, type Group, type Key, type Model } from "../../domain/registry";
import { readinessState, type ReadinessState } from "./key-readiness";

// Managed keys first, then the worklist: what can be adopted now, what is blocked, what is empty.
const worklist: ReadinessState[] = ["managed", "ready", "blocked", "unknown", "empty"];

// The Keys page shelves: managed keys, then "To adopt", then "Empty" (collapsed by default); each keeps the list's order.
export type KeyShelf = { id: "managed" | "adopt" | "empty"; keys: Key[] };
export function keyShelves(keys: Key[]): KeyShelf[] {
  const shelfOf = (key: Key): KeyShelf["id"] =>
    readinessState(key) === "managed" ? "managed" : readinessState(key) === "empty" ? "empty" : "adopt";
  return (["managed", "adopt", "empty"] as const)
    .map(id => ({ id, keys: keys.filter(key => shelfOf(key) === id) }))
    .filter(shelf => shelf.keys.length);
}

// Keys whose names differ only by case or surrounding spaces ("Elson - Poc", "Elson - POC").
export function nearDuplicates(keys: Key[]) {
  const norm = (key: Key) => key.name.trim().toLocaleLowerCase();
  return new Set(
    keys.filter(key => keys.some(other => other.id !== key.id && norm(other) === norm(key))).map(key => key.id),
  );
}

export function filterKeys(
  keys: Key[],
  groups: Group[],
  models: Model[],
  search: string,
  groupFilter: string,
  clientFilter: string,
  sort: string,
  readinessFilter = "all",
) {
  const query = search.trim().toLocaleLowerCase();
  return keys
    .filter(key => {
      const selected = members(key.policy, groups);
      const groupNames = key.policy.groups.map(id => groups.find(group => group.id === id)?.name || id);
      const modelNames = selected.map(id => models.find(model => model.id === id)?.name || id);
      const haystack = [
        key.name,
        key.client,
        key.id,
        ...groupNames,
        ...modelNames,
        ...exposed(key.policy, groups, models),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        haystack.includes(query) &&
        (groupFilter === "all" || key.policy.groups.includes(groupFilter)) &&
        (clientFilter === "all" || key.client === clientFilter) &&
        (readinessFilter === "all" || readinessState(key) === readinessFilter)
      );
    })
    .sort((a, b) =>
      sort === "readiness"
        ? worklist.indexOf(readinessState(a)) - worklist.indexOf(readinessState(b)) || a.name.localeCompare(b.name)
        : sort === "client"
          ? a.client.localeCompare(b.client) || a.name.localeCompare(b.name)
          : sort === "models"
            ? members(b.policy, groups).length - members(a.policy, groups).length
            : sort === "status"
              ? Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)
              : a.name.localeCompare(b.name),
    );
}
