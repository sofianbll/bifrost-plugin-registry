import { useMemo, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { EditorJourney } from "../../components/registry/EditorJourney";
import { fieldLabel, sourceLabel, type Catalog, type CatalogAccess, type CatalogField, type CatalogRecord } from "./catalog-api";
import { registryEndpoints, type Access, type Capability, type Model, type PricingProof } from "../../domain/registry";
import { parsePropertyValue, pricingApplicationState, proposedAccessValue, stageCatalogOverride, type CatalogOverride, type EditableProperty } from "./model-card-fields";
import { applyModelId, canonicalCapabilities, changeAccessProvider, declaredEndpoints, firstRegistrationIssue, modelEditorOptions, prefillFromReference } from "./model-editor-data";
import { SearchableSelect, type SearchOption } from "../../components/registry/SearchableSelect";
import { BrandIcon, displayProvider } from "../../components/registry/BrandIcon";
import { ModelCapabilitiesSummary, ModelModalitiesSummary } from "../../components/registry/model-capabilities";
import { useCopy, useCreatorName, useFormat, useLanguage, useTerm } from "../../lib/locale";

const tasks = ["Chat", "Code", "Reasoning", "Vision", "Image generation", "Embeddings", "Audio transcription", "Audio generation", "Video generation"];
const modalities = ["Text", "Image", "Audio", "Video", "Vector"];
const capabilityNames = ["Chat", "Streaming", "Tool calling", "Vision", "Reasoning", "Structured output"];
const editableProperties = new Set<string>(["context_length", "max_output_tokens", "tool_call", "structured_output", "input_cost_usd_per_million", "output_cost_usd_per_million"]);
// Unit "$/M": a price in USD per million tokens.
const facts = [
  ["context_length", "tokens"], ["max_input_tokens", "tokens"], ["max_output_tokens", "tokens"],
  ["input_cost_usd_per_million", "$/M"], ["output_cost_usd_per_million", "$/M"],
  ["reasoning", ""], ["tool_call", ""], ["structured_output", ""],
] as const;
function useDisplay() {
  const format = useFormat();
  return (value: unknown, unit = "") => unit === "$/M" ? format.price(value) : format.value(value, unit);
}

function modalityList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map(item => item.charAt(0).toUpperCase() + item.slice(1)) : [];
}

function PricingApplication({ proofs, access, field, fact }: { proofs: PricingProof[]; access: Access; field: string; fact?: CatalogField }) {
  const copy = useCopy();
  const state = pricingApplicationState(proofs, access, field, fact?.source);
  if (!state) return null;
  if (state === "applied") return <span className="block text-xs text-emerald-600 dark:text-emerald-400">{copy("Applied to Bifrost", "Appliqué dans Bifrost")}</span>;
  if (state === "pending") return <span className="block text-xs text-amber-600 dark:text-amber-400">{copy("Pending native verification", "En attente de vérification native")}</span>;
  return <span className="block text-xs text-destructive">{copy("Native application failed", "Application native échouée")} · {state.error}</span>;
}

function referenceSources(reference: CatalogRecord | undefined, copy: (english: string, french: string) => string) {
  const sources = [...new Set(Object.values(reference?.fields || {}).map(field => sourceLabel(field.source, copy)).filter(Boolean))];
  return sources.length ? sources.join(", ") : copy("unknown", "inconnues");
}

function FactValue({ fact, unit, inherited, accessSpecific }: { fact?: CatalogField; unit?: string; inherited?: boolean; accessSpecific?: boolean }) {
  const copy = useCopy();
  const display = useDisplay();
  return <span className="block min-w-0"><strong className="block break-words text-sm font-medium">{display(fact?.value, unit)}</strong><small className="block break-words text-xs text-muted-foreground">{fact ? `${inherited ? copy("Inherited from model", "Hérité de la fiche documentaire") + " · " : accessSpecific ? copy("Access-specific", "Propre à cet accès") + " · " : ""}${sourceLabel(fact.source, copy)} · ${/^manual$/i.test(fact.source) ? copy("customized", "personnalisé") : fact.kind === "observed" ? copy("observed", "observé") : copy("Declared", "Déclaré")}` : copy("Source unknown", "Source inconnue")}</small></span>;
}

function ToggleChoices({ label, choices, selected, onChange }: { label: string; choices: string[]; selected: string[]; onChange: (value: string[]) => void }) {
  const term = useTerm();
  const copy = useCopy();
  const french: Record<string, string> = { "Image generation": "Génération d’images", "Audio transcription": "Transcription audio", "Audio generation": "Génération audio", "Video generation": "Génération vidéo", Embeddings: "Vecteurs" };
  return <fieldset><legend className="mb-2 text-sm font-medium">{label}</legend><div className="flex flex-wrap gap-2">{choices.map(choice => <label key={choice} className="flex cursor-pointer items-center gap-2 rounded-sm border px-2 py-1.5 text-xs"><Checkbox checked={selected.includes(choice)} onCheckedChange={checked => onChange(checked ? [...selected, choice] : selected.filter(value => value !== choice))} />{french[choice] ? copy(choice, french[choice]) : term(choice)}</label>)}</div></fieldset>;
}

const endpointLabels: Record<(typeof registryEndpoints)[number], [string, string]> = {
  "chat/completions": ["Chat Completions", "Chat Completions"], responses: ["Responses", "Responses"], completions: ["Completions", "Completions"], embeddings: ["Embeddings", "Embeddings"],
  "images/generations": ["Image generation", "Génération d’images"], "audio/speech": ["Audio speech", "Synthèse audio"], decisions: ["Decisions", "Décisions"], rerank: ["Rerank", "Reclassement"], ocr: ["OCR", "OCR"],
};

function EndpointChoices({ access, invalid, onChange }: { access: Access; invalid?: boolean; onChange: (endpoints: string[]) => void }) {
  const copy = useCopy();
  return <fieldset aria-invalid={invalid || undefined} className="rounded-sm border p-3"><legend className="px-1 text-sm font-medium">{copy("Registry endpoints for this access *", "Endpoints Registry pour cet accès *")}</legend><div className="grid gap-2 sm:grid-cols-2">{registryEndpoints.map(endpoint => <label key={endpoint} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={access.endpoints?.includes(endpoint) || false} onCheckedChange={checked => onChange(checked ? [...(access.endpoints || []), endpoint] : (access.endpoints || []).filter(value => value !== endpoint))} /><span>{copy(...endpointLabels[endpoint])} <code className="text-xs text-muted-foreground">{endpoint}</code></span></label>)}</div>{invalid && <p role="alert" className="mt-2 text-xs text-destructive">{copy("Choose at least one endpoint for this access.", "Choisissez au moins un endpoint pour cet accès.")}</p>}<p className="mt-2 text-xs text-muted-foreground">{copy("These choices configure Registry request types; they do not prove model support.", "Ces choix configurent les types de requêtes Registry ; ils ne prouvent pas la prise en charge du modèle.")}</p></fieldset>;
}

type EditSection = "identity" | "details" | "capabilities" | "access" | null;

export default function ModelEditor({ draft, onChange, creating, workspace, catalog, catalogError, pricingProofs, baseline, error, busy, snapshotMode = false, expert = false, onExpertChange, canExpert, onSave, onOverridesChange, onCancel, onDelete, actionSlot }: {
  draft: Model;
  onChange: (draft: Model) => void;
  creating: boolean;
  workspace: Model[];
  // The reference catalogue the app loads once per revision.
  catalog: Catalog | null;
  catalogError: string;
  pricingProofs: PricingProof[];
  baseline?: Model;
  error: string;
  busy: boolean;
  snapshotMode?: boolean;
  expert?: boolean;
  onExpertChange?: (expert: boolean) => void;
  canExpert?: boolean;
  onSave: (overrides: CatalogOverride[]) => void;
  onOverridesChange?: (overrides: CatalogOverride[]) => void;
  onCancel: () => void;
  onDelete: (model: Model) => void;
  actionSlot?: ReactNode;
}) {
  const [stagedOverrides, setStagedOverrides] = useState<CatalogOverride[]>([]);
  const [step, setStep] = useState<"choose" | "card" | "review">(creating ? "choose" : "card");
  const [cardTab, setCardTab] = useState<"overview" | "access" | "properties" | "sources">("overview");
  const [selectedAccessId, setSelectedAccessId] = useState("");
  const [editing, setEditing] = useState<EditSection>(null);
  const [editDraft, setEditDraft] = useState<Model | null>(null);
  const [editingAccess, setEditingAccess] = useState(0);
  const [property, setProperty] = useState<{ key: EditableProperty; target: "reference" | "access"; id: string; value: string } | null>(null);
  const [propertyNotice, setPropertyNotice] = useState("");
  const [registrationIssue, setRegistrationIssue] = useState<ReturnType<typeof firstRegistrationIssue>>();
  const copy = useCopy();
  const colon = copy(":", " :");
  const language = useLanguage();
  const display = useDisplay();
  const creatorName = useCreatorName();
  const term = useTerm();
  const evidence = (status?: Capability) => status === "Observed in simulated campaign" ? copy("Observed in simulation", "Observé en simulation") : status === "Declared" ? copy("Declared", "Déclaré") : copy("Unknown", "Inconnu");
  const editOpener = useRef<HTMLElement | null>(null);
  const propertyOpener = useRef<HTMLElement | null>(null);
  const viewCatalog = useMemo(() => {
    if (!catalog) return null;
    const view = { ...catalog, references: catalog.references.map(record => ({ ...record, fields: { ...record.fields } })), accesses: catalog.accesses.map(record => ({ ...record, fields: { ...record.fields } })) };
    for (const correction of stagedOverrides) {
      const record = (correction.target === "reference" ? view.references : view.accesses).find(item => item.id === correction.id);
      if (record) record.fields[correction.field] = { value: correction.value, source: "manual", updatedAt: null, kind: "declared" };
    }
    return view;
  }, [catalog, stagedOverrides]);
  const options = useMemo(() => modelEditorOptions(viewCatalog, workspace, copy), [viewCatalog, workspace, language]);
  const update = (patch: Partial<Model>) => onChange({ ...draft, ...patch });
  const form = editDraft || draft;
  const updateEdit = (patch: Partial<Model>) => setEditDraft({ ...form, ...patch });
  const changeEditAccess = (index: number, patch: Partial<Access>) => updateEdit({ accesses: form.accesses.map((access, at) => at !== index ? access : patch.provider !== undefined ? changeAccessProvider({ ...access, ...patch }, form.id, patch.provider) : { ...access, ...patch }) });
  const openEdit = (section: Exclude<EditSection, null>, accessIndex = 0, value = draft) => {
    editOpener.current = document.activeElement as HTMLElement | null;
    setEditDraft(value);
    setEditingAccess(accessIndex);
    setEditing(section);
  };
  const closeEdit = () => { setEditing(null); setEditDraft(null); };
  const validAccesses = draft.accesses.filter(access => access.provider && access.nativeModel);
  const selectedAccess = validAccesses.find(access => access.id === selectedAccessId) || validAccesses[0];
  // Saved accesses removed from the draft stay matches, so they can be added back.
  const knownAccesses = [...draft.accesses, ...(creating ? [] : baseline?.accesses || [])];
  const linkedReferenceIds = new Set(knownAccesses.map(access => access.referenceId).filter(Boolean));
  const matchingCatalog = (viewCatalog?.accesses || []).filter(access => access.configured && (
    access.model === draft.id || linkedReferenceIds.has(access.referenceId) ||
    knownAccesses.some(row => row.provider === access.provider && row.nativeModel === access.model)
  ));
  const availableAccesses = [...new Map(matchingCatalog.map(access => [`${access.provider}/${access.model}`, access])).values()];
  const selectedReference = (id?: string) => viewCatalog?.references.find(reference => reference.id === id);
  const catalogAccess = (access: Access) => viewCatalog?.accesses.find(row => row.provider === access.provider && row.model === access.nativeModel);
  const referenceOptions = (viewCatalog?.references || []).map(reference => ({ value: reference.id, label: display(reference.fields.name?.value), detail: copy("Existing reference card", "Fiche documentaire existante") }));
  const referenceName = (id?: string) => id ? display(selectedReference(id)?.fields.name?.value) : copy("none", "aucune");
  const associationStatus = (access: Access, found?: CatalogAccess) => {
    if (access.referenceId !== undefined && access.referenceId !== found?.referenceId) return access.referenceId ? copy("Mapping proposed in this draft", "Correspondance proposée dans ce brouillon") : copy("Unlink proposed in this draft", "Dissociation proposée dans ce brouillon");
    if (found?.mappingManual === true) return copy("Mapping chosen in Registry", "Correspondance choisie dans Registry");
    // The catalog API omits mappingManual when it is false.
    return found?.referenceId ? copy("Automatically suggested mapping · verify", "Association suggérée automatiquement · à vérifier") : copy("No mapping", "Aucune correspondance");
  };
  const chooseModelId = (value: string, option?: SearchOption) => {
    const reference = option?.referenceId ? selectedReference(option.referenceId) : undefined;
    const fromWorkspace = workspace.find(model => model.id === value);
    const next = reference ? prefillFromReference(draft, reference) : fromWorkspace ? {
      ...draft, name: draft.name || fromWorkspace.name,
      creator: draft.creator === "Unknown" ? fromWorkspace.creator : draft.creator,
      family: draft.family === "Unknown" ? fromWorkspace.family : draft.family,
    } : draft;
    onChange(applyModelId(next, value));
  };
  const chooseEditReference = (index: number, id: string) => {
    const reference = selectedReference(id);
    const next = reference ? prefillFromReference(form, reference) : form;
    setEditDraft({ ...next, accesses: next.accesses.map((access, at) => at === index ? { ...access, referenceId: id } : access) });
  };
  const toggleCatalogAccess = (access: CatalogAccess, checked: boolean) => {
    const remaining = draft.accesses.filter(row => row.provider && row.nativeModel && !(row.provider === access.provider && row.nativeModel === access.model));
    // A saved access comes back as saved; a new one starts with the operations its native mode implies.
    const saved = creating ? undefined : baseline?.accesses.find(row => row.provider === access.provider && row.nativeModel === access.model);
    const row: Access = saved ?? { provider: access.provider, nativeModel: access.model, id: `${access.provider}/${draft.id}`, route: "Direct provider", status: "Configured", endpoints: declaredEndpoints(access), ...(access.referenceId ? { referenceId: access.referenceId } : {}) };
    update({ accesses: checked ? [...remaining, row] : remaining });
  };
  const original = creating ? undefined : baseline ?? workspace.find(model => model.id === draft.id);
  const invalidReference = draft.accesses.some(access => !!access.referenceId && (viewCatalog ? !viewCatalog.references.some(reference => reference.id === access.referenceId) : !original?.accesses.some(row => row.provider === access.provider && row.nativeModel === access.nativeModel && row.referenceId === access.referenceId)));
  const canContinue = /^[a-z0-9][a-z0-9._-]*$/.test(draft.id) && validAccesses.length > 0;
  const canSave = firstRegistrationIssue(draft) === undefined && !invalidReference;
  const displayedCapabilities = canonicalCapabilities(draft.capabilities);
  const capabilityRows = [...new Set([...capabilityNames, ...Object.keys(displayedCapabilities)])];
  const referenceIds = validAccesses.map(access => access.referenceId ?? catalogAccess(access)?.referenceId);
  const sharedReferenceId = referenceIds.length > 0 && referenceIds[0] && referenceIds.every(id => id === referenceIds[0]) ? referenceIds[0] : "";
  const displayedReference = selectedReference(sharedReferenceId);
  const commonFacts = displayedReference?.fields || {};
  const summaryModel = {
    ...draft,
    inputModalities: draft.inputModalities.length ? draft.inputModalities : modalityList(commonFacts.input_modalities?.value),
    outputModalities: draft.outputModalities.length ? draft.outputModalities : modalityList(commonFacts.output_modalities?.value),
    capabilities: displayedCapabilities,
  };
  const commonFact = (key: string): CatalogField | undefined => commonFacts[key];
  const catalogFact = (found: CatalogAccess | undefined, key: string, referenceId = found?.referenceId) =>
    found?.fields[key] || (found?.omittedFields?.includes(key) ? undefined : selectedReference(referenceId)?.fields[key]);
  const accessFact = (access: Access, key: string) => catalogFact(catalogAccess(access), key, access.referenceId ?? catalogAccess(access)?.referenceId);
  // Discovered accesses matching this model stay out of the card until the user adds one.
  const others = availableAccesses.filter(access => !draft.accesses.some(row => row.provider === access.provider && row.nativeModel === access.model));
  const documentedPrice = (access: CatalogAccess) => {
    const [input, output] = ["input_cost_usd_per_million", "output_cost_usd_per_million"].map(key => catalogFact(access, key)?.value);
    return input === undefined && output === undefined ? copy("No documented price", "Aucun tarif documenté")
      : `${fieldLabel("input_cost_usd_per_million", copy)} ${display(input, "$/M")} · ${fieldLabel("output_cost_usd_per_million", copy)} ${display(output, "$/M")}`;
  };
  const alsoAvailable = others.length > 0 && <section className="space-y-2"><h4 className="text-sm font-semibold">{copy("Also available", "Également disponibles")} · {others.length}</h4><p className="text-xs text-muted-foreground">{copy("Discovered accesses to the same model. They stay out of this card unless you add them.", "Accès découverts pour le même modèle. Ils restent hors de cette fiche sauf si vous les ajoutez.")}</p>{others.map(access => <div key={access.id} className="flex flex-wrap items-start justify-between gap-3 rounded-sm border border-dashed p-3"><span className="min-w-0 space-y-1"><strong className="block text-sm">{displayProvider(access.provider)}</strong><code className="block break-all text-xs">{access.model}</code><span className="block text-xs text-muted-foreground">{documentedPrice(access)}</span></span><Button variant="outline" size="sm" aria-label={copy(`Add ${displayProvider(access.provider)} · ${access.model}`, `Ajouter ${displayProvider(access.provider)} · ${access.model}`)} onClick={() => { toggleCatalogAccess(access, true); setStep("choose"); }}><Plus className="size-4" />{copy("Add", "Ajouter")}</Button></div>)}</section>;
  const openProperty = (key: EditableProperty, target: "reference" | "access", access?: Access) => {
    const record = target === "reference" ? displayedReference : access && catalogAccess(access);
    if (!record) return;
    const fact = target === "reference" ? record.fields[key] : access && accessFact(access, key);
    setProperty({ key, target, id: record.id, value: fact?.value === undefined ? "" : String(fact.value) });
  };
  const editButton = (key: string, target: "reference" | "access", access?: Access) => editableProperties.has(key) && (target === "reference" ? displayedReference : access && catalogAccess(access))
    ? <Button variant="ghost" size="sm" className="mt-1 h-7 px-1 text-xs" aria-label={`${copy("Edit", "Modifier")} ${fieldLabel(key, copy).toLowerCase()} ${target === "reference" ? copy("on model card", "de la fiche commune") : `${copy("for access", "de l’accès")} ${displayProvider(access?.provider ?? "")} ${access?.nativeModel}`}`} onClick={event => { propertyOpener.current = event.currentTarget; openProperty(key as EditableProperty, target, access); }}>{copy("Edit", "Modifier")}</Button> : null;
  const propertyRecord = property?.target === "reference" ? displayedReference : viewCatalog?.accesses.find(access => access.id === property?.id);
  const propertyAccess = property?.target === "access" ? validAccesses.find(access => catalogAccess(access)?.id === property.id) : undefined;
  const propertyCurrent = property?.target === "reference" ? propertyRecord?.fields[property.key] : property && propertyAccess ? accessFact(propertyAccess, property.key) : undefined;
  const propertyInherited = property ? (() => {
    if (property.target === "reference") return catalog?.references.find(record => record.id === property.id)?.fields[property.key]?.value;
    const access = catalog?.accesses.find(record => record.id === property.id);
    const draftAccess = draft.accesses.find(row => row.provider === access?.provider && row.nativeModel === access?.model);
    return access?.fields[property.key]?.value ?? catalog?.references.find(record => record.id === (draftAccess?.referenceId ?? access?.referenceId))?.fields[property.key]?.value;
  })() : undefined;
  let proposed: number | boolean | undefined;
  let propertyValidation = "";
  if (property) {
    try { proposed = parsePropertyValue(property.key, property.value); }
    catch { propertyValidation = property.key === "tool_call" || property.key === "structured_output" ? copy("Choose yes or no.", "Choisir Oui ou Non.") : property.key === "input_cost_usd_per_million" || property.key === "output_cost_usd_per_million" ? copy("Enter a nonnegative number.", "Saisir un nombre positif ou nul.") : copy("Enter a nonnegative whole number.", "Saisir un entier positif ou nul."); }
  }
  const propertyPreview = property && proposed !== undefined ? (viewCatalog?.accesses || []).map(access => {
    const draftAccess = draft.accesses.find(row => row.provider === access.provider && row.nativeModel === access.model);
    const linked = draftAccess?.referenceId ?? access.referenceId;
    const own = access.fields[property.key]?.value;
    const omitted = access.omittedFields?.includes(property.key) || false;
    const inherited = omitted ? undefined : selectedReference(linked)?.fields[property.key]?.value;
    const before = own === undefined ? inherited : own;
    const after = proposedAccessValue(property.target, property.id, access.id, linked, own, inherited, proposed, omitted);
    return { access, before, after, linked };
  }).filter(row => property.target === "reference" ? row.linked === property.id : row.access.id === property.id) : [];
  const saveProperty = () => {
    if (!property || proposed === undefined || !catalog) return;
    const original = (property.target === "reference" ? catalog.references : catalog.accesses).find(record => record.id === property.id)?.fields[property.key]?.value;
    const next = stageCatalogOverride(stagedOverrides, { target: property.target, id: property.id, field: property.key, value: proposed }, original);
    setStagedOverrides(next);
    onOverridesChange?.(next);
    const isPrice = property.key === "input_cost_usd_per_million" || property.key === "output_cost_usd_per_million";
    setPropertyNotice(Object.is(proposed, original) ? copy("Correction removed from draft.", "Correction retirée du brouillon.") : isPrice ? copy("Correction added to the draft. Price corrections are saved with the model and applied as native Bifrost pricing overrides.", "Correction ajoutée au brouillon. Les corrections de prix sont enregistrées avec le modèle et appliquées comme overrides de tarification natifs Bifrost.") : copy("Correction added to the draft. It will be saved with the Registry model; no native Bifrost value is activated here.", "Correction ajoutée au brouillon. Elle sera enregistrée avec le modèle dans Registry ; aucune valeur native Bifrost n’est activée ici."));
    setProperty(null);
  };
  const reviewLabels: Record<string, string> = { name: copy("Display name", "Nom affiché"), creator: copy("Creator", "Créateur"), family: copy("Series", "Série"), summary: copy("Description", "Description"), context: copy("Registry context", "Contexte Registry"), tasks: copy("Tasks", "Usages"), inputModalities: copy("Input", "Entrées"), outputModalities: copy("Output", "Sorties") };
  const originalPropertyValue = (item: CatalogOverride) => {
    if (item.target === "reference") return catalog?.references.find(record => record.id === item.id)?.fields[item.field]?.value;
    const access = catalog?.accesses.find(record => record.id === item.id);
    const draftAccess = draft.accesses.find(row => row.provider === access?.provider && row.nativeModel === access?.model);
    return access?.fields[item.field]?.value ?? catalog?.references.find(record => record.id === (draftAccess?.referenceId ?? access?.referenceId))?.fields[item.field]?.value;
  };
  const reviewChanges = original ? [
    ...(["name", "creator", "family", "summary", "context"] as const).filter(key => original[key] !== draft[key]).map(key => `${reviewLabels[key]}${colon} ${display(original[key])} → ${display(draft[key])}`),
    ...(["tasks", "inputModalities", "outputModalities"] as const).filter(key => JSON.stringify(original[key]) !== JSON.stringify(draft[key])).map(key => `${reviewLabels[key]}${colon} ${display(original[key].map(term))} → ${display(draft[key].map(term))}`),
    ...[...new Set([...Object.keys(original.capabilities), ...Object.keys(draft.capabilities)])].filter(name => original.capabilities[name] !== draft.capabilities[name]).map(name => `${copy("Capability", "Capacité")} ${term(name)}${colon} ${evidence(original.capabilities[name])} → ${evidence(draft.capabilities[name])}`),
    ...draft.accesses.filter(access => !original.accesses.some(before => before.provider === access.provider && before.nativeModel === access.nativeModel)).map(access => `${copy("Access added", "Accès ajouté")}${colon} ${displayProvider(access.provider)} · ${access.nativeModel}`),
    ...original.accesses.filter(access => !draft.accesses.some(after => after.provider === access.provider && after.nativeModel === access.nativeModel)).map(access => `${copy("Access removed", "Accès retiré")}${colon} ${displayProvider(access.provider)} · ${access.nativeModel}`),
    ...draft.accesses.filter(access => original.accesses.some(before => before.provider === access.provider && before.nativeModel === access.nativeModel && before.referenceId !== access.referenceId)).map(access => `${copy("Documentary record for", "Fiche documentaire de")} ${displayProvider(access.provider)}${colon} ${referenceName(original.accesses.find(before => before.provider === access.provider && before.nativeModel === access.nativeModel)?.referenceId)} → ${referenceName(access.referenceId)}`),
    ...draft.accesses.filter(access => original.accesses.some(before => before.provider === access.provider && before.nativeModel === access.nativeModel && JSON.stringify(before.endpoints || []) !== JSON.stringify(access.endpoints || []))).map(access => `${copy("Endpoints for", "Endpoints pour")} ${displayProvider(access.provider)} · ${access.nativeModel}${colon} ${(original.accesses.find(before => before.provider === access.provider && before.nativeModel === access.nativeModel)?.endpoints || []).join(", ") || copy("Unknown", "Inconnu")} → ${(access.endpoints || []).join(", ") || copy("Unknown", "Inconnu")}`),
  ] : [];
  const continueToReview = () => {
    const issue = firstRegistrationIssue(draft);
    setRegistrationIssue(issue);
    if (!issue) { setStep("review"); return; }
    if (issue === "id" || issue === "access" || issue === "operations") { setStep("choose"); if (issue === "access" || issue === "operations") openEdit("access", Math.max(0, draft.accesses.findIndex(access => issue === "operations" ? !access.endpoints?.length : !access.provider || !access.nativeModel || access.id !== `${access.provider}/${draft.id}`))); }
    else setStep("card");
  };
  const stepNames = creating ? ["choose", "card", "review"] as const : ["card", "choose", "review"] as const;
  const stepId = (name: string) => `editor-journey-step-${(stepNames as readonly string[]).indexOf(name)}`;
  const stepLabels = stepNames.map(name => name === "choose" ? copy("Accesses", "Accès") : name === "card" ? copy("Model details", "Fiche modèle") : copy("Review", "Vérifier"));
  const currentStep = Math.max(0, stepNames.findIndex(name => name === step));
  const changeStep = (index: number) => {
    if (index === stepNames.length - 1) { const valid = !firstRegistrationIssue(draft); continueToReview(); return valid; }
    if (creating && index > 0 && !canContinue) { setRegistrationIssue(firstRegistrationIssue(draft)); setStep("choose"); return false; }
    setStep(stepNames[index] || stepNames[stepNames.length - 1]); return true;
  };
  const modelSummary = <div className="space-y-3"><div className="rounded-sm border bg-card p-3"><p className="font-semibold">{draft.name || copy("Unnamed model", "Modèle sans nom")}</p><code className="break-all text-xs">{draft.id || copy("ID missing", "ID manquant")}</code></div><div><h3 className="mb-2 text-sm font-semibold">{copy("Provider accesses", "Accès fournisseurs")} · {validAccesses.length}</h3>{validAccesses.map(access => <p key={access.id} className="break-all border-t py-2 text-xs">{displayProvider(access.provider)} · {access.nativeModel}<br /><span className="text-muted-foreground">{copy("Registry ID", "ID Registry")} · {access.id}</span></p>)}{!validAccesses.length && <p className="text-xs text-muted-foreground">{copy("Add at least one provider access.", "Ajoutez au moins un accès fournisseur.")}</p>}</div>{!canSave && <p className="text-xs text-destructive">{copy("Complete the required fields before saving.", "Complétez les champs obligatoires avant l’enregistrement.")}</p>}</div>;
  const editorFooter = <><div className="mb-3">{error && <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}</div><div className="flex flex-wrap justify-end gap-2">{!creating && <Button variant="ghost" className="mr-auto text-destructive" onClick={() => onDelete(draft)}>{copy("Delete", "Supprimer")}</Button>}{currentStep > 0 && <Button variant="ghost" onClick={() => changeStep(currentStep - 1)}>{copy("Back", "Retour")}</Button>}<Button variant="outline" onClick={onCancel}>{copy("Cancel", "Annuler")}</Button>{currentStep < stepNames.length - 1 ? <Button disabled={step === "choose" && !canContinue} onClick={() => !creating || currentStep === stepNames.length - 2 ? continueToReview() : changeStep(currentStep + 1)}>{currentStep === 0 ? copy(creating ? "Prepare model card" : "Review", creating ? "Préparer la fiche" : "Vérifier") : copy("Review", "Vérifier")}</Button> : <Button disabled={busy || !canSave} onClick={() => onSave(stagedOverrides)}>{copy("Save model", "Enregistrer le modèle")}</Button>}</div></>;

  const chooser = (expert || step === "choose") && <section id={stepId("choose")} className="space-y-4">
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{copy("Selected model", "Modèle choisi")}</p><h3 className="text-2xl font-semibold">{draft.name || draft.id || copy("Choose a model", "Choisir un modèle")}</h3><p className="text-sm text-muted-foreground">{copy("Creator", "Créateur")}{colon} {creatorName(draft.creator)} · {copy("Series", "Série")}{colon} {display(draft.family)}</p><p className="mt-2 text-sm">{copy("Confirm the exact accesses to include in this model card.", "Confirmez les accès exacts à regrouper dans cette fiche.")}</p></div>
        {!creating ? <p className="text-sm">{copy("Common model ID", "Identifiant commun")} · <code>{draft.id}</code></p> : draft.id ? <details className="rounded-sm border p-3"><summary className="cursor-pointer text-sm">{copy("Common model ID", "Identifiant commun")} · <code>{draft.id}</code></summary><div className="mt-3"><SearchableSelect label={copy("Change common model ID", "Changer l’identifiant commun")} value={draft.id} options={options.modelIds} onChange={chooseModelId} placeholder={copy("Search or enter an ID", "Chercher ou saisir un identifiant")} /></div><p className="text-xs text-muted-foreground">{copy("Changing this ID recalculates Registry access IDs. Provider selection remains separate.", "Changer cet identifiant recalcule les IDs exposés Registry. La sélection entre fournisseurs reste distincte.")}</p></details> : <SearchableSelect label={copy("Search a model or enter its ID *", "Chercher un modèle ou saisir son identifiant *")} value={draft.id} options={options.modelIds} onChange={chooseModelId} placeholder={copy("Model or custom ID", "Modèle ou identifiant personnalisé")} />}
        <section className="space-y-2"><h4 className="text-sm font-semibold">{copy("In this card", "Dans cette fiche")} · {validAccesses.length}</h4>
          {validAccesses.map((access, index) => <div key={`${access.provider}/${access.nativeModel}/${index}`} className="space-y-3 rounded-sm border p-3 text-sm"><div className="flex items-start justify-between gap-2"><p><strong>{displayProvider(access.provider)}</strong> · <code className="break-all">{access.nativeModel}</code></p><Button variant="ghost" size="sm" aria-label={copy(`Remove ${displayProvider(access.provider)} · ${access.nativeModel}`, `Retirer ${displayProvider(access.provider)} · ${access.nativeModel}`)} onClick={() => update({ accesses: draft.accesses.filter(row => row !== access) })}><X className="size-4" />{copy("Remove", "Retirer")}</Button></div><EndpointChoices access={access} invalid={registrationIssue === "operations" && !access.endpoints?.length} onChange={endpoints => update({ accesses: draft.accesses.map(row => row === access ? { ...row, endpoints } : row) })} /></div>)}
          {draft.accesses.length === 0 && <p className="text-sm text-muted-foreground">{copy("No access selected.", "Aucun accès sélectionné.")}</p>}
        </section>
        {alsoAvailable}
        <Button variant="outline" size="sm" onClick={() => openEdit("access", validAccesses.length, { ...draft, accesses: [...validAccesses, { provider: "", id: "", nativeModel: "", route: "Direct provider", status: "Unknown" }] })}><Plus className="size-4" />{copy("Enter access manually", "Saisir un accès manuellement")}</Button>
        {!canContinue && <p role="status" className="text-sm text-destructive">{copy("Choose a valid common model ID and at least one complete provider access to prepare the card.", "Choisissez un identifiant commun valide et au moins un accès fournisseur complet pour préparer la fiche.")}</p>}
      </section>;

  return <SheetContent inert={busy} expandable className="min-h-0 max-w-[calc(100vw-1rem)] p-4 sm:max-w-5xl sm:p-6">
    <SheetHeader className="shrink-0 border-b pb-4"><SheetTitle className="text-xl">{creating ? copy("Save model", "Enregistrer un modèle") : draft.name}</SheetTitle><SheetDescription>{creating ? copy("Choose accesses, review the model card, then verify the save.", "Choisir les accès, lire la fiche, puis vérifier l’enregistrement.") : copy("Model card and provider accesses.", "Fiche du modèle et accès fournisseurs enregistrés.")}</SheetDescription></SheetHeader>
    <EditorJourney labels={stepLabels} step={currentStep} onStepChange={changeStep} expert={expert} onExpertChange={value => onExpertChange?.(value)} canExpert={canExpert} summary={modelSummary} footer={editorFooter}>
      {catalogError && <p role="status" className="rounded-sm border p-3 text-xs text-muted-foreground">{copy("Reference data unavailable", "Données de référence indisponibles")}{colon} {catalogError}. {copy("Existing accesses remain visible.", "Les accès déjà présents restent visibles.")}</p>}
      {propertyNotice && <p role="status" className="rounded-sm border bg-primary/5 p-3 text-sm">{propertyNotice}</p>}
      {registrationIssue && <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{registrationIssue === "id" ? copy("Enter a valid common model ID.", "Saisissez un identifiant commun valide.") : registrationIssue === "name" ? copy("A display name is required.", "Le nom affiché est obligatoire.") : registrationIssue === "operations" ? copy("Choose at least one Registry endpoint for every provider access.", "Choisissez au moins un endpoint Registry pour chaque accès fournisseur.") : copy("Complete each provider access: provider, native model ID, and matching Registry ID.", "Complétez chaque accès fournisseur : fournisseur, ID natif et ID Registry correspondant.")}</p>}

      {creating && chooser}

      {(expert || step === "card") && <div id={stepId("card")} className="space-y-5">
        <section className="grid gap-3 rounded-sm border bg-card p-4 sm:grid-cols-2"><Field data-invalid={!draft.name.trim()}><FieldLabel htmlFor="model-display-name">{copy("Display name", "Nom affiché")} *</FieldLabel><Input id="model-display-name" aria-required="true" aria-invalid={!draft.name.trim()} autoFocus={!draft.name.trim()} value={draft.name} onChange={event => update({ name: event.target.value })} /><FieldDescription>{!draft.name.trim() ? copy("A display name is required.", "Le nom affiché est obligatoire.") : copy("Shown in the Registry catalog.", "Affiché dans le catalogue Registry.")}</FieldDescription></Field></section>

        <section className="rounded-sm border bg-card p-4"><div className="flex flex-wrap items-start gap-3"><BrandIcon model={draft} mode="creator" /><div className="min-w-0 flex-1 basis-48"><p className="text-xs uppercase tracking-wide text-muted-foreground">{creating ? copy("Preview before saving", "Aperçu avant enregistrement") : copy("Registry model", "Fiche modèle Registry")}</p><h3 className="mt-1 break-words text-2xl font-semibold">{draft.name || draft.id || copy("Unnamed model", "Modèle sans nom")}</h3><code className="break-all text-xs text-muted-foreground">{draft.id}</code><p className="mt-2 text-sm text-muted-foreground">{creatorName(draft.creator)} · {display(draft.family)}</p></div><Button variant="outline" size="sm" onClick={() => openEdit("identity")}>{copy("Edit identity", "Modifier l’identité")}</Button></div></section>
        <nav aria-label={copy("Model details", "Détails du modèle")} className="grid grid-cols-2 gap-1 border-b sm:flex sm:overflow-x-auto">{([ ["overview", "Overview", "Vue d’ensemble"], ["access", "Access", "Accès"], ["properties", "Properties", "Propriétés"], ["sources", "Sources", "Sources"] ] as const).map(([id, en, fr]) => <Button key={id} type="button" variant="ghost" aria-pressed={cardTab === id} className={`shrink-0 rounded-b-none border-b-2 ${cardTab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`} onClick={() => setCardTab(id)}>{copy(en, fr)}</Button>)}</nav>
        {cardTab === "overview" && <section className="space-y-4 rounded-sm border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{copy("Model identity", "Identité du modèle")}</p><p className="mt-1 text-sm">{draft.summary || copy("No description recorded.", "Aucune description enregistrée.")}</p></div><Button variant="outline" size="sm" onClick={() => openEdit("details")}>{copy("Edit Registry details", "Modifier les détails Registry")}</Button></div><div className="grid gap-3 sm:grid-cols-3"><div><span className="text-xs text-muted-foreground">{copy("Creator", "Créateur")}</span><p className="text-sm font-medium">{creatorName(draft.creator)}</p></div><div><span className="text-xs text-muted-foreground">{copy("Series", "Série")}</span><p className="text-sm font-medium">{display(draft.family)}</p></div></div></section>}
        {cardTab === "properties" && <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">{copy("Documented properties", "Propriétés documentées")}</h4><Button variant="outline" size="sm" onClick={() => openEdit("details")}>{copy("Edit Registry details", "Modifier les détails Registry")}</Button></div><p className="text-xs text-muted-foreground">{copy("Each column shows its value and source. Access-specific facts stay separate; Registry corrections apply native Bifrost pricing overrides only for price fields.", "Chaque colonne montre sa valeur et sa source. Les données propres à un accès restent distinctes ; les corrections Registry appliquent des overrides de tarification natifs Bifrost uniquement pour les champs de prix.")}</p><p className="text-xs text-muted-foreground">{copy("Declared means reported by the source, without an inference test. Bifrost catalog identifies where the value was imported from.", "Déclaré signifie indiqué par la source, sans test d’inférence. Catalogue Bifrost indique l’origine de la valeur importée.")}</p>{!displayedReference && <p className="text-xs text-muted-foreground">{copy("No shared documentary record: selected accesses do not all use the same mapping.", "Fiche documentaire commune indisponible : les accès sélectionnés n’ont pas tous la même association.")}</p>}
          <div className="space-y-2 md:hidden">{facts.map(([key, unit]) => <div key={key} className="rounded-sm border bg-card p-3"><h5 className="mb-2 text-sm font-medium">{fieldLabel(key, copy)}</h5><div className="grid gap-2 sm:grid-cols-2"><div><span className="text-xs text-muted-foreground">{copy("Model card", "Fiche commune")}</span><FactValue fact={commonFact(key)} unit={unit} />{editButton(key, "reference")}</div>{validAccesses.map(access => { const fact = accessFact(access, key); return <div key={`${access.provider}/${access.nativeModel}`}><span className="text-xs text-muted-foreground">{displayProvider(access.provider)}</span><FactValue fact={fact} inherited={!catalogAccess(access)?.fields[key] && !!fact} accessSpecific={!!catalogAccess(access)?.fields[key]} unit={unit} />{editButton(key, "access", access)}<PricingApplication proofs={pricingProofs} access={access} field={key} fact={fact} /></div>; })}</div></div>)}</div>
          <div className="hidden overflow-x-auto rounded-sm border md:block"><table className="w-full min-w-[620px] border-collapse text-left"><thead className="bg-muted/40"><tr><th scope="col" className="p-3 text-xs font-medium">{copy("Property", "Propriété")}</th><th scope="col" className="p-3 text-xs font-medium">{copy("Model card", "Fiche commune")}</th>{validAccesses.map(access => <th key={`${access.provider}/${access.nativeModel}`} scope="col" className="min-w-40 p-3 text-xs font-medium">{displayProvider(access.provider)}</th>)}</tr></thead><tbody>{facts.map(([key, unit]) => <tr key={key} className="border-t align-top"><th scope="row" className="p-3 text-sm font-medium">{fieldLabel(key, copy)}</th><td className="p-3"><FactValue fact={commonFact(key)} unit={unit} />{editButton(key, "reference")}</td>{validAccesses.map(access => { const fact = accessFact(access, key); return <td key={`${access.provider}/${access.nativeModel}`} className="p-3"><FactValue fact={fact} inherited={!catalogAccess(access)?.fields[key] && !!fact} accessSpecific={!!catalogAccess(access)?.fields[key]} unit={unit} />{editButton(key, "access", access)}<PricingApplication proofs={pricingProofs} access={access} field={key} fact={fact} /></td>; })}</tr>)}</tbody></table></div>
          <div className="space-y-3 border-t pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">{copy("Modalities and capabilities", "Modalités et capacités")}</h4><Button variant="outline" size="sm" onClick={() => openEdit("capabilities")}>{copy("Edit Registry values", "Modifier les valeurs Registry")}</Button></div><div className="flex flex-wrap gap-x-4 gap-y-2"><div className="min-w-0"><p className="mb-1 text-xs font-medium text-muted-foreground">{copy("Modalities", "Modalités")}</p><ModelModalitiesSummary model={summaryModel} /></div><div className="min-w-0"><p className="mb-1 text-xs font-medium text-muted-foreground">{copy("Capabilities", "Capacités")}</p><ModelCapabilitiesSummary model={summaryModel} context={{ source: "Registry", scope: copy("Model-level declaration", "Déclaration de la fiche"), execution: copy("Not verified", "Non vérifiée") }} /></div></div><p className="text-xs text-muted-foreground">{copy("A Registry declaration does not prove native support or activation.", "Une déclaration Registry ne prouve ni la prise en charge native ni l’activation.")}</p><p className="text-sm">{copy("Tasks", "Usages")}{colon} {draft.tasks.length ? draft.tasks.map(term).join(", ") : copy("Unknown", "Inconnu")}</p></div></section>}
        {cardTab === "access" && <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div className="min-w-0 flex-1"><label className="mb-1 block text-sm font-medium">{copy("Select provider access", "Choisir un accès fournisseur")}</label><Select value={selectedAccess?.id ?? ""} onValueChange={setSelectedAccessId}><SelectTrigger className="w-full"><SelectValue placeholder={copy("Select an access", "Choisir un accès")} /></SelectTrigger><SelectContent>{validAccesses.map(access => <SelectItem key={access.id} value={access.id}>{displayProvider(access.provider)} · {access.nativeModel}</SelectItem>)}</SelectContent></Select></div><Button variant="outline" size="sm" onClick={() => setStep("choose")}>{copy("Edit accesses", "Modifier les accès")}</Button></div>{selectedAccess && <div className="grid gap-3 rounded-sm border bg-card p-4 sm:grid-cols-2"><div><span className="text-xs text-muted-foreground">{copy("Access ID", "ID d’accès")}</span><code className="block break-all text-sm">{selectedAccess.id}</code></div><div><span className="text-xs text-muted-foreground">{copy("Native model ID", "ID natif du modèle")}</span><code className="block break-all text-sm">{selectedAccess.nativeModel}</code></div><div><span className="text-xs text-muted-foreground">{copy("Provider route", "Route fournisseur")}</span><p className="text-sm">{selectedAccess.route === "Direct provider" ? copy("Direct provider", "Fournisseur direct") : selectedAccess.route}</p></div><div><span className="text-xs text-muted-foreground">{copy("Configuration", "Configuration")}</span><p className="text-sm">{catalogAccess(selectedAccess)?.configured ? copy("Configured in Bifrost", "Configuré dans Bifrost") : selectedAccess.status === "Configured" ? copy("Configured · discovered", "Configuré · découvert") : copy("Unknown", "Inconnu")}</p></div></div>}<div className="grid gap-2 sm:grid-cols-2">{validAccesses.map((access, index) => {
          const found = catalogAccess(access);
          return <div key={`${access.provider}/${access.nativeModel}/${index}`} className="space-y-3 rounded-sm border bg-card p-3">
            <div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-start gap-2"><BrandIcon model={{ ...draft, accesses: [access] }} mode="provider" /><div className="min-w-0 space-y-1"><p className="text-xs font-semibold">{copy("Provider access", "Accès natif")}</p><p className="text-xs text-muted-foreground">{copy("Provider in Bifrost", "Fournisseur dans Bifrost")}</p><strong className="block break-words text-sm">{displayProvider(access.provider)}</strong><p className="text-xs text-muted-foreground">{copy("Model at this provider", "Modèle chez ce fournisseur")}</p><code className="block break-all text-xs">{access.nativeModel}</code><span className="block text-xs text-muted-foreground">{found?.configured ? copy("Configured · Bifrost", "Configuré · Bifrost") : access.status === "Configured" ? copy("Configured · discovered", "Configuré · découverte") : copy("Status unknown", "État inconnu")}</span></div></div><Button variant="outline" size="sm" onClick={() => openEdit("access", draft.accesses.indexOf(access))}>{copy("Edit", "Modifier")}</Button></div><EndpointChoices access={access} onChange={endpoints => update({ accesses: draft.accesses.map(row => row === access ? { ...row, endpoints } : row) })} />
          </div>;
        })}</div>{alsoAvailable}</section>}
        {cardTab === "sources" && <section className="grid gap-3 md:grid-cols-2">{validAccesses.map(access => { const found = catalogAccess(access); const reference = selectedReference(access.referenceId ?? found?.referenceId); return <div key={`${access.provider}/${access.nativeModel}`} className="min-w-0 rounded-sm border bg-card p-4"><h4 className="font-semibold">{displayProvider(access.provider)}</h4><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{access.nativeModel}</p><div className="mt-3 border-t pt-3"><p className="text-xs text-muted-foreground">{copy("Documentary record", "Fiche documentaire")}</p><p className="text-sm font-medium">{reference ? display(reference.fields.name?.value) : copy("No linked record", "Aucune fiche liée")}</p>{reference && <p className="mt-1 break-words text-xs text-muted-foreground">{copy("Sources", "Sources")}{colon} {referenceSources(reference, copy)}</p>}<p className="mt-2 text-xs text-muted-foreground">{associationStatus(access, found)}</p>{reference && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">{copy("Document ID", "Identifiant documentaire")}</summary><code className="block break-all">{reference.id}</code></details>}</div><p className="mt-3 text-xs text-muted-foreground">{copy("Documentary data; provider behavior is not tested.", "Données documentaires ; le comportement fournisseur n’est pas testé.")}</p></div>; })}</section>}
        {actionSlot && <details className="rounded-sm border p-3"><summary className="cursor-pointer text-sm font-medium">{copy("Optional assistance", "Assistance facultative")}</summary><div className="mt-3">{actionSlot}</div></details>}
      </div>}

      {!creating && chooser}

      {(expert || step === "review") && <section id={stepId("review")} className="space-y-4"><div><h3 className="text-lg font-semibold">{copy("Review before saving", "Vérifier avant enregistrement")}</h3><p className="text-sm text-muted-foreground">{copy("Selected operations define Registry request types; they do not prove model support. An access is not enabled for a key and does not choose its provider.", "Les opérations choisies déterminent les types de requêtes exposés par Registry ; elles ne prouvent pas que le modèle les prend en charge. La présence d’un accès ne l’active pas pour une clé et ne choisit pas le fournisseur.")}</p>{!creating && <p className="text-sm text-muted-foreground">{copy("Registry keys already using this model card will receive its changes.", "Les clés Registry utilisant déjà cette fiche recevront ses changements.")}</p>}</div><div className="rounded-sm border bg-card p-4"><p><strong>{draft.name || copy("Name missing", "Nom manquant")}</strong> · <code>{draft.id || copy("ID missing", "ID manquant")}</code></p><p className="mt-1 text-sm">{copy("Creator", "Créateur")}{colon} {creatorName(draft.creator)} · {copy("Series", "Série")}{colon} {display(draft.family)}</p><div className="mt-3 space-y-1 border-t pt-3 text-xs"><strong>{copy("Common model ID and accesses", "Identifiant commun et accès")}</strong>{draft.accesses.map(access => <p key={`${access.provider}/${access.nativeModel}`}>{copy("Registry ID", "ID Registry")}{colon} <code>{access.id}</code> → {access.provider} / <code>{access.nativeModel}</code>{draft.id !== access.nativeModel && <span className="block text-muted-foreground">{snapshotMode ? copy("Simulated alias in this copy", "Alias simulé dans la copie") : copy("Bifrost alias planned for affected keys", "Alias Bifrost prévu pour les clés concernées")}{colon} <code>{draft.id}</code> → <code>{access.nativeModel}</code></span>}</p>)}</div></div>{original && <div className="rounded-sm border p-3"><h4 className="text-sm font-semibold">{copy("Proposed changes", "Changements proposés")}</h4>{reviewChanges.length ? <ul className="mt-2 space-y-1 text-sm">{reviewChanges.map((change, index) => <li key={index}>{change}</li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">{copy("No changes to the Registry model card.", "Aucun changement dans la fiche Registry.")}</p>}</div>}{stagedOverrides.length > 0 && <div className="rounded-sm border p-3"><h4 className="text-sm font-semibold">{copy("Catalog corrections saved with this model", "Corrections du catalogue à enregistrer avec le modèle")}</h4><ul className="mt-2 space-y-1 text-sm">{stagedOverrides.map(item => <li key={`${item.target}/${item.id}/${item.field}`}>{fieldLabel(item.field, copy)} · {item.target === "reference" ? copy("Model card", "fiche documentaire") : copy("provider access", "accès fournisseur")} <code>{item.id}</code>{colon} {display(originalPropertyValue(item))} → {display(item.value)}</li>)}</ul></div>}<div className="space-y-2">{draft.accesses.map((access, index) => {
        const found = catalogAccess(access);
        const reference = selectedReference(access.referenceId ?? found?.referenceId);
        return <div key={index} className="rounded-sm border p-3 text-sm"><strong>{displayProvider(access.provider) || copy("Provider missing", "Fournisseur manquant")}</strong> · <code className="break-all">{access.nativeModel || copy("Native ID missing", "ID natif manquant")}</code><p className="text-xs text-muted-foreground">{copy("Registry exposed ID", "ID exposé Registry")}{colon} {access.id || copy("Unknown", "Inconnu")}</p><p className="text-xs">{copy("Registry endpoints", "Endpoints Registry")}{colon} {(access.endpoints || []).join(", ") || copy("Unknown", "Inconnu")}</p><p className="mt-2">{copy("Documentary record", "Fiche documentaire")}{colon} {reference ? display(reference.fields.name?.value) : copy("No record linked", "aucune fiche liée")}</p>{reference && <p className="text-xs text-muted-foreground">{copy("Sources", "Sources")}{colon} {referenceSources(reference, copy)}</p>}<p className="text-xs text-muted-foreground">{associationStatus(access, found)}</p>{reference && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{copy("Document ID", "Identifiant documentaire")}</summary><code className="block break-all">{reference.id}</code></details>}</div>;
      })}</div>{invalidReference && <p role="alert" className="text-sm text-destructive">{copy("An access points to a documentary record missing from the catalog.", "Une correspondance pointe vers une fiche documentaire absente du catalogue.")}</p>}{!canSave && <p role="alert" className="text-sm text-destructive">{copy("Complete the name, choose endpoints for every access, and complete each provider access before saving.", "Complétez le nom et chaque accès, puis choisissez ses endpoints avant l’enregistrement.")}</p>}</section>}
    </EditorJourney>

    <Dialog open={editing !== null} onOpenChange={open => { if (!open) closeEdit(); }}><DialogContent className="max-h-[90vh] overflow-y-auto" onCloseAutoFocus={event => { event.preventDefault(); editOpener.current?.focus(); }}>
      <DialogHeader><DialogTitle>{editing === "identity" ? copy("Edit identity", "Modifier l’identité") : editing === "details" ? copy("Edit Registry details", "Modifier les détails Registry") : editing === "capabilities" ? copy("Edit tasks and capabilities", "Modifier usages et capacités") : copy("Edit provider access", "Modifier un accès")}</DialogTitle><DialogDescription>{copy("Changes are added to the draft after confirmation, then reviewed before saving.", "Les modifications seront ajoutées au brouillon après confirmation, puis relues avant l’enregistrement.")}</DialogDescription></DialogHeader>
      {editing === "identity" && <div className="space-y-3"><label className="block text-sm">{copy("Display name *", "Nom affiché *")}<Input className="mt-1" autoFocus={!form.name.trim()} aria-required="true" aria-invalid={!form.name.trim()} value={form.name} onChange={event => updateEdit({ name: event.target.value })} />{!form.name.trim() && <span className="mt-1 block text-xs text-destructive">{copy("Enter a name for this model.", "Saisissez le nom de ce modèle.")}</span>}</label>{form.accesses.map((access, index) => <EndpointChoices key={access.id} access={access} invalid={!access.endpoints?.length} onChange={endpoints => updateEdit({ accesses: form.accesses.map((row, rowIndex) => rowIndex === index ? { ...row, endpoints } : row) })} />)}<p className="text-xs text-muted-foreground">{copy("Endpoint choices do not prove model support. Common ID:", "Les choix d’endpoints ne prouvent pas la prise en charge du modèle. Identifiant commun :")} {form.id}.</p></div>}
      {editing === "details" && <div className="space-y-3"><SearchableSelect label={copy("Creator", "Créateur")} value={form.creator} options={options.creators} onChange={creator => updateEdit({ creator })} /><SearchableSelect label={copy("Series", "Série")} value={form.family} options={options.families} onChange={family => updateEdit({ family })} /><label className="block text-sm">{copy("Description", "Description")}<Textarea className="mt-1" value={form.summary} onChange={event => updateEdit({ summary: event.target.value })} /></label><ToggleChoices label={copy("Input modalities", "Modalités d’entrée")} choices={modalities.filter(value => value !== "Vector")} selected={form.inputModalities} onChange={inputModalities => updateEdit({ inputModalities })} /><ToggleChoices label={copy("Output modalities", "Modalités de sortie")} choices={modalities} selected={form.outputModalities} onChange={outputModalities => updateEdit({ outputModalities })} /></div>}
      {editing === "capabilities" && <div className="space-y-3"><ToggleChoices label={copy("Tasks", "Usages")} choices={tasks} selected={form.tasks} onChange={tasks => updateEdit({ tasks })} />{capabilityRows.map(name => <div key={name} className="flex items-center justify-between gap-2 text-sm"><span>{term(name)}</span><Select value={canonicalCapabilities(form.capabilities)[name] || "Unknown"} onValueChange={value => updateEdit({ capabilities: { ...canonicalCapabilities(form.capabilities), [name]: value as Capability } })}><SelectTrigger aria-label={`${term(name)} ${copy("evidence", "état")}`} className="w-48"><SelectValue /></SelectTrigger><SelectContent>{(canonicalCapabilities(form.capabilities)[name] === "Observed in simulated campaign" ? ["Observed in simulated campaign", "Declared", "Unknown"] : ["Declared", "Unknown"]).map(value => <SelectItem key={value} value={value}>{evidence(value as Capability)}</SelectItem>)}</SelectContent></Select></div>)}<p className="text-xs text-muted-foreground">{copy("Unknown differs from no. A simulated campaign does not verify real provider support.", "Inconnu reste distinct de « non ». Une campagne simulée ne vérifie pas une capacité fournisseur réelle.")}</p></div>}
      {editing === "access" && form.accesses[editingAccess] && <div className="space-y-3"><SearchableSelect label={copy("Provider in Bifrost *", "Fournisseur dans Bifrost *")} value={form.accesses[editingAccess].provider} options={options.providers} onChange={provider => changeEditAccess(editingAccess, { provider })} /><label className="block text-sm">{copy("Model at this provider *", "Modèle chez ce fournisseur *")}<Input className="mt-1 font-mono" value={form.accesses[editingAccess].nativeModel || ""} readOnly={!!catalogAccess(form.accesses[editingAccess])} onChange={event => changeEditAccess(editingAccess, { nativeModel: event.target.value })} /></label><p className="text-xs text-muted-foreground">{catalogAccess(form.accesses[editingAccess]) ? copy("Discovered in Bifrost · read only.", "Identifiant découvert dans Bifrost · lecture seule.") : copy("Manual access: enter the exact ID configured in Bifrost.", "Accès manuel : reprendre l’identifiant exact configuré dans Bifrost.")}</p><SearchableSelect label={copy("Documentary record for this access", "Fiche documentaire pour cet accès")} value={form.accesses[editingAccess].referenceId || ""} options={referenceOptions} onChange={id => chooseEditReference(editingAccess, id)} placeholder={copy("Search documentary records", "Chercher une fiche documentaire")} />{form.accesses[editingAccess].referenceId && <Button variant="ghost" size="sm" onClick={() => changeEditAccess(editingAccess, { referenceId: "" })}>{copy("Unlink", "Dissocier")}</Button>}{form.accesses[editingAccess].referenceId && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{copy("Document ID", "Identifiant documentaire")}</summary><code className="block break-all">{form.accesses[editingAccess].referenceId}</code></details>}<label className="block text-sm">{copy("Registry exposed ID", "ID exposé Registry")}<Input className="mt-1 font-mono" value={form.accesses[editingAccess].id} readOnly /></label><EndpointChoices access={form.accesses[editingAccess]} invalid={!form.accesses[editingAccess].endpoints?.length} onChange={endpoints => changeEditAccess(editingAccess, { endpoints })} /><div className="flex items-center gap-2 text-sm"><span>{copy("Status", "Statut")}</span><Select value={form.accesses[editingAccess].status} onValueChange={status => changeEditAccess(editingAccess, { status: status as Access["status"] })}><SelectTrigger aria-label={copy("Access status", "Statut de l’accès")} className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Configured">{copy("Configured", "Configuré")}</SelectItem><SelectItem value="Unknown">{copy("Unknown", "Inconnu")}</SelectItem></SelectContent></Select></div><p className="text-xs text-muted-foreground">{copy("Route", "Route")}{colon} {form.accesses[editingAccess].route}. {copy("Native routing is configured separately.", "Le routage natif se règle séparément.")}</p><Button variant="ghost" size="sm" disabled={form.accesses.length === 1} onClick={() => updateEdit({ accesses: form.accesses.filter((_, index) => index !== editingAccess) })}><X className="size-4" />{copy("Remove access", "Retirer cet accès")}</Button></div>}
    <DialogFooter><Button variant="outline" onClick={closeEdit}>{copy("Cancel", "Annuler")}</Button><Button disabled={editing === "identity" ? !form.name.trim() : editing === "access" ? !form.accesses[editingAccess]?.endpoints?.length || form.accesses.some(access => !access.provider || !access.nativeModel || access.id !== `${access.provider}/${form.id}` || !!access.referenceId && !catalog?.references.some(reference => reference.id === access.referenceId)) : false} onClick={() => { if (editDraft) onChange(editDraft); closeEdit(); setRegistrationIssue(undefined); }}>{copy("Keep changes", "Garder les modifications")}</Button></DialogFooter>
    </DialogContent></Dialog>

    <Dialog open={!!property} onOpenChange={open => { if (!open) setProperty(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto" onCloseAutoFocus={event => { event.preventDefault(); propertyOpener.current?.focus(); }}>
      <DialogHeader><DialogTitle>{copy("Edit", "Modifier")} {property ? fieldLabel(property.key, copy) : ""}</DialogTitle><DialogDescription>{property?.target === "reference" ? copy("Model card", "Fiche documentaire commune") : copy("Provider access", "Accès fournisseur")} · {copy("The correction is added to the draft. Review all linked accesses before saving the model.", "Correction ajoutée au brouillon. Vérifiez tous les accès liés avant l’enregistrement du modèle.")}</DialogDescription></DialogHeader>
      {property && <div className="space-y-4">
        <p className="text-sm">{copy("Current", "Actuel")}{colon} <strong>{display(propertyCurrent?.value, facts.find(([key]) => key === property.key)?.[1])}</strong> <span className="text-xs text-muted-foreground">· {propertyCurrent ? sourceLabel(propertyCurrent.source, copy) : copy("Source unknown", "Source inconnue")}</span></p>
        {property.key === "tool_call" || property.key === "structured_output"
          ? <label className="block text-sm">{fieldLabel(property.key, copy)} {copy("proposed", "proposé")}<select className="mt-1 h-9 w-full rounded-sm border bg-background px-3" value={property.value} onChange={event => setProperty({ ...property, value: event.target.value })}><option value="">{copy("Choose yes or no", "Choisir Oui ou Non")}</option><option value="true">{copy("Yes", "Oui")}</option><option value="false">{copy("No", "Non")}</option></select></label>
          : <label className="block text-sm">{fieldLabel(property.key, copy)} {property.key === "input_cost_usd_per_million" || property.key === "output_cost_usd_per_million" ? copy("proposed, $ / million tokens", "proposé, $ / million de tokens") : copy("proposed, in tokens", "proposé, en tokens")}<Input className="mt-1" type="number" min="0" step={property.key === "input_cost_usd_per_million" || property.key === "output_cost_usd_per_million" ? "0.0001" : "1"} inputMode={property.key === "input_cost_usd_per_million" || property.key === "output_cost_usd_per_million" ? "decimal" : "numeric"} value={property.value} onChange={event => setProperty({ ...property, value: event.target.value })} /></label>}
        {property?.target === "access" && propertyInherited !== undefined && <Button variant="ghost" size="sm" className="h-7 px-1 text-xs" onClick={() => setProperty({ ...property, value: String(propertyInherited) })}>{copy("Revert to inherited", "Revenir à la valeur héritée")}</Button>}
        {propertyValidation && <p role="alert" className="text-xs text-destructive">{propertyValidation}</p>}
        <div className="rounded-sm border bg-muted/30 p-3"><h4 className="text-sm font-semibold">{copy("Correction preview", "Aperçu de la correction")}</h4>{property.target === "reference" && <p className="mt-2 text-sm">{copy("Model card", "Fiche documentaire")} · {display(propertyRecord?.fields[property.key]?.value)} → {display(proposed)}</p>}{(property.key === "input_cost_usd_per_million" || property.key === "output_cost_usd_per_million") && property.target === "reference" && (() => { const affected = propertyPreview.filter(row => !Object.is(row.before, row.after)); return affected.length > 0 ? <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">{copy(`Applies to ${affected.length} access${affected.length > 1 ? "es" : ""}`, `S'applique à ${affected.length} accès`)}{colon} {affected.map(row => `${row.access.provider}/${row.access.model}`).join(", ")}</p> : null; })()}<div className="mt-2 space-y-2">{propertyPreview.map(row => <p key={row.access.id} className="text-sm"><strong>{displayProvider(row.access.provider)}</strong> · <code>{row.access.model}</code> · {display(row.before)} → {display(row.after)} <span className="text-xs text-muted-foreground">{Object.is(row.before, row.after) ? copy("unchanged", "inchangé") : copy("proposed in Registry", "proposé dans Registry")}</span></p>)}</div>{propertyPreview.length === 0 && <p className="mt-2 text-xs text-muted-foreground">{copy("No catalog access is linked to this record.", "Aucun accès du catalogue n’est lié à cette fiche.")}</p>}{propertyPreview.length > 0 && propertyPreview.every(row => Object.is(row.before, row.after)) && <p className="mt-2 text-xs text-muted-foreground">{copy("No linked access changes value.", "Aucun accès lié ne change de valeur.")}</p>}</div>
        <p className="text-xs text-muted-foreground">{property && (property.key === "input_cost_usd_per_million" || property.key === "output_cost_usd_per_million") ? copy("Price corrections are saved with the model and applied as native Bifrost pricing overrides.", "Les corrections de prix sont enregistrées avec le modèle et appliquées comme overrides de tarification natifs Bifrost.") : copy("This correction documents Registry catalog data. It does not activate a capability, route, or native Bifrost limit.", "Cette correction documente le catalogue Registry. Elle n’active ni capacité, ni routage, ni limite native Bifrost.")}</p>
        <DialogFooter><Button variant="outline" onClick={() => setProperty(null)}>{copy("Cancel", "Annuler")}</Button><Button disabled={proposed === undefined || Object.is(proposed, propertyCurrent?.value)} onClick={saveProperty}>{copy("Keep correction in draft", "Garder cette correction dans le brouillon")}</Button></DialogFooter>
      </div>}
    </DialogContent></Dialog>
  </SheetContent>;
}
