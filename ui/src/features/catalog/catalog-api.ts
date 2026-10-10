import { request } from "../../data/api";
import type { Copy } from "../../lib/locale";

export const fieldTypes = {
  name: "text", creator: "text", family: "text", context_length: "number", max_input_tokens: "number", max_output_tokens: "number",
  input_modalities: "array", output_modalities: "array", input_cost_usd_per_million: "number", output_cost_usd_per_million: "number",
  cache_read_cost_usd_per_million: "number", cache_write_cost_usd_per_million: "number", reasoning: "boolean", tool_call: "boolean",
  structured_output: "boolean", temperature: "boolean", attachment: "boolean", parameters: "json", architecture: "object", additional_attributes: "object", legacy_datasheet: "object",
} as const;
export type CatalogFieldName = keyof typeof fieldTypes;

// What people read for each field and source, in the UI language.
const fieldLabels: Record<CatalogFieldName, [string, string]> = {
  name: ["Name", "Nom"], creator: ["Creator", "Créateur"], family: ["Series", "Série"],
  context_length: ["Context length", "Contexte"], max_input_tokens: ["Maximum input", "Entrée maximale"], max_output_tokens: ["Maximum output", "Sortie maximale"],
  input_modalities: ["Input modalities", "Modalités d’entrée"], output_modalities: ["Output modalities", "Modalités de sortie"],
  input_cost_usd_per_million: ["Input price", "Prix entrée"], output_cost_usd_per_million: ["Output price", "Prix sortie"],
  cache_read_cost_usd_per_million: ["Cache read price", "Prix lecture du cache"], cache_write_cost_usd_per_million: ["Cache write price", "Prix écriture du cache"],
  reasoning: ["Reasoning", "Raisonnement"], tool_call: ["Tool calling", "Appels d’outils"], structured_output: ["Structured output", "Sortie structurée"],
  temperature: ["Temperature", "Température"], attachment: ["Attachments", "Pièces jointes"], parameters: ["Bifrost parameters", "Paramètres Bifrost"],
  architecture: ["Architecture", "Architecture"], additional_attributes: ["Additional attributes", "Attributs supplémentaires"], legacy_datasheet: ["Legacy datasheet", "Ancienne fiche technique"],
};
export const fieldLabel = (field: string, copy: Copy) => field in fieldLabels ? copy(...fieldLabels[field as CatalogFieldName]) : field.replaceAll("_", " ");
export function sourceLabel(source: string, copy: Copy) {
  if (/^manual$/i.test(source)) return "Registry";
  if (/bifrost/i.test(source)) return copy("Bifrost catalog", "Catalogue Bifrost");
  if (/models[.-]?dev/i.test(source)) return "Models.dev";
  if (/registry/i.test(source)) return "Registry";
  return source;
}

export function parseCatalogValue(field: CatalogFieldName, raw: string, copy: Copy): unknown {
  const type = fieldTypes[field];
  if (type === "text") return raw;
  if (type === "number") {
    if (!raw.trim() || !Number.isFinite(Number(raw))) throw new Error(copy("Enter a finite number.", "Saisissez un nombre fini."));
    return Number(raw);
  }
  if (type === "boolean") {
    if (raw !== "true" && raw !== "false") throw new Error(copy("Choose true or false.", "Choisissez true ou false."));
    return raw === "true";
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error(copy(`Enter a valid JSON ${type}.`, type === "array" ? "Saisissez un tableau JSON valide." : "Saisissez un objet JSON valide.")); }
  if (type === "array" && (!Array.isArray(parsed) || !parsed.every(item => typeof item === "string"))) throw new Error(copy("Enter a JSON array of strings.", "Saisissez un tableau JSON de chaînes."));
  if (type === "object" && (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")) throw new Error(copy("Enter a JSON object.", "Saisissez un objet JSON."));
  if (type === "json" && (parsed === null || typeof parsed !== "object")) throw new Error(copy("Enter a JSON object or array.", "Saisissez un objet ou un tableau JSON."));
  return parsed;
}

export type CatalogField = { value: unknown; source: string; updatedAt: string | null; kind: "declared" | "observed" };
export type CatalogRecord = { id: string; fields: Record<string, CatalogField>; overrides: Record<string, unknown> };
export type CatalogAccess = CatalogRecord & { provider: string; model: string; configured: boolean; referenceId?: string; mappingManual?: boolean; matchConflict?: string; omittedFields?: string[] };
export type Catalog = {
  revision: string;
  references: CatalogRecord[];
  accesses: CatalogAccess[];
  sources: { id: string; lastSuccess?: string; lastAttempt?: string; error?: string; repository?: string; commit?: string; sourceAt?: string }[];
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
