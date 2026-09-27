export type Field = "limit.context" | "limit.output" | "tool_call" | "structured_output";
export type Data = Record<string, unknown>;
export type Access = {
  id: string;
  providerId: string;
  providerName: string;
  modelId: string;
  baseModelId: string;
  authored: Data;
  resolved: Data;
  sourcePath: string;
};
export type Draft = { common: Partial<Record<Field, string>>; access: Record<string, Partial<Record<Field, string>>> };

export const emptyDraft = (): Draft => ({ common: {}, access: {} });
export const validLimit = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value));

export function readPath(data: Data, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) =>
    value && typeof value === "object" && Object.hasOwn(value, key)
      ? (value as Data)[key]
      : undefined, data);
}

export function effective(model: Data, access: Access | undefined, field: Field, draft: Draft) {
  if (access && Object.hasOwn(draft.access[access.id] ?? {}, field))
    return { value: draft.access[access.id][field], source: "Correction Registry · accès" };
  if (access && readPath(access.authored, field) !== undefined)
    return { value: readPath(access.authored, field), source: "Models.dev · provider" };
  if (Object.hasOwn(draft.common, field))
    return { value: draft.common[field], source: "Correction Registry · modèle" };
  const canonical = readPath(model, field);
  if (canonical !== undefined) return { value: canonical, source: "Models.dev · modèle" };
  return { value: undefined, source: "Inconnu" };
}

export function change(draft: Draft, accessId: string | undefined, field: Field, value: string | undefined): Draft {
  if (!accessId) {
    const common = { ...draft.common };
    if (value === undefined) delete common[field]; else common[field] = value;
    return { ...draft, common };
  }
  const local = { ...draft.access[accessId] };
  if (value === undefined) delete local[field]; else local[field] = value;
  return { ...draft, access: { ...draft.access, [accessId]: local } };
}
