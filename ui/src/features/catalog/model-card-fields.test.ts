import { parsePropertyValue, pricingApplicationState, proposedAccessValue, stageCatalogOverride } from "./model-card-fields";
import type { PricingProof } from "../../domain/registry";

const equal = (actual: unknown, expected: unknown) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); };
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

equal(parsePropertyValue("input_cost_usd_per_million", "1.5"), 1.5);
equal(parsePropertyValue("output_cost_usd_per_million", "0"), 0);
rejects(() => parsePropertyValue("input_cost_usd_per_million", "-1"));
rejects(() => parsePropertyValue("output_cost_usd_per_million", "abc"));
const costStaged = stageCatalogOverride([], { target: "access", id: "p/m", field: "input_cost_usd_per_million", value: 2.5 }, 1.5);
equal(costStaged.length, 1);
equal(stageCatalogOverride(costStaged, { target: "access", id: "p/m", field: "input_cost_usd_per_million", value: 1.5 }, 1.5).length, 0);

const access = { provider: "p", nativeModel: "m" };
const proof: PricingProof = { access: "p/m", state: "not_verified", checkedAt: "2026-09-27T00:00:00Z", error: "Native write failed" };
equal(pricingApplicationState([], access, "input_cost_usd_per_million"), null);
equal(pricingApplicationState([], access, "input_cost_usd_per_million", "manual"), "applied");
equal(pricingApplicationState([proof], access, "input_cost_usd_per_million", "manual"), { error: "Native write failed" });
equal(pricingApplicationState([proof], access, "context_length"), null);
console.log("Model card property checks passed");
