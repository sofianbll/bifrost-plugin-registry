import { editDraft, initialKeys, saveKey } from "./key-state";

const check = (condition: boolean, label: string) => { if (!condition) throw new Error(label); };

const original = structuredClone(initialKeys);
const draft = editDraft(initialKeys[1]);
draft.name = "Changed";
draft.added.push({ modelId: "kimi-k2", accesses: ["moonshot/kimi-k2"] });
check(initialKeys[1].draft.name === "Demo · Hermes", "edit mutates original name");
check(initialKeys[1].draft.added.length === 0, "edit mutates nested original");

const created = saveKey(initialKeys, draft, "created-1");
check(created.length === initialKeys.length + 1, "create length");
check(created.at(-1)?.draft.name === "Changed", "create draft");
check(/^DEMO_NOT_VALID_/.test(created.at(-1)?.demoToken ?? ""), "demo prefix");
draft.added[0].accesses.push("other");
check(created.at(-1)?.draft.added[0].accesses.length === 1, "save nested clone");

const changed = editDraft(created.at(-1)!);
changed.client = "Edited client";
const updated = saveKey(created, changed, "created-1");
check(updated.length === created.length, "edit length");
check(updated.at(-1)?.id === "created-1", "stable id");
check(updated.at(-1)?.demoToken === created.at(-1)?.demoToken, "stable token");
check(created.at(-1)?.draft.client === "Hermes (demo)", "edit mutates stored key");
check(JSON.stringify(initialKeys) === JSON.stringify(original), "cancel mutates storage");
let witnessRejected = false;
try { saveKey(initialKeys, draft, "witness"); } catch { witnessRejected = true; }
check(witnessRejected, "witness edit accepted");
console.log("Prototype key create/edit/cancel checks passed");
