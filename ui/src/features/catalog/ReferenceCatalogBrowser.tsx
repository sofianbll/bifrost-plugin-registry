import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CatalogCard, CatalogGrid } from "@/components/registry/CatalogCard";
import { ModelCapabilitiesSummary, ModelModalitiesSummary } from "@/components/registry/model-capabilities";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError } from "../../data/api";
import { getCatalog, type Catalog } from "./catalog-api";
import { BrandIcon, displayProvider } from "../../components/registry/BrandIcon";
import { ProviderSummary } from "../../components/registry/CompactCollection";
import { type Access, type Model, type ModelFilters } from "../../domain/registry";
import ModelBrowser from "./ModelBrowser";
import { prefillFromReference } from "./model-editor-data";
import { filterReferenceGroups, filterReferenceModels, groupReferenceModels, sharedReferenceFacts, type ReferenceGroup } from "./reference-groups";
import { cardFormat, gridColumns, type ViewOptions } from "../../components/registry/ViewOptions";
import { useCopy } from "../../lib/locale";

const known = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const unique = (items: string[]) => [...new Set(items)];
const factValue = (value: unknown) => value == null ? "Unknown" : typeof value === "string" ? value || '""' : JSON.stringify(value);
const factDate = (date?: string | null) => date ? new Date(date).toLocaleString() : "date unknown";
const price = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 6 }).format(value)} $/M` : "inconnu";
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
  const grouped: Access[] = group.entries.flatMap(({ access, catalogAccess }) => {
    if (!access) return [];
    const saved = registered ? base.accesses.find(row => row.provider === access.provider && row.nativeModel === access.nativeModel) : undefined;
    return [{ ...access, ...saved, id: `${access.provider}/${base.id}`, referenceId: saved ? saved.referenceId : access.referenceId ?? catalogAccess?.referenceId }];
  });
  const accesses = registered ? [...base.accesses.filter(access => !grouped.some(row => row.provider === access.provider)), ...grouped] : grouped;
  const draft: Model = {
    ...base,
    name: registered ? base.name : nameOf(group),
    creator: registered ? base.creator : known(group.reference?.fields.creator?.value) ? group.reference.fields.creator.value : base.creator,
    family: registered ? base.family : known(group.reference?.fields.family?.value) ? group.reference.fields.family.value : base.family,
    accesses,
  };
  if (registered || !group.reference) return draft;
  return prefillFromReference(draft, group.reference);
}

export default function ReferenceCatalogBrowser({ revision, models, registeredIds, registeredModels, preferences, onOpen, onMetadata, onUnauthorized }: { revision: string; models: Model[]; registeredIds: ReadonlySet<string>; registeredModels?: Model[]; preferences: ViewOptions; onOpen: (model: Model) => void; onMetadata: (target: "reference" | "access", id: string) => void; onUnauthorized: () => void }) {
  const copy = useCopy();
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
    const base = registeredModels?.find(model => model.id === registered[0]) ?? complete.entries.find(entry => entry.model.id === (registered[0] || ids[0]))?.model;
    const conflict = base && registered.length === 1 && complete.entries.some(entry => entry.access && base.accesses.some(access => access.provider === entry.access?.provider && access.nativeModel !== entry.access.nativeModel));
    if (registered.length > 1 || unique(providers).length !== providers.length || conflict || (!registered.length && ids.length > 1)) { setChoice(complete); return; }
    if (base) onOpen(draftFor(complete, base, registeredIds.has(base.id)));
  };

  const render = (filtered: Model[], view: ViewOptions, groupBy: string, filters: ModelFilters) => {
    if (!catalog) return <div role="status" className="rounded-sm border p-5 text-sm text-muted-foreground">{copy("Loading model cards…", "Chargement des fiches…")}</div>;
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
      return count === group.entries.length ? "Fiche Registry enregistrée" : count ? "Fiche Registry partielle" : "Fiche Registry à créer";
    };
    const accessLine = (group: ReferenceGroup) => <div className="space-y-1.5">{group.entries.map(({ model, access, catalogAccess }, index) => <div key={`${model.id}/${access?.id || index}`} className="space-y-1 text-xs">
      <div className="flex flex-wrap items-center gap-1.5"><Badge variant="outline">{access ? displayProvider(access.provider) : copy("No provider access", "Aucun accès fournisseur")}</Badge>{access && <span className={access.status === "Configured" ? "text-chart-success" : "text-muted-foreground"}>{access.status === "Configured" ? copy("Configured", "Configuré") : copy("Configuration unknown", "Configuration inconnue")}</span>}{catalogAccess?.matchConflict && <span className="text-destructive">{copy("Match conflict", "Conflit de correspondance")}</span>}</div>
      {access && view.evidence && (catalogAccess?.fields.input_cost_usd_per_million || catalogAccess?.fields.output_cost_usd_per_million) && <span className="block text-muted-foreground">{copy("Documented pricing", "Tarifs documentés")} · {copy("Input", "Entrée")} {price(catalogAccess?.fields.input_cost_usd_per_million?.value)} · {copy("Output", "Sortie")} {price(catalogAccess?.fields.output_cost_usd_per_million?.value)}</span>}
    </div>)}</div>;
    const factLines = (fields: Record<string, { value: unknown; source: string; kind: string; updatedAt: string | null }>) => Object.entries(fields).map(([field, fact]) => <p key={field}><strong>{field.replaceAll("_", " ")}:</strong> {factValue(fact.value)} · {fact.source} · {fact.kind} · {factDate(fact.updatedAt)}</p>);
    const details = (group: ReferenceGroup) => <details className="min-w-0 text-xs text-muted-foreground"><summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-primary">{copy("Access IDs, matching and sources", "Identifiants, correspondances et sources")}</summary><div className="mt-2 space-y-3 break-all">
      <p>{copy("Registry status", "État Registry")}: {status(group)}</p>
      {group.reference && <div className="space-y-1"><p className="font-mono">Reference: {group.reference.id}</p>{factLines(group.reference.fields)}<Button variant="ghost" size="sm" onClick={() => onMetadata("reference", group.reference!.id)}>{copy("Reference metadata", "Métadonnées de référence")}</Button></div>}
      {group.entries.map(({ model, access, catalogAccess }, index) => <div key={`${model.id}/${access?.id || index}`} className="space-y-1 border-t pt-2"><p className="font-mono">Model: {model.id}</p>{access && <><p className="font-mono">Workspace access: {access.id}</p><p className="font-mono">Native model: {access.nativeModel || "Unknown"}</p><p>{copy("Bifrost access", "Accès Bifrost")}: {access.status === "Configured" ? copy("Configured", "Configuré") : copy("Unknown", "Inconnu")}</p></>}{catalogAccess && <><p className="font-mono">Catalog access: {catalogAccess.id}</p><p>{copy("Reference match", "Correspondance de référence")}: {catalogAccess.referenceId || copy("None", "Aucune")} · {catalogAccess.mappingManual ? copy("chosen", "choisie") : copy("suggested", "suggérée")}</p>{catalogAccess.matchConflict && <p className="text-destructive">{catalogAccess.matchConflict}</p>}{factLines(catalogAccess.fields)}<Button variant="ghost" size="sm" onClick={() => onMetadata("access", catalogAccess.id)}>{copy("Access metadata", "Métadonnées d’accès")}</Button></>}</div>)}
    </div></details>;
    const accessMenu = (group: ReferenceGroup) => <Popover><PopoverTrigger asChild><Button size="sm" variant="ghost" className="h-8 px-2 text-xs">{copy("Accesses", "Accès")} · {group.entries.filter(entry => entry.access).length}</Button></PopoverTrigger><PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] space-y-2 p-3"><h3 className="text-sm font-semibold">{copy("Provider accesses", "Accès fournisseurs")}</h3>{accessLine(group)}{details(group)}{status(group) === "Fiche Registry à créer" && <Button size="sm" className="w-full" onClick={() => open(group)}>{copy("Register model", "Enregistrer le modèle")}</Button>}</PopoverContent></Popover>;
    const header = (group: ReferenceGroup) => {
      const saved = registeredModels?.filter(model => group.entries.some(entry => entry.model.id === model.id));
      const registered = saved?.length === 1 ? saved[0] : undefined;
      const creator = registered?.creator ?? creatorOf(group);
      const family = registered?.family ?? familyOf(group);
      return <div className="flex min-w-0 items-start gap-2"><BrandIcon model={{ ...group.entries[0].model, creator, accesses: group.entries.flatMap(entry => entry.access ? [entry.access] : []) }} mode={view.logo} /><div className="min-w-0 flex-1"><button type="button" className="block w-full truncate rounded-sm text-left text-sm font-semibold leading-snug hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={registered?.name ?? nameOf(group)} aria-label={copy(`Open ${registered?.name ?? nameOf(group)} details`, `Ouvrir la fiche ${registered?.name ?? nameOf(group)}`)} onClick={() => open(group)}>{registered?.name ?? nameOf(group)}</button>{view.metadata && <p className="mt-1 truncate text-xs text-muted-foreground">{creator}{family && ` · ${family}`}</p>}{view.metadata && <p className="truncate font-mono text-xs text-muted-foreground" title={group.reference?.id || group.entries[0].model.id}>{group.reference?.id || group.entries[0].model.id}</p>}</div></div>;
    };
    const card = (group: ReferenceGroup) => {
      const first = group.entries[0].model;
      const common = sharedReferenceFacts(group);
      const format = cardFormat(view);
      return <CatalogCard key={group.key} format={format} dataTour={group === groups[0] ? "first-model" : undefined}
        header={header(group)}
        footer={<>{view.providers && <ProviderSummary ids={group.entries.flatMap(entry => entry.access ? [entry.access.provider] : [])} />}{accessMenu(group)}</>}>
        {view.description && (common.summary && first.summary ? <p className="line-clamp-2 text-xs leading-relaxed text-foreground/80" title={first.summary}>{first.summary}</p> : !common.summary ? <p className="text-xs text-muted-foreground">{copy("Descriptions vary by access", "Descriptions variables selon les accès")}</p> : null)}
        {view.modalities && (common.modalities ? <ModelModalitiesSummary model={first} stacked={format === "square"} /> : <p className="text-xs text-muted-foreground">{copy("Modalities vary by access", "Modalités variables selon les accès")}</p>)}
        {view.evidence && (common.capabilities ? <ModelCapabilitiesSummary model={first} stacked={format === "square"} /> : <p className="text-xs text-muted-foreground">{copy("Capabilities vary by access", "Capacités variables selon les accès")}</p>)}
      </CatalogCard>;
    };
    return <div className="space-y-4"><Tooltip><TooltipTrigger asChild><button type="button" className="w-fit cursor-help rounded-sm text-left text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">{copy(`${shown.length} of ${groups.length} reference models shown · ${registeredIds.size} Registry cards saved`, `${shown.length} modèles de référence affichés sur ${groups.length} · ${registeredIds.size} fiches Registry enregistrées`)}</button></TooltipTrigger><TooltipContent className="max-w-xs">{copy("Reference models are the catalogue rows grouped by shared identity and accesses. Registry cards are the logical models saved in this workspace.", "Les modèles de référence sont les lignes du catalogue regroupées par identité et accès partagés. Les fiches Registry sont les modèles logiques enregistrés dans cet espace.")}</TooltipContent></Tooltip>{[...sections.entries()].map(([section, items]) => <section key={section || "all"} className="space-y-3">{section && <h3 className="text-base font-semibold">{section} <span className="text-sm font-normal text-muted-foreground">{items.length}</span></h3>}{view.layout === "grid" ? <CatalogGrid format={cardFormat(view)} columns={gridColumns(view.size)}>{items.map(card)}</CatalogGrid> : <div className="min-w-0 max-w-full overflow-x-auto rounded-sm border bg-card"><Table><TableHeader className="bg-muted/50"><TableRow><TableHead className="sticky left-0 z-20 bg-muted">{copy("Model", "Modèle")}</TableHead>{view.providers && <TableHead>{copy("Providers", "Fournisseurs")}</TableHead>}{view.modalities && <TableHead>{copy("Inputs → outputs", "Entrées → sorties")}</TableHead>}{view.evidence && <TableHead>{copy("Capabilities", "Capacités")}</TableHead>}<TableHead className="text-right">{copy("Action", "Action")}</TableHead></TableRow></TableHeader><TableBody>{items.map(group => { const first = group.entries[0].model; const common = sharedReferenceFacts(group); return <TableRow key={group.key} data-tour={group === groups[0] ? "first-model" : undefined}><TableCell className="sticky left-0 z-10 min-w-52 max-w-72 whitespace-normal bg-card"><div className="flex items-center gap-2">{header(group)}</div>{view.description && common.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{first.summary}</p>}{view.metadata && <div className="mt-2">{details(group)}</div>}</TableCell>{view.providers && <TableCell className="min-w-40 align-top">{accessLine(group)}</TableCell>}{view.modalities && <TableCell className="align-top">{common.modalities ? <ModelModalitiesSummary model={first} /> : copy("Varies", "Variable")}</TableCell>}{view.evidence && <TableCell className="align-top">{common.capabilities ? <ModelCapabilitiesSummary model={first} /> : copy("Varies", "Variable")}</TableCell>}<TableCell className="text-right align-top"><Button size="sm" variant="outline" onClick={() => open(group)}>{copy(status(group) === "Fiche Registry à créer" ? "Register" : "Details", status(group) === "Fiche Registry à créer" ? "Enregistrer" : "Détails")}</Button></TableCell></TableRow>; })}</TableBody></Table></div>}</section>)}{shown.length < groups.length && <Button variant="outline" onClick={() => setVisibleCount(count => count + 60)}>{copy(`Show more (${groups.length - shown.length})`, `Voir plus (${groups.length - shown.length})`)}</Button>}</div>;
  };

  if (error) return <div className="space-y-3"><div role="alert" className="flex flex-wrap items-center gap-2 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">{copy(`Model details unavailable: ${error}. Your known models are still available.`, `Détails des modèles indisponibles : ${error}. Vos modèles connus restent disponibles.`)} <Button variant="outline" size="sm" onClick={() => void load()}>{copy("Retry", "Réessayer")}</Button></div><ModelBrowser models={models} registeredIds={registeredIds} preferences={preferences} onOpen={onOpen} tourFirst /></div>;
  return <><ModelBrowser models={models} registeredIds={registeredIds} preferences={preferences} onOpen={onOpen} filter={(rows, filters) => catalog ? filterReferenceModels(rows, catalog, filters) : rows} renderResults={render} tourFirst />
    <Dialog open={!!choice} onOpenChange={open => { if (!open) setChoice(null); }}><DialogContent><DialogHeader><DialogTitle>{copy("Choose the model identifier", "Choisir l’identifiant du modèle")}</DialogTitle><DialogDescription>{choice && unique(choice.entries.map(entry => entry.model.id)).filter(id => registeredIds.has(id)).length > 1 ? copy("These accesses already belong to distinct registered models. Open one card without changing the others.", "Ces accès appartiennent déjà à des modèles enregistrés distincts. Ouvrez une fiche sans modifier les autres.") : copy("Choose the exposed identifier. Conflicting provider accesses stay in separate cards.", "Choisissez l’identifiant exposé. Les accès fournisseurs en conflit restent dans des fiches séparées.")}</DialogDescription></DialogHeader><div className="space-y-2">{choice && unique(choice.entries.map(entry => entry.model.id)).map(id => { const base = registeredModels?.find(model => model.id === id) ?? choice.entries.find(entry => entry.model.id === id)!.model; const existing = unique(choice.entries.map(entry => entry.model.id)).filter(value => registeredIds.has(value)); const grouped = choice.entries.flatMap(entry => entry.access ? [entry.access] : []); const duplicateProvider = unique(grouped.map(access => access.provider)).length !== grouped.length; const conflict = registeredIds.has(id) && grouped.some(row => base.accesses.some(access => access.provider === row.provider && access.nativeModel !== row.nativeModel)); const canCombine = existing.length <= 1 && !duplicateProvider && !conflict && (!existing.length || existing[0] === id); return <Button key={id} variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => { onOpen(canCombine ? draftFor(choice, base, registeredIds.has(id)) : base); setChoice(null); }}>{id}{registeredIds.has(id) ? " · enregistré" : " · nouveau"}{!canCombine ? " · ouvre séparément" : " · regroupe les accès"}</Button>; })}</div></DialogContent></Dialog>
  </>;
}
