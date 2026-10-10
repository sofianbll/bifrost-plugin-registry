import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CatalogCard, CatalogGrid } from "@/components/registry/CatalogCard";
import { ModelCapabilitiesSummary, ModelModalitiesSummary } from "@/components/registry/model-capabilities";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { fieldLabel, sourceLabel, type Catalog } from "./catalog-api";
import { BrandIcon, displayProvider } from "../../components/registry/BrandIcon";
import { ProviderSummary } from "../../components/registry/CompactCollection";
import { creatorKey, type Access, type Model, type ModelFilters } from "../../domain/registry";
import ModelBrowser from "./ModelBrowser";
import { declaredEndpoints, prefillFromReference } from "./model-editor-data";
import { cardEntries, filterReferenceGroups, filterReferenceModels, groupReferenceModels, sharedReferenceFacts, type ReferenceGroup } from "./reference-groups";
import { cardFormat, gridColumns, type ViewOptions } from "../../components/registry/ViewOptions";
import { useCopy, useCreatorName, useFormat, useTerm } from "../../lib/locale";

const known = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const unique = (items: string[]) => [...new Set(items)];
const nameOf = (group: ReferenceGroup) => known(group.reference?.fields.name?.value) ? group.reference.fields.name.value : group.entries[0]?.model.name || group.key;
// A saved card's own creator, else its reference's, else a grouped model's; "Unknown" is missing.
const creatorOf = (group: ReferenceGroup, saved?: Model) => [saved?.creator, group.reference?.fields.creator?.value, ...group.entries.map(entry => entry.model.creator)].map(creatorKey).find(creator => creator !== "Unknown") ?? "Unknown";
const familyOf = (group: ReferenceGroup) => {
  const family = known(group.reference?.fields.family?.value) ? group.reference.fields.family.value : group.entries[0]?.model.family;
  return family && family !== "Unknown" ? family : "";
};

// A new card from discovered accesses; a saved card opens as saved, never through here. The editor
// uses provider/common-ID for exposed IDs. Native IDs remain on each access, and each access starts
// with the operations its native mode implies.
export function draftFor(group: ReferenceGroup, base: Model): Model {
  const accesses: Access[] = group.entries.flatMap(({ access, catalogAccess }) => access ? [{ ...access, id: `${access.provider}/${base.id}`, referenceId: access.referenceId ?? catalogAccess?.referenceId, endpoints: access.endpoints?.length ? access.endpoints : declaredEndpoints(catalogAccess) }] : []);
  const draft: Model = {
    ...base,
    name: nameOf(group),
    creator: known(group.reference?.fields.creator?.value) ? group.reference.fields.creator.value : base.creator,
    family: known(group.reference?.fields.family?.value) ? group.reference.fields.family.value : base.family,
    accesses,
  };
  return group.reference ? prefillFromReference(draft, group.reference) : draft;
}

// models: the scope being browsed (saved cards, or To add); allModels: both, so a card still knows
// the accesses available beside it. The catalogue is loaded once per revision by the app.
export default function ReferenceCatalogBrowser({ models, allModels, catalog, error, onRetry, registeredIds, registeredModels, preferences, onOpen, onMetadata }: { models: Model[]; allModels: Model[]; catalog: Catalog | null; error: string; onRetry: () => void; registeredIds: ReadonlySet<string>; registeredModels: Model[]; preferences: ViewOptions; onOpen: (model: Model) => void; onMetadata: (target: "reference" | "access", id: string) => void }) {
  const copy = useCopy();
  const format = useFormat();
  const term = useTerm();
  const creatorName = useCreatorName();
  const [visibleCount, setVisibleCount] = useState(60);
  const [choice, setChoice] = useState<ReferenceGroup | null>(null);

  const open = (group: ReferenceGroup) => {
    if (!catalog) return;
    // Use the complete exact group, across scopes; a scope or a provider filter only narrows the visible card.
    const complete = groupReferenceModels(allModels, catalog).find(row => row.key === group.key) || group;
    const ids = unique(complete.entries.map(entry => entry.model.id));
    const registered = ids.filter(id => registeredIds.has(id));
    const providers = complete.entries.flatMap(entry => entry.access ? [entry.access.provider] : []);
    const base = registeredModels.find(model => model.id === registered[0]) ?? complete.entries.find(entry => entry.model.id === (registered[0] || ids[0]))?.model;
    const conflict = base && registered.length === 1 && complete.entries.some(entry => entry.access && base.accesses.some(access => access.provider === entry.access?.provider && access.nativeModel !== entry.access.nativeModel));
    if (registered.length > 1 || unique(providers).length !== providers.length || conflict || (!registered.length && ids.length > 1)) { setChoice(complete); return; }
    if (base) onOpen(registeredIds.has(base.id) ? base : draftFor(complete, base));
  };

  const render = (filtered: Model[], view: ViewOptions, groupBy: string, filters: ModelFilters) => {
    if (!catalog) return <div role="status" aria-label={copy("Loading model cards…", "Chargement des fiches…")}><CatalogGrid format={cardFormat(view)} columns={gridColumns(view.size)}>{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-36" />)}</CatalogGrid></div>;
    const groups = filterReferenceGroups(filtered, catalog, filters);
    const full = new Map(groupReferenceModels(allModels, catalog).map(group => [group.key, group]));
    const shown = groups.slice(0, visibleCount);
    const sections = new Map<string, ReferenceGroup[]>();
    for (const group of shown) {
      const label = groupBy === "provider" ? displayProvider(group.entries.find(entry => entry.access)?.access?.provider || copy("Unknown provider", "Fournisseur inconnu"))
        : groupBy === "creator" ? creatorName(creatorOf(group))
        : groupBy === "task" ? term(group.entries[0]?.model.tasks[0] || copy("Other", "Autre")) : "";
      sections.set(label, [...(sections.get(label) || []), group]);
    }

    // A visible card holds only its scope's entries. Status and the accesses available beside a
    // saved card come from the complete group: partial = a saved card does not hold every access.
    const isCard = (group: ReferenceGroup) => cardEntries(group, registeredModels).card.length > 0;
    const availableBeside = (group: ReferenceGroup) => isCard(group) ? cardEntries(full.get(group.key) ?? group, registeredModels).available : [];
    const status = (group: ReferenceGroup) => {
      const whole = full.get(group.key) ?? group;
      const count = cardEntries(whole, registeredModels).card.length;
      return count === whole.entries.length ? "registered" : count ? "partial" : "to-create";
    };
    const statusBadge = (group: ReferenceGroup) => {
      const state = status(group);
      const variant = ({ registered: "success", partial: "warning", "to-create": "outline" } as const)[state];
      return <Badge variant={variant} title={statusLabel(group)} className="shrink-0">{{ registered: copy("Saved", "Enregistrée"), partial: copy("Partial", "Partielle"), "to-create": copy("Not saved", "Non enregistrée") }[state]}</Badge>;
    };
    const statusLabel = (group: ReferenceGroup) => ({
      registered: copy("Registry record saved", "Fiche Registry enregistrée"),
      partial: copy("Partial Registry record", "Fiche Registry partielle"),
      "to-create": copy("Registry record to create", "Fiche Registry à créer"),
    })[status(group)];
    const accessLine = (entries: ReferenceGroup["entries"], facts = view.evidence) => <div className="space-y-1.5">{entries.map(({ model, access, catalogAccess }, index) => <div key={`${model.id}/${access?.id || index}`} className="space-y-1 text-xs">
      <div className="flex flex-wrap items-center gap-1.5"><Badge variant="outline">{access ? displayProvider(access.provider) : copy("No provider access", "Aucun accès fournisseur")}</Badge>{access && <span className={access.status === "Configured" ? "text-chart-success" : "text-muted-foreground"}>{access.status === "Configured" ? copy("Configured", "Configuré") : copy("Configuration unknown", "Configuration inconnue")}</span>}{catalogAccess?.matchConflict && <span className="text-destructive">{copy("Match conflict", "Conflit de correspondance")}</span>}</div>
      {access?.nativeModel && facts && <code className="block break-all text-muted-foreground">{access.nativeModel}</code>}
      {access && facts && (catalogAccess?.fields.input_cost_usd_per_million || catalogAccess?.fields.output_cost_usd_per_million) && <span className="block text-muted-foreground">{copy("Documented pricing", "Tarifs documentés")} · {copy("Input", "Entrée")} {format.price(catalogAccess?.fields.input_cost_usd_per_million?.value)} · {copy("Output", "Sortie")} {format.price(catalogAccess?.fields.output_cost_usd_per_million?.value)}</span>}
    </div>)}</div>;
    const factLines = (fields: Record<string, { value: unknown; source: string; kind: string; updatedAt: string | null }>) => Object.entries(fields).map(([field, fact]) => <p key={field}><strong>{fieldLabel(field, copy)}:</strong> {format.value(fact.value)} · {sourceLabel(fact.source, copy)} · {fact.kind === "observed" ? copy("observed", "observé") : copy("declared", "déclaré")} · {fact.updatedAt ? format.date(fact.updatedAt) : copy("date unknown", "date inconnue")}</p>);
    const details = (group: ReferenceGroup, entries = group.entries) => <details className="min-w-0 text-xs text-muted-foreground"><summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-primary">{copy("Access IDs, matching and sources", "Identifiants, correspondances et sources")}</summary><div className="mt-2 space-y-3 break-all">
      <p>{copy("Registry status", "État Registry")}: {statusLabel(group)}</p>
      {group.reference && <div className="space-y-1"><p className="font-mono">{copy("Reference", "Fiche documentaire")}: {group.reference.id}</p>{factLines(group.reference.fields)}<Button variant="ghost" size="sm" onClick={() => onMetadata("reference", group.reference!.id)}>{copy("Reference metadata", "Métadonnées de référence")}</Button></div>}
      {entries.map(({ model, access, catalogAccess }, index) => <div key={`${model.id}/${access?.id || index}`} className="space-y-1 border-t pt-2"><p className="font-mono">{copy("Model", "Modèle")}: {model.id}</p>{access && <><p className="font-mono">{copy("Workspace access", "Accès Registry")}: {access.id}</p><p className="font-mono">{copy("Native model", "Modèle natif")}: {access.nativeModel || copy("Unknown", "Inconnu")}</p><p>{copy("Bifrost access", "Accès Bifrost")}: {access.status === "Configured" ? copy("Configured", "Configuré") : copy("Unknown", "Inconnu")}</p></>}{catalogAccess && <><p className="font-mono">{copy("Catalog access", "Accès du catalogue")}: {catalogAccess.id}</p><p>{copy("Reference match", "Correspondance de référence")}: {catalogAccess.referenceId || copy("None", "Aucune")} · {catalogAccess.mappingManual ? copy("chosen", "choisie") : copy("suggested", "suggérée")}</p>{catalogAccess.matchConflict && <p className="text-destructive">{catalogAccess.matchConflict}</p>}{factLines(catalogAccess.fields)}<Button variant="ghost" size="sm" onClick={() => onMetadata("access", catalogAccess.id)}>{copy("Access metadata", "Métadonnées d’accès")}</Button></>}</div>)}
    </div></details>;
    const accessMenu = (group: ReferenceGroup) => {
      const available = availableBeside(group);
      const part = (title: string, entries: ReferenceGroup["entries"]) => <section className="space-y-1.5"><h4 className="text-xs font-medium text-muted-foreground">{title} · {entries.length}</h4>{accessLine(entries, true)}</section>;
      return <Popover><PopoverTrigger asChild><Button size="sm" variant="ghost" className="h-8 px-2 text-xs">{copy("Accesses", "Accès")} · {group.entries.filter(entry => entry.access).length}{available.length > 0 && <span className="ml-1 text-muted-foreground">+{available.length}<span className="sr-only"> {copy("available", "disponibles")}</span></span>}</Button></PopoverTrigger><PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] space-y-2 p-3"><h3 className="text-sm font-semibold">{copy("Provider accesses", "Accès fournisseurs")}</h3>{isCard(group) ? <>{part(copy("In this card", "Dans cette fiche"), group.entries)}{available.length > 0 && part(copy("Available, not in this card", "Disponibles, hors de cette fiche"), available)}</> : accessLine(group.entries, true)}{details(full.get(group.key) ?? group)}{status(group) === "to-create" && <Button size="sm" className="w-full" onClick={() => open(group)}>{copy("Register model", "Enregistrer le modèle")}</Button>}</PopoverContent></Popover>;
    };
    const header = (group: ReferenceGroup) => {
      const saved = registeredModels.filter(model => group.entries.some(entry => entry.model.id === model.id));
      const registered = saved?.length === 1 ? saved[0] : undefined;
      const creator = creatorName(creatorOf(group, registered));
      const family = registered?.family && registered.family !== "Unknown" ? registered.family : familyOf(group);
      // A saved name equal to the common ID is a slug: the reference name reads better, the ID stays below.
      const name = registered?.name && registered.name !== registered.id ? registered.name : nameOf(group);
      // A saved card reads its common ID; a model to add, the exact native IDs it would bring.
      const idLine = registered?.id ?? (unique(group.entries.flatMap(entry => entry.access?.nativeModel ? [entry.access.nativeModel] : [])).join(" · ") || group.entries[0].model.id);
      return <div className="flex min-w-0 items-start gap-2"><BrandIcon model={{ ...group.entries[0].model, creator, accesses: group.entries.flatMap(entry => entry.access ? [entry.access] : []) }} mode={view.logo} /><div className="min-w-0 flex-1"><button type="button" className="block w-full truncate rounded-sm text-left text-sm font-semibold leading-snug hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={name} aria-label={copy(`Open ${name} details`, `Ouvrir la fiche ${name}`)} onClick={() => open(group)}>{name}</button>{view.metadata && <p className="mt-1 truncate text-xs text-muted-foreground">{creator}{family && ` · ${family}`}</p>}{view.metadata && idLine !== name && <p className="truncate font-mono text-xs text-muted-foreground" title={idLine}>{idLine}</p>}</div>{statusBadge(group)}</div>;
    };
    const card = (group: ReferenceGroup) => {
      const entries = group.entries;
      const first = entries[0].model;
      const common = sharedReferenceFacts({ ...group, entries });
      const format = cardFormat(view);
      return <CatalogCard key={group.key} format={format} dataTour={group === groups[0] ? "first-model" : undefined}
        header={header(group)}
        footer={<>{view.providers && <ProviderSummary ids={entries.flatMap(entry => entry.access ? [entry.access.provider] : [])} />}{accessMenu(group)}</>}>
        {view.description && (common.summary && first.summary ? <p className="line-clamp-2 text-xs leading-relaxed text-foreground/80" title={first.summary}>{first.summary}</p> : !common.summary ? <p className="text-xs text-muted-foreground">{copy("Descriptions vary by access", "Descriptions variables selon les accès")}</p> : null)}
        {view.modalities && (common.modalities ? <ModelModalitiesSummary model={first} stacked={format === "square"} /> : <p className="text-xs text-muted-foreground">{copy("Modalities vary by access", "Modalités variables selon les accès")}</p>)}
        {view.evidence && (common.capabilities ? <ModelCapabilitiesSummary model={first} stacked={format === "square"} /> : <p className="text-xs text-muted-foreground">{copy("Capabilities vary by access", "Capacités variables selon les accès")}</p>)}
      </CatalogCard>;
    };
    return <div className="space-y-4"><p className="text-xs text-muted-foreground">{copy(`${shown.length} of ${groups.length} shown`, `${shown.length} affichés sur ${groups.length}`)}</p>{[...sections.entries()].map(([section, items]) => <section key={section || "all"} className="space-y-3">{section && <h3 className="text-base font-semibold">{section} <span className="text-sm font-normal text-muted-foreground">{items.length}</span></h3>}{view.layout === "grid" ? <CatalogGrid format={cardFormat(view)} columns={gridColumns(view.size)}>{items.map(card)}</CatalogGrid> : <div className="min-w-0 max-w-full overflow-x-auto rounded-sm border bg-card"><Table><TableHeader className="bg-muted/50"><TableRow><TableHead className="sticky left-0 z-20 bg-muted">{copy("Model", "Modèle")}</TableHead>{view.providers && <TableHead>{copy("Providers", "Fournisseurs")}</TableHead>}{view.modalities && <TableHead>{copy("Inputs → outputs", "Entrées → sorties")}</TableHead>}{view.evidence && <TableHead>{copy("Capabilities", "Capacités")}</TableHead>}<TableHead className="text-right">{copy("Action", "Action")}</TableHead></TableRow></TableHeader><TableBody>{items.map(group => { const entries = group.entries; const first = entries[0].model; const common = sharedReferenceFacts(group); const others = availableBeside(group).length; return <TableRow key={group.key} data-tour={group === groups[0] ? "first-model" : undefined}><TableCell className="sticky left-0 z-10 min-w-52 max-w-72 whitespace-normal bg-card"><div className="flex items-center gap-2">{header(group)}</div>{view.description && common.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{first.summary}</p>}{view.metadata && <div className="mt-2">{details(group, entries)}</div>}</TableCell>{view.providers && <TableCell className="min-w-40 align-top">{accessLine(entries)}{others > 0 && <p className="mt-1.5 text-xs text-muted-foreground">{copy(`${others} available, not in this card`, `${others} disponible${others > 1 ? "s" : ""}, hors de cette fiche`)}</p>}</TableCell>}{view.modalities && <TableCell className="align-top">{common.modalities ? <ModelModalitiesSummary model={first} /> : copy("Varies", "Variable")}</TableCell>}{view.evidence && <TableCell className="align-top">{common.capabilities ? <ModelCapabilitiesSummary model={first} /> : copy("Varies", "Variable")}</TableCell>}<TableCell className="text-right align-top"><Button size="sm" variant="outline" onClick={() => open(group)}>{copy(status(group) === "to-create" ? "Register" : "Details", status(group) === "to-create" ? "Enregistrer" : "Détails")}</Button></TableCell></TableRow>; })}</TableBody></Table></div>}</section>)}{shown.length < groups.length && <Button variant="outline" onClick={() => setVisibleCount(count => count + 60)}>{copy(`Show more (${groups.length - shown.length})`, `Voir plus (${groups.length - shown.length})`)}</Button>}</div>;
  };

  if (error && !catalog) return <div className="space-y-3"><div role="alert" className="flex flex-wrap items-center gap-2 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">{copy(`Model details unavailable: ${error}. Your known models are still available.`, `Détails des modèles indisponibles : ${error}. Vos modèles connus restent disponibles.`)} <Button variant="outline" size="sm" onClick={onRetry}>{copy("Retry", "Réessayer")}</Button></div><ModelBrowser models={models} registeredIds={registeredIds} preferences={preferences} onOpen={onOpen} tourFirst stateKey="models" /></div>;
  return <><ModelBrowser models={models} registeredIds={registeredIds} preferences={preferences} onOpen={onOpen} filter={(rows, filters) => catalog ? filterReferenceModels(rows, catalog, filters) : rows} renderResults={render} tourFirst stateKey="models" />
    <Dialog open={!!choice} onOpenChange={open => { if (!open) setChoice(null); }}><DialogContent><DialogHeader><DialogTitle>{copy("Choose the model identifier", "Choisir l’identifiant du modèle")}</DialogTitle><DialogDescription>{choice && unique(choice.entries.map(entry => entry.model.id)).filter(id => registeredIds.has(id)).length > 1 ? copy("These accesses already belong to distinct registered models. Open one card without changing the others.", "Ces accès appartiennent déjà à des modèles enregistrés distincts. Ouvrez une fiche sans modifier les autres.") : copy("Choose the exposed identifier. Conflicting provider accesses stay in separate cards.", "Choisissez l’identifiant exposé. Les accès fournisseurs en conflit restent dans des fiches séparées.")}</DialogDescription></DialogHeader><div className="space-y-2">{choice && unique(choice.entries.map(entry => entry.model.id)).map(id => { const base = registeredModels.find(model => model.id === id) ?? choice.entries.find(entry => entry.model.id === id)!.model; const existing = unique(choice.entries.map(entry => entry.model.id)).filter(value => registeredIds.has(value)); const grouped = choice.entries.flatMap(entry => entry.access ? [entry.access] : []); const duplicateProvider = unique(grouped.map(access => access.provider)).length !== grouped.length; const combine = existing.length === 0 && !duplicateProvider; return <Button key={id} variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => { onOpen(combine ? draftFor(choice, base) : base); setChoice(null); }}>{id}{registeredIds.has(id) ? copy(" · saved", " · enregistré") : copy(" · new", " · nouveau")}{!combine ? copy(" · opens separately", " · ouvre séparément") : copy(" · combines the accesses", " · regroupe les accès")}</Button>; })}</div></DialogContent></Dialog>
  </>;
}
