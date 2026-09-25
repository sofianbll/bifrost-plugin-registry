import { change, effective, emptyDraft, validLimit, type Access } from "./state";

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
