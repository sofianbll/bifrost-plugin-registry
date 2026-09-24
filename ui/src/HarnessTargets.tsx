import { useId, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BrandIcon, displayProvider } from "./BrandIcon";
import { type Group, type Model } from "./demo";
import { emptyTargetFilters, visibleHarnessTargets, type TargetFilters, type VisibleTarget } from "./harness-targets";
import { selectionCounts, setVisibleSelection } from "./selection";
import { defaultViewOptions, updateViewOverride, ViewControls, type ViewOptions } from "./ViewOptions";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const sizeClass = { small: "min-[560px]:grid-cols-2 xl:grid-cols-4", medium: "min-[560px]:grid-cols-2 xl:grid-cols-3", large: "lg:grid-cols-2" };

export default function HarnessTargets({ models, groups, selectedAccessIds, onChange, preferences = defaultViewOptions }: { models: Model[]; groups: Group[]; selectedAccessIds: string[]; onChange: (ids: string[]) => void; preferences?: ViewOptions }) {
  const bulkId = useId();
  const [filters, setFilters] = useState<TargetFilters>(emptyTargetFilters);
  const [override, setOverride] = useState<Partial<ViewOptions>>({});
  const base = { ...preferences, description: false, metadata: false, providers: true, evidence: false };
  const view = { ...base, ...override };
  const setFilter = (field: keyof TargetFilters, value: string) => setFilters(old => ({ ...old, [field]: value }));
  const visible = visibleHarnessTargets(models, groups, filters);
  const visibleIds = unique(visible.flatMap(row => row.accesses.map(access => access.id)));
  const counts = selectionCounts(selectedAccessIds, visibleIds);
  const selectedSet = new Set(selectedAccessIds);
  const selectedModels = models.filter(model => model.accesses.some(access => selectedSet.has(access.id))).length;
  const visibleSelectedModels = visible.filter(row => row.accesses.some(access => selectedSet.has(access.id))).length;
  const allSelected = counts.visibleTotal > 0 && counts.visibleSelected === counts.visibleTotal;
  const toggle = (ids: string[], checked: boolean) => onChange(setVisibleSelection(selectedAccessIds, ids, checked));
  const fields: { key: keyof TargetFilters; label: string; options: { value: string; label: string }[] }[] = [
    { key: "creator", label: "Creator", options: unique(models.map(model => model.creator)).map(value => ({ value, label: value })) },
    { key: "provider", label: "Serving provider", options: unique(models.flatMap(model => model.accesses.map(access => access.provider))).map(value => ({ value, label: displayProvider(value) })) },
    { key: "group", label: "Group", options: groups.map(item => ({ value: item.id, label: item.name })) },
    { key: "task", label: "Task", options: unique(models.flatMap(model => model.tasks)).map(value => ({ value, label: value })) },
  ];
  const active = Object.entries(filters).filter(([, value]) => value).length;

  const accessChoices = (row: VisibleTarget) => <div className="space-y-2">{row.accesses.map(access => <label key={access.id} className="flex min-w-0 cursor-pointer items-start gap-2 rounded-sm border p-2 text-xs hover:bg-muted/40"><Checkbox className="mt-0.5" checked={selectedSet.has(access.id)} onCheckedChange={checked => toggle([access.id], checked === true)} aria-label={`Select ${access.id}`} /><span className="min-w-0 flex-1"><span className="font-medium">{displayProvider(access.provider)}</span><span className="block break-all font-mono text-muted-foreground">{access.id}</span>{access.status !== "Configured" && <span className="text-amber-700 dark:text-amber-400">Configuration unknown · not verified live</span>}</span></label>)}</div>;
  const modelChoice = (row: VisibleTarget) => {
    const ids = row.accesses.map(access => access.id);
    const selected = ids.filter(id => selectedSet.has(id)).length;
    return <Checkbox checked={selected === 0 ? false : selected === ids.length ? true : "indeterminate"} onCheckedChange={checked => toggle(ids, checked === true)} aria-label={`Select all visible accesses for ${row.model.name}`} />;
  };

  return <div className="min-w-0 space-y-4">
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-0 basis-full grow sm:basis-48"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search models and accesses" placeholder="Model, creator, provider or access ID…" value={filters.search} onChange={event => setFilter("search", event.target.value)} className="pl-9" /></div><ViewControls value={view} onChange={next => setOverride(old => updateViewOverride(base, old, next))} onReset={() => setOverride({})} scope="Harness targets" fields={["description", "metadata", "evidence"]} /></div>
      <div className="flex flex-wrap gap-2">{fields.map(field => <Select key={field.key} value={filters[field.key] || "all"} onValueChange={value => setFilter(field.key, value === "all" ? "" : value)}><SelectTrigger aria-label={`Filter by ${field.label.toLowerCase()}`} className="w-auto min-w-28 max-w-full text-xs"><SelectValue placeholder={field.label} /></SelectTrigger><SelectContent><SelectItem value="all">{field.label}: All</SelectItem>{field.options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>)}{active > 0 && <Button size="sm" variant="ghost" onClick={() => setFilters(emptyTargetFilters)}>Clear filters ({active})</Button>}</div>
    </div>
    <div className="flex flex-wrap items-center gap-3 rounded-sm border bg-muted/30 px-3 py-2 text-xs"><Checkbox id={bulkId} disabled={!visibleIds.length} checked={counts.visibleSelected === 0 ? false : allSelected ? true : "indeterminate"} onCheckedChange={checked => toggle(visibleIds, checked === true)} /><label htmlFor={bulkId} className={visibleIds.length ? "cursor-pointer font-medium" : "text-muted-foreground"}>{allSelected ? "Deselect" : "Select"} all {visibleIds.length} visible accesses</label><span className="text-muted-foreground">{visibleSelectedModels}/{visible.length} visible models · {counts.visibleSelected}/{counts.visibleTotal} visible accesses · {selectedModels} models / {counts.totalSelected} accesses selected{counts.hiddenSelected ? ` · ${counts.hiddenSelected} accesses outside filters` : ""}</span></div>
    {visible.length ? view.layout === "grid" ? <div className={`grid grid-cols-1 gap-3 ${sizeClass[view.size]}`}>{visible.map(row => <Card key={row.model.id} className="min-w-0 gap-2 py-0"><CardHeader className="border-b py-3"><div className="flex min-w-0 items-start gap-3"><BrandIcon model={{ ...row.model, accesses: row.accesses }} mode={view.logo} /><div className="min-w-0 flex-1"><CardTitle className="break-words text-sm">{row.model.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{row.model.creator} · {row.accesses.length} visible access{row.accesses.length === 1 ? "" : "es"}</p></div>{modelChoice(row)}</div></CardHeader><CardContent className="space-y-2 pb-3">{view.description && <p className="text-xs text-muted-foreground">{row.model.summary}</p>}{view.metadata && <p className="text-xs text-muted-foreground">{row.model.family} · {row.model.tasks.join(", ")}</p>}{view.evidence && <Badge variant="outline">Harness results unverified for this access</Badge>}{accessChoices(row)}</CardContent></Card>)}</div> : <div className="max-w-full overflow-x-auto rounded-sm border"><Table><TableHeader><TableRow><TableHead>Model</TableHead><TableHead>Visible accesses</TableHead></TableRow></TableHeader><TableBody>{visible.map(row => <TableRow key={row.model.id}><TableCell className="align-top"><div className="flex min-w-40 items-start gap-2">{modelChoice(row)}<BrandIcon model={{ ...row.model, accesses: row.accesses }} mode={view.logo} /><div><p className="font-medium">{row.model.name}</p><p className="text-xs text-muted-foreground">{row.model.creator}</p></div></div>{view.description && <p className="mt-2 max-w-60 text-xs text-muted-foreground">{row.model.summary}</p>}{view.metadata && <p className="mt-1 text-xs text-muted-foreground">{row.model.family} · {row.model.tasks.join(", ")}</p>}{view.evidence && <Badge variant="outline" className="mt-2">Unverified</Badge>}</TableCell><TableCell className="min-w-48 align-top">{accessChoices(row)}</TableCell></TableRow>)}</TableBody></Table></div> : <div className="rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground">No matching models or accesses. <Button variant="link" size="sm" onClick={() => setFilters(emptyTargetFilters)}>Clear filters</Button></div>}
  </div>;
}
