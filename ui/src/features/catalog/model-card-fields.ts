import type { PricingProof } from "../../domain/registry";

export type EditableProperty = "context_length" | "max_output_tokens" | "tool_call" | "structured_output" | "input_cost_usd_per_million" | "output_cost_usd_per_million";
export type CatalogOverride = { target: "reference" | "access"; id: string; field: EditableProperty; value: number | boolean };
export type PricingApplicationState = "applied" | "pending" | { error: string } | null;

export function stageCatalogOverride(current: CatalogOverride[], next: CatalogOverride, original: unknown): CatalogOverride[] {
  const other = current.filter(item => item.target !== next.target || item.id !== next.id || item.field !== next.field);
  return Object.is(next.value, original) ? other : [...other, next];
}

export function parsePropertyValue(field: EditableProperty, raw: string): number | boolean {
  if (field === "tool_call" || field === "structured_output") {
    if (raw !== "true" && raw !== "false") throw new Error("Choisir Oui ou Non.");
    return raw === "true";
  }
  if (field === "input_cost_usd_per_million" || field === "output_cost_usd_per_million") {
    const value = Number(raw);
    if (!raw.trim() || !Number.isFinite(value) || value < 0) throw new Error("Saisir un nombre positif ou nul.");
    return value;
  }
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error("Saisir un entier positif ou nul.");
  return Number(raw);
}

export function proposedAccessValue(
  target: "reference" | "access",
  targetId: string,
  accessId: string | undefined,
  referenceId: string | undefined,
  ownValue: unknown,
  referenceValue: unknown,
  proposed: number | boolean,
  omitted = false,
): unknown {
  if (target === "access" && accessId === targetId) return proposed;
  if (target === "reference" && referenceId === targetId && ownValue === undefined && !omitted) return proposed;
  return ownValue === undefined ? referenceValue : ownValue;
}

export function pricingApplicationState(
  proofs: PricingProof[],
  access: { provider: string; nativeModel?: string },
  field: string,
  source?: string,
): PricingApplicationState {
  if (field !== "input_cost_usd_per_million" && field !== "output_cost_usd_per_million") return null;
  const matches = proofs.filter(proof => proof.access === `${access.provider}/${access.nativeModel}`);
  const errors = matches.map(proof => proof.error).filter((error): error is string => Boolean(error));
  if (errors.length) return { error: errors.join(" ; ") };
  if (matches.some(proof => proof.state === "verified")) return "applied";
  if (source === "manual") return "pending";
  return null;
}
