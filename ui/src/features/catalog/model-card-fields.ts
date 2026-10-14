export type EditableProperty = "context_length" | "max_output_tokens" | "tool_call" | "structured_output";
export type CatalogOverride = { target: "reference" | "access"; id: string; field: EditableProperty; value: number | boolean };

export function stageCatalogOverride(current: CatalogOverride[], next: CatalogOverride, original: unknown): CatalogOverride[] {
  const other = current.filter(item => item.target !== next.target || item.id !== next.id || item.field !== next.field);
  return Object.is(next.value, original) ? other : [...other, next];
}

export function parsePropertyValue(field: EditableProperty, raw: string): number | boolean {
  if (field === "tool_call" || field === "structured_output") {
    if (raw !== "true" && raw !== "false") throw new Error("Choisir Oui ou Non.");
    return raw === "true";
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
): unknown {
  if (target === "access" && accessId === targetId) return proposed;
  if (target === "reference" && referenceId === targetId && ownValue === undefined) return proposed;
  return ownValue === undefined ? referenceValue : ownValue;
}
