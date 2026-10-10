import type { Catalog, CatalogRecord } from "./catalog-api";
import { registryEndpoints, type Access, type Model } from "../../domain/registry";
import type { SearchOption } from "../../components/registry/SearchableSelect";
import type { Copy } from "../../lib/locale";

const stringField = (record: CatalogRecord, name: string) => {
  const value = record.fields[name]?.value;
  return typeof value === "string" && value.trim() ? value : "";
};
const unique = (options: SearchOption[]) => [...new Map(options.map(option => [option.value.toLocaleLowerCase(), option])).values()];

export function modelEditorOptions(catalog: Catalog | null, workspace: Model[], copy: Copy) {
  const references = catalog?.references || [];
  const accesses = catalog?.accesses || [];
  const referenceOptions = references.flatMap(reference => {
      const linked = accesses.find(access => access.referenceId === reference.id)?.model;
      const tail = reference.id.split("/").at(-1) || "";
      const id = linked && /^[a-z0-9][a-z0-9._-]*$/.test(linked) ? linked : tail;
      return /^[a-z0-9][a-z0-9._-]*$/.test(id) ? [{ value: id, label: stringField(reference, "name") || id, detail: `${copy("Reference", "Fiche documentaire")} ${reference.id}`, referenceId: reference.id }] : [];
    });
  const modelIds = [
    ...referenceOptions,
    ...workspace.filter(model => /^[a-z0-9][a-z0-9._-]*$/.test(model.id) && !referenceOptions.some(option => option.value === model.id)).map(model => ({ value: model.id, label: model.name, detail: copy("Workspace model", "Fiche modèle enregistrée") })),
    ...accesses.filter(access => !access.referenceId && /^[a-z0-9][a-z0-9._-]*$/.test(access.model) && !referenceOptions.some(option => option.value === access.model) && !workspace.some(model => model.id === access.model)).map(access => ({ value: access.model, label: stringField(access, "name") || access.model, detail: `${copy("Discovered access", "Accès découvert")} ${access.id}`, accessId: access.id })),
  ];
  const values = (field: "creator" | "family", workspaceField: "creator" | "family") => unique([
    ...references.map(reference => stringField(reference, field)),
    ...accesses.map(access => stringField(access, field)),
    ...workspace.map(model => model[workspaceField]),
  ].filter(value => value && value !== "Unknown").map(value => ({ value })));
  const providers = unique([
    ...accesses.filter(access => access.configured).map(access => access.provider),
    ...workspace.flatMap(model => model.accesses.map(access => access.provider)),
  ].filter(Boolean).map(value => ({ value })));
  return { modelIds, creators: values("creator", "creator"), families: values("family", "family"), providers };
}

export type RegistrationIssue = "id" | "name" | "operations" | "access";

export function firstRegistrationIssue(model: Model): RegistrationIssue | undefined {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(model.id)) return "id";
  if (!model.name.trim()) return "name";
  if (!model.accesses.length || model.accesses.some(access => !access.provider.trim() || !access.nativeModel || !access.nativeModel.trim() || access.id !== `${access.provider}/${model.id}`)) return "access";
  if (model.accesses.some(access => !access.endpoints?.length || access.endpoints.some(endpoint => !(registryEndpoints as readonly string[]).includes(endpoint)))) return "operations";
}

// Registry endpoints implied by the mode Bifrost declares for a native model (its parameters
// datasheet). A missing or unknown mode preselects nothing; saved accesses keep their own.
const modeEndpoints: Record<string, string[]> = {
  chat: ["chat/completions"], completion: ["completions"], responses: ["responses"], embedding: ["embeddings"],
  image_generation: ["images/generations"], audio_speech: ["audio/speech"], rerank: ["rerank"], ocr: ["ocr"],
};
export function declaredEndpoints(access?: CatalogRecord): string[] {
  const parameters = access?.fields.parameters?.value as { mode?: unknown } | undefined;
  return typeof parameters?.mode === "string" ? [...(modeEndpoints[parameters.mode] ?? [])] : [];
}

export type AccessCandidate = Pick<Access, "provider" | "nativeModel" | "status"> & { source: string };

export function canonicalCapabilities(values: Model["capabilities"]): Model["capabilities"] {
  const { Tools, ...canonical } = values;
  if (Tools && !Object.hasOwn(canonical, "Tool calling")) canonical["Tool calling"] = Tools;
  return canonical;
}

export function changeAccessProvider(access: Access, modelId: string, provider: string): Access {
  return { ...access, provider, id: provider && modelId ? `${provider}/${modelId}` : "" };
}

export function applyModelId(draft: Model, id: string, candidate?: AccessCandidate): Model {
  const accesses = draft.accesses.map(access => {
    const empty = !access.provider && !access.id && !access.nativeModel;
    if (empty && candidate && candidate.provider && candidate.nativeModel) return {
      ...changeAccessProvider(access, id, candidate.provider),
      nativeModel: candidate.nativeModel,
      status: candidate.status,
    };
    return changeAccessProvider(access, id, access.provider);
  });
  return { ...draft, id, accesses };
}

export function prefillFromReference(draft: Model, reference: CatalogRecord): Model {
  const missing = (value: string) => !value || value === "Unknown";
  const fill = (current: string, field: string) => missing(current) ? stringField(reference, field) || current : current;
  const context = reference.fields.context_length?.value;
  const modalities = (field: string, current: string[]) => current.length ? current : Array.isArray(reference.fields[field]?.value) ? (reference.fields[field].value as unknown[]).filter((value): value is string => typeof value === "string").map(value => value.charAt(0).toUpperCase() + value.slice(1)) : current;
  const capabilities = canonicalCapabilities(draft.capabilities);
  for (const [field, name] of [["reasoning", "Reasoning"], ["tool_call", "Tool calling"], ["structured_output", "Structured output"]] as const) {
    if (reference.fields[field]?.value === true && (!capabilities[name] || capabilities[name] === "Unknown")) capabilities[name] = "Declared";
  }
  return {
    ...draft,
    name: fill(draft.name, "name"),
    creator: fill(draft.creator, "creator"),
    family: fill(draft.family, "family"),
    context: missing(draft.context) && typeof context === "number" ? String(context) : draft.context,
    inputModalities: modalities("input_modalities", draft.inputModalities),
    outputModalities: modalities("output_modalities", draft.outputModalities),
    capabilities,
  };
}

export function omitUnchangedReferenceIds(draft: Model, workspace: Model[]): Model {
  const original = workspace.find(model => model.id === draft.id);
  return { ...draft, accesses: draft.accesses.map(access => {
    const before = original?.accesses.find(row => row.provider === access.provider && row.nativeModel === access.nativeModel);
    if (access.referenceId !== before?.referenceId) return access;
    const { referenceId: _unchanged, ...rest } = access;
    return rest;
  }) };
}
