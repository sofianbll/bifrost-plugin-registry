import type { Catalog, CatalogRecord } from "./catalog-api";
import type { Access, Model } from "./demo";
import type { SearchOption } from "./SearchableSelect";

const stringField = (record: CatalogRecord, name: string) => {
  const value = record.fields[name]?.value;
  return typeof value === "string" && value.trim() ? value : "";
};
const unique = (options: SearchOption[]) => [...new Map(options.map(option => [option.value.toLocaleLowerCase(), option])).values()];

export function modelEditorOptions(catalog: Catalog | null, workspace: Model[]) {
  const references = catalog?.references || [];
  const accesses = catalog?.accesses || [];
  const referenceOptions = references.flatMap(reference => {
      const linked = accesses.find(access => access.referenceId === reference.id)?.model;
      const tail = reference.id.split("/").at(-1) || "";
      const id = linked && /^[a-z0-9][a-z0-9._-]*$/.test(linked) ? linked : tail;
      return /^[a-z0-9][a-z0-9._-]*$/.test(id) ? [{ value: id, label: stringField(reference, "name") || id, detail: `Reference ${reference.id}`, referenceId: reference.id }] : [];
    });
  const modelIds = [
    ...referenceOptions,
    ...workspace.filter(model => /^[a-z0-9][a-z0-9._-]*$/.test(model.id) && !referenceOptions.some(option => option.value === model.id)).map(model => ({ value: model.id, label: model.name, detail: "Workspace model" })),
    ...accesses.filter(access => !access.referenceId && /^[a-z0-9][a-z0-9._-]*$/.test(access.model) && !referenceOptions.some(option => option.value === access.model) && !workspace.some(model => model.id === access.model)).map(access => ({ value: access.model, label: stringField(access, "name") || access.model, detail: `Discovered access ${access.id}`, accessId: access.id })),
  ];
  const values = (field: "creator" | "family", workspaceField: "creator" | "family") => unique([
    ...references.map(reference => stringField(reference, field)),
    ...accesses.map(access => stringField(access, field)),
    ...workspace.map(model => model[workspaceField]),
  ].filter(value => value && value !== "Unknown").map(value => ({ value })));
  return { modelIds, creators: values("creator", "creator"), families: values("family", "family") };
}

export type AccessCandidate = Pick<Access, "provider" | "nativeModel" | "status"> & { source: string };

export function applyModelId(draft: Model, id: string, candidate?: AccessCandidate): Model {
  const accesses = draft.accesses.map(access => {
    const aliasFollowsModel = !access.id || access.id === `${access.provider}/${draft.id}`;
    const empty = !access.provider && !access.id && !access.nativeModel;
    if (empty && candidate && candidate.provider && candidate.nativeModel) return {
      ...access,
      provider: candidate.provider,
      id: `${candidate.provider}/${id}`,
      nativeModel: candidate.nativeModel,
      status: candidate.status,
    };
    return aliasFollowsModel && access.provider ? { ...access, id: `${access.provider}/${id}` } : access;
  });
  return { ...draft, id, accesses };
}

export function prefillFromReference(draft: Model, reference: CatalogRecord): Model {
  const missing = (value: string) => !value || value === "Unknown";
  const fill = (current: string, field: string) => missing(current) ? stringField(reference, field) || current : current;
  const context = reference.fields.context_length?.value;
  const modalities = (field: string, current: string[]) => current.length ? current : Array.isArray(reference.fields[field]?.value) ? (reference.fields[field].value as unknown[]).filter((value): value is string => typeof value === "string").map(value => value.charAt(0).toUpperCase() + value.slice(1)) : current;
  const capabilities = { ...draft.capabilities };
  for (const [field, name] of [["reasoning", "Reasoning"], ["tool_call", "Tools"], ["structured_output", "Structured output"]] as const) {
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
