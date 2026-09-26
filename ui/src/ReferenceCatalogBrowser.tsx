import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "./api";
import { getCatalog, type Catalog } from "./catalog-api";
import { BrandIcon, displayProvider } from "./BrandIcon";
import { type Model, type ModelFilters } from "./demo";
import ModelBrowser from "./ModelBrowser";
import { filterReferenceGroups, filterReferenceModels, type ReferenceGroup } from "./reference-groups";
import type { ViewOptions } from "./ViewOptions";

const value = (unknown: unknown) => typeof unknown === "string" && unknown.trim() ? unknown : "Unknown";
const price = (unknown: unknown) => typeof unknown === "number" ? `$${unknown}/M` : "Unknown";
const factValue = (unknown: unknown) => unknown == null ? "Unknown" : typeof unknown === "string" ? unknown || '""' : JSON.stringify(unknown);
const factDate = (updatedAt?: string | null) => updatedAt ? new Date(updatedAt).toLocaleString() : "Unknown date";
const unique = (items: string[]) => [...new Set(items)].sort((a, b) => a.localeCompare(b));

export default function ReferenceCatalogBrowser({ revision, models, registeredIds, preferences, onOpen, onMetadata, onUnauthorized }: { revision: string; models: Model[]; registeredIds: ReadonlySet<string>; preferences: ViewOptions; onOpen: (model: Model) => void; onMetadata: (target: "reference" | "access", id: string) => void; onUnauthorized: () => void }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);
  const load = async () => {
    try { setCatalog(await getCatalog()); setError(""); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { onUnauthorized(); return; }
      setError(cause instanceof Error ? cause.message : "Reference catalogue unavailable.");
    }
  };
  useEffect(() => { void load(); }, [revision]);

  const render = (filtered: Model[], view: ViewOptions, groupBy: string, filters: ModelFilters) => {
    if (!catalog) return <div role="status" className="rounded-sm border p-5 text-sm text-muted-foreground">Loading model details…</div>;
    const groups = filterReferenceGroups(filtered, catalog, filters);
    const shown = groups.slice(0, visibleCount);
    const sections = new Map<string, ReferenceGroup[]>();
    if (groupBy === "none") sections.set("", shown);
    else for (const group of shown) {
      const labels = groupBy === "provider" ? unique(group.entries.map(entry => entry.access ? displayProvider(entry.access.provider) : "Unknown"))
        : groupBy === "creator" ? unique(group.entries.map(entry => entry.model.creator || "Unknown"))
        : unique(group.entries.flatMap(entry => entry.model.tasks.length ? entry.model.tasks : ["Other"]));
      for (const label of labels) sections.set(label, [...(sections.get(label) || []), group]);
    }
    const accessRows = (group: ReferenceGroup) => <div className="space-y-2">{group.entries.map((entry, index) => {
      const access = entry.access;
      const fact = entry.catalogAccess;
      const registered = registeredIds.has(entry.model.id);
      return <div key={`${entry.model.id}/${access?.id || index}`} className="min-w-0 rounded-sm border bg-background p-3 text-xs">
        <div className="flex flex-wrap items-center gap-2"><Badge variant={registered ? "success" : "secondary"}>{registered ? "Registered" : "Review & add"}</Badge>{group.entries.length > 1 && <span className="font-medium">{entry.model.name}</span>}</div>
        {view.providers && <p className="mt-2 break-words text-sm"><span className="font-medium">{access ? displayProvider(access.provider) : "No provider access"}</span>{access?.nativeModel && <span className="text-muted-foreground"> · {access.nativeModel}</span>}</p>}
        {access && <p className="mt-1 text-muted-foreground">Input {price(fact?.fields.input_cost_usd_per_million?.value)} · Output {price(fact?.fields.output_cost_usd_per_million?.value)}</p>}
        <div className="mt-2 flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => onOpen(entry.model)}>{registered ? "Details" : "Review & add"} <ArrowRight className="size-3.5" /></Button>{fact && <Button size="sm" variant="ghost" onClick={() => onMetadata("access", fact.id)}>Access details</Button>}</div>
        <details className="mt-2 text-muted-foreground"><summary className="cursor-pointer">Exact IDs and access facts</summary><div className="mt-1 space-y-1 break-all"><p className="font-mono">Model: {entry.model.id}</p>{access && <><p className="font-mono">Workspace access: {access.id}</p><p className="font-mono">Native model: {access.nativeModel || "Unknown"}</p></>}{fact && <><p className="font-mono">Catalog access: {fact.id}</p>{Object.entries(fact.fields).map(([field, detail]) => <p key={field}><strong>{field.replaceAll("_", " ")}:</strong> <span className="font-mono">{factValue(detail.value)}</span> · {detail.source} · {detail.kind} · {factDate(detail.updatedAt)}</p>)}</>}</div></details>
      </div>;
    })}</div>;
    const title = (group: ReferenceGroup) => group.entries[0]?.model.name || (group.reference ? value(group.reference.fields.name?.value) : group.key);
    const header = (group: ReferenceGroup) => <><div className="flex flex-wrap items-center gap-2">{group.entries[0] && <BrandIcon model={group.entries[0].model} mode={view.logo} />}<strong className="break-words text-base">{title(group)}</strong></div>{view.metadata && <p className="mt-1 text-xs text-muted-foreground">{group.reference ? `${value(group.reference.fields.creator?.value)} · ${value(group.reference.fields.family?.value)}` : `${group.entries[0]?.model.creator || "Unknown"} · ${group.entries[0]?.model.family || "Unknown"}`}</p>}{view.evidence && <p className="mt-1 text-xs text-muted-foreground">{group.reference?.fields.name ? `${group.reference.fields.name.kind} · ${group.reference.fields.name.source}` : "No reference provenance"}</p>}<details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Model details</summary><p className="mt-1 break-all font-mono">{group.reference ? `Reference ID: ${group.reference.id}` : `Model ID: ${group.entries[0]?.model.id}`}</p>{group.reference && Object.entries(group.reference.fields).map(([field, fact]) => <p key={field} className="break-all"><strong>{field.replaceAll("_", " ")}:</strong> <span className="font-mono">{factValue(fact.value)}</span> · {fact.source} · {fact.kind} · {factDate(fact.updatedAt)}</p>)}</details></>;
    return <div className="space-y-4"><p className="text-xs text-muted-foreground">Showing {shown.length} of {groups.length} model details for {filtered.length} models.</p>{[...sections.entries()].map(([section, items]) => <section key={section || "all"} className="space-y-3">{section && <h3 className="text-base font-semibold">{section} <span className="text-sm font-normal text-muted-foreground">{items.length}</span></h3>}{view.layout === "grid" ? <div className={`grid gap-4 ${view.size === "small" ? "min-[560px]:grid-cols-2 xl:grid-cols-4" : view.size === "large" ? "lg:grid-cols-2" : "min-[560px]:grid-cols-2 xl:grid-cols-3"}`}>{items.map(group => <Card key={group.key} data-tour={group === groups[0] ? "first-model" : undefined} className="min-w-0 gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/40 px-4 py-4"><CardTitle>{header(group)}</CardTitle></CardHeader><CardContent className="space-y-3 px-4 py-4">{view.description && !group.reference && group.entries[0]?.model.summary && <p className="text-sm text-foreground/80">{group.entries[0].model.summary}</p>}{accessRows(group)}{group.reference && <Button variant="outline" size="sm" onClick={() => onMetadata("reference", group.reference!.id)}>Reference details <ArrowRight className="size-3.5" /></Button>}</CardContent></Card>)}</div> : <div className="overflow-x-auto rounded-sm border bg-card"><Table><TableHeader><TableRow><TableHead>Model</TableHead><TableHead>Access and prices</TableHead><TableHead>Reference</TableHead></TableRow></TableHeader><TableBody>{items.map(group => <TableRow key={group.key} data-tour={group === groups[0] ? "first-model" : undefined}><TableCell className="min-w-48 align-top">{header(group)}</TableCell><TableCell className="min-w-64">{accessRows(group)}</TableCell><TableCell className="align-top">{group.reference ? <Button variant="outline" size="sm" onClick={() => onMetadata("reference", group.reference!.id)}>Details</Button> : "—"}</TableCell></TableRow>)}</TableBody></Table></div>}</section>)}{shown.length < groups.length && <Button variant="outline" onClick={() => setVisibleCount(count => count + 60)}>Show more ({groups.length - shown.length} remaining)</Button>}</div>;
  };
  if (error) return <div className="space-y-3"><div role="alert" className="flex flex-wrap items-center gap-2 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">Model details unavailable: {error}. Your known models are still available. <Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div><ModelBrowser models={models} registeredIds={registeredIds} preferences={preferences} onOpen={onOpen} tourFirst /></div>;
  return <ModelBrowser models={models} registeredIds={registeredIds} preferences={preferences} onOpen={onOpen} filter={(rows, filters) => catalog ? filterReferenceModels(rows, catalog, filters) : rows} renderResults={render} tourFirst />;
}
