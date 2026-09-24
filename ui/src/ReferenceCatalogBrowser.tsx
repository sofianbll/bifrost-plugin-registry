import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "./api";
import { getCatalog, type Catalog } from "./catalog-api";
import { BrandIcon, displayProvider } from "./BrandIcon";
import { filterModels, type Model, type ModelFilters } from "./demo";
import ModelBrowser from "./ModelBrowser";
import { filterReferenceGroups, filterReferenceModels, type ReferenceGroup } from "./reference-groups";
import type { ViewOptions } from "./ViewOptions";

const value = (unknown: unknown) => typeof unknown === "string" && unknown.trim() ? unknown : "Unknown";
const price = (unknown: unknown) => typeof unknown === "number" ? `$${unknown}/M` : "Unknown";
const unique = (items: string[]) => [...new Set(items)].sort((a, b) => a.localeCompare(b));

export default function ReferenceCatalogBrowser({ revision, models, registeredIds, preferences, onOpen, onMetadata, onUnauthorized }: { revision: string; models: Model[]; registeredIds: ReadonlySet<string>; preferences: ViewOptions; onOpen: (model: Model) => void; onMetadata: (target: "reference" | "access", id: string) => void; onUnauthorized: () => void }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const load = async () => {
    try { setCatalog(await getCatalog()); setError(""); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { onUnauthorized(); return; }
      setError(cause instanceof Error ? cause.message : "Reference catalogue unavailable.");
    }
  };
  useEffect(() => { void load(); }, [revision]);

  const render = (filtered: Model[], view: ViewOptions, groupBy: string, filters: ModelFilters) => {
    if (!catalog) return <div role="status" className="rounded-sm border p-5 text-sm text-muted-foreground">{error ? <>Reference grouping unavailable: {error}. <Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></> : "Loading reference mappings…"}</div>;
    const groups = filterReferenceGroups(filtered, catalog, filters);
    const shown = groups.slice(0, 60);
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
      return <div key={`${entry.model.id}/${access?.id || index}`} className="min-w-0 rounded-sm border bg-background p-2 text-xs"><div className="flex flex-wrap items-center gap-1"><Badge variant={registeredIds.has(entry.model.id) ? "success" : "secondary"}>{registeredIds.has(entry.model.id) ? "Registered" : "Needs configuration"}</Badge><span className="break-all font-mono">Model ID: {entry.model.id}</span></div>{access ? <><p className="mt-1 break-all font-mono">Workspace access: {access.id}</p>{fact && <p className="break-all font-mono">Native access: {fact.id}</p>}<p className="mt-1 text-muted-foreground">{displayProvider(access.provider)} · Input {price(fact?.fields.input_cost_usd_per_million?.value)} · Output {price(fact?.fields.output_cost_usd_per_million?.value)}</p></> : <p className="mt-1 text-muted-foreground">No provider access</p>}<div className="mt-2 flex flex-wrap gap-1">{fact && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onMetadata("access", fact.id)}>Access metadata</Button>}<Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onOpen(entry.model)}>Edit model access</Button></div></div>;
    })}</div>;
    const title = (group: ReferenceGroup) => group.reference ? value(group.reference.fields.name?.value) === "Unknown" ? group.reference.id : value(group.reference.fields.name?.value) : group.entries[0]?.model.name || group.key;
    const header = (group: ReferenceGroup) => <><div className="flex flex-wrap items-center gap-2">{group.entries[0] && <BrandIcon model={group.entries[0].model} mode={view.logo} />}<strong className="break-words text-base">{title(group)}</strong><Badge variant={group.reference ? "outline" : "secondary"}>{group.reference ? "Reference" : "Unmatched"}</Badge></div><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{group.reference ? `Reference ID: ${group.reference.id}` : `Model ID: ${group.entries[0]?.model.id}`}</p>{view.evidence && <p className="mt-1 text-xs text-muted-foreground">{group.reference?.fields.name ? `${group.reference.fields.name.kind} · ${group.reference.fields.name.source}` : "No reference provenance"}</p>}</>;
    return <div className="space-y-4"><p className="text-xs text-muted-foreground">{groups.length} fiches for {filtered.length} workspace models. Showing {shown.length}; search to narrow results. Exact workspace IDs remain the only key and group selections.</p>{[...sections.entries()].map(([section, items]) => <section key={section || "all"} className="space-y-3">{section && <h3 className="text-base font-semibold">{section} <span className="text-sm font-normal text-muted-foreground">{items.length}</span></h3>}{view.layout === "grid" ? <div className={`grid gap-4 ${view.size === "small" ? "min-[560px]:grid-cols-2 xl:grid-cols-4" : view.size === "large" ? "lg:grid-cols-2" : "min-[560px]:grid-cols-2 xl:grid-cols-3"}`}>{items.map(group => <Card key={group.key} data-tour={group === groups[0] ? "first-model" : undefined} className="min-w-0 gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/40 px-4 py-4"><CardTitle>{header(group)}</CardTitle>{view.metadata && <p className="text-xs text-muted-foreground">{group.reference ? `${value(group.reference.fields.creator?.value)} · ${value(group.reference.fields.family?.value)}` : `${group.entries[0]?.model.creator || "Unknown"} · ${group.entries[0]?.model.family || "Unknown"}`}</p>}</CardHeader><CardContent className="space-y-3 px-4 py-4">{view.description && !group.reference && group.entries[0]?.model.summary && <p className="text-sm text-foreground/80">{group.entries[0].model.summary}</p>}{accessRows(group)}{group.reference && <Button variant="outline" size="sm" onClick={() => onMetadata("reference", group.reference!.id)}>Reference metadata <ArrowRight className="size-3.5" /></Button>}</CardContent></Card>)}</div> : <div className="overflow-x-auto rounded-sm border bg-card"><Table><TableHeader><TableRow><TableHead>Fiche</TableHead><TableHead>Exact accesses and prices</TableHead><TableHead>Reference</TableHead></TableRow></TableHeader><TableBody>{items.map(group => <TableRow key={group.key} data-tour={group === groups[0] ? "first-model" : undefined}><TableCell className="min-w-48 align-top">{header(group)}</TableCell><TableCell className="min-w-64">{accessRows(group)}</TableCell><TableCell className="align-top">{group.reference ? <Button variant="outline" size="sm" onClick={() => onMetadata("reference", group.reference!.id)}>Metadata</Button> : "—"}</TableCell></TableRow>)}</TableBody></Table></div>}</section>)}</div>;
  };
  return <ModelBrowser models={models} registeredIds={registeredIds} preferences={preferences} onOpen={onOpen} filter={(rows, filters) => catalog ? filterReferenceModels(rows, catalog, filters) : filterModels(rows, filters)} renderResults={render} tourFirst />;
}
