import { Layers3, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CatalogCard, CatalogGrid } from "@/components/registry/CatalogCard";
import { ProviderSummary } from "@/components/registry/CompactCollection";
import { cardFormat, gridColumns, ViewControls, type ViewOptions } from "@/components/registry/ViewOptions";
import { useCopy } from "../../lib/locale";
import type { Group, Key, Model } from "../../domain/registry";

type Props = {
  groups: Group[];
  models: Model[];
  keys: Key[];
  search: string;
  onSearch: (value: string) => void;
  view: ViewOptions;
  onViewChange: (value: ViewOptions) => void;
  onResetView: () => void;
  onCreate: () => void;
  onEdit: (group: Group) => void;
};

export function GroupLibrary({ groups, models, keys, search, onSearch, view, onViewChange, onResetView, onCreate, onEdit }: Props) {
  const copy = useCopy();
  const query = search.trim().toLocaleLowerCase();
  const filtered = groups.filter(group => {
    const memberModels = group.members.map(id => models.find(model => model.id === id));
    const providers = memberModels.flatMap(model => model?.accesses.map(access => access.provider) || []);
    const keyNames = keys.filter(key => key.managed !== false && key.policy.groups.includes(group.id)).map(key => key.name);
    return [group.name, group.description, ...group.members, ...memberModels.flatMap(model => model ? [model.name, model.id, model.creator, model.family] : []), ...providers, ...keyNames].join(" ").toLocaleLowerCase().includes(query);
  });
  const providerIds = (group: Group) => [...new Set(group.members.flatMap(id => models.find(model => model.id === id)?.accesses.map(access => access.provider) || []))];
  const users = (group: Group) => keys.filter(key => key.managed !== false && key.policy.groups.includes(group.id));
  const format = cardFormat(view);
  const count = (n: number) => `${n} ${copy(n === 1 ? "model" : "models", n === 1 ? "modèle" : "modèles")}`;

  const card = (group: Group) => {
    const groupUsers = users(group);
    const missing = group.members.filter(id => !models.some(model => model.id === id));
    return <CatalogCard key={group.id} format={format} header={<><span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-primary/15 bg-primary/10 text-primary"><Layers3 className="size-4" /></span><div className="min-w-0 flex-1"><CardTitle className="truncate text-sm font-semibold" title={group.name}>{group.name}</CardTitle>{view.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{group.description || copy("Shared model selection", "Sélection de modèles partagée")}</p>}</div></>} footer={<>{view.providers && <ProviderSummary ids={providerIds(group)} scope="group" />}<Button size="sm" variant="outline" onClick={() => onEdit(group)}>{copy("Edit group", "Modifier le groupe")}</Button></>}>
      <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{count(group.members.length)}</p>{view.metadata && <Badge variant="secondary" title={copy(`${groupUsers.length} keys use this group`, `${groupUsers.length} clés utilisent ce groupe`)}>{copy(`${groupUsers.length} keys`, `${groupUsers.length} clés`)}</Badge>}</div>
      {missing.length > 0 && <Badge variant="warning" title={copy("Some saved model IDs are no longer in the registry.", "Certains IDs enregistrés ne figurent plus dans le registre.")}>{copy(`${missing.length} unavailable`, `${missing.length} indisponible${missing.length === 1 ? "" : "s"}`)}</Badge>}
    </CatalogCard>;
  };

  return <div className="mx-auto flex max-w-7xl flex-col gap-4 pb-24">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy("Groups", "Groupes")}</h2><p className="mt-1 max-w-prose text-sm text-foreground/70">{copy("Reusable model selections shared by virtual keys. Every member model contributes all of its linked provider accesses.", "Sélections de modèles réutilisables entre clés virtuelles. Chaque modèle membre apporte tous ses accès fournisseurs liés.")}</p></div><Button onClick={onCreate}><Plus data-icon="inline-start" />{copy("Create group", "Créer un groupe")}</Button></div>
    <div className="flex flex-wrap items-center gap-2 rounded-sm border bg-card p-3 shadow-sm"><Input aria-label={copy("Search groups", "Rechercher des groupes")} value={search} onChange={event => onSearch(event.target.value)} placeholder={copy("Group, model, creator or provider…", "Groupe, modèle, créateur ou fournisseur…")} className="min-w-48 flex-1" /><ViewControls value={view} onChange={onViewChange} onReset={onResetView} scope={copy("Groups", "Groupes")} fields={["description", "metadata", "providers"]} catalogFormats /></div>
    <p className="text-xs text-muted-foreground" aria-live="polite">{copy(`${filtered.length} of ${groups.length} groups`, `${filtered.length} groupe${filtered.length === 1 ? "" : "s"} sur ${groups.length}`)}</p>
    {!filtered.length ? <div className="rounded-sm border border-dashed p-8 text-center"><Layers3 className="mx-auto mb-3 size-7 text-muted-foreground" /><p className="font-medium">{groups.length ? copy("No matching groups", "Aucun groupe correspondant") : copy("No groups yet", "Aucun groupe pour le moment")}</p><p className="mt-1 text-sm text-muted-foreground">{groups.length ? copy("Try another search or clear it.", "Modifiez la recherche ou effacez-la.") : copy("Create a group to share registered model selections across keys.", "Créez un groupe pour partager des modèles enregistrés entre clés.")}</p>{groups.length ? <Button className="mt-3" variant="outline" onClick={() => onSearch("")}>{copy("Clear search", "Effacer la recherche")}</Button> : <Button className="mt-3" onClick={onCreate}><Plus data-icon="inline-start" />{copy("Create group", "Créer un groupe")}</Button>}</div> : view.layout === "table" ? <div className="overflow-x-auto rounded-sm border bg-card shadow-sm"><Table><TableHeader><TableRow><TableHead>{copy("Group", "Groupe")}</TableHead><TableHead>{copy("Models", "Modèles")}</TableHead><TableHead>{copy("Provider accesses", "Accès fournisseurs")}</TableHead><TableHead>{copy("Used by", "Utilisé par")}</TableHead><TableHead className="text-right">{copy("Action", "Action")}</TableHead></TableRow></TableHeader><TableBody>{filtered.map(group => <TableRow key={group.id}><TableCell className="min-w-40"><p className="font-medium">{group.name}</p>{view.description && <p className="max-w-xs break-words text-xs text-muted-foreground">{group.description}</p>}</TableCell><TableCell>{count(group.members.length)}</TableCell><TableCell>{view.providers && <ProviderSummary ids={providerIds(group)} scope="group" />}</TableCell><TableCell>{view.metadata && copy(`${users(group).length} keys`, `${users(group).length} clés`)}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => onEdit(group)}>{copy("Edit", "Modifier")}</Button></TableCell></TableRow>)}</TableBody></Table></div> : <CatalogGrid format={format} columns={gridColumns(view.size)}>{filtered.map(card)}</CatalogGrid>}
  </div>;
}
