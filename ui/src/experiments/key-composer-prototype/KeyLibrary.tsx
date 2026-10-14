import { useMemo, useState } from "react";
import { Copy, KeyRound, LockKeyhole, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GroupSummary, ProviderSummary } from "./CompactCollection";
import { plannedExposures, resolveDraft, type ProtoGroup, type ProtoModel } from "./state";
import { type SimulatedKey } from "./key-state";
import { useCopy } from "../../lib/locale";
import { CatalogCard, CatalogGrid } from "@/components/registry/CatalogCard";
import { ViewMenu, type DisplayFormat } from "./ViewMenu";

type Props = { keys: SimulatedKey[]; groups: ProtoGroup[]; models: ProtoModel[]; onCreate: () => void; onEdit: (key: SimulatedKey) => void };
export default function KeyLibrary({ keys, groups, models, onCreate, onEdit }: Props) {
  const copy = useCopy();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [client, setClient] = useState("all");
  const [sort, setSort] = useState("name");
  const [view, setView] = useState<DisplayFormat>("compact");
  const [manualToken, setManualToken] = useState<string | null>(null);
  const clients = [...new Set(keys.map(key => key.draft.client).filter(Boolean))].sort();
  const shown = useMemo(() => keys.filter(key => {
    const draft = key.draft;
    const haystack = [draft.name, draft.client, ...draft.groups.map(id => groups.find(g => g.id === id)?.name || id), ...resolveDraft(draft, groups, models).map(item => item.model.name), ...plannedExposures(draft, groups, models)].join(" ").toLocaleLowerCase();
    return haystack.includes(search.trim().toLocaleLowerCase()) && (group === "all" || draft.groups.includes(group)) && (client === "all" || draft.client === client);
  }).sort((a, b) => sort === "client" ? a.draft.client.localeCompare(b.draft.client) || a.draft.name.localeCompare(b.draft.name) : sort === "models" ? plannedExposures(b.draft, groups, models).length - plannedExposures(a.draft, groups, models).length : a.draft.name.localeCompare(b.draft.name)), [keys, groups, models, search, group, client, sort]);
  const copyToken = async (key: SimulatedKey) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(key.demoToken);
      toast.success(copy("Demo token copied. It cannot call any API.", "Jeton de démonstration copié. Il ne permet aucun appel API."));
    } catch { setManualToken(key.demoToken); }
  };
  const actions = (key: SimulatedKey) => key.readonly
    ? <Badge variant="secondary">{copy("Read-only witness", "Témoin en lecture seule")}</Badge>
    : <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => onEdit(key)}><Pencil className="size-3.5" />{copy("Edit", "Modifier")}</Button><Button size="sm" variant="ghost" onClick={() => void copyToken(key)}><Copy className="size-3.5" />{copy("Copy demo token", "Copier le jeton démo")}</Button></div>;
  const card = (key: SimulatedKey) => {
    const active = resolveDraft(key.draft, groups, models).filter(item => item.state === "active" && item.accesses.some(access => access.state === "active"));
    const names = key.draft.groups.map(id => groups.find(g => g.id === id)?.name || id);
    const Icon = key.readonly ? LockKeyhole : KeyRound;
    return <CatalogCard key={key.id} format={view === "table" ? "compact" : view}
      header={<><span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-primary/15 bg-primary/10 text-primary"><Icon className="size-4" /></span><div className="min-w-0"><CardTitle className="truncate text-sm font-semibold" title={key.draft.name}>{key.draft.name}</CardTitle><p className="mt-0.5 truncate text-xs text-muted-foreground" title={key.draft.client}>{key.draft.client || "—"}</p></div></>}
      footer={key.readonly ? <Badge variant="secondary" className="max-w-full truncate">{copy("Read-only witness", "Témoin en lecture seule")}</Badge> : <div className="flex w-full min-w-0 items-center gap-1"><code aria-label={copy("Masked demo token", "Jeton démo masqué")} className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">DEMO_••••</code><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={copy(`Copy demo token for ${key.draft.name}`, `Copier le jeton démo de ${key.draft.name}`)} onClick={() => void copyToken(key)}><Copy className="size-3.5" /></Button></TooltipTrigger><TooltipContent>{copy("Copy demo token", "Copier le jeton démo")}</TooltipContent></Tooltip><Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" onClick={() => onEdit(key)}><Pencil className="size-3" />{copy("Edit", "Modifier")}</Button></div>}>
      <p className="text-sm font-semibold">{active.length} {copy(active.length === 1 ? "model" : "models", active.length === 1 ? "modèle" : "modèles")}</p>
      <div className="flex min-h-8 min-w-0 items-center"><ProviderSummary ids={active.flatMap(item => item.accesses.filter(access => access.state === "active").map(access => access.access.provider))} /></div>
      <GroupSummary names={names} />
    </CatalogCard>;
  };
  return <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-24">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy("Virtual keys", "Clés virtuelles")}</h2><p className="mt-1 max-w-prose text-sm text-foreground/70">{copy("Synthetic keys in memory only. No gateway, inference, or valid API token.", "Clés fictives en mémoire uniquement. Aucune passerelle, inférence ni clé API valide.")}</p></div><Button onClick={onCreate}><Plus className="size-4" />{copy("Create key", "Créer une clé")}</Button></div>
    <div className="grid grid-cols-2 gap-2 rounded-sm border bg-card p-2 shadow-sm xl:grid-cols-[minmax(0,1fr)_10rem_10rem_9rem_auto]">
      <Field className="col-span-2 min-w-0 gap-0 xl:col-span-1"><FieldLabel htmlFor="key-search" className="sr-only">{copy("Search keys", "Rechercher des clés")}</FieldLabel><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input id="key-search" placeholder={copy("Name, client, model or group…", "Nom, client, modèle ou groupe…")} className="pl-9" value={search} onChange={event => setSearch(event.target.value)} /></div></Field>
      <Select value={group} onValueChange={setGroup}><SelectTrigger className="h-auto min-h-9 w-full min-w-0 px-2 text-xs whitespace-normal *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:wrap-anywhere" aria-label={copy("Filter by group", "Filtrer par groupe")}><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">{copy("All groups", "Tous les groupes")}</SelectItem>{groups.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectGroup></SelectContent></Select>
      <Select value={client} onValueChange={setClient}><SelectTrigger className="h-auto min-h-9 w-full min-w-0 px-2 text-xs whitespace-normal *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:wrap-anywhere" aria-label={copy("Filter by client", "Filtrer par client")}><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">{copy("All clients", "Tous les clients")}</SelectItem>{clients.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectGroup></SelectContent></Select>
      <Select value={sort} onValueChange={setSort}><SelectTrigger className="h-auto min-h-9 w-full min-w-0 px-2 text-xs whitespace-normal *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:wrap-anywhere" aria-label={copy("Sort keys", "Trier les clés")}><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="name">{copy("Name", "Nom")}</SelectItem><SelectItem value="client">Client</SelectItem><SelectItem value="models">{copy("ID count", "Nombre d’identifiants")}</SelectItem></SelectGroup></SelectContent></Select>
      <div className="min-w-0 [&_button]:h-auto [&_button]:min-h-8 [&_button]:w-full [&_button]:min-w-0 [&_button]:justify-start [&_button]:text-xs [&_button]:whitespace-normal [&_button]:wrap-anywhere"><ViewMenu format={view} onFormatChange={setView} /></div>
    </div>
    <p className="text-xs text-muted-foreground">{copy(`${shown.length} of ${keys.length} keys shown`, `${shown.length} clé${shown.length === 1 ? "" : "s"} affichée${shown.length === 1 ? "" : "s"} sur ${keys.length}`)}</p>
    {!shown.length && <p className="rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground">{copy("No keys match these filters.", "Aucune clé ne correspond à ces filtres.")}</p>}
    {view === "table" && shown.length > 0 ? <div className="overflow-x-auto rounded-sm border bg-card"><Table><TableHeader><TableRow><TableHead>{copy("Key", "Clé")}</TableHead><TableHead>Client</TableHead><TableHead>{copy("Catalog", "Catalogue")}</TableHead><TableHead>{copy("Demo token", "Jeton démo")}</TableHead><TableHead>{copy("Actions", "Actions")}</TableHead></TableRow></TableHeader><TableBody>{shown.map(key => <TableRow key={key.id}><TableCell className="font-medium">{key.draft.name}</TableCell><TableCell>{key.draft.client || "—"}</TableCell><TableCell>{plannedExposures(key.draft, groups, models).length} {copy("IDs", "identifiants")}</TableCell><TableCell><code className="text-xs">{key.readonly ? "—" : "DEMO_NOT_VALID_••••"}</code></TableCell><TableCell>{actions(key)}</TableCell></TableRow>)}</TableBody></Table></div> : view !== "table" && <CatalogGrid format={view}>{shown.map(card)}</CatalogGrid>}
    <p className="text-xs text-muted-foreground">{copy("Changes reset when this page reloads.", "Les modifications disparaissent au rechargement de la page.")}</p>
    <Dialog open={manualToken !== null} onOpenChange={open => { if (!open) setManualToken(null); }}><DialogContent><DialogHeader><DialogTitle>{copy("Copy the demo token manually", "Copier le jeton de démonstration manuellement")}</DialogTitle><DialogDescription>{copy("Clipboard access failed. This value is synthetic and cannot authenticate.", "L’accès au presse-papiers a échoué. Cette valeur fictive ne permet aucune authentification.")}</DialogDescription></DialogHeader><Field><FieldLabel htmlFor="manual-demo-token">{copy("Demo token", "Jeton de démonstration")}</FieldLabel><Input id="manual-demo-token" readOnly value={manualToken ?? ""} onFocus={event => event.target.select()} /></Field><DialogFooter><Button onClick={() => setManualToken(null)}>{copy("Close", "Fermer")}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
