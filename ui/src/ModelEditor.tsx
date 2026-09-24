import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "./api";
import { displayProvider } from "./BrandIcon";
import { getCatalog, type Catalog } from "./catalog-api";
import { type Access, type Capability, type Model } from "./demo";
import { applyModelId, modelEditorOptions, prefillFromReference, type AccessCandidate } from "./model-editor-data";
import { SearchableSelect, type SearchOption } from "./SearchableSelect";

const tasks = ["Chat", "Code", "Reasoning", "Vision", "Image generation", "Embeddings", "Audio transcription", "Audio generation", "Video generation"];
const modalities = ["Text", "Image", "Audio", "Video", "Vector"];
const capabilityNames = ["Chat", "Streaming", "Tools", "Vision", "Reasoning", "Structured output"];
const providers = ["openai", "azure", "anthropic", "bedrock", "google", "moonshot", "openrouter"];

function UiSelect({ label, value, options, onChange, className = "" }: { label: string; value: string; options: string[]; onChange: (value: string) => void; className?: string }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className={className}><SelectValue /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>;
}

function TaxonomyChoices({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (next: string[]) => void }) {
  return <fieldset><legend className="mb-2 text-sm font-medium">{label}</legend><div className="flex flex-wrap gap-2">{options.map(option => <label key={option} className="flex cursor-pointer items-center gap-2 rounded-sm border px-2 py-1.5 text-xs hover:bg-muted/40"><Checkbox checked={selected.includes(option)} onCheckedChange={checked => onChange(checked ? [...selected, option] : selected.filter(value => value !== option))} />{option}</label>)}</div></fieldset>;
}

function ProviderPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = providers.filter(id => `${id} ${displayProvider(id)}`.toLowerCase().includes(query.toLowerCase()));
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" className="w-full justify-between" aria-label="Serving provider">{providers.includes(value) ? displayProvider(value) : value || "Choose provider"}<ChevronDown className="size-4" /></Button></PopoverTrigger><PopoverContent align="start" className="w-64"><Input autoFocus aria-label="Search serving providers" placeholder="Search providers…" value={query} onChange={e => setQuery(e.target.value)} /><div className="mt-2 max-h-48 overflow-auto">{matches.map(id => <Button key={id} variant="ghost" className="w-full justify-start" onClick={() => { onChange(id); setOpen(false); setQuery(""); }}>{displayProvider(id)}</Button>)}{!matches.length && <p className="p-2 text-xs text-muted-foreground">No providers found.</p>}</div><Button variant="ghost" className="mt-2 w-full justify-start" onClick={() => { onChange(""); setOpen(false); setQuery(""); }}>Advanced: custom provider</Button></PopoverContent></Popover>;
}

export default function ModelEditor({ draft, onChange, creating, workspace, error, busy, onSave, onCancel, onDelete, onUnauthorized, actionSlot }: {
  draft: Model;
  onChange: (draft: Model) => void;
  creating: boolean;
  workspace: Model[];
  error: string;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete: (model: Model) => void;
  onUnauthorized: () => void;
  actionSlot?: ReactNode;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [accessChoices, setAccessChoices] = useState<AccessCandidate[]>([]);
  useEffect(() => {
    let active = true;
    getCatalog().then(result => { if (active) { setCatalog(result); setCatalogError(""); } }).catch(cause => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized();
      else setCatalogError(cause instanceof Error ? cause.message : "Reference catalogue unavailable.");
    });
    return () => { active = false; };
  }, []);
  const options = useMemo(() => modelEditorOptions(catalog, workspace), [catalog, workspace]);
  const update = (patch: Partial<Model>) => onChange({ ...draft, ...patch });
  const changeAccess = (index: number, patch: Partial<Access>) => update({ accesses: draft.accesses.map((access, at) => at === index ? { ...access, ...patch } : access) });
  const chooseModelId = (value: string, option?: SearchOption) => {
    const reference = option?.referenceId ? catalog?.references.find(item => item.id === option.referenceId) : undefined;
    setCandidateId(reference?.id || "");
    const candidates: AccessCandidate[] = reference ? (catalog?.accesses.filter(access => access.referenceId === reference.id) || []).map(access => ({ provider: access.provider, nativeModel: access.model, status: access.configured ? "Configured" : "Unknown", source: access.id }))
      : option?.accessId ? (catalog?.accesses.filter(access => access.id === option.accessId) || []).map(access => ({ provider: access.provider, nativeModel: access.model, status: access.configured ? "Configured" : "Unknown", source: access.id }))
      : option ? (workspace.find(model => model.id === value)?.accesses || []).filter(access => !!access.nativeModel).map(access => ({ provider: access.provider, nativeModel: access.nativeModel, status: access.status, source: access.id })) : [];
    setAccessChoices(candidates.length > 1 ? candidates : []);
    const fromWorkspace = workspace.find(model => model.id === value);
    const next = reference ? prefillFromReference(draft, reference) : fromWorkspace ? {
      ...draft,
      name: draft.name || fromWorkspace.name,
      creator: !draft.creator || draft.creator === "Unknown" ? fromWorkspace.creator : draft.creator,
      family: !draft.family || draft.family === "Unknown" ? fromWorkspace.family : draft.family,
    } : draft;
    const oldReference = candidateId && !reference ? next.accesses.map(access => access.referenceId === candidateId ? { ...access, referenceId: "" } : access) : next.accesses;
    const withId = applyModelId({ ...next, accesses: oldReference }, value, candidates.length === 1 ? candidates[0] : undefined);
    onChange({ ...withId, accesses: reference ? withId.accesses.map(access => ({ ...access, referenceId: reference.id })) : withId.accesses });
  };
  const matchedAccesses = catalog?.accesses.filter(access => draft.accesses.some(row => row.provider === access.provider && row.nativeModel === access.model)) || [];
  const candidate = candidateId ? catalog?.references.find(reference => reference.id === candidateId) : undefined;
  const referenceOptions = (catalog?.references || []).map(reference => ({ value: reference.id, label: typeof reference.fields.name?.value === "string" ? reference.fields.name.value : reference.id, detail: "Reference ID" }));
  const original = workspace.find(model => model.id === draft.id);
  const invalidReference = draft.accesses.some(access => !!access.referenceId && (catalog ? !catalog.references.some(reference => reference.id === access.referenceId) : !original?.accesses.some(row => row.provider === access.provider && row.nativeModel === access.nativeModel && row.referenceId === access.referenceId)));
  const capabilityRows = [...new Set([...capabilityNames, ...Object.keys(draft.capabilities)])];

  return <SheetContent inert={busy} className="min-h-0 max-w-[calc(100vw-1rem)] p-4 sm:p-6">
    <SheetHeader className="shrink-0 border-b bg-muted/40 pb-4"><SheetTitle className="text-xl">{creating ? "Add model" : draft.name}</SheetTitle><SheetDescription className="sr-only">Edit the model details, provider accesses, and capabilities.</SheetDescription></SheetHeader>
    <div className="custom-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pr-2 pb-4">
      {actionSlot}
      {creating && <SearchableSelect label="Model ID *" value={draft.id} options={options.modelIds} onChange={chooseModelId} placeholder="Search known models or enter a custom ID" />}
      {catalogError && <p role="status" className="text-xs text-muted-foreground">Reference suggestions unavailable: {catalogError}</p>}
      {candidate && <div className="rounded-sm border border-primary/30 bg-primary/5 p-3 text-xs"><p className="font-medium">Selected reference: {candidate.id}</p><p className="mt-1 text-muted-foreground">Known metadata fills empty fields only. Saving will link this reference to the accesses below. Review each link and its source facts. Existing native upstream IDs and routing remain unchanged.</p><div className="mt-2 space-y-1">{Object.entries(candidate.fields).filter(([name]) => ["name", "creator", "family", "context_length", "input_modalities", "output_modalities", "reasoning", "tool_call", "structured_output"].includes(name)).map(([name, fact]) => <p key={name} className="break-words">{name.replaceAll("_", " ")}: {JSON.stringify(fact.value)} <span className="text-muted-foreground">· {fact.source} · {fact.kind} · {fact.updatedAt || "date unknown"}</span></p>)}</div></div>}
      {accessChoices.length > 1 && <div className="rounded-sm border p-3 text-xs"><p className="font-medium">Choose an access to prefill</p><p className="mt-1 text-muted-foreground">Several native accesses match this model. Choose the exact provider and upstream ID; already entered access fields stay unchanged.</p><div className="mt-2 max-h-40 space-y-1 overflow-auto">{accessChoices.map(access => <Button key={access.source} variant="outline" size="sm" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => { onChange(applyModelId(draft, draft.id, access)); setAccessChoices([]); }}>{access.provider} · {access.nativeModel} · {access.status}</Button>)}</div></div>}
      <div><label className="mb-2 block text-sm font-medium">Display name *</label><Input aria-label="Display name" value={draft.name} onChange={e => update({ name: e.target.value })} /></div>
      <SearchableSelect label="Creator" value={draft.creator} options={options.creators} onChange={creator => update({ creator })} placeholder="Search or enter a creator" />
      <SearchableSelect label="Model series" value={draft.family} options={options.families} onChange={family => update({ family })} placeholder="Search or enter a series" />
      <div><label className="mb-2 block text-sm font-medium">Description</label><Textarea aria-label="Description" value={draft.summary} onChange={e => update({ summary: e.target.value })} /></div>
      <div><label className="mb-2 block text-sm font-medium">Context window</label><Input aria-label="Context window" value={draft.context} onChange={e => update({ context: e.target.value })} /></div>
      <div><label className="mb-2 block text-sm font-medium">Endpoint type *</label><UiSelect label="Endpoint type" value={draft.kind || "Unknown"} options={["Unknown", "Chat", "Vision", "Image", "Embedding"]} onChange={value => update({ kind: value as Model["kind"] })} className="w-full" /><p className="mt-1 text-xs text-muted-foreground">Choose from the native endpoint actually supported by this access.</p></div>
      <TaxonomyChoices label="Usage / tasks" options={tasks} selected={draft.tasks} onChange={tasks => update({ tasks })} />
      <TaxonomyChoices label="Input modalities" options={modalities.filter(m => m !== "Vector")} selected={draft.inputModalities} onChange={inputModalities => update({ inputModalities })} />
      <TaxonomyChoices label="Output modalities" options={modalities} selected={draft.outputModalities} onChange={outputModalities => update({ outputModalities })} />
      <section><h3 className="mb-2 text-sm font-semibold">Provider accesses *</h3><div className="space-y-2">{draft.accesses.map((access, index) => <div key={index} className="rounded-sm border bg-card p-4 shadow-sm"><div className="mb-3 flex items-center justify-between border-b pb-2"><span className="text-xs text-muted-foreground">Access {index + 1}</span><Button variant="ghost" size="icon" aria-label={`Remove access ${index + 1}`} disabled={draft.accesses.length === 1} onClick={() => update({ accesses: draft.accesses.filter((_, at) => index !== at) })}><X className="size-4" /></Button></div><div className="grid gap-2 sm:grid-cols-2"><div><ProviderPicker value={access.provider} onChange={provider => changeAccess(index, { provider })} />{!providers.includes(access.provider) && <details className="mt-1" open><summary className="text-xs text-muted-foreground">Advanced custom provider</summary><Input aria-label="Custom provider" placeholder="Provider ID" value={access.provider} onChange={e => changeAccess(index, { provider: e.target.value })} /></details>}</div><Input aria-label="Exposed provider ID" placeholder="provider/model" value={access.id} onChange={e => changeAccess(index, { id: e.target.value })} /></div><div className="mt-2"><label className="mb-1 block text-xs text-muted-foreground">Native upstream model</label><Input aria-label="Native upstream model" value={access.nativeModel || ""} onChange={e => changeAccess(index, { nativeModel: e.target.value })} /></div><div className="mt-2 flex items-center justify-between"><span className="text-xs text-muted-foreground">Route: {access.route}</span><UiSelect label="Access status" value={access.status} onChange={status => changeAccess(index, { status: status as Access["status"] })} options={["Configured", "Unknown"]} /></div><div className="mt-3 rounded-sm border-t pt-3"><SearchableSelect label={`Access ${index + 1} reference ID`} value={access.referenceId || ""} options={referenceOptions} onChange={referenceId => changeAccess(index, { referenceId })} placeholder="Search an exact reference ID" /><div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="break-all text-muted-foreground">{access.referenceId === "" ? "Will unlink on save" : access.referenceId ? `Will link ${access.referenceId} on save` : "Existing mapping remains unchanged"}</span>{access.referenceId && <Button variant="ghost" size="sm" onClick={() => changeAccess(index, { referenceId: "" })}>Unlink</Button>}</div>{access.referenceId && catalog && !catalog.references.some(reference => reference.id === access.referenceId) && <p role="alert" className="mt-1 text-xs text-destructive">Choose an existing exact reference ID.</p>}</div></div>)}</div><Button variant="outline" size="sm" className="mt-2" onClick={() => update({ accesses: [...draft.accesses, { provider: "", id: "", route: "Direct provider", status: "Unknown", nativeModel: "", ...(candidateId ? { referenceId: candidateId } : {}) }] })}><Plus className="size-3.5" />Add access</Button><p className="mt-2 text-xs text-muted-foreground">Short-name routing is configured separately. These rows do not define a load balancer. Reference mapping changes only when you save.</p>{matchedAccesses.length > 0 && <div className="mt-3 rounded-sm border p-3 text-xs"><p className="font-medium">Current catalogue matches for native accesses</p>{matchedAccesses.map(access => <p key={access.id} className="mt-1 break-all">{access.id} → {access.referenceId || "Unlinked"} {access.mappingManual && <Badge variant="secondary">Manual</Badge>}</p>)}</div>}</section>
      <section><h3 className="mb-2 text-sm font-semibold">Capabilities and evidence</h3><div className="space-y-2">{capabilityRows.map(name => <div key={name} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border bg-card px-4 py-3"><span className="text-sm">{name}</span><UiSelect label={`${name} evidence`} className="max-w-[230px]" value={draft.capabilities[name] || "Unknown"} onChange={value => update({ capabilities: { ...draft.capabilities, [name]: value as Capability } })} options={draft.capabilities[name] === "Observed in simulated campaign" ? ["Observed in simulated campaign", "Declared", "Unknown"] : ["Declared", "Unknown"]} /></div>)}</div><p className="mt-2 text-xs text-muted-foreground">Unknown means no capability evidence has been recorded. Only mark a capability observed with a real, dated test result.</p></section>
      {error && <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    </div>
    <SheetFooter className="shrink-0 flex-row flex-wrap justify-end border-t px-0 pb-0 pt-4">{!creating && <Button variant="ghost" className="mr-auto text-destructive" onClick={() => onDelete(draft)}>Delete</Button>}<Button variant="outline" onClick={onCancel}>Cancel</Button><Button disabled={busy || invalidReference} onClick={onSave}>Save model</Button></SheetFooter>
  </SheetContent>;
}
