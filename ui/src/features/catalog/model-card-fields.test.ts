import { parsePropertyValue, proposedAccessValue, stageCatalogOverride } from "./model-card-fields";

const equal = (actual: unknown, expected: unknown) => { if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`); };
const rejects = (work: () => unknown) => { try { work(); } catch { return; } throw new Error("Expected invalid value to be rejected"); };

equal(parsePropertyValue("context_length", "32000"), 32000);
equal(parsePropertyValue("tool_call", "false"), false);
rejects(() => parsePropertyValue("max_output_tokens", "-1"));
rejects(() => parsePropertyValue("context_length", "1.5"));
rejects(() => parsePropertyValue("context_length", String(Number.MAX_SAFE_INTEGER + 1)));
equal(proposedAccessValue("reference", "ref", "access", "ref", undefined, 128000, 32000), 32000);
equal(proposedAccessValue("reference", "ref", "access", "ref", 128000, 128000, 32000), 128000);
equal(proposedAccessValue("reference", "ref", "access", "other", undefined, 128000, 32000), 128000);
equal(proposedAccessValue("reference", "ref", "access", "ref", undefined, undefined, 32000, true), undefined);
equal(proposedAccessValue("reference", "ref", "access", "ref", 64000, undefined, 32000, true), 64000);
equal(proposedAccessValue("access", "access", "access", "ref", undefined, undefined, 32000, true), 32000);
equal(proposedAccessValue("access", "access", "access", "ref", false, true, true), true);
equal(proposedAccessValue("access", "other", "access", "ref", false, true, true), false);
const staged = stageCatalogOverride([], { target: "reference", id: "ref", field: "context_length", value: 32000 }, 128000);
equal(staged.length, 1);
equal(stageCatalogOverride(staged, { target: "reference", id: "ref", field: "context_length", value: 128000 }, 128000).length, 0);
console.log("Model card property checks passed");
