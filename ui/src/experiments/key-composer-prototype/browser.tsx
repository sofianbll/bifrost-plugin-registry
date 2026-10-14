// Prototype-only catalog controls. Filtering affects visibility, never the key draft.
import { useId, useState } from "react";
import { AudioLines, BrainCircuit, ChevronDown, Code2, Eye, Image, Search, SlidersHorizontal, Sparkles, Wrench, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandIcon, displayProvider } from "../../components/registry/BrandIcon";
import { ModelCapabilityLegend } from "../../components/registry/model-capabilities";
import { emptyModelFilters, type ModelFilters } from "../../domain/registry";
import { selectionCounts, setVisibleSelection } from "../../features/catalog/selection";
import { defaultViewOptions, type ViewOptions } from "../../components/registry/ViewOptions";
import { ComposerModelResults, type CardCallbacks } from "./cards";
import { catalogResults, type Category } from "./catalog";
import { useCopy, useTerm } from "../../lib/locale";
import { ViewMenu, type DisplayFormat } from "./ViewMenu";
import type { KeyDraft, ModelResolution, ProtoGroup, ProtoModel } from "./state";

const categories: Category[] = ["All", "Text", "Image", "Video", "Audio", "Retrieval", "Evaluation", "Tools"];
const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const capabilityIcons: Record<string, typeof BrainCircuit> = { Reasoning: BrainCircuit, Vision: Eye, "Tool calling": Wrench, Tools: Wrench, "Image generation": Image, Embeddings: Sparkles, Streaming: AudioLines, "Structured output": Code2, Chat: Sparkles };

type BrowserProps = { models: ProtoModel[] } & (
  { mode: "catalog"; onOpenModel: (modelId: string) => void } |
  { mode?: "composer"; selectionScope?: "key" | "group"; selected: string[]; onSetSelected: (ids: string[]) => void; draft: KeyDraft; groups: ProtoGroup[]; resolved: Map<string, ModelResolution>; callbacks: CardCallbacks }
);

export function ComposerBrowser(props: BrowserProps) {
  const { models } = props;
  const catalog = props.mode === "catalog";
  const selected = catalog ? [] : props.selected;
  const copy = useCopy();
  const term = useTerm();
  const selectId = useId();
  const [category, setCategory] = useState<Category>("All");
  const [filters, setFilters] = useState<ModelFilters>(emptyModelFilters);
  const [providerSearch, setProviderSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [groupBy, setGroupBy] = useState("none");
  const [format, setFormat] = useState<DisplayFormat>("compact");
  const [display, setDisplay] = useState({ description: false, id: false, providers: true, capabilities: true, modalities: true });
  const view: ViewOptions = { ...defaultViewOptions, layout: format === "table" ? "table" : "grid", size: format === "square" ? "medium" : "small" };
  const toggleDisplay = (field: keyof typeof display) => setDisplay(previous => ({ ...previous, [field]: !previous[field] }));
  const setFilter = (field: keyof ModelFilters, value: string) => setFilters(previous => ({ ...previous, [field]: value }));
  const providers = unique(models.flatMap(model => model.accesses.map(access => access.provider)));
  const capabilities = unique(models.flatMap(model => Object.entries(model.capabilities).filter(([, value]) => value === "Declared").map(([name]) => name)));
  const filtered = catalogResults(models, filters, category, status, selected, sort);
  const visibleIds = filtered.map(model => model.id);
  const counts = selectionCounts(selected, visibleIds);
  const hiddenSelected = selected.filter(id => !visibleIds.includes(id));
  const active: { id: string; label: string; clear: () => void }[] = (["provider", "capability", "creator", "task", "input", "output"] as const)
    .filter(field => Boolean(filters[field]))
    .map(field => ({ id: field, label: field === "provider" ? displayProvider(filters[field]) : term(filters[field]), clear: () => setFilter(field, "") }));
  if (status !== "all") active.push({ id: "status", label: status === "configured" ? copy("Configured", "Configuré") : status === "unconfigured" ? copy("Unconfigured", "Non configuré") : copy("Selected", "Sélectionné"), clear: () => setStatus("all") });
  const selectFilter = (label: string, field: keyof ModelFilters, options: string[]) => <Select value={filters[field] || "all"} onValueChange={value => setFilter(field, value === "all" ? "" : value)}><SelectTrigger aria-label={label} className="w-full text-xs"><SelectValue placeholder={label} /></SelectTrigger><SelectContent><SelectItem value="all">{label}: {copy("All", "Tous")}</SelectItem>{options.map(option => <SelectItem key={option} value={option}>{term(option)}</SelectItem>)}</SelectContent></Select>;
  return <div className="min-w-0 space-y-4">
    <div className="space-y-1.5 rounded-sm border bg-card p-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1"><Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input aria-label={copy("Search models", "Rechercher des modèles")} placeholder={copy("Model, creator or access ID…", "Modèle, créateur ou identifiant d’accès…")} className="pl-9" value={filters.search} onChange={event => setFilter("search", event.target.value)} /></div>
        <ViewMenu format={format} onFormatChange={setFormat}>
          <div className="grid gap-2 border-b pb-3">
            <p className="text-xs font-medium text-muted-foreground">{copy("Sort and group", "Trier et regrouper")}</p>
            <Select value={sort} onValueChange={setSort}><SelectTrigger aria-label={copy("Sort models", "Trier les modèles")} className="w-full text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">{copy("Name", "Nom")}</SelectItem><SelectItem value="creator">{copy("Creator", "Créateur")}</SelectItem><SelectItem value="accesses">{copy("Access count", "Nombre d’accès")}</SelectItem></SelectContent></Select>
            <Select value={groupBy} onValueChange={setGroupBy}><SelectTrigger aria-label={copy("Group models by", "Regrouper les modèles par")} className="w-full text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{copy("No grouping", "Aucun regroupement")}</SelectItem><SelectItem value="creator">{copy("Creator", "Créateur")}</SelectItem><SelectItem value="provider">{copy("Access provider", "Fournisseur d’accès")}</SelectItem><SelectItem value="task">{copy("Usage", "Usage")}</SelectItem></SelectContent></Select>
          </div>
          <FieldSet className="gap-2"><FieldLegend variant="label" className="mb-1 text-muted-foreground">{copy("Visible details", "Informations visibles")}</FieldLegend><FieldGroup className="gap-2">{([ ["description", copy("Description", "Description")], ["id", copy("Model ID", "Identifiant du modèle")], ["providers", copy("Provider logos", "Logos fournisseurs")], ["capabilities", copy("Capability icons", "Icônes de capacités")], ["modalities", copy("Input/output modalities", "Modalités entrée/sortie")] ] as const).map(([field, label]) => <Field key={field} orientation="horizontal" className="gap-2"><Checkbox id={`view-${field}`} checked={display[field]} onCheckedChange={() => toggleDisplay(field)} /><FieldLabel htmlFor={`view-${field}`} className="cursor-pointer text-xs">{label}</FieldLabel></Field>)}</FieldGroup></FieldSet><Button type="button" size="sm" variant="ghost" className="mt-2 w-full text-xs" onClick={() => setDisplay({ description: false, id: false, providers: true, capabilities: true, modalities: true })}>{copy("Reset display", "Réinitialiser l’affichage")}</Button></ViewMenu>
      </div>
      <div role="group" aria-label={copy("Model categories", "Catégories de modèles")} className="flex gap-1 overflow-x-auto border-b pb-1">
        {categories.map(item => <Button key={item} aria-pressed={category === item} size="sm" variant={category === item ? "secondary" : "ghost"} className="h-7 shrink-0 px-2 text-xs" onClick={() => setCategory(item)}>{term(item) === item ? copy(item, ({ All: "Tous", Retrieval: "Recherche", Evaluation: "Évaluation" } as Partial<Record<Category, string>>)[item] || item) : term(item)}</Button>)}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Popover><PopoverTrigger asChild><Button variant="outline" size="sm">{filters.provider ? displayProvider(filters.provider) : copy("Access providers", "Fournisseurs d’accès")}<ChevronDown className="size-3.5" /></Button></PopoverTrigger><PopoverContent align="start" className="w-64 space-y-2 p-3"><Input aria-label={copy("Search access providers", "Rechercher des fournisseurs d’accès")} placeholder={copy("Search providers…", "Rechercher…")} value={providerSearch} onChange={event => setProviderSearch(event.target.value)} /><div className="max-h-60 space-y-1 overflow-y-auto"><Button size="sm" variant={!filters.provider ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => setFilter("provider", "")}>{copy("All access providers", "Tous les fournisseurs d’accès")}</Button>{providers.filter(id => displayProvider(id).toLowerCase().includes(providerSearch.toLowerCase())).map(id => { const model = models.find(m => m.accesses.some(a => a.provider === id)); return <Button key={id} size="sm" variant={filters.provider === id ? "secondary" : "ghost"} className="w-full justify-start gap-2" onClick={() => setFilter("provider", id)}>{model && <BrandIcon model={{ ...model, accesses: model.accesses.filter(a => a.provider === id) }} mode="provider" />}{displayProvider(id)}</Button>; })}</div>{!catalog && <p className="text-[11px] text-muted-foreground">{copy("Filters the display; selections keep their configured accesses.", "Filtre l’affichage ; les sélections conservent leurs accès configurés.")}</p>}</PopoverContent></Popover>
        <Popover><PopoverTrigger asChild><Button variant="outline" size="sm">{filters.capability ? term(filters.capability) : copy("Capabilities", "Capacités")}<ChevronDown className="size-3.5" /></Button></PopoverTrigger><PopoverContent align="start" className="w-60 space-y-1 p-3"><p className="px-2 text-xs text-muted-foreground">{copy("Reference model declarations", "Déclarations du modèle de référence")}</p><Button size="sm" variant={!filters.capability ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => setFilter("capability", "")}>{copy("All capabilities", "Toutes les capacités")}</Button>{capabilities.map(capability => { const Icon = capabilityIcons[capability] || Sparkles; return <Button key={capability} size="sm" variant={filters.capability === capability ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => setFilter("capability", capability)}><Icon className="size-3.5" />{term(capability)}</Button>; })}</PopoverContent></Popover>
        <Popover><PopoverTrigger asChild><Button variant="outline" size="sm"><SlidersHorizontal className="size-3.5" />{copy("More filters", "Plus de filtres")}{active.length ? ` (${active.length})` : ""}</Button></PopoverTrigger><PopoverContent align="start" className="w-72 max-h-[70dvh] space-y-3 overflow-y-auto p-3"><div><p className="mb-1 text-xs font-semibold">{copy("Identity and use", "Identité et usage")}</p><div className="space-y-2">{selectFilter(copy("Creator", "Créateur"), "creator", unique(models.map(m => m.creator)))}{selectFilter(copy("Usage / task", "Usage / tâche"), "task", unique(models.flatMap(m => m.tasks)))}</div></div><div className="border-t pt-2"><p className="mb-1 text-xs font-semibold">{copy("Directional modalities", "Modalités par direction")}</p><div className="space-y-2">{selectFilter(copy("Input", "Entrée"), "input", unique(models.flatMap(m => m.inputModalities)))}{selectFilter(copy("Output", "Sortie"), "output", unique(models.flatMap(m => m.outputModalities)))}</div></div><div className="border-t pt-2"><p className="mb-1 text-xs font-semibold">{copy("Availability", "Disponibilité")}</p><Select value={status} onValueChange={setStatus}><SelectTrigger aria-label={copy("Configuration status", "État de configuration")} className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{copy("All models", "Tous les modèles")}</SelectItem><SelectItem value="configured">{copy("At least one configured access", "Au moins un accès configuré")}</SelectItem><SelectItem value="unconfigured">{copy("No configured access", "Aucun accès configuré")}</SelectItem>{!catalog && <SelectItem value="selected">{props.selectionScope === "group" ? copy("Selected for this group", "Sélectionnés pour ce groupe") : copy("Selected for this key", "Sélectionnés pour cette clé")}</SelectItem>}</SelectContent></Select></div><p className="text-xs text-muted-foreground">{copy("Privacy, pricing and region are not specified in this fixture.", "Confidentialité, prix et région ne sont pas renseignés dans ces données fictives.")}</p></PopoverContent></Popover>
      </div>
      {(filters.search || active.length > 0 || category !== "All") && <div className="flex flex-wrap items-center gap-1 text-xs"><span className="text-muted-foreground">{copy("Active:", "Actifs :")}</span>{category !== "All" && <Button type="button" size="sm" variant="secondary" className="h-7 gap-1" onClick={() => setCategory("All")}>{term(category)}<X className="size-3" /><span className="sr-only">{copy("Remove category filter", "Retirer le filtre de catégorie")}</span></Button>}{filters.search && <Button type="button" size="sm" variant="secondary" className="h-7 max-w-full gap-1" onClick={() => setFilter("search", "")}><span className="truncate">{copy("Search", "Recherche")}: {filters.search}</span><X className="size-3 shrink-0" /><span className="sr-only">{copy("Remove search filter", "Retirer le filtre de recherche")}</span></Button>}{active.map(item => <Button type="button" key={item.id} size="sm" variant="secondary" className="h-7 gap-1" onClick={item.clear}>{item.label}<X className="size-3" /><span className="sr-only">{copy("Remove filter", "Retirer le filtre")}</span></Button>)}<Button size="sm" variant="ghost" className="h-7" onClick={() => { setCategory("All"); setFilters(emptyModelFilters); setStatus("all"); }}>{copy("Clear filters", "Effacer les filtres")}<X className="size-3" /></Button></div>}
    </div>
    {!catalog && <div className="flex flex-wrap items-center gap-2 text-xs"><Checkbox id={selectId} disabled={!counts.visibleTotal} checked={counts.visibleSelected === 0 ? false : counts.visibleSelected === counts.visibleTotal ? true : "indeterminate"} onCheckedChange={() => props.onSetSelected(setVisibleSelection(selected, visibleIds, counts.visibleSelected !== counts.visibleTotal))} /><label htmlFor={selectId} className="cursor-pointer font-medium">{copy(`${counts.visibleSelected}/${counts.visibleTotal} visible selected`, `${counts.visibleSelected} sélection${counts.visibleSelected === 1 ? "" : "s"} sur ${counts.visibleTotal} résultats visibles`)}</label><span className="text-muted-foreground">{copy(`${counts.totalSelected} selected overall`, `${counts.totalSelected} sélectionné${counts.totalSelected === 1 ? "" : "s"} au total`)}{counts.hiddenSelected ? copy(` · ${counts.hiddenSelected} outside results`, ` · ${counts.hiddenSelected} hors résultats`) : ""}</span></div>}
    {!catalog && hiddenSelected.length > 0 && <div className="flex flex-wrap items-center gap-1 text-xs"><span className="text-muted-foreground">{copy("Selected outside results:", "Sélection hors résultats :")}</span>{hiddenSelected.map(id => <Badge key={id} variant="secondary">{models.find(model => model.id === id)?.name || id}</Badge>)}</div>}
    <p className="text-[11px] text-muted-foreground">{copy(`${filtered.length} of ${models.length} models shown · Unknown values are not zero or free.`, `${filtered.length} modèles affichés sur ${models.length} · « Non renseigné » ne signifie pas zéro ou gratuit.`)}</p>
    {display.capabilities && <ModelCapabilityLegend />}
    {filtered.length ? catalog ? <ComposerModelResults filtered={filtered} view={view} display={display} groupBy={groupBy} mode="catalog" onOpenModel={props.onOpenModel} /> : <ComposerModelResults filtered={filtered} view={view} display={display} groupBy={groupBy} selectionScope={props.selectionScope} draft={props.draft} groups={props.groups} resolved={props.resolved} callbacks={props.callbacks} /> : <p className="rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground">{copy("No models match these filters.", "Aucun modèle ne correspond à ces filtres.")}</p>}
  </div>;
}
