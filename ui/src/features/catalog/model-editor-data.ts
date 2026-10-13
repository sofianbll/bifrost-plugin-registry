import type { Catalog, CatalogAccess, CatalogRecord } from "./catalog-api";
import { registryEndpoints, sameAccess, type Access, type Model } from "../../domain/registry";
import type { SearchOption } from "../../components/registry/SearchableSelect";
import type { Copy } from "../../lib/locale";

const stringField = (record: CatalogRecord, name: string) => {
  const value = record.fields[name]?.value;
  return typeof value === "string" && value.trim() ? value : "";
};
const unique = (options: SearchOption[]) => [
  ...new Map(options.map(option => [option.value.toLocaleLowerCase(), option])).values(),
];

export function modelEditorOptions(catalog: Catalog | null, workspace: Model[], copy: Copy) {
  const references = catalog?.references || [];
  const accesses = catalog?.accesses || [];
  const referenceOptions = references.flatMap(reference => {
    const linked = accesses.find(access => access.referenceId === reference.id)?.model;
    const tail = reference.id.split("/").at(-1) || "";
    const id = linked && /^[a-z0-9][a-z0-9._-]*$/.test(linked) ? linked : tail;
    return /^[a-z0-9][a-z0-9._-]*$/.test(id)
      ? [
          {
            value: id,
            label: stringField(reference, "name") || id,
            detail: `${copy("Reference", "Fiche documentaire")} ${reference.id}`,
            referenceId: reference.id,
          },
        ]
      : [];
  });
  const modelIds = [
    ...referenceOptions,
    ...workspace
      .filter(
        model => /^[a-z0-9][a-z0-9._-]*$/.test(model.id) && !referenceOptions.some(option => option.value === model.id),
      )
      .map(model => ({ value: model.id, label: model.name, detail: copy("Model card", "Fiche modèle") })),
    ...accesses
      .filter(
        access =>
          !access.referenceId &&
          /^[a-z0-9][a-z0-9._-]*$/.test(access.model) &&
          !referenceOptions.some(option => option.value === access.model) &&
          !workspace.some(model => model.id === access.model),
      )
      .map(access => ({
        value: access.model,
        label: stringField(access, "name") || access.model,
        detail: `${copy("Discovered access", "Accès découvert")} ${access.id}`,
        accessId: access.id,
      })),
  ];
  const values = (field: "creator" | "family", workspaceField: "creator" | "family") =>
    unique(
      [
        ...references.map(reference => stringField(reference, field)),
        ...accesses.map(access => stringField(access, field)),
        ...workspace.map(model => model[workspaceField]),
      ]
        .filter(value => value && value !== "Unknown")
        .map(value => ({ value })),
    );
  const providers = unique(
    [
      ...accesses.filter(access => access.configured).map(access => access.provider),
      ...workspace.flatMap(model => model.accesses.map(access => access.provider)),
    ]
      .filter(Boolean)
      .map(value => ({ value })),
  );
  return { modelIds, creators: values("creator", "creator"), families: values("family", "family"), providers };
}

export type RegistrationIssue = "id" | "name" | "operations" | "access";

export function firstRegistrationIssue(model: Model): RegistrationIssue | undefined {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(model.id)) return "id";
  if (!model.name.trim()) return "name";
  if (
    !model.accesses.length ||
    model.accesses.some(
      access =>
        !access.provider.trim() ||
        !access.nativeModel ||
        !access.nativeModel.trim() ||
        access.id !== `${access.provider}/${model.id}`,
    )
  )
    return "access";
  if (
    model.accesses.some(
      access =>
        !access.endpoints?.length ||
        access.endpoints.some(endpoint => !(registryEndpoints as readonly string[]).includes(endpoint)),
    )
  )
    return "operations";
}

// Registry endpoints implied by the mode Bifrost declares for a native model (its parameters
// datasheet); without a mode, by what the model outputs (the access's facts, else its reference's).
// An unknown mode or output preselects nothing; saved accesses keep their own.
const modeEndpoints: Record<string, string[]> = {
  chat: ["chat/completions", "responses"],
  completion: ["completions"],
  responses: ["responses"],
  embedding: ["embeddings"],
  image_generation: ["images/generations"],
  audio_speech: ["audio/speech"],
  decisions: ["decisions"],
  rerank: ["rerank"],
  ocr: ["ocr"],
};
const outputEndpoints: Record<string, string[]> = {
  text: ["chat/completions", "responses"],
  image: ["images/generations"],
  audio: ["audio/speech"],
};

export function declaredEndpoints(access?: CatalogRecord, reference?: CatalogRecord): string[] {
  const parameters = access?.fields.parameters?.value as { mode?: unknown } | undefined;
  if (typeof parameters?.mode === "string") return [...(modeEndpoints[parameters.mode] ?? [])];
  const outputs = access?.fields.output_modalities?.value ?? reference?.fields.output_modalities?.value;
  const implied = new Set(
    Array.isArray(outputs)
      ? outputs.flatMap(output => (typeof output === "string" ? (outputEndpoints[output.toLowerCase()] ?? []) : []))
      : [],
  );
  return registryEndpoints.filter(endpoint => implied.has(endpoint));
}

// A native name without its aggregator's "vendor/" prefix, punctuation and case: "openai/GPT-5.6-luna" -> "gpt56luna".
const bareName = (name: string) => (name.split("/").at(-1) ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Configured accesses that are the card's model: one it already holds, one under a name the card uses (an
// aggregator's "vendor/" prefix aside), or a plain native name linked to the same reference. An aggregator links
// "-pro", "-latest" or ":batch" variants to the base reference, so its prefixed names never match on that alone.
// shortcut: a plain native name (Bedrock, dated IDs) is trusted on its reference alone, tighten if variants show up there.
// An access another card holds is never offered (Bifrost routes one access to one card).
export function matchingAccesses(accesses: CatalogAccess[], cardId: string, known: Access[], saved: Model[]) {
  const references = new Set(known.flatMap(access => (access.referenceId ? [access.referenceId] : [])));
  const names = new Set([cardId, ...known.map(access => access.nativeModel ?? "")].map(bareName).filter(Boolean));
  return accesses.filter(
    access =>
      access.configured &&
      (names.has(bareName(access.model)) ||
        known.some(row => sameAccess(row, access)) ||
        (!!access.referenceId && references.has(access.referenceId) && !access.model.includes("/"))) &&
      !saved.some(card => card.id !== cardId && card.accesses.some(row => sameAccess(row, access))),
  );
}

// The one "Also available" list: the card tile's "+N available" badge and the sheet's Access tab both count it.
// Matching accesses the card does not hold, once per provider and native model. removed: saved accesses the
// editor took off the card, offered back.
export function alsoAvailable(accesses: CatalogAccess[], card: Model, saved: Model[], removed: Access[] = []) {
  const offered = matchingAccesses(accesses, card.id, [...card.accesses, ...removed], saved).filter(
    access => !card.accesses.some(row => sameAccess(row, access)),
  );
  return [...new Map(offered.map(access => [`${access.provider}/${access.model}`, access])).values()];
}

// Basic names an access by its provider alone (#100). Expert, and the rows of a provider the card holds twice,
// also show the native model: it is all that tells those rows apart.
export function showsNativeModel(accesses: Access[], access: Access, expert: boolean) {
  return expert || accesses.filter(row => row.provider === access.provider).length > 1;
}

// How an access came to its reference. Expert names every state; Basic says only what needs a look (a change
// proposed in the draft, a guess to check) and nothing for a reference the user chose or for none.
export function associationStatus(access: Access, found: CatalogAccess | undefined, expert: boolean, copy: Copy) {
  if (access.referenceId !== undefined && access.referenceId !== found?.referenceId)
    return access.referenceId
      ? expert
        ? copy("Mapping proposed in this draft", "Correspondance proposée dans ce brouillon")
        : copy("Reference proposed in this draft", "Fiche documentaire proposée dans ce brouillon")
      : copy("Unlink proposed in this draft", "Dissociation proposée dans ce brouillon");
  if (found?.mappingManual === true)
    return expert ? copy("Mapping chosen in Registry", "Correspondance choisie dans Registry") : "";
  // The catalog API omits mappingManual when it is false.
  if (found?.referenceId)
    return expert
      ? copy("Automatically suggested mapping · verify", "Association suggérée automatiquement · à vérifier")
      : copy("Suggested automatically · check that it fits", "Suggérée automatiquement · à vérifier");
  return expert ? copy("No mapping", "Aucune correspondance") : "";
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
    if (empty && candidate && candidate.provider && candidate.nativeModel)
      return {
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
  const fill = (current: string, field: string) =>
    missing(current) ? stringField(reference, field) || current : current;
  const context = reference.fields.context_length?.value;
  const modalities = (field: string, current: string[]) =>
    current.length
      ? current
      : Array.isArray(reference.fields[field]?.value)
        ? (reference.fields[field].value as unknown[])
            .filter((value): value is string => typeof value === "string")
            .map(value => value.charAt(0).toUpperCase() + value.slice(1))
        : current;
  const capabilities = canonicalCapabilities(draft.capabilities);
  for (const [field, name] of [
    ["reasoning", "Reasoning"],
    ["tool_call", "Tool calling"],
    ["structured_output", "Structured output"],
  ] as const) {
    if (reference.fields[field]?.value === true && (!capabilities[name] || capabilities[name] === "Unknown"))
      capabilities[name] = "Declared";
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
  return {
    ...draft,
    accesses: draft.accesses.map(access => {
      const before = original?.accesses.find(row => sameAccess(row, access));
      if (access.referenceId !== before?.referenceId) return access;
      const { referenceId: _unchanged, ...rest } = access;
      return rest;
    }),
  };
}

// #100: the one plain sentence the Review step opens on: what saving does, from the draft's own name and subscriptions.
export function reviewSentence(
  {
    name,
    providers,
    creating,
    changed = true,
  }: { name: string; providers: string[]; creating: boolean; changed?: boolean },
  copy: Copy,
) {
  const model = name || copy("this model", "ce modèle");
  if (!creating && !changed)
    return copy(`No changes to save for ${model} yet.`, `Rien à enregistrer pour ${model} pour le moment.`);
  if (!creating)
    return copy(
      `You’re saving changes to ${model}. Keys that already use it get these changes.`,
      `Vous enregistrez des modifications de ${model}. Les clés qui l’utilisent déjà reçoivent ces modifications.`,
    );
  const list =
    providers.length > 1
      ? `${providers.slice(0, -1).join(", ")} ${copy("and", "et")} ${providers.at(-1)}`
      : providers[0];
  const from = !list
    ? ""
    : providers.length > 1
      ? copy(` from your ${list} subscriptions`, ` depuis vos abonnements ${list}`)
      : copy(` from your ${list} subscription`, ` depuis votre abonnement ${list}`);
  return copy(
    `You’re registering ${model}${from}. It appears in My models; no key can use it until you add it to one.`,
    `Vous enregistrez ${model}${from}. Il apparaîtra dans Mes modèles ; aucune clé ne pourra l’utiliser tant que vous ne l’aurez pas ajouté à une clé.`,
  );
}
