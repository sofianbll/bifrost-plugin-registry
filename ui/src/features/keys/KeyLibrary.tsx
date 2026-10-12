import { useId, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight, KeyRound, ListFilter, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionLabel, CatalogCard, CatalogGrid } from "../../components/registry/CatalogCard";
import { GroupSummary, ProviderSummary } from "../../components/registry/CompactCollection";
import { cardFormat, gridColumns, ViewControls, type ViewOptions } from "../../components/registry/ViewOptions";
import { distinctLabels, members, type Group, type Key, type Model } from "../../domain/registry";
import { useCopy, useFormat } from "../../lib/locale";
import { filterKeys, keyShelves, nearDuplicates, type KeyShelf } from "./key-library-state";
import { readinessLabel, readinessReason, readinessState, readinessVariant, type ReadinessState } from "./key-readiness";
import { permissionSummary } from "./KeyComposer.state";
import { checkState, keyLedger, ledgerTotal, useDay } from "./KeySummary";
import { useSessionState } from "../../lib/session-state";

type Props = {
  keys: Key[];
  groups: Group[];
  models: Model[];
  view: ViewOptions;
  onViewChange: (value: ViewOptions) => void;
  onResetView: () => void;
  busy: boolean;
  snapshotMode: boolean;
  // Expert keeps the toolbar inline; Basic folds the filters and the sort into "Filters (n)", like Models.
  expert?: boolean;
  onCreate: () => void;
  onOpen: (key: Key) => void;
};

export function KeyLibrary({ keys, groups, models, view, onViewChange, onResetView, busy, snapshotMode, expert = false, onCreate, onOpen }: Props) {
  const copy = useCopy();
  const localized = useFormat();
  const day = useDay();
  const { colon } = localized;
  const filterId = useId();
  // Search and filters survive leaving the page for the session.
  const [search, onSearch] = useSessionState("keys.search", "");
  const [groupFilter, setGroupFilter] = useSessionState("keys.group", "all");
  const [clientFilter, setClientFilter] = useSessionState("keys.client", "all");
  const [sort, setSort] = useSessionState("keys.sort", "readiness");
  const [readinessFilter, setReadinessFilter] = useSessionState("keys.readiness", "all");
  // Shelves the user opened or closed; a search or a filter opens them all, so results are never hidden.
  const [shelfChoice, setShelfChoice] = useState<Record<string, boolean>>({});
  const clients = [...new Set(keys.map(key => key.client).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const shown = useMemo(() => filterKeys(keys, groups, models, search, groupFilter, clientFilter, sort, readinessFilter), [keys, groups, models, search, groupFilter, clientFilter, sort, readinessFilter]);
  const dupes = useMemo(() => nearDuplicates(keys), [keys]);
  const activeFilters = [groupFilter, clientFilter, readinessFilter].filter(value => value !== "all").length;
  const filtering = !!search.trim() || activeFilters > 0;
  const shelfKey = (shelf: KeyShelf) => `${filtering}:${shelf.id}`;
  const isOpen = (shelf: KeyShelf) => shelf.id === "managed" || (shelfChoice[shelfKey(shelf)] ?? (filtering || shelf.id === "adopt"));
  const shelves = keyShelves(shown);
  const collapsed = shelves.filter(shelf => !isOpen(shelf)).reduce((sum, shelf) => sum + shelf.keys.length, 0);
  // Triage: how many keys sit in each adoption state, before the other filters apply.
  const readinessCount = (state: ReadinessState) => keys.filter(key => readinessState(key) === state).length;
  const format = cardFormat(view);
  // The guided tour points at the first managed key, then at the first key that still needs adopting.
  const tourKeys = { managed: shown.find(key => key.managed !== false), unmanaged: shown.find(key => key.managed === false) };
  // Card and row actions are named after their key; a name shared by two keys gains the ID.
  const labelOf = distinctLabels(shown, key => key.name, key => key.id);
  // An unmanaged key shows its adoption readiness (ready, blocked, empty); a managed one is active or disabled.
  const stateBadge = (key: Key) => {
    const state = readinessState(key);
    if (state === "managed") return <Badge variant={key.active ? "success" : "secondary"}>{key.active ? copy("Active", "Active") : copy("Disabled", "Désactivée")}</Badge>;
    return <Badge variant={readinessVariant[state]} title={readinessReason(key.readiness, copy) || undefined}>{readinessLabel(state, copy)}</Badge>;
  };
  const reasonLine = (key: Key) => { const reason = readinessReason(key.readiness, copy); return reason && <p className="line-clamp-2 break-words text-xs text-chart-warning-ink" title={reason}>{reason}</p>; };
  const checkBadge = (key: Key) => { const state = key.publication?.state; return <Badge variant={state === "verified" ? "success" : state === "drift" ? "warning" : "outline"}>{checkState(key, copy)}</Badge>; };
  const dupeHint = (key: Key) => dupes.has(key.id) && <p className="text-xs text-chart-warning-ink">{copy("Another key has almost the same name", "Une autre clé porte presque le même nom")}</p>;
  const accessChoice = copy("Access choice needed", "Choix d’accès requis");
  const card = (key: Key) => {
    const selected = members(key.policy, groups);
    const providers = models.filter(model => selected.includes(model.id)).flatMap(model => model.accesses.map(access => access.provider));
    const groupNames = key.policy.groups.map(id => groups.find(group => group.id === id)?.name || id);
    const pending = Object.keys(key.pendingAccessSelection || {});
    return <CatalogCard key={key.id} format={format} dataTour={key.id === tourKeys.managed?.id ? "first-key" : key.id === tourKeys.unmanaged?.id ? "adoption" : undefined} warning={key.publication?.state === "drift" || pending.length > 0}
      header={<><span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-primary/15 bg-primary/10 text-primary"><KeyRound className="size-4" /></span><div className="min-w-0 flex-1"><CardTitle className="truncate text-sm font-semibold" title={key.name}>{key.name}</CardTitle>{key.client && <p className="mt-0.5 truncate text-xs text-muted-foreground" title={key.client}>{key.client}</p>}{dupeHint(key)}</div></>}
      footer={<div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-1.5">{stateBadge(key)}<Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy} onClick={() => onOpen(key)}>{key.managed === false ? copy("Review", "Examiner") : copy("Open", "Ouvrir")}<ActionLabel label={labelOf(key)} /><ArrowRight className="size-3.5" /></Button></div>}>
      {key.managed === false ? <><p className="text-sm font-medium">{copy("Bifrost allows today", "Bifrost autorise aujourd’hui")}</p><p className="text-xs text-muted-foreground">{permissionSummary(key.permissions, copy)}</p>{reasonLine(key)}{view.providers && !!key.permissions?.providers.length &&<div className="flex min-h-8 min-w-0 items-center"><ProviderSummary ids={key.permissions.providers.map(p => p.provider)} /></div>}</> : <>
        {/* The same single total as the key page: what the key can call, then whether Bifrost confirmed it. */}
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold"><span>{ledgerTotal(keyLedger(key, models, groups), copy).replace(/^./, letter => letter.toLocaleUpperCase())} ·</span>{" "}{snapshotMode ? <span className="font-normal text-muted-foreground">{copy("local copy", "copie locale")}</span> : checkBadge(key)}</p>
        {expert && view.metadata && format === "compact" && <p className="text-xs text-muted-foreground">{copy("ID format", "Format des ID")} · {key.policy.naming === "both" ? copy("both", "les deux") : key.policy.naming === "model" ? copy("model", "modèle") : copy("provider/model", "fournisseur/modèle")}</p>}
        {view.providers && <><div className="flex min-h-8 min-w-0 items-center"><ProviderSummary ids={providers} /></div><GroupSummary names={groupNames} /></>}
        {view.description && format === "compact" && key.publication?.checkedAt && <p className="text-xs text-muted-foreground">{copy("Checked with Bifrost", "Vérifiée avec Bifrost")} · {day(key.publication.checkedAt)}</p>}
        {key.publication?.error && <p className="line-clamp-2 break-words text-xs text-chart-warning-ink" title={key.publication.error}>{key.publication.error}</p>}
        {key.publication?.state === "drift" && <p className="text-xs text-destructive">{copy("Missing", "Manquants")}{colon} {key.publication.missing.length} · {copy("unexpected", "inattendus")}{colon} {key.publication.unexpected.length}</p>}
        {pending.length > 0 && <p className="break-words text-xs text-chart-warning-ink">{accessChoice} · {pending.join(", ")}</p>}
      </>}
    </CatalogCard>;
  };
  const table = (rows: Key[]) => <div className="overflow-x-auto rounded-sm border bg-card"><Table><TableHeader><TableRow><TableHead>{copy("Key", "Clé")}</TableHead><TableHead>Client</TableHead><TableHead>{copy("Groups", "Groupes")}</TableHead><TableHead>{copy("Models", "Modèles")}</TableHead><TableHead>{copy("Status", "Statut")}</TableHead><TableHead>{copy("Checked with Bifrost", "Vérifiée avec Bifrost")}</TableHead><TableHead className="text-right">{copy("Action", "Action")}</TableHead></TableRow></TableHeader><TableBody>{rows.map(key => <TableRow key={key.id}><TableCell className="font-medium">{key.name}{dupeHint(key)}</TableCell><TableCell>{key.client}</TableCell><TableCell>{key.managed === false ? "" : key.policy.groups.map(id => groups.find(group => group.id === id)?.name || id).join(", ")}</TableCell><TableCell>{key.managed === false ? permissionSummary(key.permissions, copy) : ledgerTotal(keyLedger(key, models, groups), copy)}</TableCell><TableCell>{stateBadge(key)}{reasonLine(key)}</TableCell><TableCell>{key.managed !== false && <>{checkBadge(key)}{key.publication?.checkedAt && <span className="ml-2 text-xs text-muted-foreground">{day(key.publication.checkedAt)}</span>}{key.pendingAccessSelection && <Badge variant="warning" className="ml-2">{accessChoice}</Badge>}</>}</TableCell><TableCell className="text-right"><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onOpen(key)}>{key.managed === false ? copy("Review", "Examiner") : copy("Open", "Ouvrir")}<ActionLabel label={labelOf(key)} /><ArrowRight className="size-3.5" /></Button></TableCell></TableRow>)}</TableBody></Table></div>;
  const shelfLabel = (shelf: KeyShelf) => shelf.id === "managed" ? copy("Managed by Registry", "Gérées par Registry") : shelf.id === "adopt" ? copy("To adopt", "À adopter") : copy("Empty", "Vides");

  // Each filter is built once and placed inline (Expert) or inside "Filters (n)" (Basic). Triggers fit their longest label.
  const selectClass = `h-9 px-2 text-xs [&>span[data-slot=select-value]]:block [&>span[data-slot=select-value]]:min-w-0 [&>span[data-slot=select-value]]:truncate ${expert ? "w-auto min-w-30 max-w-60" : "w-full"}`;
  const menuWidth = "w-auto min-w-[max(var(--radix-select-trigger-width),12rem)]";
  const filters = <>
    <Select value={groupFilter} onValueChange={setGroupFilter}><SelectTrigger className={selectClass} aria-label={copy("Filter by group", "Filtrer par groupe")} title={copy("Filter by group", "Filtrer par groupe")}><SelectValue /></SelectTrigger><SelectContent className={menuWidth}><SelectGroup><SelectItem value="all">{copy("All groups", "Tous les groupes")}</SelectItem>{groups.map(group => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectGroup></SelectContent></Select>
    <Select value={clientFilter} onValueChange={setClientFilter}><SelectTrigger className={selectClass} aria-label={copy("Filter by client", "Filtrer par client")} title={copy("Filter by client", "Filtrer par client")}><SelectValue /></SelectTrigger><SelectContent className={menuWidth}><SelectGroup><SelectItem value="all">{copy("All clients", "Tous les clients")}</SelectItem>{clients.map(client => <SelectItem key={client} value={client}>{client}</SelectItem>)}</SelectGroup></SelectContent></Select>
    <Select value={readinessFilter} onValueChange={setReadinessFilter}><SelectTrigger className={selectClass} aria-label={copy("Filter by readiness", "Filtrer par état d’adoption")} title={copy("Filter by readiness", "Filtrer par état d’adoption")}><SelectValue /></SelectTrigger><SelectContent className={menuWidth}><SelectGroup><SelectItem value="all">{copy("All adoption states", "Tous les états d’adoption")}</SelectItem>{(["ready", "blocked", "empty", "managed"] as const).map(state => <SelectItem key={state} value={state}>{readinessLabel(state, copy)} ({readinessCount(state)})</SelectItem>)}</SelectGroup></SelectContent></Select>
    <Select value={sort} onValueChange={setSort}><SelectTrigger className={selectClass} aria-label={copy("Sort keys", "Trier les clés")} title={copy("Sort keys", "Trier les clés")}><SelectValue /></SelectTrigger><SelectContent className={menuWidth}><SelectGroup><SelectItem value="readiness">{copy("Sort by adoption state", "Trier par état d’adoption")}</SelectItem><SelectItem value="name">{copy("Sort by name", "Trier par nom")}</SelectItem><SelectItem value="client">{copy("Sort by client", "Trier par client")}</SelectItem><SelectItem value="models">{copy("Sort by model count", "Trier par nombre de modèles")}</SelectItem><SelectItem value="status">{copy("Sort by status", "Trier par statut")}</SelectItem></SelectGroup></SelectContent></Select>
  </>;

  return <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 data-tour="keys" className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy("Virtual keys", "Clés virtuelles")}</h1><p className="mt-1 max-w-prose text-sm text-foreground/70">{copy("Review Bifrost keys, the models each one can call, and whether Bifrost confirmed it.", "Consultez les clés Bifrost, les modèles que chacune peut appeler, et si Bifrost l’a confirmé.")}</p></div><Button type="button" disabled={busy || snapshotMode} title={snapshotMode ? copy("Key creation is unavailable in a copy without secrets.", "La création de clé est indisponible dans une copie sans secrets.") : undefined} onClick={onCreate}><Plus className="size-4" />{copy("Create key", "Créer une clé")}</Button></div>
    <div className="flex flex-wrap items-center gap-2 rounded-sm border bg-card p-3 shadow-sm"><div className="relative min-w-48 basis-full flex-1 md:basis-56"><label htmlFor={filterId} className="sr-only">{copy("Search keys", "Rechercher des clés")}</label><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input id={filterId} placeholder={copy("Name, client, model, group or ID…", "Nom, client, modèle, groupe ou ID…")} className="pl-9" value={search} onChange={event => onSearch(event.target.value)} /></div>
      {expert ? filters : <Popover><PopoverTrigger asChild><Button size="sm" variant="outline"><ListFilter className="size-4" />{copy("Filters", "Filtres")}{activeFilters ? ` (${activeFilters})` : ""}</Button></PopoverTrigger><PopoverContent align="end" collisionPadding={16} aria-label={copy("Filters", "Filtres")} className="flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2 p-2">{filters}</PopoverContent></Popover>}
      <ViewControls value={view} onChange={onViewChange} onReset={onResetView} scope={copy("Keys", "Clés")} fields={["description", "metadata", "providers"]} catalogFormats folded={!expert} />
    </div>
    <p className="text-xs text-muted-foreground">{copy(`${shown.length} of ${keys.length} keys shown`, `${shown.length} clé${shown.length === 1 ? "" : "s"} affichée${shown.length === 1 ? "" : "s"} sur ${keys.length}`)}{collapsed > 0 && copy(`, ${collapsed} in a collapsed shelf`, `, ${collapsed} dans une étagère repliée`)}</p>
    {!shown.length ? <div className="rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground">{keys.length ? copy("No keys match these filters.", "Aucune clé ne correspond à ces filtres.") : copy("No virtual keys are available yet.", "Aucune clé virtuelle pour le moment.")}</div>
      : shelves.map(shelf => {
        const open = isOpen(shelf);
        const label = <>{shelfLabel(shelf)} <span className="text-sm font-normal text-muted-foreground">{shelf.keys.length}</span></>;
        return <section key={shelf.id} className="space-y-3">
          <h2 className="text-base font-semibold">{shelf.id === "managed" ? label : <button type="button" aria-expanded={open} className="inline-flex items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setShelfChoice({ ...shelfChoice, [shelfKey(shelf)]: !open })}>{open ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}{label}</button>}</h2>
          {open && (view.layout === "table" ? table(shelf.keys) : <CatalogGrid format={format} columns={gridColumns(view.size)}>{shelf.keys.map(card)}</CatalogGrid>)}
        </section>;
      })}
  </div>;
}

export default KeyLibrary;
