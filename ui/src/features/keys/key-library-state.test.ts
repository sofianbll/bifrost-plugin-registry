import { fixture } from "../../test/fixtures/registry";
import { filterKeys, keyShelves, nearDuplicates } from "./key-library-state";

const { groups, models } = fixture;
const makeKey = (id: string, name: string, groupIds: string[], active = true) => ({
  ...fixture.keys[0],
  id,
  name,
  client: id.startsWith("a") ? "alpha" : "beta",
  active,
  policy: { groups: groupIds, added: [], excluded: [], naming: "model" as const },
});
const keys = [
  makeKey("a1", "Alpha", [groups[0].id]),
  makeKey("b1", "Beta", [groups[1].id], false),
  makeKey("b2", "Gamma", []),
];
if (
  filterKeys(keys, groups, models, groups[0].name, "all", "all", "name")
    .map(key => key.id)
    .join() !== "a1"
)
  throw new Error("Group search should find a key by its inherited group");
if (
  filterKeys(keys, groups, models, "", "all", "alpha", "name")
    .map(key => key.id)
    .join() !== "a1"
)
  throw new Error("Client filtering should retain only matching keys");
if (
  filterKeys(keys, groups, models, "", "all", "all", "status")
    .map(key => key.id)
    .join() !== "a1,b2,b1"
)
  throw new Error("Status sorting should put active keys first");

// #87: the Keys page triages unmanaged keys by readiness; managed keys are their own bucket.
const triage = [
  { ...makeKey("a2", "Codex", []), managed: false, readiness: { state: "ready" as const, blockers: [] } },
  { ...makeKey("a3", "Hermes", []), managed: false, readiness: { state: "blocked" as const, blockers: [] } },
  { ...makeKey("b3", "Blank", []), managed: false, readiness: { state: "empty" as const, blockers: [] } },
  { ...makeKey("b4", "Unread", []), managed: false },
  { ...makeKey("b5", "Adopted", []), managed: true },
];
for (const [state, ids] of [
  ["all", "b5,b3,a2,a3,b4"],
  ["ready", "a2"],
  ["blocked", "a3"],
  ["empty", "b3"],
  ["unknown", "b4"],
  ["managed", "b5"],
] as const) {
  const shown = filterKeys(triage, groups, models, "", "all", "all", "name", state)
    .map(key => key.id)
    .join();
  if (shown !== ids) throw new Error(`Readiness filter ${state} should show ${ids}, got ${shown}`);
}
if (filterKeys(triage, groups, models, "", "all", "all", "name").length !== 5)
  throw new Error("Without a readiness filter every key stays");

// Spec #85 round 2: the default order opens on managed keys, then the worklist: ready, blocked, not read yet, empty; by name inside each.
const worklist = filterKeys(
  [...triage, { ...makeKey("a4", "Zed", []), managed: false, readiness: { state: "ready" as const, blockers: [] } }],
  groups,
  models,
  "",
  "all",
  "all",
  "readiness",
)
  .map(key => key.id)
  .join();
if (worklist !== "b5,a2,a4,a3,b4,b3")
  throw new Error(`Readiness sorting should read managed, ready, blocked, unknown, empty, got ${worklist}`);

// Shelves: managed keys, then "To adopt" (ready, blocked, not read yet), then "Empty"; each keeps the list's order.
const shelves = keyShelves(filterKeys(triage, groups, models, "", "all", "all", "name"))
  .map(shelf => `${shelf.id}:${shelf.keys.map(key => key.id).join("+")}`)
  .join();
if (shelves !== "managed:b5,adopt:a2+a3+b4,empty:b3")
  throw new Error(`Keys should shelve as managed, to adopt, empty, got ${shelves}`);
if (
  keyShelves([triage[0]])
    .map(shelf => shelf.id)
    .join() !== "adopt"
)
  throw new Error("An empty shelf is not listed");

// Near-duplicate names ("Elson - Poc" and "Elson - POC ") are flagged; distinct names are not.
const dupes = nearDuplicates([
  makeKey("x1", "Elson - Poc", []),
  makeKey("x2", "Elson - POC ", []),
  makeKey("x3", "Elson", []),
]);
if ([...dupes].sort().join() !== "x1,x2")
  throw new Error(`Near-duplicate names should be flagged, got ${[...dupes].join()}`);
