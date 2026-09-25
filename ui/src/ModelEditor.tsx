import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "./api";
import { getCatalog, type Catalog, type CatalogAccess, type CatalogField, type CatalogRecord } from "./catalog-api";
import { modelOperationLabels as kindLabels, type Access, type Capability, type Model } from "./demo";
import { parsePropertyValue, proposedAccessValue, stageCatalogOverride, type CatalogOverride, type EditableProperty } from "./model-card-fields";
import { applyModelId, canonicalCapabilities, changeAccessProvider, modelEditorOptions, prefillFromReference } from "./model-editor-data";
import { SearchableSelect, type SearchOption } from "./SearchableSelect";

const tasks = ["Chat", "Code", "Reasoning", "Vision", "Image generation", "Embeddings", "Audio transcription", "Audio generation", "Video generation"];
const modalities = ["Text", "Image", "Audio", "Video", "Vector"];
const capabilityNames = ["Chat", "Streaming", "Tool calling", "Vision", "Reasoning", "Structured output"];
const editableProperties = new Set<string>(["context_length", "max_output_tokens", "tool_call", "structured_output"]);
const facts = [
  ["context_length", "Contexte", "tokens"],
  ["max_input_tokens", "Entrée maximale", "tokens"],
  ["max_output_tokens", "Sortie maximale", "tokens"],
  ["input_cost_usd_per_million", "Prix entrée", "$ / million"],
  ["output_cost_usd_per_million", "Prix sortie", "$ / million"],
  ["reasoning", "Raisonnement", ""],
  ["tool_call", "Appels d’outils", ""],
  ["structured_output", "Sortie structurée", ""],
] as const;

function display(value: unknown, unit = "") {
  if (value === undefined || value === null || value === "") return "Inconnu";
  if (value === true) return "Oui";
  if (value === false) return "Non";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Inconnu";
  if (typeof value === "number") return `${value.toLocaleString("fr-FR")}${unit ? ` ${unit}` : ""}`;
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function sourceLabel(source: string) {
  if (/^manual$/i.test(source)) return "Registry";
  if (/bifrost/i.test(source)) return "Datasheet Bifrost";
  if (/models[.-]?dev/i.test(source)) return "Models.dev";
  if (/registry/i.test(source)) return "Registry";
  return source;
}

function referenceSources(reference?: CatalogRecord) {
  const sources = [...new Set(Object.values(reference?.fields || {}).map(field => sourceLabel(field.source)).filter(Boolean))];
  return sources.length ? sources.join(", ") : "inconnues";
}

function FactValue({ fact, unit, inherited, accessSpecific }: { fact?: CatalogField; unit?: string; inherited?: boolean; accessSpecific?: boolean }) {
  return <span className="block min-w-0"><strong className="block break-words text-sm font-medium">{display(fact?.value, unit)}</strong><small className="block break-words text-xs text-muted-foreground">{fact ? `${inherited ? "Hérité de la fiche documentaire · " : accessSpecific ? "Propre à cet accès · " : ""}${sourceLabel(fact.source)} · ${/^manual$/i.test(fact.source) ? "personnalisé" : fact.kind === "observed" ? "observé" : "déclaré"}` : "Source inconnue"}</small></span>;
}

function ToggleChoices({ label, choices, selected, onChange }: { label: string; choices: string[]; selected: string[]; onChange: (value: string[]) => void }) {
  return <fieldset><legend className="mb-2 text-sm font-medium">{label}</legend><div className="flex flex-wrap gap-2">{choices.map(choice => <label key={choice} className="flex cursor-pointer items-center gap-2 rounded-sm border px-2 py-1.5 text-xs"><Checkbox checked={selected.includes(choice)} onCheckedChange={checked => onChange(checked ? [...selected, choice] : selected.filter(value => value !== choice))} />{choice}</label>)}</div></fieldset>;
}

function KindSelect({ value, onChange }: { value: Model["kind"]; onChange: (kind: Model["kind"]) => void }) {
  return <Select value={value || "Unknown"} onValueChange={value => onChange(value as Model["kind"])}><SelectTrigger aria-label="Opérations exposées"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(kindLabels) as Model["kind"][]).map(kind => <SelectItem key={kind} value={kind}>{kindLabels[kind]}</SelectItem>)}</SelectContent></Select>;
}

type EditSection = "identity" | "details" | "capabilities" | "access" | null;

export default function ModelEditor({ draft, onChange, creating, workspace, baseline, error, busy, snapshotMode = false, onSave, onOverridesChange, onCancel, onDelete, onUnauthorized, actionSlot }: {
  draft: Model;
  onChange: (draft: Model) => void;
  creating: boolean;
  workspace: Model[];
  baseline?: Model;
  error: string;
  busy: boolean;
  snapshotMode?: boolean;
  onSave: (overrides: CatalogOverride[]) => void;
  onOverridesChange?: (overrides: CatalogOverride[]) => void;
  onCancel: () => void;
  onDelete: (model: Model) => void;
  onUnauthorized: () => void;
  actionSlot?: ReactNode;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [stagedOverrides, setStagedOverrides] = useState<CatalogOverride[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [step, setStep] = useState<"choose" | "card" | "review">(creating ? "choose" : "card");
  const [editing, setEditing] = useState<EditSection>(null);
  const [editDraft, setEditDraft] = useState<Model | null>(null);
  const [editingAccess, setEditingAccess] = useState(0);
  const [property, setProperty] = useState<{ key: EditableProperty; target: "reference" | "access"; id: string; value: string } | null>(null);
  const [propertyNotice, setPropertyNotice] = useState("");
  const editOpener = useRef<HTMLElement | null>(null);
  const propertyOpener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let active = true;
    getCatalog().then(result => { if (active) { setCatalog(result); setCatalogError(""); } }).catch(cause => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized();
      else setCatalogError(cause instanceof Error ? cause.message : "Catalogue de référence indisponible.");
    });
    return () => { active = false; };
  }, []);

  const viewCatalog = useMemo(() => {
    if (!catalog) return null;
    const view = { ...catalog, references: catalog.references.map(record => ({ ...record, fields: { ...record.fields } })), accesses: catalog.accesses.map(record => ({ ...record, fields: { ...record.fields } })) };
    for (const correction of stagedOverrides) {
      const record = (correction.target === "reference" ? view.references : view.accesses).find(item => item.id === correction.id);
      if (record) record.fields[correction.field] = { value: correction.value, source: "manual", updatedAt: null, kind: "declared" };
    }
    return view;
  }, [catalog, stagedOverrides]);
  const options = useMemo(() => modelEditorOptions(viewCatalog, workspace), [viewCatalog, workspace]);
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
  const linkedReferenceIds = new Set(draft.accesses.map(access => access.referenceId).filter(Boolean));
  const matchingCatalog = (viewCatalog?.accesses || []).filter(access => access.configured && (
    access.model === draft.id || linkedReferenceIds.has(access.referenceId) ||
    draft.accesses.some(row => row.provider === access.provider && row.nativeModel === access.model)
  ));
  const availableAccesses = [...new Map(matchingCatalog.map(access => [`${access.provider}/${access.model}`, access])).values()];
  const selectedReference = (id?: string) => viewCatalog?.references.find(reference => reference.id === id);
  const catalogAccess = (access: Access) => viewCatalog?.accesses.find(row => row.provider === access.provider && row.model === access.nativeModel);
  const referenceOptions = (viewCatalog?.references || []).map(reference => ({ value: reference.id, label: display(reference.fields.name?.value), detail: "Fiche documentaire existante" }));
  const referenceName = (id?: string) => id ? display(selectedReference(id)?.fields.name?.value) : "aucune";
  const associationStatus = (access: Access, found?: CatalogAccess) => {
    if (access.referenceId !== undefined && access.referenceId !== found?.referenceId) return access.referenceId ? "Correspondance proposée dans ce brouillon" : "Dissociation proposée dans ce brouillon";
    if (found?.mappingManual === true) return "Correspondance choisie dans Registry";
    // The catalog API omits mappingManual when it is false.
    return found?.referenceId ? "Association suggérée automatiquement · à vérifier" : "Aucune correspondance";
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
    const row: Access = { provider: access.provider, nativeModel: access.model, id: `${access.provider}/${draft.id}`, route: "Direct provider", status: "Configured", ...(access.referenceId ? { referenceId: access.referenceId } : {}) };
    update({ accesses: checked ? [...remaining, row] : remaining });
  };
  const original = creating ? undefined : baseline ?? workspace.find(model => model.id === draft.id);
  const invalidReference = draft.accesses.some(access => !!access.referenceId && (viewCatalog ? !viewCatalog.references.some(reference => reference.id === access.referenceId) : !original?.accesses.some(row => row.provider === access.provider && row.nativeModel === access.nativeModel && row.referenceId === access.referenceId)));
  const canContinue = /^[a-z0-9][a-z0-9._-]*$/.test(draft.id) && validAccesses.length > 0;
  const canSave = canContinue && draft.name.trim() && draft.kind !== "Unknown" && !invalidReference && draft.accesses.every(access => access.provider && access.nativeModel && access.id === `${access.provider}/${draft.id}`);
  const displayedCapabilities = canonicalCapabilities(draft.capabilities);
  const capabilityRows = [...new Set([...capabilityNames, ...Object.keys(displayedCapabilities)])];
  const referenceIds = validAccesses.map(access => access.referenceId ?? catalogAccess(access)?.referenceId);
  const sharedReferenceId = referenceIds.length > 0 && referenceIds[0] && referenceIds.every(id => id === referenceIds[0]) ? referenceIds[0] : "";
  const displayedReference = selectedReference(sharedReferenceId);
  const commonFacts = displayedReference?.fields || {};
  const commonFact = (key: string): CatalogField | undefined => commonFacts[key];
  const accessFact = (access: Access, key: string) => {
    const found = catalogAccess(access);
    return found?.fields[key] || selectedReference(access.referenceId ?? found?.referenceId)?.fields[key];
  };
  const openProperty = (key: EditableProperty, target: "reference" | "access", access?: Access) => {
    const record = target === "reference" ? displayedReference : access && catalogAccess(access);
    if (!record) return;
    const fact = target === "reference" ? record.fields[key] : access && accessFact(access, key);
    setProperty({ key, target, id: record.id, value: fact?.value === undefined ? "" : String(fact.value) });
  };
  const editButton = (key: string, target: "reference" | "access", access?: Access) => editableProperties.has(key) && (target === "reference" ? displayedReference : access && catalogAccess(access))
    ? <Button variant="ghost" size="sm" className="mt-1 h-7 px-1 text-xs" aria-label={`Modifier ${facts.find(([field]) => field === key)?.[1].toLowerCase()} ${target === "reference" ? "de la fiche commune" : `de l’accès ${access?.provider} ${access?.nativeModel}`}`} onClick={event => { propertyOpener.current = event.currentTarget; openProperty(key as EditableProperty, target, access); }}>Modifier</Button> : null;
  const propertyRecord = property?.target === "reference" ? displayedReference : viewCatalog?.accesses.find(access => access.id === property?.id);
  const propertyAccess = property?.target === "access" ? validAccesses.find(access => catalogAccess(access)?.id === property.id) : undefined;
  const propertyCurrent = property?.target === "reference" ? propertyRecord?.fields[property.key] : property && propertyAccess ? accessFact(propertyAccess, property.key) : undefined;
  let proposed: number | boolean | undefined;
  let propertyValidation = "";
  if (property) {
    try { proposed = parsePropertyValue(property.key, property.value); }
    catch (cause) { propertyValidation = cause instanceof Error ? cause.message : "Valeur invalide."; }
  }
  const propertyPreview = property && proposed !== undefined ? (viewCatalog?.accesses || []).map(access => {
    const draftAccess = draft.accesses.find(row => row.provider === access.provider && row.nativeModel === access.model);
    const linked = draftAccess?.referenceId ?? access.referenceId;
    const own = access.fields[property.key]?.value;
    const inherited = selectedReference(linked)?.fields[property.key]?.value;
    const before = own === undefined ? inherited : own;
    const after = proposedAccessValue(property.target, property.id, access.id, linked, own, inherited, proposed);
    return { access, before, after, linked };
  }).filter(row => property.target === "reference" ? row.linked === property.id : row.access.id === property.id) : [];
  const saveProperty = () => {
    if (!property || proposed === undefined || !catalog) return;
    const original = (property.target === "reference" ? catalog.references : catalog.accesses).find(record => record.id === property.id)?.fields[property.key]?.value;
    const next = stageCatalogOverride(stagedOverrides, { target: property.target, id: property.id, field: property.key, value: proposed }, original);
    setStagedOverrides(next);
    onOverridesChange?.(next);
    setPropertyNotice(Object.is(proposed, original) ? "Correction retirée du brouillon." : "Correction ajoutée au brouillon. Elle sera enregistrée avec le modèle dans Registry ; aucune valeur native Bifrost n’est activée ici.");
    setProperty(null);
  };
  const reviewLabels: Record<string, string> = { name: "Nom affiché", creator: "Créateur", family: "Série", kind: "Opérations exposées", summary: "Description", context: "Contexte Registry", tasks: "Usages", inputModalities: "Entrées", outputModalities: "Sorties" };
  const originalPropertyValue = (item: CatalogOverride) => {
    if (item.target === "reference") return catalog?.references.find(record => record.id === item.id)?.fields[item.field]?.value;
    const access = catalog?.accesses.find(record => record.id === item.id);
    const draftAccess = draft.accesses.find(row => row.provider === access?.provider && row.nativeModel === access?.model);
    return access?.fields[item.field]?.value ?? catalog?.references.find(record => record.id === (draftAccess?.referenceId ?? access?.referenceId))?.fields[item.field]?.value;
  };
  const reviewChanges = original ? [
    ...(["name", "creator", "family", "kind", "summary", "context"] as const).filter(key => original[key] !== draft[key]).map(key => `${reviewLabels[key]} : ${display(original[key])} → ${display(draft[key])}`),
    ...(["tasks", "inputModalities", "outputModalities"] as const).filter(key => JSON.stringify(original[key]) !== JSON.stringify(draft[key])).map(key => `${reviewLabels[key]} : ${display(original[key])} → ${display(draft[key])}`),
    ...[...new Set([...Object.keys(original.capabilities), ...Object.keys(draft.capabilities)])].filter(name => original.capabilities[name] !== draft.capabilities[name]).map(name => `Capacité ${name} : ${original.capabilities[name] || "Unknown"} → ${draft.capabilities[name] || "Unknown"}`),
    ...draft.accesses.filter(access => !original.accesses.some(before => before.provider === access.provider && before.nativeModel === access.nativeModel)).map(access => `Accès ajouté : ${access.provider} · ${access.nativeModel}`),
    ...original.accesses.filter(access => !draft.accesses.some(after => after.provider === access.provider && after.nativeModel === access.nativeModel)).map(access => `Accès retiré : ${access.provider} · ${access.nativeModel}`),
    ...draft.accesses.filter(access => original.accesses.some(before => before.provider === access.provider && before.nativeModel === access.nativeModel && before.referenceId !== access.referenceId)).map(access => `Fiche documentaire de ${access.provider} : ${referenceName(original.accesses.find(before => before.provider === access.provider && before.nativeModel === access.nativeModel)?.referenceId)} → ${referenceName(access.referenceId)}`),
  ] : [];

  return <SheetContent inert={busy} className="min-h-0 max-w-[calc(100vw-1rem)] p-4 sm:max-w-5xl sm:p-6">
    <SheetHeader className="shrink-0 border-b pb-4"><SheetTitle className="text-xl">{creating ? "Enregistrer un modèle" : draft.name}</SheetTitle><SheetDescription>{creating ? "Choisir les accès, lire la fiche, puis vérifier l’enregistrement." : "Fiche du modèle et accès fournisseurs enregistrés."}</SheetDescription></SheetHeader>
    <div className="custom-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pr-2 pb-4">
      <nav aria-label="Étapes" className="flex flex-wrap gap-2 text-xs">{(creating ? ["choose", "card", "review"] : ["card", "review"]).map((item, index) => <Badge key={item} variant={step === item ? "default" : "outline"}>{index + 1}. {item === "choose" ? "Choisir" : item === "card" ? "Lire la fiche" : "Vérifier"}</Badge>)}</nav>
      {catalogError && <p role="status" className="rounded-sm border p-3 text-xs text-muted-foreground">Données de référence indisponibles : {catalogError}. Les accès déjà présents restent visibles.</p>}
      {propertyNotice && <p role="status" className="rounded-sm border bg-primary/5 p-3 text-sm">{propertyNotice}</p>}

      {step === "choose" && <section className="space-y-4">
        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Modèle choisi</p><h3 className="text-2xl font-semibold">{draft.name || draft.id || "Choisir un modèle"}</h3><p className="text-sm text-muted-foreground">Créateur : {display(draft.creator)} · Série : {display(draft.family)}</p><p className="mt-2 text-sm">Confirmez les accès exacts à regrouper dans cette fiche.</p></div>
        {draft.id ? <details className="rounded-sm border p-3"><summary className="cursor-pointer text-sm">Identifiant commun · <code>{draft.id}</code></summary><div className="mt-3"><SearchableSelect label="Changer l’identifiant commun" value={draft.id} options={options.modelIds} onChange={chooseModelId} placeholder="Chercher ou saisir un identifiant" /></div><p className="text-xs text-muted-foreground">Changer cet identifiant recalcule les IDs exposés Registry. La sélection entre fournisseurs reste distincte.</p></details> : <SearchableSelect label="Chercher un modèle ou saisir son identifiant *" value={draft.id} options={options.modelIds} onChange={chooseModelId} placeholder="Modèle ou identifiant personnalisé" />}
        {availableAccesses.length > 0 && <div className="space-y-2"><h4 className="text-sm font-semibold">Accès configurés repérés dans Bifrost</h4>{availableAccesses.map(access => {
          const selected = draft.accesses.some(row => row.provider === access.provider && row.nativeModel === access.model);
          return <label key={access.id} className="flex cursor-pointer items-start gap-3 rounded-sm border bg-card p-3"><Checkbox checked={selected} onCheckedChange={checked => toggleCatalogAccess(access, checked === true)} /><span className="min-w-0 space-y-1"><span className="block text-xs text-muted-foreground">Fournisseur dans Bifrost</span><strong className="block text-sm">{access.provider}</strong><span className="block text-xs text-muted-foreground">Modèle chez ce fournisseur</span><code className="block break-all text-xs">{access.model}</code></span></label>;
        })}</div>}
        {validAccesses.filter(access => !availableAccesses.some(row => row.provider === access.provider && row.model === access.nativeModel)).map((access, index) => <div key={`${access.provider}/${access.nativeModel}/${index}`} className="rounded-sm border p-3 text-sm"><p className="text-xs text-muted-foreground">Fournisseur dans Bifrost</p><strong>{access.provider}</strong><p className="text-xs text-muted-foreground">Modèle chez ce fournisseur</p><code className="break-all">{access.nativeModel}</code></div>)}
        <Button variant="outline" size="sm" onClick={() => openEdit("access", validAccesses.length, { ...draft, accesses: [...validAccesses, { provider: "", id: "", nativeModel: "", route: "Direct provider", status: "Unknown" }] })}><Plus className="size-4" />Saisir un accès manuellement</Button>
        {draft.accesses.length === 0 && <p className="text-sm text-muted-foreground">Aucun accès sélectionné.</p>}
      </section>}

      {step === "card" && <div className="space-y-5">
        <section className="space-y-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{creating ? "Aperçu avant enregistrement" : "Fiche enregistrée · Registry"}</p><h3 className="mt-1 text-2xl font-semibold">{draft.name || draft.id || "Modèle sans nom"}</h3><p className="text-sm text-muted-foreground">Créateur : {display(draft.creator)} · Série : {display(draft.family)} · Opérations exposées : {kindLabels[draft.kind]}</p><code className="break-all text-xs">{draft.id}</code></div><Button variant="outline" size="sm" onClick={() => openEdit("identity")}>Modifier l’identité</Button></div><p className="text-sm">{draft.summary || "Aucune description."}</p></section>
        <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Comparaison des valeurs documentées</h4><Button variant="outline" size="sm" onClick={() => openEdit("details")}>Modifier les détails Registry</Button></div><p className="text-xs text-muted-foreground">Chaque colonne montre sa valeur et son origine. Une valeur propre à un fournisseur reste distincte de la fiche commune ; ces données n’appliquent pas de limite ou tarif natif.</p>{!displayedReference && <p className="text-xs text-muted-foreground">Fiche documentaire commune indisponible : les accès sélectionnés n’ont pas tous la même association. Comparez leurs colonnes avant de choisir une fiche.</p>}
          <div className="space-y-2 md:hidden">{facts.map(([key, label, unit]) => <div key={key} className="rounded-sm border bg-card p-3"><h5 className="mb-2 text-sm font-medium">{label}</h5><div className="grid gap-2 sm:grid-cols-2"><div><span className="text-xs text-muted-foreground">Fiche commune</span><FactValue fact={commonFact(key)} unit={unit} />{editButton(key, "reference")}</div>{validAccesses.map(access => <div key={`${access.provider}/${access.nativeModel}`}><span className="text-xs text-muted-foreground">{access.provider}</span><FactValue fact={accessFact(access, key)} inherited={!catalogAccess(access)?.fields[key] && !!accessFact(access, key)} accessSpecific={!!catalogAccess(access)?.fields[key]} unit={unit} />{editButton(key, "access", access)}</div>)}</div></div>)}</div>
          <div className="hidden overflow-x-auto rounded-sm border md:block"><table className="w-full min-w-[620px] border-collapse text-left"><thead className="bg-muted/40"><tr><th scope="col" className="p-3 text-xs font-medium">Propriété</th><th scope="col" className="p-3 text-xs font-medium">Fiche commune</th>{validAccesses.map(access => <th key={`${access.provider}/${access.nativeModel}`} scope="col" className="min-w-40 p-3 text-xs font-medium">{access.provider}</th>)}</tr></thead><tbody>{facts.map(([key, label, unit]) => <tr key={key} className="border-t align-top"><th scope="row" className="p-3 text-sm font-medium">{label}</th><td className="p-3"><FactValue fact={commonFact(key)} unit={unit} />{editButton(key, "reference")}</td>{validAccesses.map(access => <td key={`${access.provider}/${access.nativeModel}`} className="p-3"><FactValue fact={accessFact(access, key)} inherited={!catalogAccess(access)?.fields[key] && !!accessFact(access, key)} accessSpecific={!!catalogAccess(access)?.fields[key]} unit={unit} />{editButton(key, "access", access)}</td>)}</tr>)}</tbody></table></div>
          <p className="text-xs text-muted-foreground">Entrées : {draft.inputModalities.length ? draft.inputModalities.join(", ") : display(commonFacts.input_modalities?.value)} · Sorties : {draft.outputModalities.length ? draft.outputModalities.join(", ") : display(commonFacts.output_modalities?.value)}</p>
        </section>
        <section className="space-y-3"><div className="flex items-center justify-between gap-2"><h4 className="font-semibold">Accès fournisseurs ({validAccesses.length})</h4><Button variant="outline" size="sm" onClick={() => setStep("choose")}>Modifier les accès</Button></div><div className="grid gap-2 sm:grid-cols-2">{validAccesses.map((access, index) => {
          const found = catalogAccess(access);
          const reference = selectedReference(access.referenceId ?? found?.referenceId);
          return <div key={`${access.provider}/${access.nativeModel}/${index}`} className="rounded-sm border bg-card p-3">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0 space-y-1"><p className="text-xs font-semibold">Accès natif</p><p className="text-xs text-muted-foreground">Fournisseur dans Bifrost</p><strong className="block text-sm">{access.provider}</strong><p className="text-xs text-muted-foreground">Modèle chez ce fournisseur</p><code className="block break-all text-xs">{access.nativeModel}</code><span className="block text-xs text-muted-foreground">{found?.configured ? "Configuré · Bifrost" : access.status === "Configured" ? "Configuré · découverte" : "État inconnu"}</span></div><Button variant="outline" size="sm" onClick={() => openEdit("access", draft.accesses.indexOf(access))}>Modifier</Button></div>
            <div className="mt-3 space-y-1 border-t pt-3"><p className="text-xs font-semibold">Informations documentaires</p><p className="text-sm">{reference ? display(reference.fields.name?.value) : "Aucune fiche documentaire liée"}</p>{reference && <p className="text-xs text-muted-foreground">Sources : {referenceSources(reference)}</p>}<p className="text-xs text-muted-foreground">{associationStatus(access, found)}</p>{reference && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Identifiant documentaire</summary><code className="block break-all">{reference.id}</code></details>}</div>
          </div>;
        })}</div></section>
        <section className="space-y-2"><div className="flex items-center justify-between"><h4 className="font-semibold">Usages et capacités Registry</h4><Button variant="outline" size="sm" onClick={() => openEdit("capabilities")}>Modifier</Button></div><p className="text-sm">Usages : {draft.tasks.length ? draft.tasks.join(", ") : "Inconnus"}</p><p className="text-sm">Capacités : {Object.entries(displayedCapabilities).filter(([, value]) => value !== "Unknown").map(([key, value]) => `${key} (${value})`).join(", ") || "Inconnues"}</p><p className="text-xs text-muted-foreground">Une déclaration Registry ne prouve pas une capacité native ni son activation.</p></section>
        {actionSlot && <details className="rounded-sm border p-3"><summary className="cursor-pointer text-sm font-medium">Assistance facultative</summary><div className="mt-3">{actionSlot}</div></details>}
      </div>}

      {step === "review" && <section className="space-y-4"><div><h3 className="text-lg font-semibold">Vérifier avant enregistrement</h3><p className="text-sm text-muted-foreground">Les opérations choisies déterminent les types de requêtes exposés par Registry ; elles ne prouvent pas que le modèle les prend en charge. La présence d’un accès ne l’active pas pour une clé et ne choisit pas le fournisseur.</p>{!creating && <p className="text-sm text-muted-foreground">Les clés Registry utilisant déjà cette fiche recevront ses changements.</p>}</div><div className="rounded-sm border bg-card p-4"><p><strong>{draft.name || "Nom manquant"}</strong> · <code>{draft.id || "ID manquant"}</code></p><p className="mt-1 text-sm">Opérations exposées : {kindLabels[draft.kind]}</p><p className="mt-1 text-sm">Créateur : {display(draft.creator)} · Série : {display(draft.family)}</p><div className="mt-3 space-y-1 border-t pt-3 text-xs"><strong>Identifiant commun et accès</strong>{draft.accesses.map(access => <p key={`${access.provider}/${access.nativeModel}`}>ID Registry : <code>{access.id}</code> → {access.provider} / <code>{access.nativeModel}</code>{draft.id !== access.nativeModel && <span className="block text-muted-foreground">{snapshotMode ? "Alias simulé dans la copie" : "Alias Bifrost prévu pour les clés concernées"} : <code>{draft.id}</code> → <code>{access.nativeModel}</code></span>}</p>)}</div></div>{original && <div className="rounded-sm border p-3"><h4 className="text-sm font-semibold">Changements proposés</h4>{reviewChanges.length ? <ul className="mt-2 space-y-1 text-sm">{reviewChanges.map((change, index) => <li key={index}>{change}</li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">Aucun changement dans la fiche Registry.</p>}</div>}{stagedOverrides.length > 0 && <div className="rounded-sm border p-3"><h4 className="text-sm font-semibold">Corrections du catalogue à enregistrer avec le modèle</h4><ul className="mt-2 space-y-1 text-sm">{stagedOverrides.map(item => <li key={`${item.target}/${item.id}/${item.field}`}>{facts.find(([key]) => key === item.field)?.[1]} · {item.target === "reference" ? "fiche documentaire" : "accès fournisseur"} <code>{item.id}</code> : {display(originalPropertyValue(item))} → {display(item.value)}</li>)}</ul></div>}<div className="space-y-2">{draft.accesses.map((access, index) => {
        const found = catalogAccess(access);
        const reference = selectedReference(access.referenceId ?? found?.referenceId);
        return <div key={index} className="rounded-sm border p-3 text-sm"><strong>{access.provider || "Fournisseur manquant"}</strong> · <code className="break-all">{access.nativeModel || "ID natif manquant"}</code><p className="text-xs text-muted-foreground">ID exposé Registry : {access.id || "Inconnu"}</p><p className="mt-2">Fiche documentaire : {reference ? display(reference.fields.name?.value) : "aucune fiche liée"}</p>{reference && <p className="text-xs text-muted-foreground">Sources : {referenceSources(reference)}</p>}<p className="text-xs text-muted-foreground">{associationStatus(access, found)}</p>{reference && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Identifiant documentaire</summary><code className="block break-all">{reference.id}</code></details>}</div>;
      })}</div>{invalidReference && <p role="alert" className="text-sm text-destructive">Une correspondance pointe vers une fiche documentaire absente du catalogue.</p>}{!canSave && <p role="alert" className="text-sm text-destructive">Compléter le nom, les opérations exposées et chaque accès fournisseur avant d’enregistrer.</p>}</section>}
    </div>
    {error && <p role="alert" className="shrink-0 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <SheetFooter className="shrink-0 flex-row flex-wrap justify-end border-t px-0 pb-0 pt-4">{!creating && <Button variant="ghost" className="mr-auto text-destructive" onClick={() => onDelete(draft)}>Supprimer</Button>}{step !== "choose" && <Button variant="ghost" onClick={() => setStep(step === "review" ? "card" : "choose")}>Retour</Button>}<Button variant="outline" onClick={onCancel}>Annuler</Button>{step === "choose" ? <Button disabled={!canContinue} onClick={() => setStep("card")}>Préparer la fiche</Button> : step === "card" ? <Button onClick={() => setStep("review")}>Vérifier</Button> : <Button disabled={busy || !canSave} onClick={() => onSave(stagedOverrides)}>Enregistrer le modèle</Button>}</SheetFooter>

    <Dialog open={editing !== null} onOpenChange={open => { if (!open) closeEdit(); }}><DialogContent className="max-h-[90vh] overflow-y-auto" onCloseAutoFocus={event => { event.preventDefault(); editOpener.current?.focus(); }}>
      <DialogHeader><DialogTitle>{editing === "identity" ? "Modifier l’identité" : editing === "details" ? "Modifier les détails Registry" : editing === "capabilities" ? "Modifier usages et capacités" : "Modifier un accès"}</DialogTitle><DialogDescription>Les modifications de ce dialogue seront ajoutées au brouillon après confirmation, puis relues avant l’enregistrement.</DialogDescription></DialogHeader>
      {editing === "identity" && <div className="space-y-3"><label className="block text-sm">Nom affiché *<Input className="mt-1" value={form.name} onChange={event => updateEdit({ name: event.target.value })} /></label><label className="block text-sm">Opérations exposées *<KindSelect value={form.kind} onChange={kind => updateEdit({ kind })} /></label><p className="text-xs text-muted-foreground">Ce choix détermine les types de requêtes exposés par Registry ; il ne prouve pas leur prise en charge par le modèle. Identifiant commun : {form.id}.</p></div>}
      {editing === "details" && <div className="space-y-3"><SearchableSelect label="Créateur" value={form.creator} options={options.creators} onChange={creator => updateEdit({ creator })} /><SearchableSelect label="Série" value={form.family} options={options.families} onChange={family => updateEdit({ family })} /><label className="block text-sm">Description<Textarea className="mt-1" value={form.summary} onChange={event => updateEdit({ summary: event.target.value })} /></label><ToggleChoices label="Modalités d’entrée" choices={modalities.filter(value => value !== "Vector")} selected={form.inputModalities} onChange={inputModalities => updateEdit({ inputModalities })} /><ToggleChoices label="Modalités de sortie" choices={modalities} selected={form.outputModalities} onChange={outputModalities => updateEdit({ outputModalities })} /></div>}
      {editing === "capabilities" && <div className="space-y-3"><ToggleChoices label="Usages" choices={tasks} selected={form.tasks} onChange={tasks => updateEdit({ tasks })} />{capabilityRows.map(name => <div key={name} className="flex items-center justify-between gap-2 text-sm"><span>{name}</span><Select value={canonicalCapabilities(form.capabilities)[name] || "Unknown"} onValueChange={value => updateEdit({ capabilities: { ...canonicalCapabilities(form.capabilities), [name]: value as Capability } })}><SelectTrigger aria-label={`${name} evidence`} className="w-48"><SelectValue /></SelectTrigger><SelectContent>{(canonicalCapabilities(form.capabilities)[name] === "Observed in simulated campaign" ? ["Observed in simulated campaign", "Declared", "Unknown"] : ["Declared", "Unknown"]).map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>)}<p className="text-xs text-muted-foreground">Inconnu reste distinct de « non ». Une campagne simulée ne vérifie pas une capacité fournisseur réelle.</p></div>}
      {editing === "access" && form.accesses[editingAccess] && <div className="space-y-3"><SearchableSelect label="Fournisseur dans Bifrost *" value={form.accesses[editingAccess].provider} options={options.providers} onChange={provider => changeEditAccess(editingAccess, { provider })} /><label className="block text-sm">Modèle chez ce fournisseur *<Input className="mt-1 font-mono" value={form.accesses[editingAccess].nativeModel || ""} readOnly={!!catalogAccess(form.accesses[editingAccess])} onChange={event => changeEditAccess(editingAccess, { nativeModel: event.target.value })} /></label><p className="text-xs text-muted-foreground">{catalogAccess(form.accesses[editingAccess]) ? "Identifiant découvert dans Bifrost · lecture seule." : "Accès manuel : reprendre l’identifiant exact configuré dans Bifrost."}</p><SearchableSelect label="Fiche documentaire pour cet accès" value={form.accesses[editingAccess].referenceId || ""} options={referenceOptions} onChange={id => chooseEditReference(editingAccess, id)} placeholder="Chercher une fiche documentaire" />{form.accesses[editingAccess].referenceId && <Button variant="ghost" size="sm" onClick={() => changeEditAccess(editingAccess, { referenceId: "" })}>Dissocier</Button>}{form.accesses[editingAccess].referenceId && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Identifiant documentaire</summary><code className="block break-all">{form.accesses[editingAccess].referenceId}</code></details>}<label className="block text-sm">ID exposé Registry<Input className="mt-1 font-mono" value={form.accesses[editingAccess].id} readOnly /></label><div className="flex items-center gap-2 text-sm"><span>Statut</span><Select value={form.accesses[editingAccess].status} onValueChange={status => changeEditAccess(editingAccess, { status: status as Access["status"] })}><SelectTrigger aria-label="Statut de l’accès" className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Configured">Configured</SelectItem><SelectItem value="Unknown">Unknown</SelectItem></SelectContent></Select></div><p className="text-xs text-muted-foreground">Route : {form.accesses[editingAccess].route}. Le routage natif se règle séparément.</p><Button variant="ghost" size="sm" disabled={form.accesses.length === 1} onClick={() => updateEdit({ accesses: form.accesses.filter((_, index) => index !== editingAccess) })}><X className="size-4" />Retirer cet accès</Button></div>}
      <DialogFooter><Button variant="outline" onClick={closeEdit}>Annuler</Button><Button disabled={editing === "identity" ? !form.name.trim() || form.kind === "Unknown" : editing === "access" ? form.accesses.some(access => !access.provider || !access.nativeModel || access.id !== `${access.provider}/${form.id}` || !!access.referenceId && !catalog?.references.some(reference => reference.id === access.referenceId)) : false} onClick={() => { if (editDraft) onChange(editDraft); closeEdit(); }}>Garder les modifications</Button></DialogFooter>
    </DialogContent></Dialog>

    <Dialog open={!!property} onOpenChange={open => { if (!open) setProperty(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto" onCloseAutoFocus={event => { event.preventDefault(); propertyOpener.current?.focus(); }}>
      <DialogHeader><DialogTitle>Modifier {facts.find(([key]) => key === property?.key)?.[1]}</DialogTitle><DialogDescription>{property?.target === "reference" ? "Fiche documentaire commune" : "Accès fournisseur"} · correction ajoutée au brouillon. Vérifiez tous les accès liés avant l’enregistrement du modèle.</DialogDescription></DialogHeader>
      {property && <div className="space-y-4">
        <p className="text-sm">Actuel : <strong>{display(propertyCurrent?.value, facts.find(([key]) => key === property.key)?.[2])}</strong> <span className="text-xs text-muted-foreground">· {propertyCurrent ? sourceLabel(propertyCurrent.source) : "Source inconnue"}</span></p>
        {property.key === "tool_call" || property.key === "structured_output"
          ? <label className="block text-sm">{facts.find(([key]) => key === property.key)?.[1]} proposé<select className="mt-1 h-9 w-full rounded-sm border bg-background px-3" value={property.value} onChange={event => setProperty({ ...property, value: event.target.value })}><option value="">Choisir Oui ou Non</option><option value="true">Oui</option><option value="false">Non</option></select></label>
          : <label className="block text-sm">{facts.find(([key]) => key === property.key)?.[1]} proposé, en tokens<Input className="mt-1" type="number" min="0" step="1" inputMode="numeric" value={property.value} onChange={event => setProperty({ ...property, value: event.target.value })} /></label>}
        {propertyValidation && <p role="alert" className="text-xs text-destructive">{propertyValidation}</p>}
        <div className="rounded-sm border bg-muted/30 p-3"><h4 className="text-sm font-semibold">Aperçu de la correction</h4>{property.target === "reference" && <p className="mt-2 text-sm">Fiche documentaire · {display(propertyRecord?.fields[property.key]?.value)} → {display(proposed)}</p>}<div className="mt-2 space-y-2">{propertyPreview.map(row => <p key={row.access.id} className="text-sm"><strong>{row.access.provider}</strong> · <code>{row.access.model}</code> · {display(row.before)} → {display(row.after)} <span className="text-xs text-muted-foreground">{Object.is(row.before, row.after) ? "inchangé" : "proposé dans Registry"}</span></p>)}</div>{propertyPreview.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Aucun accès du catalogue n’est lié à cette fiche.</p>}{propertyPreview.length > 0 && propertyPreview.every(row => Object.is(row.before, row.after)) && <p className="mt-2 text-xs text-muted-foreground">Aucun accès lié ne change de valeur.</p>}</div>
        <p className="text-xs text-muted-foreground">Cette correction documente le catalogue Registry. Elle n’active ni capacité, ni routage, ni limite native Bifrost.</p>
        <DialogFooter><Button variant="outline" onClick={() => setProperty(null)}>Annuler</Button><Button disabled={proposed === undefined || Object.is(proposed, propertyCurrent?.value)} onClick={saveProperty}>Garder cette correction dans le brouillon</Button></DialogFooter>
      </div>}
    </DialogContent></Dialog>
  </SheetContent>;
}
