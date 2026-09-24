import { request } from "./api";

export const fieldTypes = {
  name: "text", creator: "text", family: "text", context_length: "number", max_input_tokens: "number", max_output_tokens: "number",
  input_modalities: "array", output_modalities: "array", input_cost_usd_per_million: "number", output_cost_usd_per_million: "number",
  cache_read_cost_usd_per_million: "number", cache_write_cost_usd_per_million: "number", reasoning: "boolean", tool_call: "boolean",
  structured_output: "boolean", temperature: "boolean", attachment: "boolean", parameters: "json", architecture: "object", additional_attributes: "object", legacy_datasheet: "object",
} as const;
export type CatalogFieldName = keyof typeof fieldTypes;

export function parseCatalogValue(field: CatalogFieldName, raw: string): unknown {
  const type = fieldTypes[field];
  if (type === "text") return raw;
  if (type === "number") {
    if (!raw.trim() || !Number.isFinite(Number(raw))) throw new Error("Enter a finite number.");
    return Number(raw);
  }
  if (type === "boolean") {
    if (raw !== "true" && raw !== "false") throw new Error("Choose true or false.");
    return raw === "true";
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error(`Enter a valid JSON ${type}.`); }
  if (type === "array" && (!Array.isArray(parsed) || !parsed.every(item => typeof item === "string"))) throw new Error("Enter a JSON array of strings.");
  if (type === "object" && (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")) throw new Error("Enter a JSON object.");
  if (type === "json" && (parsed === null || typeof parsed !== "object")) throw new Error("Enter a JSON object or array.");
  return parsed;
}

export type CatalogField = { value: unknown; source: string; updatedAt: string | null; kind: "declared" | "observed" };
export type CatalogRecord = { id: string; fields: Record<string, CatalogField>; overrides: Record<string, unknown> };
export type CatalogAccess = CatalogRecord & { provider: string; model: string; configured: boolean; referenceId?: string; mappingManual?: boolean; matchConflict?: string };
export type Catalog = {
  revision: string;
  references: CatalogRecord[];
  accesses: CatalogAccess[];
  sources: { id: string; lastSuccess?: string; lastAttempt?: string; error?: string }[];
};

const mutation = (path: string, revision: string, method: "POST" | "PUT", body?: unknown) => request<Catalog>(path, {
  method,
  headers: { "If-Match": revision, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const getCatalog = () => request<Catalog>("catalog");
export const refreshCatalog = (revision: string, sources?: string[]) => mutation("catalog/refresh", revision, "POST", sources ? { sources } : {});
export const overrideCatalogField = (revision: string, target: "reference" | "access", id: string, field: string, value: unknown) => mutation("catalog/override", revision, "PUT", { target, id, field, value });
export const matchCatalogReference = (revision: string, accessId: string, referenceId: string) => mutation("catalog/match", revision, "PUT", { accessId, referenceId });
export const createCatalogReference = (revision: string, id: string, name: string) => mutation("catalog/reference", revision, "PUT", { id, fields: { name } });
