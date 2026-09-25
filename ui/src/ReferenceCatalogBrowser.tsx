import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "./api";
import { getCatalog, type Catalog } from "./catalog-api";
import { BrandIcon, displayProvider } from "./BrandIcon";
import { kindFor, type Access, type Model, type ModelFilters } from "./demo";
import ModelBrowser from "./ModelBrowser";
import { prefillFromReference } from "./model-editor-data";
import { filterReferenceGroups, filterReferenceModels, groupReferenceModels, type ReferenceGroup } from "./reference-groups";
import type { ViewOptions } from "./ViewOptions";

const known = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const unique = (items: string[]) => [...new Set(items)];
const factValue = (value: unknown) => value == null ? "Unknown" : typeof value === "string" ? value || '""' : JSON.stringify(value);
const factDate = (date?: string | null) => date ? new Date(date).toLocaleString() : "date unknown";
const price = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 6 }).format(value)} $/M` : "inconnu";
const sourceName = (source: string) => /models[.-]?dev/i.test(source) ? "Models.dev" : /bifrost/i.test(source) ? "Bifrost" : /manual|override|registry/i.test(source) ? "Registry" : source;
const nameOf = (group: ReferenceGroup) => known(group.reference?.fields.name?.value) ? group.reference.fields.name.value : group.entries[0]?.model.name || group.key;
const creatorOf = (group: ReferenceGroup) => {
  const creator = known(group.reference?.fields.creator?.value) ? group.reference.fields.creator.value : group.entries[0]?.model.creator;
  return creator && creator !== "Unknown" ? creator : "Créateur non identifié";
};
const familyOf = (group: ReferenceGroup) => {
  const family = known(group.reference?.fields.family?.value) ? group.reference.fields.family.value : group.entries[0]?.model.family;
  return family && family !== "Unknown" ? family : "";
};

// The editor uses provider/common-ID for exposed IDs. Native IDs remain on each access.
export function draftFor(group: ReferenceGroup, base: Model, registered: boolean): Model {
  const grouped: Access[] = group.entries.flatMap(({ access, catalogAccess }) => access ? [{
    ...access,
    id: `${access.provider}/${base.id}`,
    referenceId: catalogAccess?.referenceId || access.referenceId,
  }] : []);
  const accesses = registered ? [...base.accesses.filter(access => !grouped.some(row => row.provider === access.provider)), ...grouped] : grouped;
  const draft: Model = {
    ...base,
    name: registered ? base.name : nameOf(group),
    creator: registered ? base.creator : known(group.reference?.fields.creator?.value) ? group.reference.fields.creator.value : base.creator,
    family: registered ? base.family : known(group.reference?.fields.family?.value) ? group.reference.fields.family.value : base.family,
    accesses,
  };
  if (registered || !group.reference) return draft;
  const filled = prefillFromReference(draft, group.reference);
  const declaredModalities = ["input_modalities", "output_modalities"].every(field => Array.isArray(group.reference?.fields[field]?.value) && (group.reference.fields[field].value as unknown[]).length > 0);
  return filled.kind === "Unknown" && declaredModalities ? { ...filled, kind: kindFor(filled) } : filled;
}

export default function ReferenceCatalogBrowser({ revision, models, registeredIds, registeredModels, preferences, onOpen, onMetadata, onUnauthorized }: { revision: string; models: Model[]; registeredIds: ReadonlySet<string>; registeredModels?: Model[]; preferences: ViewOptions; onOpen: (model: Model) => void; onMetadata: (target: "reference" | "access", id: string) => void; onUnauthorized: () => void }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);
  const [choice, setChoice] = useState<ReferenceGroup | null>(null);
  const load = async () => {
    try { setCatalog(await getCatalog()); setError(""); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { onUnauthorized(); return; }
      setError(cause instanceof Error ? cause.message : "Reference catalogue unavailable.");
    }
  };
  useEffect(() => { void load(); }, [revision]);

  const open = (group: ReferenceGroup) => {
    if (!catalog) return;
    // Use the complete exact group; a provider filter only narrows the visible card.
    const complete = groupReferenceModels(models, catalog).find(row => row.key === group.key) || group;
    const ids = unique(complete.entries.map(entry => entry.model.id));
    const registered = ids.filter(id => registeredIds.has(id));
    const providers = complete.entries.flatMap(entry => entry.access ? [entry.access.provider] : []);
    const base = complete.entries.find(entry => entry.model.id === (registered[0] || ids[0]))?.model;
    const conflict = base && registered.length === 1 && complete.entries.some(entry => entry.access && base.accesses.some(access => access.provider === entry.access?.provider && access.nativeModel !== entry.access.nativeModel));
    if (registered.length > 1 || unique(providers).length !== providers.length || conflict || (!registered.length && ids.length > 1)) { setChoice(complete); return; }
    if (base) onOpen(draftFor(complete, base, registeredIds.has(base.id)));
  };

  const render = (filtered: Model[], view: ViewOptions, groupBy: string, filters: ModelFilters) => {
    if (!catalog) return <div role="status" className="rounded-sm border p-5 text-sm text-muted-foreground">Chargement des fiches…</div>;
    const groups = filterReferenceGroups(filtered, catalog, filters);
    const shown = groups.slice(0, visibleCount);
    const sections = new Map<string, ReferenceGroup[]>();
    for (const group of shown) {
      const label = groupBy === "provider" ? displayProvider(group.entries.find(entry => entry.access)?.access?.provider || "Fournisseur inconnu")
        : groupBy === "creator" ? creatorOf(group)
        : groupBy === "task" ? group.entries[0]?.model.tasks[0] || "Autre" : "";
      sections.set(label, [...(sections.get(label) || []), group]);
    }

    const status = (group: ReferenceGroup) => {
      const count = group.entries.filter(({ model, access }) => registeredModels
        ? registeredModels.some(saved => saved.id === model.id && (!access || saved.accesses.some(row => row.provider === access.provider && row.nativeModel === access.nativeModel)))
        : registeredIds.has(model.id)).length;
      return count === group.entries.length ? "Enregistré" : count ? "En partie enregistré" : "À enregistrer";
    };
    const accessLine = (group: ReferenceGroup) => <div className="flex flex-wrap gap-1.5 text-xs">{group.entries.map(({ model, access, catalogAccess }, index) => <div key={`${model.id}/${access?.id || index}`} className="min-w-0">
      <Badge variant="outline">{access ? displayProvider(access.provider) : "Aucun accès fournisseur"}</Badge>
      {access?.status !== "Configured" && <span className="ml-1 text-muted-foreground">État inconnu</span>}
      {catalogAccess?.matchConflict && <span className="ml-1 text-destructive">Conflit de correspondance</span>}
      {access && view.evidence && (catalogAccess?.fields.input_cost_usd_per_million || catalogAccess?.fields.output_cost_usd_per_million) && <span className="block text-muted-foreground">Tarif documenté · Entrée {price(catalogAccess?.fields.input_cost_usd_per_million?.value)} · Sortie {price(catalogAccess?.fields.output_cost_usd_per_million?.value)}</span>}
    </div>)}</div>;
    const details = (group: ReferenceGroup) => <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Exact IDs, sources and access details</summary><div className="mt-2 space-y-3 break-all">
      {group.reference && <div><p className="font-mono">Reference: {group.reference.id}</p>{Object.entries(group.reference.fields).map(([field, fact]) => <p key={field}><strong>{field.replaceAll("_", " ")}:</strong> {factValue(fact.value)} · {fact.source} · {fact.kind} · {factDate(fact.updatedAt)}</p>)}<Button variant="ghost" size="sm" onClick={() => onMetadata("reference", group.reference!.id)}>Reference metadata</Button></div>}
      {group.entries.map(({ model, access, catalogAccess }, index) => <div key={`${model.id}/${access?.id || index}`}><p className="font-mono">Model: {model.id}</p>{access && <><p className="font-mono">Workspace access: {access.id}</p><p className="font-mono">Native model: {access.nativeModel || "Unknown"}</p></>}{catalogAccess && <><p className="font-mono">Catalog access: {catalogAccess.id}</p>{Object.entries(catalogAccess.fields).map(([field, fact]) => <p key={field}><strong>{field.replaceAll("_", " ")}:</strong> {factValue(fact.value)} · {fact.source} · {fact.kind} · {factDate(fact.updatedAt)}</p>)}<Button variant="ghost" size="sm" onClick={() => onMetadata("access", catalogAccess.id)}>Access metadata</Button></>}</div>)}
    </div></details>;
    const header = (group: ReferenceGroup) => <div className="flex min-w-0 items-start gap-3"><BrandIcon model={{ ...group.entries[0].model, creator: creatorOf(group), accesses: group.entries.flatMap(entry => entry.access ? [entry.access] : []) }} mode={view.logo} /><div className="min-w-0"><h3 className="break-words text-base font-semibold leading-snug">{nameOf(group)}</h3>{view.metadata && <p className="mt-1 text-xs text-muted-foreground">{creatorOf(group)}{familyOf(group) && ` · ${familyOf(group)}`}</p>}{view.evidence && <p className="mt-1 text-xs text-muted-foreground">{group.reference?.fields.name ? `Source · ${sourceName(group.reference.fields.name.source)}` : "Référence à associer"}</p>}</div></div>;
    const card = (group: ReferenceGroup) => <Card key={group.key} data-tour={group === groups[0] ? "first-model" : undefined} className="min-w-0 gap-0 py-0"><CardContent className="flex h-full flex-col gap-3 p-4">{header(group)}<Badge variant={status(group) === "Enregistré" ? "success" : "secondary"} className="w-fit">{status(group)}</Badge>{view.description && group.entries[0]?.model.summary && <p className="line-clamp-2 text-sm text-foreground/80">{group.entries[0].model.summary}</p>}{view.providers && accessLine(group)}<div className="mt-auto flex items-center gap-2 pt-1"><Button size="sm" onClick={() => open(group)}>{status(group) === "À enregistrer" ? "Enregistrer le modèle" : "Voir la fiche"}<ArrowRight className="size-3.5" /></Button></div>{details(group)}</CardContent></Card>;
    return <div className="space-y-4"><p className="text-xs text-muted-foreground">{shown.length} fiche{shown.length > 1 ? "s" : ""}{shown.length < groups.length && ` sur ${groups.length}`}</p>{[...sections.entries()].map(([section, items]) => <section key={section || "all"} className="space-y-3">{section && <h3 className="text-base font-semibold">{section} <span className="text-sm font-normal text-muted-foreground">{items.length}</span></h3>}{view.layout === "grid" ? <div className={`grid gap-4 ${view.size === "small" ? "min-[560px]:grid-cols-2 xl:grid-cols-4" : view.size === "large" ? "lg:grid-cols-2" : "min-[560px]:grid-cols-2 xl:grid-cols-3"}`}>{items.map(card)}</div> : <div className="overflow-x-auto rounded-sm border bg-card"><Table><TableHeader><TableRow><TableHead>Modèle</TableHead><TableHead>Accès fournisseurs</TableHead><TableHead>État</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{items.map(group => <TableRow key={group.key} data-tour={group === groups[0] ? "first-model" : undefined}><TableCell className="min-w-48 align-top">{header(group)}<div className="mt-2">{details(group)}</div></TableCell><TableCell className="min-w-52 align-top">{accessLine(group)}</TableCell><TableCell className="align-top"><Badge variant={status(group) === "Enregistré" ? "success" : "secondary"}>{status(group)}</Badge></TableCell><TableCell className="text-right align-top"><Button size="sm" onClick={() => open(group)}>{status(group) === "À enregistrer" ? "Enregistrer le modèle" : "Voir la fiche"}</Button></TableCell></TableRow>)}</TableBody></Table></div>}</section>)}{shown.length < groups.length && <Button variant="outline" onClick={() => setVisibleCount(count => count + 60)}>Voir plus ({groups.length - shown.length})</Button>}</div>;
  };

  if (error) return <div className="space-y-3"><div role="alert" className="flex flex-wrap items-center gap-2 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">Model details unavailable: {error}. Your known models are still available. <Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div><ModelBrowser models={models} registeredIds={registeredIds} preferences={preferences} onOpen={onOpen} tourFirst /></div>;
  return <><ModelBrowser models={models} registeredIds={registeredIds} preferences={preferences} onOpen={onOpen} filter={(rows, filters) => catalog ? filterReferenceModels(rows, catalog, filters) : rows} renderResults={render} tourFirst />
    <Dialog open={!!choice} onOpenChange={open => { if (!open) setChoice(null); }}><DialogContent><DialogHeader><DialogTitle>Choisir l’identifiant du modèle</DialogTitle><DialogDescription>{choice && unique(choice.entries.map(entry => entry.model.id)).filter(id => registeredIds.has(id)).length > 1 ? "Ces accès appartiennent déjà à des modèles enregistrés distincts. Ouvrez une fiche sans modifier les autres." : "Choisissez l’identifiant exposé. Les accès fournisseurs en conflit restent dans des fiches séparées."}</DialogDescription></DialogHeader><div className="space-y-2">{choice && unique(choice.entries.map(entry => entry.model.id)).map(id => { const base = choice.entries.find(entry => entry.model.id === id)!.model; const existing = unique(choice.entries.map(entry => entry.model.id)).filter(value => registeredIds.has(value)); const grouped = choice.entries.flatMap(entry => entry.access ? [entry.access] : []); const duplicateProvider = unique(grouped.map(access => access.provider)).length !== grouped.length; const conflict = registeredIds.has(id) && grouped.some(row => base.accesses.some(access => access.provider === row.provider && access.nativeModel !== row.nativeModel)); const canCombine = existing.length <= 1 && !duplicateProvider && !conflict && (!existing.length || existing[0] === id); return <Button key={id} variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => { onOpen(canCombine ? draftFor(choice, base, registeredIds.has(id)) : base); setChoice(null); }}>{id}{registeredIds.has(id) ? " · enregistré" : " · nouveau"}{!canCombine ? " · ouvre séparément" : " · regroupe les accès"}</Button>; })}</div></DialogContent></Dialog>
  </>;
}
