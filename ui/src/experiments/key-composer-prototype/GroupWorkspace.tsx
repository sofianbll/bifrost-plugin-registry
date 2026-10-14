import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CatalogCard, CatalogGrid } from "@/components/registry/CatalogCard";
import { ProviderSummary } from "./CompactCollection";
import { ComposerBrowser } from "./browser";
import { useCopy } from "../../lib/locale";
import { emptyDraft, plannedExposures, reconcileSelection, resolveDraft, toggleAccess, toggleModel, type KeyDraft, type ProtoAccess, type ProtoGroup, type ProtoModel } from "./state";
import type { SimulatedKey } from "./key-state";
import { ViewMenu, type DisplayFormat } from "./ViewMenu";
import { AccessDetailDialog } from "./shared";

type Props = { groups: ProtoGroup[]; models: ProtoModel[]; keys: SimulatedKey[]; onGroupsChange: (groups: ProtoGroup[]) => void; onPageChange: () => void };
type Change = { key: SimulatedKey; gained: string[]; lost: string[]; accessGained: string[]; accessLost: string[] };

const makeDraft = (group: ProtoGroup): KeyDraft => ({
  ...emptyDraft(),
  added: group.members.map(member => ({ modelId: member.modelId, accesses: [...member.accesses] })),
});

export default function GroupWorkspace({ groups, models, keys, onGroupsChange, onPageChange }: Props) {
  const copy = useCopy();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<DisplayFormat>("compact");
  const [editing, setEditing] = useState<ProtoGroup | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<KeyDraft>(emptyDraft);
  const [detail, setDetail] = useState<{ model: ProtoModel; access: ProtoAccess } | null>(null);

  const begin = (group?: ProtoGroup) => {
    const value = group ? structuredClone(group) : { id: `group-${crypto.randomUUID()}`, name: "", description: "", members: [] };
    setEditing(value);
    setName(value.name);
    setDescription(value.description);
    setDraft(makeDraft(value));
    onPageChange();
  };
  const selected = draft.added.map(member => member.modelId);
  const resolved = useMemo(() => new Map(resolveDraft(draft, [], models).map(item => [item.model.id, item])), [draft, models]);
  const filteredGroups = groups.filter(group => {
    const haystack = [group.name, group.description, ...group.members.flatMap(member => [member.modelId, models.find(model => model.id === member.modelId)?.name ?? "", ...member.accesses])].join(" ").toLocaleLowerCase();
    return haystack.includes(search.trim().toLocaleLowerCase());
  });
  const candidate = editing ? { ...editing, name: name.trim(), description: description.trim(), members: resolveDraft(draft, [], models)
    .filter(item => item.state === "active")
    .map(item => ({ modelId: item.model.id, accesses: item.accesses.filter(access => access.state === "active").map(access => access.access.id) })) } : null;
  const changes: Change[] = candidate ? keys.filter(key => key.draft.groups.includes(candidate.id)).map(key => {
    const before = new Set(plannedExposures(key.draft, groups, models));
    const nextGroups = groups.map(group => group.id === candidate.id ? candidate : group);
    const after = new Set(plannedExposures(key.draft, nextGroups, models));
    const activeAccesses = (currentGroups: ProtoGroup[]) => new Set(resolveDraft(key.draft, currentGroups, models).flatMap(model => model.state === "active" ? model.accesses.filter(access => access.state === "active").map(access => access.access.id) : []));
    const oldAccesses = activeAccesses(groups);
    const nextAccesses = activeAccesses(nextGroups);
    return { key, gained: [...after].filter(id => !before.has(id)), lost: [...before].filter(id => !after.has(id)), accessGained: [...nextAccesses].filter(id => !oldAccesses.has(id)), accessLost: [...oldAccesses].filter(id => !nextAccesses.has(id)) };
  }) : [];
  const changed = candidate && JSON.stringify(groups.find(group => group.id === candidate.id) ?? null) !== JSON.stringify(candidate);
  const save = () => {
    if (!candidate || !candidate.name) return;
    const exists = groups.some(group => group.id === candidate.id);
    onGroupsChange(exists ? groups.map(group => group.id === candidate.id ? candidate : group) : [...groups, candidate]);
    setEditing(null);
    onPageChange();
  };

  if (editing && candidate) {
    const allResolved = resolveDraft(draft, [], models);
    const chosen = allResolved.filter(item => item.state === "active");
    const callbacks = {
      onToggleModel: (model: ProtoModel) => setDraft(current => toggleModel(current, model, [])),
      onToggleAccess: (resolution: Parameters<typeof toggleAccess>[1]) => setDraft(current => toggleAccess(current, resolution)),
      onShowDetail: (model: ProtoModel, access: ProtoAccess) => setDetail({ model, access }),
    };
    const beforeGroup = groups.find(group => group.id === candidate.id);
    return <div className="mx-auto flex max-w-7xl flex-col gap-4 pb-24">
      <Button type="button" variant="ghost" className="w-fit" onClick={() => { setEditing(null); onPageChange(); }}><ArrowLeft data-icon="inline-start" />{copy("All groups", "Tous les groupes")}</Button>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 space-y-4">
          <div><div className="flex flex-wrap items-center gap-2"><Field className="min-w-48 flex-1 gap-1"><FieldLabel htmlFor="group-name">{copy("Group name", "Nom du groupe")}</FieldLabel><Input id="group-name" value={name} onChange={event => setName(event.target.value)} autoFocus /></Field><Badge variant="outline">{copy("Shared selection", "Sélection partagée")}</Badge></div><Field className="mt-3 gap-1"><FieldLabel htmlFor="group-description">{copy("Description", "Description")}</FieldLabel><Input id="group-description" value={description} onChange={event => setDescription(event.target.value)} placeholder={copy("What is this group for?", "À quoi sert ce groupe ?")} /></Field></div>
          <div><h3 className="text-lg font-semibold">{chosen.length} {copy(chosen.length === 1 ? "model" : "models", chosen.length === 1 ? "modèle" : "modèles")}</h3><p className="text-sm text-muted-foreground">{copy("Choose models and their provider accesses for this group.", "Choisissez les modèles et leurs accès fournisseurs pour ce groupe.")}</p></div>
          {models.length ? <ComposerBrowser models={models} selectionScope="group" selected={selected} onSetSelected={ids => setDraft(current => reconcileSelection(current, ids, [], models))} draft={draft} groups={[]} resolved={resolved} callbacks={callbacks} /> : <p className="rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground">{copy("No models are available.", "Aucun modèle disponible.")}</p>}
        </section>
        <aside className="h-fit min-w-0 space-y-3 rounded-sm border bg-card p-4 shadow-sm xl:sticky xl:top-4">
          <div><Badge variant="secondary">{copy("Preview · unsaved", "Aperçu · non enregistré")}</Badge><h3 className="mt-2 text-lg font-semibold">{copy("Change preview", "Aperçu des changements")}</h3></div>
          <p className="text-sm text-muted-foreground">{copy(`${changes.length} keys currently use this group.`, `${changes.length} clés utilisent actuellement ce groupe.`)}</p>
          {changes.length ? <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">{changes.map(({ key, gained, lost, accessGained, accessLost }) => <li key={key.id} className="border-b pb-2"><div className="flex flex-wrap justify-between gap-1"><span className="font-medium">{key.draft.name} {key.readonly && <span className="text-xs text-muted-foreground">· {copy("read-only", "lecture seule")}</span>}</span><span className="text-muted-foreground">{gained.length ? `+${gained.length}` : ""}{gained.length && lost.length ? " · " : ""}{lost.length ? `−${lost.length}` : ""}{accessGained.length || accessLost.length ? ` · ${accessGained.length ? `+${accessGained.length}` : ""}${accessGained.length && accessLost.length ? "/" : ""}${accessLost.length ? `−${accessLost.length}` : ""} ${copy("accesses", "accès")}` : gained.length || lost.length ? ` ${copy("IDs", "identifiants")}` : ` ${copy("no catalog change", "aucun changement de catalogue")}`}</span></div>{(gained.length > 0 || lost.length > 0 || accessGained.length > 0 || accessLost.length > 0) && <p className="mt-1 break-words text-xs text-muted-foreground">{[...gained.map(id => `${copy("ID +", "ID +")} ${id}`), ...lost.map(id => `${copy("ID −", "ID −")} ${id}`), ...accessGained.map(id => `${copy("Access +", "Accès +")} ${id}`), ...accessLost.map(id => `${copy("Access −", "Accès −")} ${id}`)].join(" · ")}</p>}</li>)}</ul> : <p className="text-sm text-muted-foreground">{copy("No keys currently use this group.", "Aucune clé n’utilise actuellement ce groupe.")}</p>}
          <div className="border-t pt-3"><p className="text-sm font-semibold">{chosen.length} {copy("models selected", "modèles sélectionnés")}</p><p className="mt-1 text-xs text-muted-foreground">{copy("Key exclusions remain in place. Saving updates only this in-memory prototype.", "Les exclusions propres aux clés restent en place. L’enregistrement ne modifie que ce prototype en mémoire.")}</p></div>
          <div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => { setEditing(null); onPageChange(); }}>{copy("Cancel", "Annuler")}</Button><Button type="button" className="flex-1" disabled={!name.trim() || !changed} onClick={save}>{copy("Save group", "Enregistrer le groupe")}</Button></div>
          {beforeGroup && <p className="text-xs text-muted-foreground">{copy("Changes are applied to linked keys only after saving.", "Les changements ne s’appliquent aux clés liées qu’après l’enregistrement.")}</p>}
        </aside>
      </div>
      <AccessDetailDialog model={detail?.model ?? null} access={detail?.access ?? null} onClose={() => setDetail(null)} />
    </div>;
  }

  const card = (group: ProtoGroup) => {
    const members = group.members.map(member => models.find(model => model.id === member.modelId)).filter((model): model is ProtoModel => !!model);
    const providers = group.members.flatMap(member => member.accesses.map(id => models.find(model => model.id === member.modelId)?.accesses.find(access => access.id === id)?.provider).filter((value): value is string => !!value));
    return <CatalogCard key={group.id} format={view === "table" ? "compact" : view} header={<><span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-primary/15 bg-primary/10 text-primary"><Users className="size-4" /></span><div className="min-w-0"><CardTitle className="truncate text-sm font-semibold" title={group.name}>{group.name}</CardTitle><p className="mt-0.5 truncate text-xs text-muted-foreground">{group.description || copy("Shared model selection", "Sélection de modèles partagée")}</p></div></>} footer={<Button type="button" size="sm" variant="outline" onClick={() => begin(group)}>{copy("Open group", "Ouvrir le groupe")}</Button>}>
      <p className="text-sm font-semibold">{members.length} {copy(members.length === 1 ? "model" : "models", members.length === 1 ? "modèle" : "modèles")}</p><ProviderSummary ids={providers} />
    </CatalogCard>;
  };
  return <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-24">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy("Groups", "Groupes")}</h2><p className="mt-1 max-w-prose text-sm text-foreground/70">{copy("Reusable model and provider-access selections shared by virtual keys.", "Sélections réutilisables de modèles et d’accès fournisseurs, partagées entre les clés virtuelles.")}</p></div><Button type="button" onClick={() => begin()}><Plus data-icon="inline-start" />{copy("Create group", "Créer un groupe")}</Button></div>
    <div className="flex flex-wrap gap-2 rounded-sm border bg-card p-2 shadow-sm"><Field className="min-w-48 flex-1 gap-0"><FieldLabel htmlFor="group-search" className="sr-only">{copy("Search groups", "Rechercher des groupes")}</FieldLabel><div className="relative"><Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input id="group-search" className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder={copy("Group, model or access ID…", "Groupe, modèle ou identifiant d’accès…")} /></div></Field><ViewMenu format={view} onFormatChange={setView} />
    </div>
    <p className="text-xs text-muted-foreground">{copy(`${filteredGroups.length} of ${groups.length} groups`, `${filteredGroups.length} groupe${filteredGroups.length === 1 ? "" : "s"} sur ${groups.length}`)}</p>
    {!filteredGroups.length ? <p className="rounded-sm border border-dashed p-8 text-center text-sm text-muted-foreground">{groups.length ? copy("No groups match this search.", "Aucun groupe ne correspond à cette recherche.") : copy("No groups yet. Create a group to reuse a model selection across keys.", "Aucun groupe. Créez-en un pour partager une sélection de modèles entre plusieurs clés.")}</p> : view === "table" ? <div className="overflow-x-auto rounded-sm border bg-card"><Table><TableHeader><TableRow><TableHead>{copy("Group", "Groupe")}</TableHead><TableHead>{copy("Models", "Modèles")}</TableHead><TableHead>{copy("Provider accesses", "Accès fournisseurs")}</TableHead><TableHead>{copy("Actions", "Actions")}</TableHead></TableRow></TableHeader><TableBody>{filteredGroups.map(group => <TableRow key={group.id}><TableCell><div className="font-medium">{group.name}</div><div className="max-w-sm truncate text-xs text-muted-foreground">{group.description}</div></TableCell><TableCell>{group.members.length}</TableCell><TableCell><ProviderSummary ids={group.members.flatMap(member => member.accesses.map(id => models.find(model => model.id === member.modelId)?.accesses.find(access => access.id === id)?.provider).filter((id): id is string => !!id))} /></TableCell><TableCell><Button size="sm" variant="outline" onClick={() => begin(group)}>{copy("Open", "Ouvrir")}</Button></TableCell></TableRow>)}</TableBody></Table></div> : <CatalogGrid format={view}>{filteredGroups.map(card)}</CatalogGrid>}
    <p className="text-xs text-muted-foreground">{copy("Group changes are synthetic and remain in memory; linked keys are only updated when you save.", "Les groupes sont fictifs et restent en mémoire ; les clés liées ne changent qu’à l’enregistrement.")}</p>
  </div>;
}
