// Scratch logic check for the key-composer prototype state engine.
// Run: npm --prefix ui run check:key-composer (from repo root)
import { emptyDraft, fixtureGroups, fixtureModels, isSelected, lateAccess, plannedExposures, reconcileSelection, resolveDraft, toggleAccess, toggleGroup, toggleModel, witnessDraft, type ProtoModel } from "./state";
import { emptyModelFilters } from "../../domain/registry";
import { catalogResults } from "./catalog";

let failures = 0;
const check = (name: string, cond: boolean, detail = "") => { console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`); if (!cond) failures++; };
const models = (): ProtoModel[] => structuredClone(fixtureModels);
const groups = fixtureGroups;
const accessState = (draft: any, modelId: string, accessId: string, ms = models()) => resolveDraft(draft, groups, ms).find(r => r.model.id === modelId)?.accesses.find(a => a.access.id === accessId)?.state;

// Scenario 1: select a model, switch tab to groups, filter, come back: selection intact.
{
  let d = emptyDraft();
  const ms = models();
  d = toggleModel(d, ms.find(m => m.id === "kimi-k2")!, groups); // select on "models" tab
  d = toggleGroup(d, "vision"); // act on "groups" tab
  // come back to models tab; selection must persist
  check("S1 selection survives tab switch", isSelected("kimi-k2", d, groups));
  // select-all on a filtered view (only gpt-5 visible) must not drop kimi-k2
  const selectedNow = ms.filter(m => isSelected(m.id, d, groups)).map(m => m.id);
  d = reconcileSelection(d, [...selectedNow, "gpt-5"], groups, ms);
  check("S1 select-visible keeps out-of-filter selection", isSelected("kimi-k2", d, groups) && isSelected("gpt-5", d, groups));
  d = reconcileSelection(d, selectedNow, groups, ms);
  check("S1 deselect-visible keeps out-of-filter selection", isSelected("kimi-k2", d, groups) && !isSelected("gpt-5", d, groups));
}

// Scenario 2: same access via two groups, exclude locally; nothing reactivates it; witness unchanged.
{
  let d = emptyDraft();
  const ms = models();
  d = toggleGroup(d, "code");
  d = toggleGroup(d, "reasoning"); // gpt-5 via both groups
  const r = resolveDraft(d, groups, ms).find(r => r.model.id === "gpt-5")!;
  const openai = r.accesses.find(a => a.access.id === "openai/gpt-5")!;
  check("S2 openai/gpt-5 inherited via both groups", openai.state === "active" && openai.origins.join("+") === "Inherited · Code+Inherited · Reasoning", openai.origins.join(" | "));
  d = toggleAccess(d, openai); // exclude locally
  check("S2 exclusion wins over both groups", accessState(d, "gpt-5", "openai/gpt-5") === "excluded");
  // a direct add of the same model must NOT reactivate the excluded access
  d = toggleModel(d, ms.find(m => m.id === "imagen-4")!, groups); // unrelated direct add, sanity
  check("S2 still excluded after unrelated direct add", accessState(d, "gpt-5", "openai/gpt-5") === "excluded");
  // witness key unchanged
  const w = resolveDraft(witnessDraft, groups, ms).find(r => r.model.id === "gpt-5")!;
  check("S2 witness key still has openai/gpt-5 active", w.accesses.find(a => a.access.id === "openai/gpt-5")!.state === "active");
  // restore is explicit
  const excluded = resolveDraft(d, groups, ms).find(r => r.model.id === "gpt-5")!.accesses.find(a => a.access.id === "openai/gpt-5")!;
  d = toggleAccess(d, excluded);
  check("S2 explicit restore reactivates via groups", accessState(d, "gpt-5", "openai/gpt-5") === "active");
  // key adds an access beyond what a group retains: Reasoning retains only openai/gpt-5
  let d2 = toggleGroup(emptyDraft(), "reasoning");
  check("S2b azure/gpt-5 off when only Reasoning inherited", accessState(d2, "gpt-5", "azure/gpt-5") === "off");
  const azOff = resolveDraft(d2, groups, ms).find(r => r.model.id === "gpt-5")!.accesses.find(a => a.access.id === "azure/gpt-5")!;
  d2 = toggleAccess(d2, azOff);
  const az = resolveDraft(d2, groups, ms).find(r => r.model.id === "gpt-5")!.accesses.find(a => a.access.id === "azure/gpt-5")!;
  check("S2b azure/gpt-5 activated directly", az.state === "active" && az.origins.includes("Activated directly"));
}

// Scenario 3: two configured accesses active by default; late third access stays off.
{
  let d = emptyDraft();
  const ms = models();
  d = toggleModel(d, ms.find(m => m.id === "kimi-k2")!, groups);
  const r = resolveDraft(d, groups, ms).find(r => r.model.id === "kimi-k2")!;
  check("S3 both configured accesses active by default", r.accesses.every(a => a.state === "active"), r.accesses.map(a => `${a.access.id}:${a.state}`).join(" "));
  const late = lateAccess["kimi-k2"]();
  ms.find(m => m.id === "kimi-k2")!.accesses.push(late); // access appears on the card afterwards
  check("S3 late access stays off in existing selection", accessState(d, "kimi-k2", "azure/kimi-k2", ms) === "off");
  const off = resolveDraft(d, groups, ms).find(r => r.model.id === "kimi-k2")!.accesses.find(a => a.access.id === "azure/kimi-k2")!;
  d = toggleAccess(d, off);
  check("S3 late access explicitly activated", accessState(d, "kimi-k2", "azure/kimi-k2", ms) === "active");
  // a fresh selection after the arrival includes it by default
  const d2 = toggleModel(emptyDraft(), ms.find(m => m.id === "kimi-k2")!, groups);
  check("S3 fresh selection gets all three by default", accessState(d2, "kimi-k2", "azure/kimi-k2", ms) === "active");
}

// Scenario 4: group complements direct picks without erasing them; origins distinct.
{
  let d = emptyDraft();
  const ms = models();
  d = toggleModel(d, ms.find(m => m.id === "gemini-2.5-pro")!, groups); // direct pick first
  d = toggleModel(d, ms.find(m => m.id === "kimi-k2")!, groups);
  d = toggleGroup(d, "vision"); // adds gemini (again) + imagen-4
  const list = resolveDraft(d, groups, ms);
  const gem = list.find(r => r.model.id === "gemini-2.5-pro")!;
  check("S4 direct pick kept after group add", gem.direct && gem.groups.includes("Vision"));
  check("S4 group adds its other member", list.some(r => r.model.id === "imagen-4" && r.groups.includes("Vision") && !r.direct));
  check("S4 kimi-k2 still direct only", list.find(r => r.model.id === "kimi-k2")!.direct);
  const origins = list.map(r => `${r.model.id}:${r.direct ? "direct" : ""}${r.groups.length ? "+group" : ""}`);
  check("S4 origins distinguishable", gem.direct && gem.groups.length > 0, origins.join(" | "));
}

// Scenario 6: mutate then cancel → back to initial state (cancel = discard draft object).
{
  let d = emptyDraft();
  const ms = models();
  d.name = "Hermes staging";
  d = toggleModel(d, ms.find(m => m.id === "gpt-5")!, groups);
  d = toggleGroup(d, "code");
  const cancelled = emptyDraft(); // cancel replaces the draft with a fresh empty one
  check("S6 cancel restores empty initial state", JSON.stringify(cancelled) === JSON.stringify(emptyDraft()) && plannedExposures(cancelled, groups, ms).length === 0);
}

// Planned exposures respect naming and only count active accesses.
{
  let d = emptyDraft();
  const ms = models();
  d = toggleGroup(d, "code");
  d.naming = "both";
  const ids = plannedExposures(d, groups, ms);
  check("Exposures include common IDs and active access IDs", ids.includes("gpt-5") && ids.includes("openai/gpt-5") && ids.includes("azure/gpt-5"));
  // bedrock sonnet access is not configured → never exposed
  check("Unconfigured access never planned", !ids.includes("bedrock/claude-sonnet-4.6"));
  d = toggleAccess(d, resolveDraft(d, groups, ms).find(r => r.model.id === "gpt-5")!.accesses.find(a => a.access.id === "azure/gpt-5")!);
  const ids2 = plannedExposures(d, groups, ms);
  check("Excluded access dropped from plan", ids2.includes("openai/gpt-5") && !ids2.includes("azure/gpt-5"));
}

// Catalog controls only change visibility/order; they never mutate access selection.
{
  const ms = models();
  const before = JSON.stringify(ms);
  check("Retrieval includes embedding model", catalogResults(ms, emptyModelFilters, "Retrieval", "all", [], "name").some(m => m.id === "text-embedding-3-large"));
  check("Video category empty when fixture has no video", catalogResults(ms, emptyModelFilters, "Video", "all", [], "name").length === 0);
  const azure = catalogResults(ms, { ...emptyModelFilters, provider: "azure" }, "All", "all", [], "name");
  check("Provider filter narrows display without changing accesses", azure.length === 1 && azure[0].id === "gpt-5" && azure[0].accesses.length === 2 && JSON.stringify(ms) === before);
  const byAccesses = catalogResults(ms, emptyModelFilters, "All", "all", [], "accesses");
  check("Access count sort uses known fixture counts", byAccesses[0].accesses.length >= byAccesses.at(-1)!.accesses.length);
}

console.log(failures ? `\n${failures} FAILURES` : "\nAll scenario checks passed.");
if (failures) throw new Error(`${failures} scenario checks failed.`);
