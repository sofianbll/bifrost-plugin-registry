import { change, effective, emptyDraft, validLimit, type Access } from "./state";
import catalog from "./catalog.json";

const assertEqual = (actual: unknown, expected: unknown) => {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
};

const model = { limit: { context: 100, output: 10 }, tool_call: true };
const inherited: Access = { id: "a", providerId: "a", providerName: "A", modelId: "a", baseModelId: "m", authored: {}, resolved: {}, sourcePath: "a" };
const explicit: Access = { ...inherited, id: "b", authored: { limit: { output: 10 } } };
let draft = change(emptyDraft(), undefined, "limit.output", "20");
assertEqual(effective(model, inherited, "limit.output", draft).value, "20");
assertEqual(effective(model, explicit, "limit.output", draft).source, "Models.dev · provider");
draft = change(draft, "b", "limit.output", "30");
assertEqual(effective(model, explicit, "limit.output", draft).value, "30");
draft = change(draft, "b", "limit.output", undefined);
assertEqual(effective(model, explicit, "limit.output", draft).value, 10);
assertEqual(effective(model, inherited, "structured_output", draft).value, undefined);
for (const value of ["-1", "1.5", "Infinity", "1e9"]) assertEqual(validLimit(value), false);
assertEqual(validLimit("128000"), true);

// The audited journey: common edits must not silently replace provider-authored limits.
const original = emptyDraft();
const offers = catalog.accesses as Access[];
const shared = change(change(original, undefined, "limit.output", "32000"), undefined, "limit.context", "500000");
for (const offer of offers) {
  assertEqual(effective(catalog.model.metadata, offer, "limit.output", shared).value, 128000);
  assertEqual(effective(catalog.model.metadata, offer, "limit.context", shared).value, "500000");
}
const local = change(shared, offers[1].id, "limit.output", "16000");
assertEqual(effective(catalog.model.metadata, offers[0], "limit.output", local).value, 128000);
assertEqual(effective(catalog.model.metadata, offers[1], "limit.output", local).value, "16000");
const reset = change(local, offers[1].id, "limit.output", undefined);
assertEqual(effective(catalog.model.metadata, offers[1], "limit.output", reset).value, 128000);
assertEqual(Object.keys(original.common).length, 0);
assertEqual(effective(model, inherited, "structured_output", change(original, undefined, "structured_output", "false")).value, "false");
assertEqual(effective(model, inherited, "structured_output", original).value, undefined);
