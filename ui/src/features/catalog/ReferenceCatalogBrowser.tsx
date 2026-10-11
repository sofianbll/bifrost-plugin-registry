import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionLabel, CatalogCard, CatalogGrid } from "@/components/registry/CatalogCard";
import { ModelAccessMenu } from "@/components/registry/ModelAccessMenu";
import { ModelCapabilitiesSummary, ModelModalitiesSummary } from "@/components/registry/model-capabilities";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { documentedPrice, type Catalog } from "./catalog-api";
import { BrandIcon, displayProvider } from "../../components/registry/BrandIcon";
import { ProviderSummary } from "../../components/registry/CompactCollection";
import { creatorKey, distinctLabels, knownValue, type Access, type Model, type ModelFilters } from "../../domain/registry";
import ModelBrowser from "./ModelBrowser";
import { FactLine } from "./FactLine";
import { AssociateReferenceDialog } from "./AssociateReference";
import { FactsUnknown, factsUnknown, hasReference } from "./card-identity";
import { declaredEndpoints, matchingAccesses, prefillFromReference } from "./model-editor-data";
import { attentionOf, cardEntries, cardName, cardsHolding, filterReferenceGroups, filterReferenceModels, groupReferenceModels, sharedReferenceFacts, type ReferenceGroup } from "./reference-groups";
import { cardFormat, gridColumns, type ViewOptions } from "../../components/registry/ViewOptions";
import { useCopy, useCreatorName, useFormat, useTerm } from "../../lib/locale";

const known = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const unique = (items: string[]) => [...new Set(items)];
const nameOf = (group: ReferenceGroup) => known(group.reference?.fields.name?.value) ? group.reference.fields.name.value : group.entries[0]?.model.name || group.key;
// A saved card's own creator, else its reference's, else a grouped model's; "Unknown" is missing.
const creatorOf = (group: ReferenceGroup, saved?: Model) => [saved?.creator, group.reference?.fields.creator?.value, ...group.entries.map(entry => entry.model.creator)].map(creatorKey).find(creator => creator !== "Unknown") ?? "Unknown";
const familyOf = (group: ReferenceGroup) => knownValue(group.reference?.fields.family?.value) || knownValue(group.entries[0]?.model.family);

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
// the accesses available beside it. In Registry shows one tile per saved card; To add groups by
// reference. The catalogue is loaded once per revision by the app.
export default function ReferenceCatalogBrowser({ scope, models, allModels, catalog, error, onRetry, registeredIds, registeredModels, preferences, onOpen, onMetadata, onAssociate }: { scope: "registry" | "to-add"; models: Model[]; allModels: Model[]; catalog: Catalog | null; error: string; onRetry: () => void; registeredIds: ReadonlySet<string>; registeredModels: Model[]; preferences: ViewOptions; onOpen: (model: Model, tab?: "access") => void; onMetadata: (target: "reference" | "access", id: string) => void; onAssociate: (model: Model, referenceId: string) => Promise<boolean> }) {
  const copy = useCopy();
  const format = useFormat();
  const { colon } = format;
  const term = useTerm();
  const creatorName = useCreatorName();
  const [visibleCount, setVisibleCount] = useState(60);
  const [choice, setChoice] = useState<ReferenceGroup | null>(null);
  const [associating, setAssociating] = useState<Model | null>(null);
  // A To add tile that fits several saved cards: the cards to choose from, and the tile.
  const [pick, setPick] = useState<{ cards: Model[]; group: ReferenceGroup } | null>(null);
  const byCard = scope === "registry";
  // The saved card an In Registry tile shows.
  const savedOf = (group: ReferenceGroup) => byCard ? registeredModels.find(model => model.id === group.entries[0]?.model.id) : undefined;
  // What the editor would offer a saved card as "Also available" among these entries: an access sharing
  // the reference is not offered when it is a variant ("-pro", "-fast") of another model.
  const offeredTo = (card: Model, entries: ReferenceGroup["entries"]) => {
    const offered = new Set(matchingAccesses(catalog?.accesses ?? [], card.id, card.accesses, registeredModels));
    return entries.filter(entry => entry.catalogAccess && offered.has(entry.catalogAccess));
  };
  // The saved cards a To add tile can join: they hold its model and the editor would offer them one of its accesses.
  const joinableCards = (whole: ReferenceGroup) => cardsHolding(whole, registeredModels).filter(card => offeredTo(card, cardEntries(whole, registeredModels).available).length > 0);

  const open = (group: ReferenceGroup) => {
    const saved = savedOf(group);
    if (saved) { onOpen(saved); return; }
    if (!catalog) return;
    // Use the complete exact group, across scopes; a scope or a provider filter only narrows the visible card.
    const complete = groupReferenceModels(allModels, catalog).find(row => row.key === group.key) || group;
    // A To add tile whose model a saved card already holds: open that card on its accesses, where
    // the access waits under "Also available" until the user adds it.
    const cards = byCard ? [] : joinableCards(complete);
    if (cards.length) { if (cards.length === 1) onOpen(cards[0], "access"); else setPick({ cards, group }); return; }
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
    const groups = filterReferenceGroups(filtered, catalog, filters, byCard);
    // Reference groups across both scopes: what a card has beside it, whether a model is partly saved.
    const full = new Map(groupReferenceModels(allModels, catalog).map(group => [group.key, group]));
    const shown = groups.slice(0, visibleCount);
    const sections = new Map<string, ReferenceGroup[]>();
    for (const group of shown) {
      const label = groupBy === "provider" ? displayProvider(group.entries.find(entry => entry.access)?.access?.provider || copy("Unknown provider", "Fournisseur inconnu"))
        : groupBy === "creator" ? creatorName(creatorOf(group))
        : groupBy === "task" ? term(group.entries[0]?.model.tasks[0] || copy("Other", "Autre")) : "";
      sections.set(label, [...(sections.get(label) || []), group]);
    }

    // The accesses no saved card holds that share one of its references are available beside it.
    const isCard = (group: ReferenceGroup) => !!savedOf(group);
    const availableBeside = (group: ReferenceGroup) => {
      const saved = savedOf(group);
      return saved ? offeredTo(saved, [...full.values()].filter(whole => cardEntries(whole, [saved]).card.length).flatMap(whole => cardEntries(whole, registeredModels).available)) : [];
    };
    const status = (group: ReferenceGroup) => isCard(group) ? "registered" : cardEntries(full.get(group.key) ?? group, registeredModels).card.length ? "partial" : "to-create";
    // The saved cards a To add tile can join (none for a saved card or a model no card holds).
    const joinable = (group: ReferenceGroup) => byCard ? [] : joinableCards(full.get(group.key) ?? group);
    // A card badge says what needs attention, never "saved": +N available, no reference... A To add
    // tile that fits a saved card says which. Each entry: key (data-attention), text, tooltip.
    const badges = (group: ReferenceGroup) => {
      const cards = joinable(group);
      if (cards.length) return [{ key: "add-to", text: cards.length === 1 ? copy(`Add to ${cardName(cards[0], catalog)}`, `Ajouter à ${cardName(cards[0], catalog)}`) : copy("Add to a card", "Ajouter à une fiche"), title: copy("A saved card already holds this model. Open it to add this access.", "Une fiche enregistrée détient déjà ce modèle. Ouvrez-la pour ajouter cet accès.") }];
      return (byCard ? attentionOf(group, availableBeside(group).length) : []).map(attention => attention.kind === "available"
        ? { key: attention.kind, text: copy(`+${attention.count} available`, `+${attention.count} disponible${attention.count > 1 ? "s" : ""}`), title: copy(`${attention.count} access${attention.count > 1 ? "es" : ""} available, not in this card`, `${attention.count} accès disponible${attention.count > 1 ? "s" : ""}, hors de cette fiche`) }
        : attention.kind === "inferred-creator" ? { key: attention.kind, text: copy("inferred creator", "créateur déduit"), title: copy("Guessed from the provider serving this model. Edit the card to correct or clear it.", "Déduit du fournisseur de ce modèle. Modifiez la fiche pour le corriger ou l’effacer.") }
        : { key: attention.kind, text: copy("no reference", "sans référence"), title: copy("No Models.dev reference is linked to this card", "Aucune fiche documentaire Models.dev n’est associée à cette fiche") });
    };
    const statusLabel = (group: ReferenceGroup) => ({
      registered: copy("Registry record saved", "Fiche Registry enregistrée"),
      partial: copy("Saved Registry record without this access", "Fiche Registry enregistrée sans cet accès"),
      "to-create": copy("Registry record to create", "Fiche Registry à créer"),
    })[status(group)];
    const accessLine = (entries: ReferenceGroup["entries"], facts = view.evidence, chosen = true) => <div className="space-y-1.5">{entries.map(({ model, access, catalogAccess }, index) => <div key={`${model.id}/${access?.id || index}`} className="space-y-1 text-xs">
      <div className="flex flex-wrap items-center gap-1.5"><Badge variant="outline">{access ? displayProvider(access.provider) : copy("No provider access", "Aucun accès fournisseur")}</Badge>{access && <span className={access.status === "Configured" && chosen ? "text-chart-success" : "text-muted-foreground"}>{access.status === "Configured" ? copy("Configured", "Configuré") : copy("Configuration unknown", "Configuration inconnue")}</span>}{catalogAccess?.matchConflict && <span className="text-destructive">{copy("Match conflict", "Conflit de correspondance")}</span>}</div>
      {access?.nativeModel && facts && <code className="block break-all text-muted-foreground">{access.nativeModel}</code>}
      {access && facts && catalogAccess && (catalogAccess.fields.input_cost_usd_per_million || catalogAccess.fields.output_cost_usd_per_million) && <span className="block text-muted-foreground">{copy("Documented pricing", "Tarifs documentés")} · {documentedPrice(catalogAccess.fields.input_cost_usd_per_million?.value, catalogAccess.fields.output_cost_usd_per_million?.value, copy, format.price)}</span>}
    </div>)}</div>;
    const factLines = (fields: Catalog["references"][number]["fields"]) => Object.entries(fields).map(([field, fact]) => <FactLine key={field} field={field} fact={fact} />);
    const details = (group: ReferenceGroup, entries = group.entries) => <details className="min-w-0 text-xs text-muted-foreground"><summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-primary">{copy("Access IDs, matching and sources", "Identifiants, correspondances et sources")}</summary><div className="mt-2 space-y-3 break-all">
      <p>{copy("Registry status", "État Registry")}{colon} {statusLabel(group)}</p>
      {group.reference && <div className="space-y-1"><p className="font-mono">{copy("Reference", "Fiche documentaire")}{colon} {group.reference.id}</p>{factLines(group.reference.fields)}<Button variant="ghost" size="sm" onClick={() => onMetadata("reference", group.reference!.id)}>{copy("Reference metadata", "Métadonnées de référence")}</Button></div>}
      {entries.map(({ model, access, catalogAccess }, index) => <div key={`${model.id}/${access?.id || index}`} className="space-y-1 border-t pt-2"><p className="font-mono">{copy("Model", "Modèle")}{colon} {model.id}</p>{access && <><p className="font-mono">{copy("Registry access", "Accès Registry")}{colon} {access.id}</p><p className="font-mono">{copy("Native model", "Modèle natif")}{colon} {access.nativeModel || copy("Unknown", "Inconnu")}</p><p>{copy("Bifrost access", "Accès Bifrost")}{colon} {access.status === "Configured" ? copy("Configured", "Configuré") : copy("Unknown", "Inconnu")}</p></>}{catalogAccess && <><p className="font-mono">{copy("Catalog access", "Accès du catalogue")}{colon} {catalogAccess.id}</p><p>{copy("Reference match", "Correspondance de référence")}{colon} {catalogAccess.referenceId || copy("None", "Aucune")} · {catalogAccess.mappingManual ? copy("chosen", "choisie") : copy("suggested", "suggérée")}</p>{catalogAccess.matchConflict && <p className="text-destructive">{catalogAccess.matchConflict}</p>}{factLines(catalogAccess.fields)}<Button variant="ghost" size="sm" onClick={() => onMetadata("access", catalogAccess.id)}>{copy("Access metadata", "Métadonnées d’accès")}</Button></>}</div>)}
    </div></details>;
    const accessMenu = (group: ReferenceGroup) => {
      const available = availableBeside(group);
      const part = (title: string, entries: ReferenceGroup["entries"], chosen = true) => <section className="space-y-1.5"><h4 className="text-xs font-medium text-muted-foreground">{title} · {entries.length}</h4>{accessLine(entries, true, chosen)}</section>;
      return <ModelAccessMenu model={group.entries[0].model} label={labelOf(group)} count={group.entries.filter(entry => entry.access).length} available={available.length}>{isCard(group) ? <>{part(copy("In this card", "Dans cette fiche"), group.entries)}{available.length > 0 && part(copy("Available, not in this card", "Disponibles, hors de cette fiche"), available, false)}</> : accessLine(group.entries, true)}{details(isCard(group) ? group : full.get(group.key) ?? group)}{status(group) === "to-create" && <Button size="sm" className="w-full" onClick={() => open(group)}>{copy("Register model", "Enregistrer le modèle")}</Button>}</ModelAccessMenu>;
    };
    const identity = (group: ReferenceGroup) => {
      const saved = registeredModels.filter(model => group.entries.some(entry => entry.model.id === model.id));
      // Only a saved card's own tile: a To add tile keeps its reference name and native IDs although its
      // namespace-free common ID can equal a saved card's.
      const registered = byCard && saved.length === 1 ? saved[0] : undefined;
      const name = registered ? cardName(registered, catalog) : nameOf(group);
      // A saved card reads its common ID; a model to add, the exact native IDs it would bring.
      const idLine = registered?.id ?? (unique(group.entries.flatMap(entry => entry.access?.nativeModel ? [entry.access.nativeModel] : [])).join(" · ") || group.entries[0].model.id);
      return { registered, name, idLine };
    };
    // Card actions are named after their card; a display name shared by two shown cards gains its ID line.
    const labelOf = distinctLabels(shown, group => identity(group).name, group => identity(group).idLine);
    const header = (group: ReferenceGroup) => {
      const { registered, name, idLine } = identity(group);
      const creator = creatorName(creatorOf(group, registered));
      const family = knownValue(registered?.family) || familyOf(group);
      return <div className="flex min-w-0 flex-1 items-start gap-2"><BrandIcon model={{ ...group.entries[0].model, creator, accesses: group.entries.flatMap(entry => entry.access ? [entry.access] : []) }} mode={view.logo} /><div className="min-w-0 flex-1"><button type="button" className="line-clamp-2 w-full rounded-sm text-left text-sm font-semibold leading-snug [overflow-wrap:anywhere] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={name} aria-label={copy(`Open ${labelOf(group)} details`, `Ouvrir la fiche ${labelOf(group)}`)} onClick={() => open(group)}>{name}</button>{view.metadata && <p className="mt-1 truncate text-xs text-muted-foreground">{creator}{family && ` · ${family}`}</p>}{view.metadata && idLine !== name && <p className="truncate font-mono text-xs text-muted-foreground" title={idLine}>{idLine}</p>}{badges(group).length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{badges(group).map(badge => <Badge key={badge.key} variant="secondary" data-attention={badge.key} title={badge.title} className="max-w-full"><span className="truncate">{badge.text}</span></Badge>)}</div>}</div></div>;
    };
    // A saved card without a reference can be associated with one; its unknown facts say so.
    const canAssociate = (group: ReferenceGroup) => { const saved = savedOf(group); return !!saved && !hasReference(saved); };
    const unknownFacts = (group: ReferenceGroup) => { const common = sharedReferenceFacts(group); return common.modalities && common.capabilities && factsUnknown(group.entries[0].model); };
    const associate = (group: ReferenceGroup) => canAssociate(group) && <Button variant="ghost" size="sm" onClick={() => setAssociating(savedOf(group)!)}>{copy("Associate a reference", "Associer une fiche documentaire")}<ActionLabel label={labelOf(group)} /></Button>;
    const card = (group: ReferenceGroup) => {
      const entries = group.entries;
      const first = entries[0].model;
      const common = sharedReferenceFacts({ ...group, entries });
      const format = cardFormat(view);
      return <CatalogCard key={group.key} format={format} dataTour={group === groups[0] ? "first-model" : undefined}
        header={header(group)}
        footer={<>{view.providers && <ProviderSummary ids={entries.flatMap(entry => entry.access ? [entry.access.provider] : [])} />}{associate(group)}{accessMenu(group)}{joinable(group).length > 0 && <Button size="sm" variant="outline" className="h-8" onClick={() => open(group)}>{copy("Add to card", "Ajouter à la fiche")}<ActionLabel label={labelOf(group)} /></Button>}</>}>
        {view.description && (common.summary && first.summary ? <p className="line-clamp-2 text-xs leading-relaxed text-foreground/80" title={first.summary}>{first.summary}</p> : !common.summary ? <p className="text-xs text-muted-foreground">{copy("Descriptions vary by access", "Descriptions variables selon les accès")}</p> : null)}
        {unknownFacts(group) ? (view.modalities || view.evidence) && <FactsUnknown associate={canAssociate(group)} /> : <>
        {view.modalities && (common.modalities ? <ModelModalitiesSummary model={first} label={labelOf(group)} stacked={format === "square"} /> : <p className="text-xs text-muted-foreground">{copy("Modalities vary by access", "Modalités variables selon les accès")}</p>)}
        {view.evidence && (common.capabilities ? <ModelCapabilitiesSummary model={first} label={labelOf(group)} stacked={format === "square"} /> : <p className="text-xs text-muted-foreground">{copy("Capabilities vary by access", "Capacités variables selon les accès")}</p>)}
        </>}
      </CatalogCard>;
    };
    return <div className="space-y-4"><p className="text-xs text-muted-foreground">{copy(`${shown.length} of ${groups.length} shown`, `${shown.length} affichés sur ${groups.length}`)}</p>{[...sections.entries()].map(([section, items]) => <section key={section || "all"} className="space-y-3">{section && <h3 className="text-base font-semibold">{section} <span className="text-sm font-normal text-muted-foreground">{items.length}</span></h3>}{view.layout === "grid" ? <CatalogGrid format={cardFormat(view)} columns={gridColumns(view.size)}>{items.map(card)}</CatalogGrid> : <div className="min-w-0 max-w-full overflow-x-auto rounded-sm border bg-card"><Table><TableHeader className="bg-muted/50"><TableRow><TableHead className="sticky left-0 z-20 bg-muted">{copy("Model", "Modèle")}</TableHead>{view.providers && <TableHead>{copy("Providers", "Fournisseurs")}</TableHead>}{view.modalities && <TableHead>{copy("Inputs → outputs", "Entrées → sorties")}</TableHead>}{view.evidence && <TableHead>{copy("Capabilities", "Capacités")}</TableHead>}<TableHead className="text-right">{copy("Action", "Action")}</TableHead></TableRow></TableHeader><TableBody>{items.map(group => { const entries = group.entries; const first = entries[0].model; const common = sharedReferenceFacts(group); const others = availableBeside(group).length; return <TableRow key={group.key} data-tour={group === groups[0] ? "first-model" : undefined}><TableCell className="sticky left-0 z-10 min-w-52 max-w-72 whitespace-normal bg-card"><div className="flex items-center gap-2">{header(group)}</div>{view.description && common.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{first.summary}</p>}{view.metadata && <div className="mt-2">{details(group, entries)}</div>}</TableCell>{view.providers && <TableCell className="min-w-40 align-top">{accessLine(entries)}{others > 0 && <p className="mt-1.5 text-xs text-muted-foreground">{copy(`${others} available, not in this card`, `${others} disponible${others > 1 ? "s" : ""}, hors de cette fiche`)}</p>}</TableCell>}{view.modalities && <TableCell className="align-top">{unknownFacts(group) ? <FactsUnknown associate={canAssociate(group)} /> : common.modalities ? <ModelModalitiesSummary model={first} label={labelOf(group)} /> : copy("Varies", "Variable")}</TableCell>}{view.evidence && <TableCell className="align-top">{unknownFacts(group) ? null : common.capabilities ? <ModelCapabilitiesSummary model={first} label={labelOf(group)} /> : copy("Varies", "Variable")}</TableCell>}<TableCell className="space-x-1 text-right align-top">{associate(group)}<Button size="sm" variant="outline" onClick={() => open(group)}>{joinable(group).length ? copy("Add to card", "Ajouter à la fiche") : copy(status(group) === "to-create" ? "Register" : "Details", status(group) === "to-create" ? "Enregistrer" : "Détails")}<ActionLabel label={labelOf(group)} /></Button></TableCell></TableRow>; })}</TableBody></Table></div>}</section>)}{shown.length < groups.length && <Button variant="outline" onClick={() => setVisibleCount(count => count + 60)}>{copy(`Show more (${groups.length - shown.length})`, `Voir plus (${groups.length - shown.length})`)}</Button>}</div>;
  };

  if (error && !catalog) return <div className="space-y-3"><div role="alert" className="flex flex-wrap items-center gap-2 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">{copy(`Model details unavailable: ${error}. Your known models are still available.`, `Détails des modèles indisponibles : ${error}. Vos modèles connus restent disponibles.`)} <Button variant="outline" size="sm" onClick={onRetry}>{copy("Retry", "Réessayer")}</Button></div><ModelBrowser key={scope} models={models} registeredIds={registeredIds} preferences={preferences} onOpen={onOpen} tourFirst stateKey="models" filterKey={`models.${scope}`} /></div>;
  // Keyed by scope: each scope keeps its own search and filters, so a To add filter never empties In Registry.
  return <><ModelBrowser key={scope} models={models} registeredIds={registeredIds} preferences={preferences} onOpen={onOpen} filter={(rows, filters) => catalog ? filterReferenceModels(rows, catalog, filters, byCard) : rows} renderResults={render} tourFirst stateKey="models" filterKey={`models.${scope}`} />
    <Dialog open={!!choice} onOpenChange={open => { if (!open) setChoice(null); }}><DialogContent><DialogHeader><DialogTitle>{copy("Choose the model identifier", "Choisir l’identifiant du modèle")}</DialogTitle><DialogDescription>{choice && unique(choice.entries.map(entry => entry.model.id)).filter(id => registeredIds.has(id)).length > 1 ? copy("These accesses already belong to distinct registered models. Open one card without changing the others.", "Ces accès appartiennent déjà à des modèles enregistrés distincts. Ouvrez une fiche sans modifier les autres.") : copy("Choose the exposed identifier. Conflicting provider accesses stay in separate cards.", "Choisissez l’identifiant exposé. Les accès fournisseurs en conflit restent dans des fiches séparées.")}</DialogDescription></DialogHeader><div className="space-y-2">{choice && unique(choice.entries.map(entry => entry.model.id)).map(id => { const base = registeredModels.find(model => model.id === id) ?? choice.entries.find(entry => entry.model.id === id)!.model; const existing = unique(choice.entries.map(entry => entry.model.id)).filter(value => registeredIds.has(value)); const grouped = choice.entries.flatMap(entry => entry.access ? [entry.access] : []); const duplicateProvider = unique(grouped.map(access => access.provider)).length !== grouped.length; const combine = existing.length === 0 && !duplicateProvider; return <Button key={id} variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => { onOpen(combine ? draftFor(choice, base) : base); setChoice(null); }}>{id}{registeredIds.has(id) ? copy(" · saved", " · enregistré") : copy(" · new", " · nouveau")}{!combine ? copy(" · opens separately", " · ouvre séparément") : copy(" · combines the accesses", " · regroupe les accès")}</Button>; })}</div></DialogContent></Dialog>
    <Dialog open={!!pick} onOpenChange={open => { if (!open) setPick(null); }}><DialogContent><DialogHeader><DialogTitle>{copy("Add to which card?", "Ajouter à quelle fiche ?")}</DialogTitle><DialogDescription>{copy("Several saved cards hold this model. The access stays out of the card until you add it.", "Plusieurs fiches enregistrées détiennent ce modèle. L’accès reste hors de la fiche tant que vous ne l’ajoutez pas.")}</DialogDescription></DialogHeader><div className="space-y-2">{pick?.cards.map(card => <Button key={card.id} variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => { onOpen(card, "access"); setPick(null); }}>{cardName(card, catalog)} · {card.id}</Button>)}{pick && <Button variant="ghost" className="w-full justify-start" onClick={() => { onOpen(pick.group.entries[0].model); setPick(null); }}>{copy("Create a separate card instead", "Créer une fiche distincte à la place")}</Button>}</div></DialogContent></Dialog>
    {associating && catalog && <AssociateReferenceDialog key={associating.id} model={associating} references={catalog.references} onAssociate={onAssociate} onClose={() => setAssociating(null)} />}
  </>;
}
