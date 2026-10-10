import { useId, useMemo } from "react";
import { ArrowRight, KeyRound, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CatalogCard, CatalogGrid } from "../../components/registry/CatalogCard";
import { GroupSummary, ProviderSummary } from "../../components/registry/CompactCollection";
import { cardFormat, gridColumns, ViewControls, type ViewOptions } from "../../components/registry/ViewOptions";
import { exposed, members, type Group, type Key, type Model } from "../../domain/registry";
import { displayProvider } from "../../components/registry/BrandIcon";
import { useCopy, useFormat } from "../../lib/locale";
import { filterKeys } from "./key-library-state";
import { useSessionState } from "../../lib/session-state";

// One line for what Bifrost allows a key today: all providers, or N providers and M models.
export function permissionSummary(permissions: Key["permissions"], copy: ReturnType<typeof useCopy>) {
  if (!permissions) return copy("Not read yet", "Pas encore lues");
  if (permissions.allProviders) return copy("All providers", "Tous les fournisseurs");
  const providers = permissions.providers;
  if (!providers.length) return copy("No provider", "Aucun fournisseur");
  const all = providers.filter(p => p.allModels).map(p => displayProvider(p.provider));
  const count = providers.reduce((sum, p) => sum + (p.allModels ? 0 : p.models.length), 0);
  return [
    `${providers.length} ${copy(providers.length === 1 ? "provider" : "providers", providers.length === 1 ? "fournisseur" : "fournisseurs")}`,
    all.length < providers.length ? `${count} ${copy(count === 1 ? "model" : "models", count === 1 ? "modèle" : "modèles")}` : "",
    all.length ? `${copy("all models of", "tous les modèles de")} ${all.join(", ")}` : "",
  ].filter(Boolean).join(" · ");
}

type Props = {
  keys: Key[];
  groups: Group[];
  models: Model[];
  search: string;
  onSearch: (value: string) => void;
  view: ViewOptions;
  onViewChange: (value: ViewOptions) => void;
  onResetView: () => void;
  busy: boolean;
  snapshotMode: boolean;
  onCreate: () => void;
  onOpen: (key: Key) => void;
};

export function KeyLibrary({ keys, groups, models, search, onSearch, view, onViewChange, onResetView, busy, snapshotMode, onCreate, onOpen }: Props) {
  const copy = useCopy();
  const localized = useFormat();
  const filterId = useId();
  // Filters survive leaving the page for the session, like the search.
  const [groupFilter, setGroupFilter] = useSessionState("keys.group", "all");
  const [clientFilter, setClientFilter] = useSessionState("keys.client", "all");
  const [sort, setSort] = useSessionState("keys.sort", "name");
  const clients = [...new Set(keys.map(key => key.client).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const shown = useMemo(() => filterKeys(keys, groups, models, search, groupFilter, clientFilter, sort), [keys, groups, models, search, groupFilter, clientFilter, sort]);
  const format = cardFormat(view);
  const stateBadge = (key: Key, compact = false) => key.managed === false
    ? <Badge variant="warning" title={compact ? copy("Bifrost key · adoption needed", "Clé Bifrost · adoption à préparer") : undefined}>{compact ? copy("Adoption needed", "À adopter") : copy("Bifrost key · adoption needed", "Clé Bifrost · adoption à préparer")}</Badge>
    : <Badge variant={key.active ? "success" : "secondary"}>{key.active ? copy("Active", "Active") : copy("Disabled", "Désactivée")}</Badge>;
  const readbackBadge = (key: Key, compact = false) => {
    const state = key.publication?.state;
    return <Badge variant={state === "verified" ? "success" : state === "drift" ? "warning" : "outline"}>{state === "verified" ? copy("Verified", "Vérifiée") : state === "drift" ? copy("Drift", "Écart") : compact ? copy("Unchecked", "À vérifier") : copy("Not verified", "Non vérifiée")}</Badge>;
  };
  const accessChoice = copy("Access choice needed", "Choix d’accès requis");
  const card = (key: Key) => {
    const selected = members(key.policy, groups);
    const providers = models.filter(model => selected.includes(model.id)).flatMap(model => model.accesses.map(access => access.provider));
    const groupNames = key.policy.groups.map(id => groups.find(group => group.id === id)?.name || id);
    const ids = exposed(key.policy, groups, models);
    const pending = Object.keys(key.pendingAccessSelection || {});
    return <CatalogCard key={key.id} format={format} warning={key.publication?.state === "drift" || pending.length > 0}
      header={<><span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-primary/15 bg-primary/10 text-primary"><KeyRound className="size-4" /></span><div className="min-w-0 flex-1"><CardTitle className="truncate text-sm font-semibold" title={key.name}>{key.name}</CardTitle><p className="mt-0.5 truncate text-xs text-muted-foreground" title={key.client}>{key.client || "—"}</p></div></>}
      footer={<div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-1.5">{stateBadge(key, true)}{key.managed !== false && readbackBadge(key, true)}<Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy} onClick={() => onOpen(key)}>{key.managed === false ? copy("Review", "Examiner") : copy("Open", "Ouvrir")}<ArrowRight className="size-3.5" /></Button></div>}>
      {key.managed === false ? <><p className="text-sm font-medium">{copy("Bifrost allows today", "Bifrost autorise aujourd’hui")}</p><p className="text-xs text-muted-foreground">{permissionSummary(key.permissions, copy)}</p>{view.providers && !!key.permissions?.providers.length && <div className="flex min-h-8 min-w-0 items-center"><ProviderSummary ids={key.permissions.providers.map(p => p.provider)} /></div>}</> : <>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{selected.length} {copy(selected.length === 1 ? "model" : "models", selected.length === 1 ? "modèle" : "modèles")}</p><span className="text-xs text-muted-foreground">{ids.length} {copy("IDs", "ID")}</span></div>
        <p className="truncate text-xs text-muted-foreground">{copy("Bifrost allows", "Bifrost autorise")} · {permissionSummary(key.permissions, copy)}</p>
        {view.metadata && format === "compact" && <p className="text-xs text-muted-foreground">{copy("ID format", "Format des ID")} · {key.policy.naming === "both" ? copy("both", "les deux") : key.policy.naming === "model" ? copy("model", "modèle") : copy("provider/model", "fournisseur/modèle")}</p>}
        {view.providers && <><div className="flex min-h-8 min-w-0 items-center"><ProviderSummary ids={providers} /></div><GroupSummary names={groupNames} /></>}
        {view.description && format === "compact" && key.publication?.checkedAt && <p className="text-xs text-muted-foreground">{copy("Readback", "Relecture")} · {localized.date(key.publication.checkedAt, { year: "numeric", month: "numeric", day: "numeric" })}</p>}
        {key.publication?.error && <p className="line-clamp-2 break-words text-xs text-chart-warning-ink" title={key.publication.error}>{key.publication.error}</p>}
        {key.publication?.state === "drift" && <p className="text-xs text-destructive">{copy("Missing", "Manquants")}: {key.publication.missing.length} · {copy("unexpected", "inattendus")}: {key.publication.unexpected.length}</p>}
        {pending.length > 0 && <p className="break-words text-xs text-chart-warning-ink">{accessChoice} · {pending.join(", ")}</p>}
      </>}
    </CatalogCard>;
  };

  return <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy("Virtual keys", "Clés virtuelles")}</h2><p className="mt-1 max-w-prose text-sm text-foreground/70">{copy("Review Bifrost keys, their selected models and the latest Registry readback.", "Consultez les clés Bifrost, leurs modèles sélectionnés et la dernière relecture Registry.")}</p></div><Button type="button" disabled={busy || snapshotMode} title={snapshotMode ? copy("Key creation is unavailable in a copy without secrets.", "La création de clé est indisponible dans une copie sans secrets.") : undefined} onClick={onCreate}><Plus className="size-4" />{copy("Create key", "Créer une clé")}</Button></div>
    <div className="flex flex-wrap items-center gap-2 rounded-sm border bg-card p-3 shadow-sm"><div className="relative min-w-48 basis-full flex-1 md:basis-56"><label htmlFor={filterId} className="sr-only">{copy("Search keys", "Rechercher des clés")}</label><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input id={filterId} placeholder={copy("Name, client, model, group or ID…", "Nom, client, modèle, groupe ou ID…")} className="pl-9" value={search} onChange={event => onSearch(event.target.value)} /></div>
      <Select value={groupFilter} onValueChange={setGroupFilter}><SelectTrigger className="h-9 w-auto min-w-30 max-w-40 px-2 text-xs [&>span[data-slot=select-value]]:block [&>span[data-slot=select-value]]:min-w-0 [&>span[data-slot=select-value]]:truncate" aria-label={copy("Filter by group", "Filtrer par groupe")} title={copy("Filter by group", "Filtrer par groupe")}><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">{copy("All groups", "Tous les groupes")}</SelectItem>{groups.map(group => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectGroup></SelectContent></Select>
      <Select value={clientFilter} onValueChange={setClientFilter}><SelectTrigger className="h-9 w-auto min-w-30 max-w-40 px-2 text-xs [&>span[data-slot=select-value]]:block [&>span[data-slot=select-value]]:min-w-0 [&>span[data-slot=select-value]]:truncate" aria-label={copy("Filter by client", "Filtrer par client")} title={copy("Filter by client", "Filtrer par client")}><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">{copy("All clients", "Tous les clients")}</SelectItem>{clients.map(client => <SelectItem key={client} value={client}>{client}</SelectItem>)}</SelectGroup></SelectContent></Select>
      <Select value={sort} onValueChange={setSort}><SelectTrigger className="h-9 w-auto min-w-30 max-w-40 px-2 text-xs [&>span[data-slot=select-value]]:block [&>span[data-slot=select-value]]:min-w-0 [&>span[data-slot=select-value]]:truncate" aria-label={copy("Sort keys", "Trier les clés")} title={copy("Sort keys", "Trier les clés")}><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="name">{copy("Name", "Nom")}</SelectItem><SelectItem value="client">Client</SelectItem><SelectItem value="models">{copy("Model count", "Nombre de modèles")}</SelectItem><SelectItem value="status">{copy("Status", "Statut")}</SelectItem></SelectGroup></SelectContent></Select>
      <ViewControls value={view} onChange={onViewChange} onReset={onResetView} scope={copy("Keys", "Clés")} fields={["description", "metadata", "providers"]} catalogFormats />
    </div>
    <p className="text-xs text-muted-foreground">{copy(`${shown.length} of ${keys.length} keys shown`, `${shown.length} clé${shown.length === 1 ? "" : "s"} affichée${shown.length === 1 ? "" : "s"} sur ${keys.length}`)}</p>
    {!shown.length ? <div className="rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground">{keys.length ? copy("No keys match these filters.", "Aucune clé ne correspond à ces filtres.") : copy("No virtual keys are available yet.", "Aucune clé virtuelle pour le moment.")}</div> : view.layout === "table" ? <div className="overflow-x-auto rounded-sm border bg-card"><Table><TableHeader><TableRow><TableHead>{copy("Key", "Clé")}</TableHead><TableHead>Client</TableHead><TableHead>{copy("Groups", "Groupes")}</TableHead><TableHead>{copy("Models", "Modèles")}</TableHead><TableHead>{copy("IDs", "ID")}</TableHead><TableHead>{copy("Status", "Statut")}</TableHead><TableHead>{copy("Readback", "Relecture")}</TableHead><TableHead className="text-right">{copy("Action", "Action")}</TableHead></TableRow></TableHeader><TableBody>{shown.map(key => <TableRow key={key.id}><TableCell className="font-medium">{key.name}</TableCell><TableCell>{key.client || "—"}</TableCell><TableCell>{key.managed === false ? "—" : key.policy.groups.map(id => groups.find(group => group.id === id)?.name || id).join(", ") || "—"}</TableCell><TableCell>{key.managed === false ? permissionSummary(key.permissions, copy) : members(key.policy, groups).length}</TableCell><TableCell>{key.managed === false ? "—" : exposed(key.policy, groups, models).length}</TableCell><TableCell>{stateBadge(key)}</TableCell><TableCell>{key.managed === false ? "—" : readbackBadge(key)}{key.managed !== false && key.publication?.checkedAt && <span className="ml-2 text-xs text-muted-foreground">{localized.date(key.publication.checkedAt, { year: "numeric", month: "numeric", day: "numeric" })}</span>}{key.managed !== false && key.pendingAccessSelection && <Badge variant="warning" className="ml-2">{accessChoice}</Badge>}</TableCell><TableCell className="text-right"><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onOpen(key)}>{key.managed === false ? copy("Review", "Examiner") : copy("Open", "Ouvrir")}<ArrowRight className="size-3.5" /></Button></TableCell></TableRow>)}</TableBody></Table></div> : <CatalogGrid format={format} columns={gridColumns(view.size)}>{shown.map(card)}</CatalogGrid>}
  </div>;
}

export default KeyLibrary;
