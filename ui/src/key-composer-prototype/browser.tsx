// Prototype-only catalog controls. Filtering affects visibility, never the key draft.
import { useId, useState } from "react";
import { AudioLines, BrainCircuit, ChevronDown, Code2, Eye, Image, Search, SlidersHorizontal, Sparkles, Wrench, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandIcon, displayProvider } from "../BrandIcon";
import { emptyModelFilters, type ModelFilters } from "../demo";
import { selectionCounts, setVisibleSelection } from "../selection";
import { defaultViewOptions, updateViewOverride, ViewControls, type ViewOptions } from "../ViewOptions";
import { ComposerModelResults, type CardCallbacks } from "./cards";
import { catalogResults, type Category } from "./catalog";
import type { KeyDraft, ModelResolution, ProtoGroup, ProtoModel } from "./state";

const categories: Category[] = ["All", "Text", "Image", "Video", "Audio", "Retrieval", "Evaluation", "Tools"];
const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const capabilityIcons: Record<string, typeof BrainCircuit> = { Reasoning: BrainCircuit, Vision: Eye, "Tool calling": Wrench, Tools: Wrench, "Image generation": Image, Embeddings: Sparkles, Streaming: AudioLines, "Structured output": Code2, Chat: Sparkles };

export function ComposerBrowser({ models, selected, onSetSelected, draft, groups, resolved, callbacks }: {
  models: ProtoModel[]; selected: string[]; onSetSelected: (ids: string[]) => void;
  draft: KeyDraft; groups: ProtoGroup[]; resolved: Map<string, ModelResolution>; callbacks: CardCallbacks;
}) {
  const selectId = useId();
  const [category, setCategory] = useState<Category>("All");
  const [filters, setFilters] = useState<ModelFilters>(emptyModelFilters);
  const [providerSearch, setProviderSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [groupBy, setGroupBy] = useState("none");
  const [override, setOverride] = useState<Partial<ViewOptions>>({});
  const view = { ...defaultViewOptions, ...override };
  const setFilter = (field: keyof ModelFilters, value: string) => setFilters(previous => ({ ...previous, [field]: value }));
  const providers = unique(models.flatMap(model => model.accesses.map(access => access.provider)));
  const capabilities = unique(models.flatMap(model => Object.entries(model.capabilities).filter(([, value]) => value === "Declared").map(([name]) => name)));
  const filtered = catalogResults(models, filters, category, status, selected, sort);
  const visibleIds = filtered.map(model => model.id);
  const counts = selectionCounts(selected, visibleIds);
  const hiddenSelected = selected.filter(id => !visibleIds.includes(id));
  const active = [filters.provider && displayProvider(filters.provider), filters.capability, filters.creator, filters.task, filters.input, filters.output, status !== "all" && status].filter((value): value is string => Boolean(value));
  const selectFilter = (label: string, field: keyof ModelFilters, options: string[]) => <Select value={filters[field] || "all"} onValueChange={value => setFilter(field, value === "all" ? "" : value)}><SelectTrigger aria-label={label} className="w-full text-xs"><SelectValue placeholder={label} /></SelectTrigger><SelectContent><SelectItem value="all">{label}: All</SelectItem>{options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>;
  return <div className="min-w-0 space-y-4">
    <div className="space-y-3 rounded-sm border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1"><Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input aria-label="Search key models" placeholder="Search model, common ID, creator or access ID…" className="pl-9" value={filters.search} onChange={event => setFilter("search", event.target.value)} /></div>
        <ViewControls value={view} onChange={next => setOverride(previous => updateViewOverride(defaultViewOptions, previous, next))} onReset={() => setOverride({})} scope="Key models" />
      </div>
      <div role="group" aria-label="Model categories" className="flex gap-1 overflow-x-auto border-b pb-2">
        {categories.map(item => <Button key={item} aria-pressed={category === item} size="sm" variant={category === item ? "secondary" : "ghost"} className="shrink-0" onClick={() => setCategory(item)}>{item}</Button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Popover><PopoverTrigger asChild><Button variant="outline" size="sm">{filters.provider ? displayProvider(filters.provider) : "Providers"}<ChevronDown className="size-3.5" /></Button></PopoverTrigger><PopoverContent align="start" className="w-64 space-y-2"><Input aria-label="Search serving providers" placeholder="Search providers…" value={providerSearch} onChange={event => setProviderSearch(event.target.value)} /><div className="max-h-60 space-y-1 overflow-y-auto"><Button size="sm" variant={!filters.provider ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => setFilter("provider", "")}>All providers</Button>{providers.filter(id => displayProvider(id).toLowerCase().includes(providerSearch.toLowerCase())).map(id => { const model = models.find(m => m.accesses.some(a => a.provider === id)); return <Button key={id} size="sm" variant={filters.provider === id ? "secondary" : "ghost"} className="w-full justify-start gap-2" onClick={() => setFilter("provider", id)}>{model && <BrandIcon model={{ ...model, accesses: model.accesses.filter(a => a.provider === id) }} mode="provider" className="scale-75" />}{displayProvider(id)}</Button>; })}</div></PopoverContent></Popover>
        <Popover><PopoverTrigger asChild><Button variant="outline" size="sm">Capabilities{filters.capability ? `: ${filters.capability}` : ""}<ChevronDown className="size-3.5" /></Button></PopoverTrigger><PopoverContent align="start" className="w-60 space-y-1"><p className="px-2 text-xs text-muted-foreground">Declared capabilities only</p><Button size="sm" variant={!filters.capability ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => setFilter("capability", "")}>All capabilities</Button>{capabilities.map(capability => { const Icon = capabilityIcons[capability] || Sparkles; return <Button key={capability} size="sm" variant={filters.capability === capability ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => setFilter("capability", capability)}><Icon className="size-3.5" />{capability}</Button>; })}</PopoverContent></Popover>
        <Popover><PopoverTrigger asChild><Button variant="outline" size="sm"><SlidersHorizontal className="size-3.5" />More filters{active.length ? ` (${active.length})` : ""}</Button></PopoverTrigger><PopoverContent align="start" className="w-72 max-h-[70dvh] space-y-3 overflow-y-auto"><div><p className="mb-1 text-xs font-semibold">Identity and use</p><div className="space-y-2">{selectFilter("Creator", "creator", unique(models.map(m => m.creator)))}{selectFilter("Usage / task", "task", unique(models.flatMap(m => m.tasks)))}</div></div><div className="border-t pt-2"><p className="mb-1 text-xs font-semibold">Modalities</p><div className="space-y-2">{selectFilter("Input", "input", unique(models.flatMap(m => m.inputModalities)))}{selectFilter("Output", "output", unique(models.flatMap(m => m.outputModalities)))}</div></div><div className="border-t pt-2"><p className="mb-1 text-xs font-semibold">Availability</p><Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Configuration status" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All models</SelectItem><SelectItem value="configured">At least one configured access</SelectItem><SelectItem value="unconfigured">No configured access</SelectItem><SelectItem value="selected">Selected for this key</SelectItem></SelectContent></Select></div>{[["Privacy", "Zero Data Retention", "No Training on Prompt Data"], ["Pricing", "Free Tier", "Promos"], ["Regional inference", "US Regional Inference", "EU Regional Inference"]].map(([section, ...items]) => <div key={section} className="border-t pt-2"><p className="mb-1 text-xs font-semibold">{section}</p>{items.map(item => <Button key={item} disabled variant="ghost" size="sm" className="w-full justify-start">{item}</Button>)}</div>)}<p className="text-xs text-muted-foreground">Privacy, pricing and region data are unavailable in this fixture.</p></PopoverContent></Popover>
        <Select value={sort} onValueChange={setSort}><SelectTrigger aria-label="Sort models" className="w-auto min-w-36 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Sort: Name</SelectItem><SelectItem value="creator">Sort: Creator</SelectItem><SelectItem value="accesses">Sort: Access count</SelectItem><SelectItem value="newest" disabled>Newest · unavailable</SelectItem><SelectItem value="latency" disabled>Latency · unavailable</SelectItem><SelectItem value="throughput" disabled>Throughput · unavailable</SelectItem></SelectContent></Select>
        <Select value={groupBy} onValueChange={setGroupBy}><SelectTrigger aria-label="Group models by" className="w-auto min-w-36 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No grouping</SelectItem><SelectItem value="creator">Group by creator</SelectItem><SelectItem value="provider">Group by provider</SelectItem><SelectItem value="task">Group by usage</SelectItem></SelectContent></Select>
      </div>
      {(filters.search || active.length > 0 || category !== "All") && <div className="flex flex-wrap items-center gap-1 text-xs"><span className="text-muted-foreground">Active:</span>{category !== "All" && <Badge variant="secondary">{category}</Badge>}{filters.search && <Badge variant="secondary">Search: {filters.search}</Badge>}{active.map(value => <Badge key={value} variant="secondary">{value}</Badge>)}<Button size="sm" variant="ghost" className="h-7" onClick={() => { setCategory("All"); setFilters(emptyModelFilters); setStatus("all"); }}>Clear filters<X className="size-3" /></Button></div>}
    </div>
    <p className="text-xs text-muted-foreground">Serving provider filters the display only. Selecting a model activates its configured accesses; refine them in Accesses.</p>
    <div className="flex flex-wrap items-center gap-2 rounded-sm border bg-card px-3 py-2 text-xs shadow-sm"><Checkbox id={selectId} disabled={!counts.visibleTotal} checked={counts.visibleSelected === 0 ? false : counts.visibleSelected === counts.visibleTotal ? true : "indeterminate"} onCheckedChange={() => onSetSelected(setVisibleSelection(selected, visibleIds, counts.visibleSelected !== counts.visibleTotal))} /><label htmlFor={selectId} className="cursor-pointer font-medium">{counts.visibleSelected === counts.visibleTotal && counts.visibleTotal ? "Deselect" : "Select"} all {counts.visibleTotal} visible models</label><span className="text-muted-foreground">{counts.totalSelected} selected overall{counts.hiddenSelected ? ` · ${counts.hiddenSelected} outside results` : ""}</span></div>
    {hiddenSelected.length > 0 && <div className="flex flex-wrap items-center gap-1 text-xs"><span className="text-muted-foreground">Selected outside results:</span>{hiddenSelected.map(id => <Badge key={id} variant="secondary">{models.find(model => model.id === id)?.name || id}</Badge>)}</div>}
    <p className="text-xs text-muted-foreground">{filtered.length} of {models.length} models shown · Unknown values are not zero or free.</p>
    {filtered.length ? <ComposerModelResults filtered={filtered} view={view} groupBy={groupBy} draft={draft} groups={groups} resolved={resolved} callbacks={callbacks} /> : <p className="rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground">No models match these filters.</p>}
  </div>;
}
