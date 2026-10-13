import { useMemo, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdownMenu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { EditorJourney, revealJourneyStep } from "../../components/registry/EditorJourney";
import {
  documentedPrice,
  fieldLabel,
  sourceLabel,
  type Catalog,
  type CatalogAccess,
  type CatalogField,
  type CatalogRecord,
} from "./catalog-api";
import { FactsUnknown, InferredMark, factsUnknown, hasReference } from "./card-identity";
import {
  creatorKey,
  knownValue,
  registryEndpoints,
  same,
  sameAccess,
  type Access,
  type Capability,
  type Model,
  type PricingProof,
} from "../../domain/registry";
import {
  parsePropertyValue,
  pricingApplicationState,
  proposedAccessValue,
  stageCatalogOverride,
  type CatalogOverride,
  type EditableProperty,
} from "./model-card-fields";
import {
  alsoAvailable,
  applyModelId,
  associationStatus,
  canonicalCapabilities,
  changeAccessProvider,
  declaredEndpoints,
  firstRegistrationIssue,
  modelEditorOptions,
  prefillFromReference,
  reviewSentence,
  showsNativeModel,
} from "./model-editor-data";
import { SearchableSelect, type SearchOption } from "../../components/registry/SearchableSelect";
import { cardName } from "./reference-groups";
import { BrandIcon, displayProvider } from "../../components/registry/BrandIcon";
import {
  capabilityStateLabel,
  ModelCapabilitiesSummary,
  ModelModalitiesSummary,
} from "../../components/registry/model-capabilities";
import { useCopy, useCreatorName, useFormat, useLanguage, useTerm, type Copy } from "../../lib/locale";

const tasks = [
  "Chat",
  "Code",
  "Reasoning",
  "Vision",
  "Image generation",
  "Embeddings",
  "Audio transcription",
  "Audio generation",
  "Video generation",
];
const modalities = ["Text", "Image", "Audio", "Video", "Vector"];
const capabilityNames = ["Chat", "Streaming", "Tool calling", "Vision", "Reasoning", "Structured output"];
const editableProperties = new Set<string>([
  "context_length",
  "max_output_tokens",
  "tool_call",
  "structured_output",
  "input_cost_usd_per_million",
  "output_cost_usd_per_million",
]);
// Unit "$/M": a price in USD per million tokens.
const facts = [
  ["context_length", "tokens"],
  ["max_input_tokens", "tokens"],
  ["max_output_tokens", "tokens"],
  ["input_cost_usd_per_million", "$/M"],
  ["output_cost_usd_per_million", "$/M"],
  ["reasoning", ""],
  ["tool_call", ""],
  ["structured_output", ""],
] as const;
function useDisplay() {
  const format = useFormat();
  return (value: unknown, unit = "") => (unit === "$/M" ? format.price(value) : format.value(value, unit));
}

function modalityList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map(item => item.charAt(0).toUpperCase() + item.slice(1))
    : [];
}

function PricingApplication({
  proofs,
  access,
  field,
  fact,
}: {
  proofs: PricingProof[];
  access: Access;
  field: string;
  fact?: CatalogField;
}) {
  const copy = useCopy();
  const state = pricingApplicationState(proofs, access, field, fact?.source);
  if (!state) return null;
  if (state === "applied")
    return (
      <span className="block text-xs text-emerald-600 dark:text-emerald-400">
        {copy("Applied to Bifrost", "Appliqué dans Bifrost")}
      </span>
    );
  if (state === "pending")
    return (
      <span className="block text-xs text-amber-600 dark:text-amber-400">
        {copy("Pending native verification", "En attente de vérification native")}
      </span>
    );
  return (
    <span className="block text-xs text-destructive">
      {copy("Native application failed", "Application native échouée")} · {state.error}
    </span>
  );
}

function referenceSources(reference: CatalogRecord | undefined, copy: (english: string, french: string) => string) {
  const sources = [
    ...new Set(
      Object.values(reference?.fields || {})
        .map(field => sourceLabel(field.source, copy))
        .filter(Boolean),
    ),
  ];
  return sources.length ? sources.join(", ") : copy("unknown", "inconnues");
}

function FactValue({
  fact,
  unit,
  inherited,
  accessSpecific,
}: {
  fact?: CatalogField;
  unit?: string;
  inherited?: boolean;
  accessSpecific?: boolean;
}) {
  const copy = useCopy();
  const display = useDisplay();
  return (
    <span className="block min-w-0">
      <strong className="block break-words text-sm font-medium">{display(fact?.value, unit)}</strong>
      <small
        className="block break-words text-xs text-muted-foreground"
        title={
          fact && !/^manual$/i.test(fact.source) && fact.kind !== "observed"
            ? copy("Declared · untested", "Déclaré · non testé")
            : undefined
        }
      >
        {fact
          ? `${inherited ? copy("Inherited from model", "Hérité de la fiche documentaire") + " · " : accessSpecific ? copy("Access-specific", "Propre à cet accès") + " · " : ""}${sourceLabel(fact.source, copy)} · ${/^manual$/i.test(fact.source) ? copy("customized", "personnalisé") : fact.kind === "observed" ? copy("observed", "observé") : copy("documented", "documenté")}`
          : copy("Source unknown", "Source inconnue")}
      </small>
    </span>
  );
}

function ToggleChoices({
  label,
  choices,
  selected,
  onChange,
}: {
  label: string;
  choices: string[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const term = useTerm();
  const copy = useCopy();
  const french: Record<string, string> = {
    "Image generation": "Génération d’images",
    "Audio transcription": "Transcription audio",
    "Audio generation": "Génération audio",
    "Video generation": "Génération vidéo",
    Embeddings: "Vecteurs",
  };
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map(choice => (
          <label key={choice} className="flex cursor-pointer items-center gap-2 rounded-sm border px-2 py-1.5 text-xs">
            <Checkbox
              checked={selected.includes(choice)}
              onCheckedChange={checked =>
                onChange(checked ? [...selected, choice] : selected.filter(value => value !== choice))
              }
            />
            {french[choice] ? copy(choice, french[choice]) : term(choice)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const endpointLabels: Record<(typeof registryEndpoints)[number], [string, string]> = {
  "chat/completions": ["Chat Completions", "Chat Completions"],
  responses: ["Responses", "Responses"],
  completions: ["Completions", "Completions"],
  embeddings: ["Embeddings", "Embeddings"],
  "images/generations": ["Image generation", "Génération d’images"],
  "audio/speech": ["Audio speech", "Synthèse audio"],
  decisions: ["Decisions", "Décisions"],
  rerank: ["Rerank", "Reclassement"],
  ocr: ["OCR", "OCR"],
};

// What a person reads in Basic: "Chat" rather than "Chat Completions" (Expert shows the exact endpoints).
const plainEndpointNames = (endpoints: string[] | undefined, copy: Copy) =>
  (endpoints || [])
    .map(endpoint => (endpoint === "chat/completions" ? "Chat" : endpointNames([endpoint], copy)))
    .join(", ") || copy("Unknown", "Inconnu");
const endpointNames = (endpoints: string[] | undefined, copy: Copy) =>
  (endpoints || [])
    .map(endpoint => {
      const label = endpointLabels[endpoint as keyof typeof endpointLabels];
      return label ? copy(...label) : endpoint;
    })
    .join(", ");

// Basic mode reads the preselected request types as one line; the grid opens on "Change", in Expert
// mode, or when no type is chosen yet.
function EndpointChoices({
  access,
  invalid,
  brief,
  technical,
  onChange,
}: {
  access: Access;
  invalid?: boolean;
  brief?: boolean;
  // Expert also names each request type by its endpoint (chat/completions); Basic names it in words only.
  technical?: boolean;
  onChange: (endpoints: string[]) => void;
}) {
  const copy = useCopy();
  const { colon } = useFormat();
  const [changing, setChanging] = useState(false);
  if (brief && !changing && !invalid && access.endpoints?.length)
    return (
      <p className="flex flex-wrap items-center gap-x-1 text-sm">
        <span className="text-muted-foreground">
          {copy("Requests", "Requêtes")}
          {colon}
        </span>{" "}
        {endpointNames(access.endpoints, copy)}{" "}
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>{" "}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0"
          aria-label={copy(
            `Change requests for ${displayProvider(access.provider)}`,
            `Changer les requêtes pour ${displayProvider(access.provider)}`,
          )}
          onClick={() => setChanging(true)}
        >
          {copy("Change", "Changer")}
        </Button>
      </p>
    );
  return (
    <fieldset aria-invalid={invalid || undefined} className="rounded-sm border p-3">
      <legend className="px-1 text-sm font-medium">
        {technical
          ? copy("Registry endpoints for this access *", "Endpoints Registry pour cet accès *")
          : copy("Request types for this access *", "Types de requêtes pour cet accès *")}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {registryEndpoints.map(endpoint => (
          <label key={endpoint} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={access.endpoints?.includes(endpoint) || false}
              onCheckedChange={checked =>
                onChange(
                  checked
                    ? [...(access.endpoints || []), endpoint]
                    : (access.endpoints || []).filter(value => value !== endpoint),
                )
              }
            />
            <span>
              {copy(...endpointLabels[endpoint])}
              {technical && (
                <>
                  {" "}
                  <code className="text-xs text-muted-foreground">{endpoint}</code>
                </>
              )}
            </span>
          </label>
        ))}
      </div>
      {invalid && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {technical
            ? copy("Choose at least one endpoint for this access.", "Choisissez au moins un endpoint pour cet accès.")
            : copy(
                "Choose at least one request type for this access.",
                "Choisissez au moins un type de requête pour cet accès.",
              )}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {copy(
          "These choices configure Registry request types; they do not prove model support.",
          "Ces choix configurent les types de requêtes Registry ; ils ne prouvent pas la prise en charge du modèle.",
        )}
      </p>
    </fieldset>
  );
}

const cardTabs = [
  ["overview", "Overview", "Vue d’ensemble"],
  ["access", "Access", "Accès"],
  ["properties", "Properties", "Propriétés"],
  ["sources", "Sources", "Sources"],
] as const;

type EditSection = "identity" | "details" | "capabilities" | "access" | null;

export default function ModelEditor({
  draft,
  onChange,
  creating,
  workspace,
  catalog,
  catalogError,
  pricingProofs,
  saved,
  error,
  busy,
  snapshotMode = false,
  expert = false,
  onSave,
  onOverridesChange,
  onCancel,
  onDelete,
  onDiscardEdits = revert => revert(),
  actionSlot,
  initialTab,
}: {
  draft: Model;
  onChange: (draft: Model) => void;
  creating: boolean;
  workspace: Model[];
  // The reference catalogue the app loads once per revision.
  catalog: Catalog | null;
  catalogError: string;
  pricingProofs: PricingProof[];
  // The saved cards: this card as saved, and the accesses other cards hold (never offered here).
  saved: Model[];
  error: string;
  busy: boolean;
  snapshotMode?: boolean;
  expert?: boolean;
  onSave: (overrides: CatalogOverride[]) => void;
  onOverridesChange?: (overrides: CatalogOverride[]) => void;
  onCancel: () => void;
  onDelete: (model: Model) => void;
  // Cancel in the editor of a saved card: the app asks before dropping a change, then calls revert.
  onDiscardEdits?: (revert: () => void) => void;
  actionSlot?: ReactNode;
  // An existing card opens on the Overview unless the caller wants the accesses ("Add to card").
  initialTab?: "access";
}) {
  const [stagedOverrides, setStagedOverrides] = useState<CatalogOverride[]>([]);
  const [step, setStep] = useState<"choose" | "card" | "review">(creating ? "choose" : "card");
  const [mode, setMode] = useState<"read" | "edit">(creating ? "edit" : "read");
  const readOnly = mode === "read";
  // Expert shows every step at once, in the editor only.
  const all = expert && !readOnly;
  const [cardTab, setCardTab] = useState<(typeof cardTabs)[number][0]>(initialTab ?? "overview");
  // Arrow keys, Home and End move between the tabs (WAI-ARIA tabs, automatic activation).
  const moveTab = (event: React.KeyboardEvent, index: number) => {
    const next =
      event.key === "ArrowRight"
        ? index + 1
        : event.key === "ArrowLeft"
          ? index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? cardTabs.length - 1
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    const [id] = cardTabs[(next + cardTabs.length) % cardTabs.length];
    setCardTab(id);
    document.getElementById(`model-tab-${id}`)?.focus();
  };
  const [editing, setEditing] = useState<EditSection>(null);
  const [editDraft, setEditDraft] = useState<Model | null>(null);
  const [editingAccess, setEditingAccess] = useState(0);
  const [property, setProperty] = useState<{
    key: EditableProperty;
    target: "reference" | "access";
    id: string;
    value: string;
  } | null>(null);
  const [propertyNotice, setPropertyNotice] = useState("");
  // Basic: the numeric corrections typed in "Edit details" and in an access's settings, only those that differ from what is shown.
  const [valueEdits, setValueEdits] = useState<Record<string, string>>({});
  const [registrationIssue, setRegistrationIssue] = useState<ReturnType<typeof firstRegistrationIssue>>();
  const copy = useCopy();
  const { colon } = useFormat();
  // #101: creating a card is "registering" in English (French already says "enregistrer" for both); editing keeps "saving".
  const committing = creating ? "registering" : "saving";
  const language = useLanguage();
  const display = useDisplay();
  const creatorName = useCreatorName();
  const term = useTerm();
  const evidence = (status?: Capability) => capabilityStateLabel(status ?? "Unknown", copy);
  const editOpener = useRef<HTMLElement | null>(null);
  const propertyOpener = useRef<HTMLElement | null>(null);
  const viewCatalog = useMemo(() => {
    if (!catalog) return null;
    const view = {
      ...catalog,
      references: catalog.references.map(record => ({ ...record, fields: { ...record.fields } })),
      accesses: catalog.accesses.map(record => ({ ...record, fields: { ...record.fields } })),
    };
    for (const correction of stagedOverrides) {
      const record = (correction.target === "reference" ? view.references : view.accesses).find(
        item => item.id === correction.id,
      );
      if (record)
        record.fields[correction.field] = {
          value: correction.value,
          source: "manual",
          updatedAt: null,
          kind: "declared",
        };
    }
    return view;
  }, [catalog, stagedOverrides]);
  const options = useMemo(() => modelEditorOptions(viewCatalog, workspace, copy), [viewCatalog, workspace, language]);
  const update = (patch: Partial<Model>) => onChange({ ...draft, ...patch });
  const form = editDraft || draft;
  const updateEdit = (patch: Partial<Model>) => setEditDraft({ ...form, ...patch });
  const changeEditAccess = (index: number, patch: Partial<Access>) =>
    updateEdit({
      accesses: form.accesses.map((access, at) =>
        at !== index
          ? access
          : patch.provider !== undefined
            ? changeAccessProvider({ ...access, ...patch }, form.id, patch.provider)
            : { ...access, ...patch },
      ),
    });
  const openEdit = (section: Exclude<EditSection, null>, accessIndex = 0, value = draft) => {
    editOpener.current = document.activeElement as HTMLElement | null;
    setEditDraft(value);
    setEditingAccess(accessIndex);
    setEditing(section);
  };
  const closeEdit = () => {
    setEditing(null);
    setEditDraft(null);
    setValueEdits({});
  };
  // Basic names a saved card by its title alone; creating or Expert, the sheet also says what it is for or its ID.
  const describes = creating || expert;
  const validAccesses = draft.accesses.filter(access => access.provider && access.nativeModel);
  const showNative = (access: Access) => showsNativeModel(validAccesses, access, expert);
  const baseline = saved.find(model => model.id === draft.id);
  // Saved accesses removed from the draft stay matches, so they can be added back; an access another
  // saved card holds is never offered (Bifrost routes one access to one card).
  const selectedReference = (id?: string) => viewCatalog?.references.find(reference => reference.id === id);
  const cardTitle = cardName(draft, viewCatalog);
  const catalogAccess = (access: Access) => viewCatalog?.accesses.find(row => sameAccess(row, access));
  const referenceOptions = (viewCatalog?.references || []).map(reference => ({
    value: reference.id,
    label: display(reference.fields.name?.value),
    detail: copy("Existing reference card", "Fiche documentaire existante"),
  }));
  const referenceName = (id?: string) =>
    id ? display(selectedReference(id)?.fields.name?.value) : copy("none", "aucune");
  const chooseModelId = (value: string, option?: SearchOption) => {
    const reference = option?.referenceId ? selectedReference(option.referenceId) : undefined;
    const fromWorkspace = workspace.find(model => model.id === value);
    const next = reference
      ? prefillFromReference(draft, reference)
      : fromWorkspace
        ? {
            ...draft,
            name: draft.name || fromWorkspace.name,
            creator: draft.creator === "Unknown" ? fromWorkspace.creator : draft.creator,
            family: draft.family === "Unknown" ? fromWorkspace.family : draft.family,
          }
        : draft;
    onChange(applyModelId(next, value));
  };
  const chooseEditReference = (index: number, id: string) => {
    const reference = selectedReference(id);
    const next = reference ? prefillFromReference(form, reference) : form;
    setEditDraft({
      ...next,
      accesses: next.accesses.map((access, at) => (at === index ? { ...access, referenceId: id } : access)),
    });
  };
  const toggleCatalogAccess = (access: CatalogAccess, checked: boolean) => {
    const remaining = draft.accesses.filter(row => row.provider && row.nativeModel && !sameAccess(row, access));
    // A saved access comes back as saved; a new one starts with the operations its native mode implies.
    const restored = creating ? undefined : baseline?.accesses.find(row => sameAccess(row, access));
    const row: Access = restored ?? {
      provider: access.provider,
      nativeModel: access.model,
      id: `${access.provider}/${draft.id}`,
      route: "Direct provider",
      status: "Configured",
      endpoints: declaredEndpoints(access, selectedReference(access.referenceId)),
      ...(access.referenceId ? { referenceId: access.referenceId } : {}),
    };
    // Saved accesses keep their saved order, so taking one off and adding it back leaves the card as saved.
    const place = (at: Access) => {
      const i = creating ? -1 : (baseline?.accesses.findIndex(saved => sameAccess(saved, at)) ?? -1);
      return i < 0 ? 1e9 : i;
    };
    update({ accesses: checked ? [...remaining, row].sort((a, b) => place(a) - place(b)) : remaining });
  };
  const original = creating ? undefined : (baseline ?? workspace.find(model => model.id === draft.id));
  const invalidReference = draft.accesses.some(
    access =>
      !!access.referenceId &&
      (viewCatalog
        ? !viewCatalog.references.some(reference => reference.id === access.referenceId)
        : !original?.accesses.some(row => sameAccess(row, access) && row.referenceId === access.referenceId)),
  );
  const validId = /^[a-z0-9][a-z0-9._-]*$/.test(draft.id);
  const canContinue = validId && validAccesses.length > 0;
  const canSave = firstRegistrationIssue(draft) === undefined && !invalidReference;
  const displayedCapabilities = canonicalCapabilities(draft.capabilities);
  const capabilityRows = [...new Set([...capabilityNames, ...Object.keys(displayedCapabilities)])];
  const referenceIds = validAccesses.map(access => access.referenceId ?? catalogAccess(access)?.referenceId);
  const sharedReferenceId =
    referenceIds.length > 0 && referenceIds[0] && referenceIds.every(id => id === referenceIds[0])
      ? referenceIds[0]
      : "";
  const displayedReference = selectedReference(sharedReferenceId);
  const commonFacts = displayedReference?.fields || {};
  const summaryModel = {
    ...draft,
    inputModalities: draft.inputModalities.length
      ? draft.inputModalities
      : modalityList(commonFacts.input_modalities?.value),
    outputModalities: draft.outputModalities.length
      ? draft.outputModalities
      : modalityList(commonFacts.output_modalities?.value),
    capabilities: displayedCapabilities,
  };
  const commonFact = (key: string): CatalogField | undefined => commonFacts[key];
  const catalogFact = (found: CatalogAccess | undefined, key: string, referenceId = found?.referenceId) =>
    found?.fields[key] ||
    (found?.omittedFields?.includes(key) ? undefined : selectedReference(referenceId)?.fields[key]);
  const accessFact = (access: Access, key: string) =>
    catalogFact(catalogAccess(access), key, access.referenceId ?? catalogAccess(access)?.referenceId);
  // Discovered accesses matching this model stay out of the card until the user adds one (the tile's "+N available").
  const others = alsoAvailable(viewCatalog?.accesses || [], draft, saved, creating ? [] : baseline?.accesses);
  const priceOf = (access: CatalogAccess) =>
    documentedPrice(
      catalogFact(access, "input_cost_usd_per_million")?.value,
      catalogFact(access, "output_cost_usd_per_million")?.value,
      copy,
      value => display(value, "$/M"),
    ) || copy("No documented price", "Aucun tarif documenté");
  const alsoAvailableSection = others.length > 0 && (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">
        {copy("Also available", "Également disponibles")} · {others.length}
      </h4>
      <p className="text-xs text-muted-foreground">
        {copy(
          "Discovered accesses to the same model. They stay out of this card unless you add them.",
          "Accès découverts pour le même modèle. Ils restent hors de cette fiche sauf si vous les ajoutez.",
        )}
      </p>
      {others.map(access => (
        <div
          key={access.id}
          className="flex flex-wrap items-start justify-between gap-3 rounded-sm border border-dashed p-3"
        >
          <span className="min-w-0 space-y-1">
            <strong className="block text-sm">{displayProvider(access.provider)}</strong>
            <code className="block break-all text-xs">{access.model}</code>
            <span className="block text-xs text-muted-foreground">{priceOf(access)}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            aria-label={copy(
              `Add ${displayProvider(access.provider)} · ${access.model}`,
              `Ajouter ${displayProvider(access.provider)} · ${access.model}`,
            )}
            onClick={() => {
              toggleCatalogAccess(access, true);
              startEdit("choose");
            }}
          >
            <Plus className="size-4" />
            {copy("Add", "Ajouter")}
          </Button>
        </div>
      ))}
    </section>
  );
  const openProperty = (key: EditableProperty, target: "reference" | "access", access?: Access) => {
    const record = target === "reference" ? displayedReference : access && catalogAccess(access);
    if (!record) return;
    const fact = target === "reference" ? record.fields[key] : access && accessFact(access, key);
    setProperty({ key, target, id: record.id, value: fact?.value === undefined ? "" : String(fact.value) });
  };
  const editButton = (key: string, target: "reference" | "access", access?: Access) =>
    !readOnly &&
    editableProperties.has(key) &&
    (target === "reference" ? displayedReference : access && catalogAccess(access)) ? (
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 h-7 px-1 text-xs"
        aria-label={`${copy("Edit", "Modifier")} ${fieldLabel(key, copy).toLowerCase()} ${target === "reference" ? copy("on model card", "de la fiche commune") : `${copy("for access", "de l’accès")} ${displayProvider(access?.provider ?? "")} ${access?.nativeModel}`}`}
        onClick={event => {
          propertyOpener.current = event.currentTarget;
          openProperty(key as EditableProperty, target, access);
        }}
      >
        {copy("Edit", "Modifier")}
      </Button>
    ) : null;
  const propertyRecord =
    property?.target === "reference"
      ? displayedReference
      : viewCatalog?.accesses.find(access => access.id === property?.id);
  const propertyAccess =
    property?.target === "access" ? validAccesses.find(access => catalogAccess(access)?.id === property.id) : undefined;
  const propertyCurrent =
    property?.target === "reference"
      ? propertyRecord?.fields[property.key]
      : property && propertyAccess
        ? accessFact(propertyAccess, property.key)
        : undefined;
  const propertyInherited = property
    ? (() => {
        if (property.target === "reference")
          return catalog?.references.find(record => record.id === property.id)?.fields[property.key]?.value;
        const access = catalog?.accesses.find(record => record.id === property.id);
        const draftAccess = draft.accesses.find(row => !!access && sameAccess(row, access));
        return (
          access?.fields[property.key]?.value ??
          catalog?.references.find(record => record.id === (draftAccess?.referenceId ?? access?.referenceId))?.fields[
            property.key
          ]?.value
        );
      })()
    : undefined;
  const isPriceKey = (key: string) => key === "input_cost_usd_per_million" || key === "output_cost_usd_per_million";
  const valueProblem = (key: EditableProperty) =>
    key === "tool_call" || key === "structured_output"
      ? copy("Choose yes or no.", "Choisir Oui ou Non.")
      : isPriceKey(key)
        ? copy("Enter a nonnegative number.", "Saisir un nombre positif ou nul.")
        : copy("Enter a nonnegative whole number.", "Saisir un entier positif ou nul.");
  let proposed: number | boolean | undefined;
  let propertyValidation = "";
  if (property) {
    try {
      proposed = parsePropertyValue(property.key, property.value);
    } catch {
      propertyValidation = valueProblem(property.key);
    }
  }
  const propertyPreview =
    property && proposed !== undefined
      ? (viewCatalog?.accesses || [])
          .map(access => {
            const draftAccess = draft.accesses.find(row => sameAccess(row, access));
            const linked = draftAccess?.referenceId ?? access.referenceId;
            const own = access.fields[property.key]?.value;
            const omitted = access.omittedFields?.includes(property.key) || false;
            const inherited = omitted ? undefined : selectedReference(linked)?.fields[property.key]?.value;
            const before = own === undefined ? inherited : own;
            const after = proposedAccessValue(
              property.target,
              property.id,
              access.id,
              linked,
              own,
              inherited,
              proposed,
              omitted,
            );
            return { access, before, after, linked };
          })
          .filter(row => (property.target === "reference" ? row.linked === property.id : row.access.id === property.id))
      : [];
  const saveProperty = () => {
    if (!property || proposed === undefined || !catalog) return;
    const original = (property.target === "reference" ? catalog.references : catalog.accesses).find(
      record => record.id === property.id,
    )?.fields[property.key]?.value;
    const next = stageCatalogOverride(
      stagedOverrides,
      { target: property.target, id: property.id, field: property.key, value: proposed },
      original,
    );
    setStagedOverrides(next);
    onOverridesChange?.(next);
    const isPrice = property.key === "input_cost_usd_per_million" || property.key === "output_cost_usd_per_million";
    setPropertyNotice(
      Object.is(proposed, original)
        ? copy("Correction removed from draft.", "Correction retirée du brouillon.")
        : isPrice
          ? copy(
              "Correction added to the draft. Price corrections are saved with the model and applied as native Bifrost pricing overrides.",
              "Correction ajoutée au brouillon. Les corrections de prix sont enregistrées avec le modèle et appliquées comme overrides de tarification natifs Bifrost.",
            )
          : copy(
              "Correction added to the draft. It will be saved with the Registry model; no native Bifrost value is activated here.",
              "Correction ajoutée au brouillon. Elle sera enregistrée avec le modèle dans Registry ; aucune valeur native Bifrost n’est activée ici.",
            ),
    );
    setProperty(null);
  };
  // Basic corrects values inside the dialogs it already has: the card's in "Edit details", an access's in its settings.
  // The same corrections as Expert's per-value dialog, staged the same way, one Keep for all of them.
  type ValueTarget = CatalogOverride["target"];
  const valueKey = (target: ValueTarget, id: string, key: string) => JSON.stringify([target, id, key]);
  const unreadableEdit = ([k, raw]: [string, string]) => {
    try {
      parsePropertyValue((JSON.parse(k) as [ValueTarget, string, EditableProperty])[2], raw);
      return false;
    } catch {
      return true;
    }
  };
  const valueIssues = Object.entries(valueEdits).some(unreadableEdit);
  const keepValueEdits = () => {
    if (!catalog || !Object.keys(valueEdits).length) return;
    let next = stagedOverrides;
    for (const [k, raw] of Object.entries(valueEdits)) {
      const [target, id, field] = JSON.parse(k) as [ValueTarget, string, EditableProperty];
      const original = (target === "reference" ? catalog.references : catalog.accesses).find(record => record.id === id)
        ?.fields[field]?.value;
      next = stageCatalogOverride(next, { target, id, field, value: parsePropertyValue(field, raw) }, original);
    }
    setStagedOverrides(next);
    onOverridesChange?.(next);
    setPropertyNotice(
      Object.keys(valueEdits).some(k => isPriceKey((JSON.parse(k) as string[])[2]))
        ? copy(
            "Correction added to the draft. Price corrections are saved with the model and applied as native Bifrost pricing overrides.",
            "Correction ajoutée au brouillon. Les corrections de prix sont enregistrées avec le modèle et appliquées comme overrides de tarification natifs Bifrost.",
          )
        : copy(
            "Correction added to the draft. It will be saved with the Registry model; no native Bifrost value is activated here.",
            "Correction ajoutée au brouillon. Elle sera enregistrée avec le modèle dans Registry ; aucune valeur native Bifrost n’est activée ici.",
          ),
    );
  };
  const valueFields = (target: ValueTarget, id: string, fact: (key: string) => CatalogField | undefined) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {facts
        .filter(([key]) => editableProperties.has(key))
        .map(([key, unit]) => {
          const field = key as EditableProperty;
          const k = valueKey(target, id, key);
          const shown = fact(key)?.value === undefined ? "" : String(fact(key)?.value);
          const typed = valueEdits[k] ?? shown;
          const set = (next: string) =>
            setValueEdits(({ [k]: _dropped, ...others }) => (next === shown ? others : { ...others, [k]: next }));
          const problem = k in valueEdits && unreadableEdit([k, valueEdits[k]]) ? valueProblem(field) : "";
          return (
            <label key={key} className="block text-sm">
              {fieldLabel(key, copy)}
              {unit === "tokens" && (
                <span className="text-xs text-muted-foreground"> · {copy("in tokens", "en tokens")}</span>
              )}
              {unit === "$/M" && (
                <span className="text-xs text-muted-foreground">
                  {" "}
                  · {copy("$ per million tokens", "$ par million de tokens")}
                </span>
              )}
              {unit === "" ? (
                <select
                  className="mt-1 h-9 w-full rounded-sm border bg-background px-3"
                  aria-invalid={!!problem}
                  value={typed}
                  onChange={event => set(event.target.value)}
                >
                  <option value="">{copy("Choose yes or no", "Choisir Oui ou Non")}</option>
                  <option value="true">{copy("Yes", "Oui")}</option>
                  <option value="false">{copy("No", "Non")}</option>
                </select>
              ) : (
                <Input
                  className="mt-1"
                  type="number"
                  min="0"
                  step={isPriceKey(key) ? "0.0001" : "1"}
                  inputMode={isPriceKey(key) ? "decimal" : "numeric"}
                  aria-invalid={!!problem}
                  value={typed}
                  onChange={event => set(event.target.value)}
                />
              )}
              {problem && (
                <span role="alert" className="mt-1 block text-xs text-destructive">
                  {problem}
                </span>
              )}
            </label>
          );
        })}
    </div>
  );
  const reviewLabels: Record<string, string> = {
    name: copy("Display name", "Nom affiché"),
    creator: copy("Creator", "Créateur"),
    family: copy("Family", "Famille"),
    summary: copy("Description", "Description"),
    context: copy("Registry context", "Contexte Registry"),
    tasks: copy("Tasks", "Usages"),
    inputModalities: copy("Input", "Entrées"),
    outputModalities: copy("Output", "Sorties"),
  };
  const originalPropertyValue = (item: CatalogOverride) => {
    if (item.target === "reference")
      return catalog?.references.find(record => record.id === item.id)?.fields[item.field]?.value;
    const access = catalog?.accesses.find(record => record.id === item.id);
    const draftAccess = draft.accesses.find(row => !!access && sameAccess(row, access));
    return (
      access?.fields[item.field]?.value ??
      catalog?.references.find(record => record.id === (draftAccess?.referenceId ?? access?.referenceId))?.fields[
        item.field
      ]?.value
    );
  };
  // #100: the Review lists plain changes; a changed access is one plain row here and its native ID, exact
  // endpoints or documentary record in the "Technical details" fold (open in Expert).
  const accessChanges: { plain: string; technical: string }[] = original
    ? [
        ...draft.accesses
          .filter(access => !original.accesses.some(before => sameAccess(before, access)))
          .map(access => ({
            plain: `${copy("Access added", "Accès ajouté")}${colon} ${displayProvider(access.provider)}`,
            technical: `${copy("Access added", "Accès ajouté")}${colon} ${displayProvider(access.provider)} · ${access.nativeModel}`,
          })),
        ...original.accesses
          .filter(access => !draft.accesses.some(after => sameAccess(after, access)))
          .map(access => ({
            plain: `${copy("Access removed", "Accès retiré")}${colon} ${displayProvider(access.provider)}`,
            technical: `${copy("Access removed", "Accès retiré")}${colon} ${displayProvider(access.provider)} · ${access.nativeModel}`,
          })),
        ...draft.accesses
          .filter(access =>
            original.accesses.some(before => sameAccess(before, access) && before.referenceId !== access.referenceId),
          )
          .map(access => ({
            plain: `${copy("Reference changed for", "Fiche documentaire modifiée pour")} ${displayProvider(access.provider)}`,
            technical: `${copy("Documentary record for", "Fiche documentaire de")} ${displayProvider(access.provider)}${colon} ${referenceName(original.accesses.find(before => sameAccess(before, access))?.referenceId)} → ${referenceName(access.referenceId)}`,
          })),
        ...draft.accesses
          .filter(access =>
            original.accesses.some(
              before =>
                sameAccess(before, access) &&
                JSON.stringify(before.endpoints || []) !== JSON.stringify(access.endpoints || []),
            ),
          )
          .map(access => {
            const before = original.accesses.find(row => sameAccess(row, access))?.endpoints;
            return {
              plain: `${copy("Requests changed for", "Requêtes modifiées pour")} ${displayProvider(access.provider)}`,
              technical: `${copy("Endpoints for", "Endpoints pour")} ${displayProvider(access.provider)} · ${access.nativeModel}${colon} ${(before || []).join(", ") || copy("Unknown", "Inconnu")} → ${(access.endpoints || []).join(", ") || copy("Unknown", "Inconnu")}`,
            };
          }),
      ]
    : [];
  const technicalChanges = accessChanges.map(change => change.technical);
  const reviewChanges = original
    ? [
        ...(["name", "creator", "family", "summary", "context"] as const)
          .filter(key => original[key] !== draft[key])
          .map(key => {
            const shown = key === "creator" ? creatorName : display;
            return `${reviewLabels[key]}${colon} ${shown(original[key])} → ${shown(draft[key])}`;
          }),
        ...(["tasks", "inputModalities", "outputModalities"] as const)
          .filter(key => JSON.stringify(original[key]) !== JSON.stringify(draft[key]))
          .map(
            key =>
              `${reviewLabels[key]}${colon} ${display(original[key].map(term))} → ${display(draft[key].map(term))}`,
          ),
        ...[...new Set([...Object.keys(original.capabilities), ...Object.keys(draft.capabilities)])]
          .filter(name => original.capabilities[name] !== draft.capabilities[name])
          .map(
            name =>
              `${copy("Capability", "Capacité")} ${term(name)}${colon} ${evidence(original.capabilities[name])} → ${evidence(draft.capabilities[name])}`,
          ),
        ...accessChanges.map(change => change.plain),
      ]
    : [];
  const continueToReview = () => {
    const issue = firstRegistrationIssue(draft);
    setRegistrationIssue(issue);
    if (!issue) {
      setStep("review");
      return;
    }
    if (issue === "id" || issue === "access" || issue === "operations") {
      setStep("choose");
      if (issue === "access" || issue === "operations")
        openEdit(
          "access",
          Math.max(
            0,
            draft.accesses.findIndex(access =>
              issue === "operations"
                ? !access.endpoints?.length
                : !access.provider || !access.nativeModel || access.id !== `${access.provider}/${draft.id}`,
            ),
          ),
        );
    } else setStep("card");
  };
  const stepNames = ["choose", "card", "review"] as const;
  const startEdit = (name: (typeof stepNames)[number] = "card") => {
    setStep(name);
    setMode("edit");
  };
  const revert = () => {
    if (original) onChange(structuredClone(original));
    setStagedOverrides([]);
    onOverridesChange?.([]);
    setPropertyNotice("");
    setRegistrationIssue(undefined);
    setStep("card");
    setMode("read");
  };
  // Nothing to save on a saved card: the draft equals the card and no catalogue correction is staged.
  const nothingToSave = !!original && !stagedOverrides.length && same(draft, original);
  const stepId = (name: string) => `editor-journey-step-${(stepNames as readonly string[]).indexOf(name)}`;
  const stepLabels = stepNames.map(name =>
    name === "choose"
      ? copy("Accesses", "Accès")
      : name === "card"
        ? copy("Model details", "Fiche modèle")
        : copy("Review", "Vérifier"),
  );
  const currentStep = Math.max(
    0,
    stepNames.findIndex(name => name === step),
  );
  const changeStep = (index: number) => {
    if (index === stepNames.length - 1) {
      const valid = !firstRegistrationIssue(draft);
      continueToReview();
      return valid;
    }
    if (creating && index > 0 && !canContinue) {
      setRegistrationIssue(firstRegistrationIssue(draft));
      setStep("choose");
      return false;
    }
    setStep(stepNames[index] || stepNames[stepNames.length - 1]);
    return true;
  };
  // The footer's way to Review: like the stepper pill it brings the section into view in Expert, then focuses its heading.
  const showReview = () => {
    if (!changeStep(stepNames.length - 1)) return;
    if (all) revealJourneyStep(stepNames.length - 1, true);
    requestAnimationFrame(() => document.getElementById("model-review-heading")?.focus({ preventScroll: all }));
  };
  const modelSummary = (
    <div className="space-y-3">
      <div className="rounded-sm border bg-card p-3">
        <p className="font-semibold">{cardTitle || copy("Unnamed model", "Modèle sans nom")}</p>
        <code className="break-all text-xs">{draft.id || copy("ID missing", "ID manquant")}</code>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">
          {copy("Provider accesses", "Accès fournisseurs")} · {validAccesses.length}
        </h3>
        {validAccesses.map(access => (
          <p key={access.id} className="break-all border-t py-2 text-xs">
            {displayProvider(access.provider)} · {access.nativeModel}
            <br />
            <span className="text-muted-foreground">
              {copy("Registry ID", "ID Registry")} · {access.id}
            </span>
          </p>
        ))}
        {!validAccesses.length && (
          <p className="text-xs text-muted-foreground">
            {copy("Add at least one provider access.", "Ajoutez au moins un accès fournisseur.")}
          </p>
        )}
      </div>
      {!canSave && (
        <p className="text-xs text-destructive">
          {copy(
            `Complete the required fields before ${committing}.`,
            "Complétez les champs obligatoires avant l’enregistrement.",
          )}
        </p>
      )}
    </div>
  );
  const editorFooter = (
    <>
      <div className="mb-3">
        {error && (
          <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {currentStep > 0 && (
          <Button variant="ghost" onClick={() => changeStep(currentStep - 1)}>
            {copy("Back", "Retour")}
          </Button>
        )}
        <Button variant="outline" onClick={creating ? onCancel : () => onDiscardEdits(revert)}>
          {copy("Cancel", "Annuler")}
        </Button>
        {currentStep < stepNames.length - 1 ? (
          <Button
            disabled={step === "choose" && !canContinue}
            onClick={() =>
              !creating || currentStep === stepNames.length - 2 ? showReview() : changeStep(currentStep + 1)
            }
          >
            {currentStep === 0
              ? copy(creating ? "Next: model details" : "Review", creating ? "Suivant : fiche modèle" : "Vérifier")
              : copy("Review", "Vérifier")}
          </Button>
        ) : (
          <>
            {nothingToSave && (
              <span id="model-save-hint" className="text-sm text-muted-foreground">
                {copy("No changes", "Aucun changement")}
              </span>
            )}
            <Button
              disabled={busy || !canSave || nothingToSave}
              aria-describedby={nothingToSave ? "model-save-hint" : undefined}
              onClick={() => onSave(stagedOverrides)}
            >
              {creating ? copy("Register", "Enregistrer le modèle") : copy("Save model", "Enregistrer le modèle")}
            </Button>
          </>
        )}
      </div>
    </>
  );
  // The read view's actions. Delete is a "..." menu item: the app confirms before it deletes.
  const readFooter = (
    <>
      <div className="mb-3">
        {error && (
          <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-auto" aria-label={copy("More actions", "Plus d’actions")}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(draft)}>
              {copy("Delete", "Supprimer")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={() => startEdit()}>{copy("Edit", "Modifier")}</Button>
      </div>
    </>
  );

  const chooser = (all || step === "choose") && (
    <section id={stepId("choose")} className="space-y-4">
      <div>
        {creating && (
          <>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {copy("Selected model", "Modèle choisi")}
            </p>
            <h3 className="text-2xl font-semibold">{cardTitle || copy("Choose a model", "Choisir un modèle")}</h3>
          </>
        )}
        <p className="text-sm text-muted-foreground">
          {creatorName(draft.creator)}
          <InferredMark model={draft} />
          {expert && <> · {display(draft.family)}</>}
        </p>
        <p className="mt-2 text-sm">
          {copy(
            "Confirm the exact accesses to include in this model card.",
            "Confirmez les accès exacts à regrouper dans cette fiche.",
          )}
        </p>
      </div>
      {!creating ? null : draft.id && validId ? (
        expert && (
          <details className="rounded-sm border p-3">
            <summary className="cursor-pointer text-sm">
              {copy("Common model ID", "Identifiant commun")} · <code>{draft.id}</code>
            </summary>
            <div className="mt-3">
              <SearchableSelect
                label={copy("Change common model ID", "Changer l’identifiant commun")}
                value={draft.id}
                options={options.modelIds}
                onChange={chooseModelId}
                placeholder={copy("Search or enter an ID", "Chercher ou saisir un identifiant")}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {copy(
                "Changing this ID recalculates Registry access IDs. Provider selection remains separate.",
                "Changer cet identifiant recalcule les IDs exposés Registry. La sélection entre fournisseurs reste distincte.",
              )}
            </p>
          </details>
        )
      ) : (
        <SearchableSelect
          label={copy("Search a model or enter its ID *", "Chercher un modèle ou saisir son identifiant *")}
          value={draft.id}
          options={options.modelIds}
          onChange={chooseModelId}
          placeholder={copy("Model or custom ID", "Modèle ou identifiant personnalisé")}
        />
      )}
      <section className="space-y-2">
        <h4 className="text-sm font-semibold">
          {copy("In this card", "Dans cette fiche")} · {validAccesses.length}
        </h4>
        {validAccesses.map((access, index) => (
          <div
            key={`${access.provider}/${access.nativeModel}/${index}`}
            className="space-y-3 rounded-sm border p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p>
                <strong>{displayProvider(access.provider)}</strong>
                {showNative(access) && (
                  <>
                    {" "}
                    · <code className="break-all">{access.nativeModel}</code>
                  </>
                )}
              </p>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                {!expert && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={copy(
                      `Access settings for ${displayProvider(access.provider)}`,
                      `Réglages de l’accès ${displayProvider(access.provider)}`,
                    )}
                    onClick={() => openEdit("access", draft.accesses.indexOf(access))}
                  >
                    {copy("Access settings", "Réglages de l’accès")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={copy(
                    `Remove ${displayProvider(access.provider)} · ${access.nativeModel}`,
                    `Retirer ${displayProvider(access.provider)} · ${access.nativeModel}`,
                  )}
                  onClick={() => update({ accesses: draft.accesses.filter(row => row !== access) })}
                >
                  <X className="size-4" />
                  {copy("Remove", "Retirer")}
                </Button>
              </div>
            </div>
            <EndpointChoices
              access={access}
              brief={!expert}
              technical={expert}
              invalid={registrationIssue === "operations" && !access.endpoints?.length}
              onChange={endpoints =>
                update({ accesses: draft.accesses.map(row => (row === access ? { ...row, endpoints } : row)) })
              }
            />
          </div>
        ))}
        {draft.accesses.length === 0 && (
          <p className="text-sm text-muted-foreground">{copy("No access selected.", "Aucun accès sélectionné.")}</p>
        )}
      </section>
      {alsoAvailableSection}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          openEdit("access", validAccesses.length, {
            ...draft,
            accesses: [
              ...validAccesses,
              { provider: "", id: "", nativeModel: "", route: "Direct provider", status: "Unknown" },
            ],
          })
        }
      >
        <Plus className="size-4" />
        {copy("Enter access manually", "Saisir un accès manuellement")}
      </Button>
      {!canContinue && (
        <p role="status" className="text-sm text-destructive">
          {copy(
            "Choose a valid common model ID and at least one complete provider access to prepare the card.",
            "Choisissez un identifiant commun valide et au moins un accès fournisseur complet pour préparer la fiche.",
          )}
        </p>
      )}
    </section>
  );

  return (
    <SheetContent
      inert={busy}
      expandable
      {...(describes ? {} : { "aria-describedby": undefined })}
      className="min-h-0 max-w-[calc(100vw-1rem)] p-4 sm:max-w-5xl sm:p-6"
    >
      <SheetHeader className="shrink-0 pb-4">
        <SheetTitle className="text-xl">
          {creating ? copy("Register a model", "Enregistrer un modèle") : cardTitle}
        </SheetTitle>
        {describes && (
          <SheetDescription>
            {creating ? (
              copy(
                "Choose accesses, review the model card, then check and register.",
                "Choisir les accès, lire la fiche, puis vérifier l’enregistrement.",
              )
            ) : (
              <>
                {copy("Common model ID", "Identifiant commun")} · <code className="break-all">{draft.id}</code>
              </>
            )}
          </SheetDescription>
        )}
      </SheetHeader>
      <EditorJourney
        labels={stepLabels}
        step={currentStep}
        onStepChange={changeStep}
        expert={all}
        summary={modelSummary}
        footer={readOnly ? readFooter : editorFooter}
        hideSteps={readOnly}
      >
        {catalogError && (
          <p role="status" className="rounded-sm border p-3 text-xs text-muted-foreground">
            {copy("Reference data unavailable", "Données de référence indisponibles")}
            {colon} {catalogError}.{" "}
            {copy("Existing accesses remain visible.", "Les accès déjà présents restent visibles.")}
          </p>
        )}
        {propertyNotice && (
          <p role="status" className="rounded-sm border bg-primary/5 p-3 text-sm">
            {propertyNotice}
          </p>
        )}
        {registrationIssue && (
          <p
            role="alert"
            className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {registrationIssue === "id"
              ? copy("Enter a valid common model ID.", "Saisissez un identifiant commun valide.")
              : registrationIssue === "name"
                ? copy("A display name is required.", "Le nom affiché est obligatoire.")
                : registrationIssue === "operations"
                  ? copy(
                      "Choose at least one Registry endpoint for every provider access.",
                      "Choisissez au moins un endpoint Registry pour chaque accès fournisseur.",
                    )
                  : copy(
                      "Complete each provider access: provider, native model ID, and matching Registry ID.",
                      "Complétez chaque accès fournisseur : fournisseur, ID natif et ID Registry correspondant.",
                    )}
          </p>
        )}

        {chooser}

        {(all || step === "card") && (
          <div id={stepId("card")} className="space-y-5">
            {!readOnly && (
              <section className="grid gap-3 rounded-sm border bg-card p-4 sm:grid-cols-2">
                <Field data-invalid={!draft.name.trim()}>
                  <FieldLabel htmlFor="model-display-name">{copy("Display name", "Nom affiché")} *</FieldLabel>
                  <Input
                    id="model-display-name"
                    aria-required="true"
                    aria-invalid={!draft.name.trim()}
                    autoFocus={!draft.name.trim()}
                    value={draft.name}
                    onChange={event => update({ name: event.target.value })}
                  />
                  <FieldDescription>
                    {!draft.name.trim()
                      ? copy("A display name is required.", "Le nom affiché est obligatoire.")
                      : copy("Shown in the Registry catalog.", "Affiché dans le catalogue Registry.")}
                  </FieldDescription>
                </Field>
              </section>
            )}

            <section className="rounded-sm border bg-card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <BrandIcon model={draft} mode="creator" />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {creating
                      ? copy("Preview before registering", "Aperçu avant enregistrement")
                      : copy("Registry model", "Fiche modèle Registry")}
                  </p>
                  {creating && (
                    <>
                      <h3 className="mt-1 break-words text-2xl font-semibold">
                        {cardTitle || copy("Unnamed model", "Modèle sans nom")}
                      </h3>
                      {expert && <code className="break-all text-xs text-muted-foreground">{draft.id}</code>}
                    </>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {creatorName(draft.creator)}
                    <InferredMark model={draft} />
                    {expert && <> · {display(draft.family)}</>}
                  </p>
                </div>
                {/* Basic edits the card through this one button; Expert keeps one button per part. */}
                {!readOnly &&
                  (expert ? (
                    <Button variant="outline" size="sm" onClick={() => openEdit("identity")}>
                      {copy("Edit identity", "Modifier l’identité")}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => openEdit("details")}>
                      {copy("Edit details", "Modifier les détails")}
                    </Button>
                  ))}
              </div>
            </section>
            <div
              role="tablist"
              aria-label={copy("Model details", "Détails du modèle")}
              className="grid grid-cols-2 gap-1 border-b sm:flex sm:overflow-x-auto"
            >
              {cardTabs.map(([id, en, fr], index) => (
                <Button
                  key={id}
                  id={`model-tab-${id}`}
                  type="button"
                  variant="ghost"
                  role="tab"
                  aria-selected={cardTab === id}
                  aria-controls="model-tab-panel"
                  tabIndex={cardTab === id ? 0 : -1}
                  onKeyDown={event => moveTab(event, index)}
                  className={`shrink-0 rounded-b-none border-b-2 ${cardTab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
                  onClick={() => setCardTab(id)}
                >
                  {copy(en, fr)}
                </Button>
              ))}
            </div>
            <div
              role="tabpanel"
              id="model-tab-panel"
              aria-labelledby={`model-tab-${cardTab}`}
              tabIndex={0}
              className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {cardTab === "overview" && (
                <section className="space-y-4 rounded-sm border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className={`min-w-0 flex-1 text-sm ${draft.summary ? "" : "text-muted-foreground"}`}>
                      {draft.summary || copy("No description recorded.", "Aucune description enregistrée.")}
                    </p>
                    {!readOnly && expert && (
                      <Button variant="outline" size="sm" onClick={() => openEdit("details")}>
                        {copy("Edit Registry details", "Modifier les détails Registry")}
                      </Button>
                    )}
                  </div>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {expert && (
                      <div>
                        <dt className="text-xs text-muted-foreground">{copy("Creator", "Créateur")}</dt>
                        <dd className="text-sm font-medium">
                          {creatorName(draft.creator)}
                          <InferredMark model={draft} />
                          {knownValue(draft.family) && (
                            <span className="font-normal text-muted-foreground"> · {draft.family}</span>
                          )}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs text-muted-foreground">{copy("Served by", "Servi par")}</dt>
                      <dd className="text-sm font-medium">
                        {validAccesses.length
                          ? [...new Set(validAccesses.map(access => displayProvider(access.provider)))].join(", ")
                          : copy("No provider access", "Aucun accès fournisseur")}
                        {others.length > 0 && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            ·{" "}
                            {copy(
                              `${others.length} more available`,
                              `${others.length} autre${others.length > 1 ? "s" : ""} disponible${others.length > 1 ? "s" : ""}`,
                            )}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{fieldLabel("context_length", copy)}</dt>
                      <dd className="text-sm font-medium">
                        {display(
                          commonFact("context_length")?.value ??
                            (/^\d+$/.test(draft.context) ? Number(draft.context) : undefined),
                          "tokens",
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{copy("Reads and writes", "Lit et produit")}</dt>
                      <dd className="text-sm">
                        {factsUnknown(summaryModel) ? (
                          <FactsUnknown associate={!hasReference(draft)} />
                        ) : (
                          <ModelModalitiesSummary model={summaryModel} />
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>
              )}
              {cardTab === "properties" && (
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold">{copy("Documented properties", "Propriétés documentées")}</h4>
                    {!readOnly && expert && (
                      <Button variant="outline" size="sm" onClick={() => openEdit("details")}>
                        {copy("Edit Registry details", "Modifier les détails Registry")}
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {copy(
                      "Values come from Models.dev unless you corrected them.",
                      "Les valeurs viennent de Models.dev, sauf si vous les avez corrigées.",
                    )}
                  </p>
                  {expert && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">{copy("More", "En savoir plus")}</summary>
                      <div className="mt-1 space-y-1">
                        <p>
                          {copy(
                            "Each column shows its value and source. Access-specific facts stay separate; Registry corrections apply native Bifrost pricing overrides only for price fields.",
                            "Chaque colonne montre sa valeur et sa source. Les données propres à un accès restent distinctes ; les corrections Registry appliquent des overrides de tarification natifs Bifrost uniquement pour les champs de prix.",
                          )}
                        </p>
                        <p>
                          {copy(
                            "Documented (declared) means reported by the source, without an inference test. Bifrost catalog identifies where the value was imported from.",
                            "Documenté (déclaré) signifie indiqué par la source, sans test d’inférence. Catalogue Bifrost indique l’origine de la valeur importée.",
                          )}
                        </p>
                      </div>
                    </details>
                  )}
                  {!displayedReference && expert && (
                    <p className="text-xs text-muted-foreground">
                      {copy(
                        "No shared documentary record: selected accesses do not all use the same mapping.",
                        "Fiche documentaire commune indisponible : les accès sélectionnés n’ont pas tous la même association.",
                      )}
                    </p>
                  )}
                  {!displayedReference && !expert && referenceIds.some(Boolean) && (
                    <p className="text-xs text-muted-foreground">
                      {copy(
                        "No shared reference: the accesses of this card do not all use the same one.",
                        "Fiche documentaire commune indisponible : les accès de cette fiche n’ont pas tous la même.",
                      )}
                    </p>
                  )}
                  {/* Basic: the card's own values, one list, the source said once above; a corrected value says so. Expert: a column per access. */}
                  {!expert && facts.some(([key]) => commonFact(key)) && (
                    <dl className="grid gap-3 rounded-sm border bg-card p-4 sm:grid-cols-2">
                      {facts.map(([key, unit]) => {
                        const fact = commonFact(key);
                        return (
                          fact && (
                            <div key={key}>
                              <dt className="text-xs text-muted-foreground">{fieldLabel(key, copy)}</dt>
                              <dd className="text-sm font-medium">
                                {display(fact.value, unit)}
                                {/^manual$/i.test(fact.source) && (
                                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    {copy("customized", "personnalisé")}
                                  </span>
                                )}
                              </dd>
                            </div>
                          )
                        );
                      })}
                    </dl>
                  )}
                  {expert && (
                    <div className="space-y-2 md:hidden">
                      {facts.map(([key, unit]) => (
                        <div key={key} className="rounded-sm border bg-card p-3">
                          <h5 className="mb-2 text-sm font-medium">{fieldLabel(key, copy)}</h5>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <span className="text-xs text-muted-foreground">
                                {copy("Model card", "Fiche commune")}
                              </span>
                              <FactValue fact={commonFact(key)} unit={unit} />
                              {editButton(key, "reference")}
                            </div>
                            {validAccesses.map(access => {
                              const fact = accessFact(access, key);
                              return (
                                <div key={`${access.provider}/${access.nativeModel}`}>
                                  <span className="text-xs text-muted-foreground">
                                    {displayProvider(access.provider)}
                                  </span>
                                  <FactValue
                                    fact={fact}
                                    inherited={!catalogAccess(access)?.fields[key] && !!fact}
                                    accessSpecific={!!catalogAccess(access)?.fields[key]}
                                    unit={unit}
                                  />
                                  {editButton(key, "access", access)}
                                  <PricingApplication proofs={pricingProofs} access={access} field={key} fact={fact} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {expert && (
                    <div className="hidden overflow-x-auto rounded-sm border md:block">
                      <table className="w-full min-w-[620px] border-collapse text-left">
                        <thead className="bg-muted/40">
                          <tr>
                            <th scope="col" className="p-3 text-xs font-medium">
                              {copy("Property", "Propriété")}
                            </th>
                            <th scope="col" className="p-3 text-xs font-medium">
                              {copy("Model card", "Fiche commune")}
                            </th>
                            {validAccesses.map(access => (
                              <th
                                key={`${access.provider}/${access.nativeModel}`}
                                scope="col"
                                className="min-w-40 p-3 text-xs font-medium"
                              >
                                {displayProvider(access.provider)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {facts.map(([key, unit]) => (
                            <tr key={key} className="border-t align-top">
                              <th scope="row" className="p-3 text-sm font-medium">
                                {fieldLabel(key, copy)}
                              </th>
                              <td className="p-3">
                                <FactValue fact={commonFact(key)} unit={unit} />
                                {editButton(key, "reference")}
                              </td>
                              {validAccesses.map(access => {
                                const fact = accessFact(access, key);
                                return (
                                  <td key={`${access.provider}/${access.nativeModel}`} className="p-3">
                                    <FactValue
                                      fact={fact}
                                      inherited={!catalogAccess(access)?.fields[key] && !!fact}
                                      accessSpecific={!!catalogAccess(access)?.fields[key]}
                                      unit={unit}
                                    />
                                    {editButton(key, "access", access)}
                                    <PricingApplication
                                      proofs={pricingProofs}
                                      access={access}
                                      field={key}
                                      fact={fact}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="space-y-3 border-t pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-semibold">{copy("Modalities and capabilities", "Modalités et capacités")}</h4>
                      {!readOnly && expert && (
                        <Button variant="outline" size="sm" onClick={() => openEdit("capabilities")}>
                          {copy("Edit Registry values", "Modifier les valeurs Registry")}
                        </Button>
                      )}
                    </div>
                    {factsUnknown(summaryModel) ? (
                      <FactsUnknown associate={!hasReference(draft)} />
                    ) : (
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        <div className="min-w-0">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            {copy("Modalities", "Modalités")}
                          </p>
                          <ModelModalitiesSummary model={summaryModel} />
                        </div>
                        <div className="min-w-0">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            {copy("Capabilities", "Capacités")}
                          </p>
                          <ModelCapabilitiesSummary
                            model={summaryModel}
                            context={{
                              source: "Registry",
                              scope: copy("Model-level declaration", "Déclaration de la fiche"),
                              execution: copy("Not verified", "Non vérifiée"),
                            }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {copy(
                        "A Registry declaration does not prove native support or activation.",
                        "Une déclaration Registry ne prouve ni la prise en charge native ni l’activation.",
                      )}
                    </p>
                    <p className="text-sm">
                      {copy("Tasks", "Usages")}
                      {colon} {draft.tasks.length ? draft.tasks.map(term).join(", ") : copy("Unknown", "Inconnu")}
                    </p>
                  </div>
                </section>
              )}
              {cardTab === "access" && (
                <section className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold">
                      {copy("In this card", "Dans cette fiche")} · {validAccesses.length}
                    </h4>
                    <Button variant="outline" size="sm" onClick={() => startEdit("choose")}>
                      {copy("Edit accesses", "Modifier les accès")}
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {validAccesses.map((access, index) => {
                      const found = catalogAccess(access);
                      return (
                        <div
                          key={`${access.provider}/${access.nativeModel}/${index}`}
                          className="space-y-3 rounded-sm border bg-card p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-2">
                              <BrandIcon model={{ ...draft, accesses: [access] }} mode="provider" />
                              <div className="min-w-0 space-y-1">
                                <p className="text-xs font-semibold">{copy("Provider access", "Accès natif")}</p>
                                <p className="text-xs text-muted-foreground">
                                  {copy("Provider in Bifrost", "Fournisseur dans Bifrost")}
                                </p>
                                <strong className="block break-words text-sm">
                                  {displayProvider(access.provider)}
                                </strong>
                                {showNative(access) && (
                                  <>
                                    <p className="text-xs text-muted-foreground">
                                      {copy("Model at this provider", "Modèle chez ce fournisseur")}
                                    </p>
                                    <code className="block break-all text-xs">{access.nativeModel}</code>
                                  </>
                                )}
                                {expert && (
                                  <code
                                    className="block break-all text-xs text-muted-foreground"
                                    title={copy("Access ID", "ID d’accès")}
                                  >
                                    {access.id}
                                  </code>
                                )}
                                <span className="block text-xs text-muted-foreground">
                                  {found?.configured
                                    ? copy("Configured · Bifrost", "Configuré · Bifrost")
                                    : access.status === "Configured"
                                      ? copy("Configured · discovered", "Configuré · découverte")
                                      : copy("Status unknown", "État inconnu")}
                                </span>
                              </div>
                            </div>
                            {!readOnly && expert && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEdit("access", draft.accesses.indexOf(access))}
                              >
                                {copy("Edit", "Modifier")}
                              </Button>
                            )}
                          </div>
                          {readOnly ? (
                            <p className="text-sm">
                              <span className="text-xs text-muted-foreground">
                                {expert
                                  ? copy("Registry endpoints", "Endpoints Registry")
                                  : copy("Works with", "Fonctionne avec")}
                                {colon}
                              </span>{" "}
                              {expert ? (
                                <code className="text-xs">{(access.endpoints || []).join(", ")}</code>
                              ) : (
                                plainEndpointNames(access.endpoints, copy)
                              )}
                            </p>
                          ) : (
                            <EndpointChoices
                              access={access}
                              brief={!expert}
                              technical={expert}
                              onChange={endpoints =>
                                update({
                                  accesses: draft.accesses.map(row => (row === access ? { ...row, endpoints } : row)),
                                })
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {alsoAvailableSection}
                </section>
              )}
              {cardTab === "sources" && (
                <div className="space-y-3">
                  <section className="grid gap-3 md:grid-cols-2">
                    {validAccesses.map(access => {
                      const found = catalogAccess(access);
                      const reference = selectedReference(access.referenceId ?? found?.referenceId);
                      const association = associationStatus(access, found, expert, copy);
                      return (
                        <div
                          key={`${access.provider}/${access.nativeModel}`}
                          className="min-w-0 rounded-sm border bg-card p-4"
                        >
                          <h4 className="font-semibold">{displayProvider(access.provider)}</h4>
                          {showNative(access) && (
                            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                              {access.nativeModel}
                            </p>
                          )}
                          <div className="mt-3 border-t pt-3">
                            <p className="text-xs text-muted-foreground">
                              {expert
                                ? copy("Documentary record", "Fiche documentaire")
                                : copy("Reference", "Fiche documentaire")}
                            </p>
                            <p className="text-sm font-medium">
                              {reference
                                ? display(reference.fields.name?.value)
                                : expert
                                  ? copy("No linked record", "Aucune fiche liée")
                                  : copy("No linked reference", "Aucune fiche liée")}
                            </p>
                            {reference && (
                              <p className="mt-1 break-words text-xs text-muted-foreground">
                                {copy("Sources", "Sources")}
                                {colon} {referenceSources(reference, copy)}
                              </p>
                            )}
                            {association && <p className="mt-2 text-xs text-muted-foreground">{association}</p>}
                            {expert && reference && (
                              <details className="mt-2 text-xs text-muted-foreground">
                                <summary className="cursor-pointer">
                                  {copy("Document ID", "Identifiant documentaire")}
                                </summary>
                                <code className="block break-all">{reference.id}</code>
                              </details>
                            )}
                          </div>
                          {expert && (
                            <p className="mt-3 text-xs text-muted-foreground">
                              {copy(
                                "Documentary data; provider behavior is not tested.",
                                "Données documentaires ; le comportement fournisseur n’est pas testé.",
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </section>
                  {/* Basic says it once under the cards, Expert on each one. */}
                  {!expert && (
                    <p className="text-xs text-muted-foreground">
                      {copy(
                        "Reference data; provider behavior is not tested.",
                        "Données documentaires ; le comportement fournisseur n’est pas testé.",
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
            {actionSlot && !readOnly && (
              <details className="rounded-sm border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {copy("Optional assistance", "Assistance facultative")}
                </summary>
                <div className="mt-3">{actionSlot}</div>
              </details>
            )}
          </div>
        )}

        {/* #100: Review opens on one plain sentence of consequence; IDs, endpoints and documentary records wait in a fold (open in Expert). */}
        {(all || step === "review") && (
          <section id={stepId("review")} className="space-y-4">
            <div>
              <h3
                id="model-review-heading"
                tabIndex={-1}
                className="text-lg font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {copy(`Review before ${committing}`, "Vérifier avant enregistrement")}
              </h3>
              <p className="text-sm">
                {reviewSentence(
                  {
                    name: draft.name.trim() ? cardTitle : draft.id,
                    providers: [...new Set(validAccesses.map(access => displayProvider(access.provider)))],
                    creating,
                    changed: !nothingToSave,
                  },
                  copy,
                )}
              </p>
            </div>
            <div className="rounded-sm border bg-card p-4">
              {creating && (
                <p>
                  <strong>{draft.name.trim() ? cardTitle : copy("Name missing", "Nom manquant")}</strong>
                </p>
              )}
              <p className="mt-1 text-sm">
                {copy("Creator", "Créateur")}
                {colon} {creatorName(draft.creator)}
                {expert && (
                  <>
                    {" "}
                    · {copy("Family", "Famille")}
                    {colon} {display(draft.family)}
                  </>
                )}
              </p>
            </div>
            {original && (
              <div className="rounded-sm border p-3">
                <h4 className="text-sm font-semibold">{copy("Proposed changes", "Changements proposés")}</h4>
                {reviewChanges.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {reviewChanges.map((change, index) => (
                      <li key={index}>{change}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {copy("No changes to the Registry model card.", "Aucun changement dans la fiche Registry.")}
                  </p>
                )}
              </div>
            )}
            {stagedOverrides.length > 0 && (
              <div className="rounded-sm border p-3">
                <h4 className="text-sm font-semibold">
                  {copy(
                    "Catalog corrections saved with this model",
                    "Corrections du catalogue à enregistrer avec le modèle",
                  )}
                </h4>
                <ul className="mt-2 space-y-1 text-sm">
                  {stagedOverrides.map(item => (
                    <li key={`${item.target}/${item.id}/${item.field}`}>
                      {fieldLabel(item.field, copy)} ·{" "}
                      {item.target === "reference"
                        ? copy("Model card", "fiche documentaire")
                        : `${copy("provider access", "accès fournisseur")} ${displayProvider(catalog?.accesses.find(row => row.id === item.id)?.provider ?? "")}`}
                      {expert && (
                        <>
                          {" "}
                          <code>{item.id}</code>
                        </>
                      )}
                      {colon} {display(originalPropertyValue(item))} → {display(item.value)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <details open={expert} className="rounded-sm border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {copy("Technical details", "Détails techniques")}
              </summary>
              <div className="mt-3 space-y-3">
                <p className="text-sm text-muted-foreground">
                  {copy(
                    "Selected operations define Registry request types; they do not prove model support. An access is not enabled for a key and does not choose its provider.",
                    "Les opérations choisies déterminent les types de requêtes exposés par Registry ; elles ne prouvent pas que le modèle les prend en charge. La présence d’un accès ne l’active pas pour une clé et ne choisit pas le fournisseur.",
                  )}
                </p>
                {technicalChanges.length > 0 && (
                  <div className="space-y-1 text-xs">
                    <strong>{copy("Technical changes", "Changements techniques")}</strong>
                    {technicalChanges.map((change, index) => (
                      <p key={index}>{change}</p>
                    ))}
                  </div>
                )}
                <div className="space-y-1 text-xs">
                  <strong>{copy("Common model ID and accesses", "Identifiant commun et accès")}</strong>
                  <p>
                    {copy("Common model ID", "Identifiant commun")}
                    {colon} <code>{draft.id || copy("ID missing", "ID manquant")}</code>
                  </p>
                  {draft.accesses.map(access => (
                    <p key={`${access.provider}/${access.nativeModel}`}>
                      {copy("Registry ID", "ID Registry")}
                      {colon} <code>{access.id}</code> → {access.provider} / <code>{access.nativeModel}</code>
                      {draft.id !== access.nativeModel && (
                        <span className="block text-muted-foreground">
                          {snapshotMode
                            ? copy("Simulated alias in this copy", "Alias simulé dans la copie")
                            : copy(
                                "Bifrost alias planned for affected keys",
                                "Alias Bifrost prévu pour les clés concernées",
                              )}
                          {colon} <code>{draft.id}</code> → <code>{access.nativeModel}</code>
                        </span>
                      )}
                    </p>
                  ))}
                </div>
                <div className="space-y-2">
                  {draft.accesses.map((access, index) => {
                    const found = catalogAccess(access);
                    const reference = selectedReference(access.referenceId ?? found?.referenceId);
                    return (
                      <div key={index} className="rounded-sm border p-3 text-sm">
                        <strong>
                          {displayProvider(access.provider) || copy("Provider missing", "Fournisseur manquant")}
                        </strong>{" "}
                        ·{" "}
                        <code className="break-all">
                          {access.nativeModel || copy("Native ID missing", "ID natif manquant")}
                        </code>
                        <p className="text-xs text-muted-foreground">
                          {copy("Registry exposed ID", "ID exposé Registry")}
                          {colon} {access.id || copy("Unknown", "Inconnu")}
                        </p>
                        <p className="text-xs">
                          {copy("Registry endpoints", "Endpoints Registry")}
                          {colon} {(access.endpoints || []).join(", ") || copy("Unknown", "Inconnu")}
                        </p>
                        <p className="mt-2">
                          {copy("Documentary record", "Fiche documentaire")}
                          {colon}{" "}
                          {reference
                            ? display(reference.fields.name?.value)
                            : copy("No record linked", "aucune fiche liée")}
                        </p>
                        {reference && (
                          <p className="text-xs text-muted-foreground">
                            {copy("Sources", "Sources")}
                            {colon} {referenceSources(reference, copy)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">{associationStatus(access, found, true, copy)}</p>
                        {reference && (
                          <p className="text-xs text-muted-foreground">
                            {copy("Document ID", "Identifiant documentaire")}
                            {colon} <code className="break-all">{reference.id}</code>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
            {invalidReference && (
              <p role="alert" className="text-sm text-destructive">
                {copy(
                  "An access points to a reference missing from the catalog.",
                  "Une correspondance pointe vers une fiche documentaire absente du catalogue.",
                )}
              </p>
            )}
            {!canSave && (
              <p role="alert" className="text-sm text-destructive">
                {copy(
                  `Complete the name, choose endpoints for every access, and complete each provider access before ${committing}.`,
                  "Complétez le nom et chaque accès, puis choisissez ses endpoints avant l’enregistrement.",
                )}
              </p>
            )}
          </section>
        )}
      </EditorJourney>

      <Dialog
        open={editing !== null}
        onOpenChange={open => {
          if (!open) closeEdit();
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto"
          onCloseAutoFocus={event => {
            event.preventDefault();
            editOpener.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {editing === "identity"
                ? copy("Edit identity", "Modifier l’identité")
                : editing === "details"
                  ? expert
                    ? copy("Edit Registry details", "Modifier les détails Registry")
                    : copy("Edit details", "Modifier les détails")
                  : editing === "capabilities"
                    ? copy("Edit tasks and capabilities", "Modifier usages et capacités")
                    : copy("Edit provider access", "Modifier un accès")}
            </DialogTitle>
            <DialogDescription>
              {copy(
                `Changes are added to the draft after confirmation, then reviewed before ${committing}.`,
                "Les modifications seront ajoutées au brouillon après confirmation, puis relues avant l’enregistrement.",
              )}
            </DialogDescription>
          </DialogHeader>
          {editing === "identity" && (
            <div className="space-y-3">
              <label className="block text-sm">
                {copy("Display name *", "Nom affiché *")}
                <Input
                  className="mt-1"
                  autoFocus={!form.name.trim()}
                  aria-required="true"
                  aria-invalid={!form.name.trim()}
                  value={form.name}
                  onChange={event => updateEdit({ name: event.target.value })}
                />
                {!form.name.trim() && (
                  <span className="mt-1 block text-xs text-destructive">
                    {copy("Enter a name for this model.", "Saisissez le nom de ce modèle.")}
                  </span>
                )}
              </label>
              {form.accesses.map((access, index) => (
                <EndpointChoices
                  key={access.id}
                  access={access}
                  technical={expert}
                  invalid={!access.endpoints?.length}
                  onChange={endpoints =>
                    updateEdit({
                      accesses: form.accesses.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, endpoints } : row,
                      ),
                    })
                  }
                />
              ))}
              <p className="text-xs text-muted-foreground">
                {copy(
                  "Endpoint choices do not prove model support. Common ID:",
                  "Les choix d’endpoints ne prouvent pas la prise en charge du modèle. Identifiant commun :",
                )}{" "}
                {form.id}.
              </p>
            </div>
          )}
          {editing === "details" && (
            <div className="space-y-3">
              <SearchableSelect
                label={copy("Creator", "Créateur")}
                value={creatorKey(form.creator) === "Unknown" ? "" : form.creator}
                placeholder={creatorName()}
                options={options.creators}
                onChange={creator =>
                  updateEdit({ creator: creator.trim() ? creator : "Unknown", creatorSource: "manual" })
                }
              />
              {expert && (
                <SearchableSelect
                  label={copy("Family", "Famille")}
                  value={form.family}
                  options={options.families}
                  onChange={family => updateEdit({ family })}
                />
              )}
              <label className="block text-sm">
                {copy("Description", "Description")}
                <Textarea
                  className="mt-1"
                  value={form.summary}
                  onChange={event => updateEdit({ summary: event.target.value })}
                />
              </label>
              <ToggleChoices
                label={copy("Input modalities", "Modalités d’entrée")}
                choices={modalities.filter(value => value !== "Vector")}
                selected={form.inputModalities}
                onChange={inputModalities => updateEdit({ inputModalities })}
              />
              <ToggleChoices
                label={copy("Output modalities", "Modalités de sortie")}
                choices={modalities}
                selected={form.outputModalities}
                onChange={outputModalities => updateEdit({ outputModalities })}
              />
            </div>
          )}
          {/* Basic edits tasks and capabilities in the same dialog as the rest of the details. */}
          {(editing === "capabilities" || (editing === "details" && !expert)) && (
            <div className="space-y-3">
              <ToggleChoices
                label={copy("Tasks", "Usages")}
                choices={tasks}
                selected={form.tasks}
                onChange={tasks => updateEdit({ tasks })}
              />
              {capabilityRows.map(name => (
                <div key={name} className="flex items-center justify-between gap-2 text-sm">
                  <span>{term(name)}</span>
                  <Select
                    value={canonicalCapabilities(form.capabilities)[name] || "Unknown"}
                    onValueChange={value =>
                      updateEdit({
                        capabilities: { ...canonicalCapabilities(form.capabilities), [name]: value as Capability },
                      })
                    }
                  >
                    <SelectTrigger aria-label={`${term(name)} ${copy("evidence", "état")}`} className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(canonicalCapabilities(form.capabilities)[name] === "Observed in simulated campaign"
                        ? ["Observed in simulated campaign", "Declared", "Unknown"]
                        : ["Declared", "Unknown"]
                      ).map(value => (
                        <SelectItem key={value} value={value}>
                          {evidence(value as Capability)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {copy(
                  "Unknown differs from no. A simulated campaign does not verify real provider support.",
                  "Inconnu reste distinct de « non ». Une campagne simulée ne vérifie pas une capacité fournisseur réelle.",
                )}
              </p>
            </div>
          )}
          {editing === "details" && !expert && displayedReference && (
            <section className="space-y-3 border-t pt-3">
              <h4 className="text-sm font-semibold">{copy("Values", "Valeurs")}</h4>
              <p className="text-xs text-muted-foreground">
                {copy(
                  "Values come from Models.dev unless you corrected them.",
                  "Les valeurs viennent de Models.dev, sauf si vous les avez corrigées.",
                )}
              </p>
              {valueFields("reference", displayedReference.id, commonFact)}
              <p className="text-xs text-muted-foreground">
                {copy(
                  "Price corrections are saved with the model and applied as native Bifrost pricing overrides.",
                  "Les corrections de prix sont enregistrées avec le modèle et appliquées comme overrides de tarification natifs Bifrost.",
                )}
              </p>
            </section>
          )}
          {editing === "access" && form.accesses[editingAccess] && (
            <div className="space-y-3">
              <SearchableSelect
                label={copy("Provider in Bifrost *", "Fournisseur dans Bifrost *")}
                value={form.accesses[editingAccess].provider}
                options={options.providers}
                onChange={provider => changeEditAccess(editingAccess, { provider })}
              />
              {/* Basic types a manual access's native ID; a discovered access's IDs and route are read-only facts, so Expert's. */}
              {(expert || !catalogAccess(form.accesses[editingAccess])) && (
                <>
                  <label className="block text-sm">
                    {copy("Model at this provider *", "Modèle chez ce fournisseur *")}
                    <Input
                      className="mt-1 font-mono"
                      value={form.accesses[editingAccess].nativeModel || ""}
                      readOnly={!!catalogAccess(form.accesses[editingAccess])}
                      onChange={event => changeEditAccess(editingAccess, { nativeModel: event.target.value })}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {catalogAccess(form.accesses[editingAccess])
                      ? copy(
                          "Discovered in Bifrost · read only.",
                          "Identifiant découvert dans Bifrost · lecture seule.",
                        )
                      : copy(
                          "Manual access: enter the exact ID configured in Bifrost.",
                          "Accès manuel : reprendre l’identifiant exact configuré dans Bifrost.",
                        )}
                  </p>
                </>
              )}
              <SearchableSelect
                label={copy("Reference for this access", "Fiche documentaire pour cet accès")}
                value={form.accesses[editingAccess].referenceId || ""}
                options={referenceOptions}
                onChange={id => chooseEditReference(editingAccess, id)}
                placeholder={copy("Search references", "Chercher une fiche documentaire")}
              />
              {form.accesses[editingAccess].referenceId && (
                <Button variant="ghost" size="sm" onClick={() => changeEditAccess(editingAccess, { referenceId: "" })}>
                  {copy("Unlink", "Dissocier")}
                </Button>
              )}
              {expert && form.accesses[editingAccess].referenceId && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">{copy("Document ID", "Identifiant documentaire")}</summary>
                  <code className="block break-all">{form.accesses[editingAccess].referenceId}</code>
                </details>
              )}
              {(expert || !catalogAccess(form.accesses[editingAccess])) && (
                <label className="block text-sm">
                  {copy("Registry exposed ID", "ID exposé Registry")}
                  <Input className="mt-1 font-mono" value={form.accesses[editingAccess].id} readOnly />
                </label>
              )}
              <EndpointChoices
                access={form.accesses[editingAccess]}
                technical={expert}
                invalid={!form.accesses[editingAccess].endpoints?.length}
                onChange={endpoints => changeEditAccess(editingAccess, { endpoints })}
              />
              <div className="flex items-center gap-2 text-sm">
                <span>{copy("Status", "Statut")}</span>
                <Select
                  value={form.accesses[editingAccess].status}
                  onValueChange={status => changeEditAccess(editingAccess, { status: status as Access["status"] })}
                >
                  <SelectTrigger aria-label={copy("Access status", "Statut de l’accès")} className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Configured">{copy("Configured", "Configuré")}</SelectItem>
                    <SelectItem value="Unknown">{copy("Unknown", "Inconnu")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(expert || !catalogAccess(form.accesses[editingAccess])) && (
                <p className="text-xs text-muted-foreground">
                  {copy("Route", "Route")}
                  {colon} {form.accesses[editingAccess].route}.{" "}
                  {copy("Native routing is configured separately.", "Le routage natif se règle séparément.")}
                </p>
              )}
              {!expert && catalogAccess(form.accesses[editingAccess]) && (
                <section className="space-y-3 border-t pt-3">
                  <h4 className="text-sm font-semibold">{copy("Values for this access", "Valeurs de cet accès")}</h4>
                  {valueFields("access", catalogAccess(form.accesses[editingAccess])!.id, key =>
                    accessFact(form.accesses[editingAccess], key),
                  )}
                </section>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={form.accesses.length === 1}
                onClick={() => updateEdit({ accesses: form.accesses.filter((_, index) => index !== editingAccess) })}
              >
                <X className="size-4" />
                {copy("Remove access", "Retirer cet accès")}
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>
              {copy("Cancel", "Annuler")}
            </Button>
            <Button
              disabled={
                valueIssues ||
                (editing === "identity"
                  ? !form.name.trim()
                  : editing === "access"
                    ? !form.accesses[editingAccess]?.endpoints?.length ||
                      form.accesses.some(
                        access =>
                          !access.provider ||
                          !access.nativeModel ||
                          access.id !== `${access.provider}/${form.id}` ||
                          (!!access.referenceId &&
                            !catalog?.references.some(reference => reference.id === access.referenceId)),
                      )
                    : false)
              }
              onClick={() => {
                keepValueEdits();
                if (editDraft) onChange(editDraft);
                closeEdit();
                setRegistrationIssue(undefined);
              }}
            >
              {copy("Keep changes", "Garder les modifications")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!property}
        onOpenChange={open => {
          if (!open) setProperty(null);
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto"
          onCloseAutoFocus={event => {
            event.preventDefault();
            propertyOpener.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {copy("Edit", "Modifier")} {property ? fieldLabel(property.key, copy) : ""}
            </DialogTitle>
            <DialogDescription>
              {property?.target === "reference"
                ? copy("Model card", "Fiche documentaire commune")
                : copy("Provider access", "Accès fournisseur")}{" "}
              ·{" "}
              {copy(
                `The correction is added to the draft. Review all linked accesses before ${committing} the model.`,
                "Correction ajoutée au brouillon. Vérifiez tous les accès liés avant l’enregistrement du modèle.",
              )}
            </DialogDescription>
          </DialogHeader>
          {property && (
            <div className="space-y-4">
              <p className="text-sm">
                {copy("Current", "Actuel")}
                {colon}{" "}
                <strong>{display(propertyCurrent?.value, facts.find(([key]) => key === property.key)?.[1])}</strong>{" "}
                <span className="text-xs text-muted-foreground">
                  ·{" "}
                  {propertyCurrent
                    ? sourceLabel(propertyCurrent.source, copy)
                    : copy("Source unknown", "Source inconnue")}
                </span>
              </p>
              {property.key === "tool_call" || property.key === "structured_output" ? (
                <label className="block text-sm">
                  {fieldLabel(property.key, copy)} {copy("proposed", "proposé")}
                  <select
                    className="mt-1 h-9 w-full rounded-sm border bg-background px-3"
                    value={property.value}
                    onChange={event => setProperty({ ...property, value: event.target.value })}
                  >
                    <option value="">{copy("Choose yes or no", "Choisir Oui ou Non")}</option>
                    <option value="true">{copy("Yes", "Oui")}</option>
                    <option value="false">{copy("No", "Non")}</option>
                  </select>
                </label>
              ) : (
                <label className="block text-sm">
                  {fieldLabel(property.key, copy)}{" "}
                  {property.key === "input_cost_usd_per_million" || property.key === "output_cost_usd_per_million"
                    ? copy("proposed, $ / million tokens", "proposé, $ / million de tokens")
                    : copy("proposed, in tokens", "proposé, en tokens")}
                  <Input
                    className="mt-1"
                    type="number"
                    min="0"
                    step={
                      property.key === "input_cost_usd_per_million" || property.key === "output_cost_usd_per_million"
                        ? "0.0001"
                        : "1"
                    }
                    inputMode={
                      property.key === "input_cost_usd_per_million" || property.key === "output_cost_usd_per_million"
                        ? "decimal"
                        : "numeric"
                    }
                    value={property.value}
                    onChange={event => setProperty({ ...property, value: event.target.value })}
                  />
                </label>
              )}
              {property?.target === "access" && propertyInherited !== undefined && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1 text-xs"
                  onClick={() => setProperty({ ...property, value: String(propertyInherited) })}
                >
                  {copy("Revert to inherited", "Revenir à la valeur héritée")}
                </Button>
              )}
              {propertyValidation && (
                <p role="alert" className="text-xs text-destructive">
                  {propertyValidation}
                </p>
              )}
              <div className="rounded-sm border bg-muted/30 p-3">
                <h4 className="text-sm font-semibold">{copy("Correction preview", "Aperçu de la correction")}</h4>
                {property.target === "reference" && (
                  <p className="mt-2 text-sm">
                    {copy("Model card", "Fiche documentaire")} · {display(propertyRecord?.fields[property.key]?.value)}{" "}
                    → {display(proposed)}
                  </p>
                )}
                {(property.key === "input_cost_usd_per_million" || property.key === "output_cost_usd_per_million") &&
                  property.target === "reference" &&
                  (() => {
                    const affected = propertyPreview.filter(row => !Object.is(row.before, row.after));
                    return affected.length > 0 ? (
                      <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                        {copy(
                          `Applies to ${affected.length} access${affected.length > 1 ? "es" : ""}`,
                          `S'applique à ${affected.length} accès`,
                        )}
                        {colon} {affected.map(row => `${row.access.provider}/${row.access.model}`).join(", ")}
                      </p>
                    ) : null;
                  })()}
                <div className="mt-2 space-y-2">
                  {propertyPreview.map(row => (
                    <p key={row.access.id} className="text-sm">
                      <strong>{displayProvider(row.access.provider)}</strong> · <code>{row.access.model}</code> ·{" "}
                      {display(row.before)} → {display(row.after)}{" "}
                      <span className="text-xs text-muted-foreground">
                        {Object.is(row.before, row.after)
                          ? copy("unchanged", "inchangé")
                          : copy("proposed in Registry", "proposé dans Registry")}
                      </span>
                    </p>
                  ))}
                </div>
                {propertyPreview.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {copy(
                      "No catalog access is linked to this record.",
                      "Aucun accès du catalogue n’est lié à cette fiche.",
                    )}
                  </p>
                )}
                {propertyPreview.length > 0 && propertyPreview.every(row => Object.is(row.before, row.after)) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {copy("No linked access changes value.", "Aucun accès lié ne change de valeur.")}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {property &&
                (property.key === "input_cost_usd_per_million" || property.key === "output_cost_usd_per_million")
                  ? copy(
                      "Price corrections are saved with the model and applied as native Bifrost pricing overrides.",
                      "Les corrections de prix sont enregistrées avec le modèle et appliquées comme overrides de tarification natifs Bifrost.",
                    )
                  : copy(
                      "This correction documents Registry catalog data. It does not activate a capability, route, or native Bifrost limit.",
                      "Cette correction documente le catalogue Registry. Elle n’active ni capacité, ni routage, ni limite native Bifrost.",
                    )}
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setProperty(null)}>
                  {copy("Cancel", "Annuler")}
                </Button>
                <Button
                  disabled={proposed === undefined || Object.is(proposed, propertyCurrent?.value)}
                  onClick={saveProperty}
                >
                  {copy("Keep correction in draft", "Garder cette correction dans le brouillon")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SheetContent>
  );
}
