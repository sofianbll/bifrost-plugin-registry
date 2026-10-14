import { useState } from "react";
import { Layers3, ListTree } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import ModelBrowser from "../catalog/ModelBrowser";
import { useCopy } from "../../lib/locale";
import { keyImpact, modelImpact, type Group, type Key, type Model } from "../../domain/registry";
import { GroupTree } from "./GroupTree";
import type { ViewOptions } from "../../components/registry/ViewOptions";

type Props = {
  group: Group | null;
  groups: Group[];
  models: Model[];
  keys: Key[];
  snapshotMode: boolean;
  busy: boolean;
  preferences: ViewOptions;
  onChange: (group: Group) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

export function GroupEditor({ group, groups, models, keys, snapshotMode, busy, preferences, onChange, onSave, onCancel, onDelete }: Props) {
  const copy = useCopy();
  const [selectionView, setSelectionView] = useState<"cards" | "tree">("cards");
  if (!group) return null;
  const saved = groups.find(item => item.id === group.id);
  const existing = !!saved;
  const nextGroups = existing ? groups.map(item => item.id === group.id ? group : item) : [...groups, group];
  const linkedKeys = keys.filter(key => key.managed !== false && key.policy.groups.includes(group.id));
  const changedKeys = new Set(keyImpact(keys, groups, nextGroups, models).filter(row => row.key.managed !== false).map(row => row.key.id));
  const count = (n: number) => `${n} ${copy(n === 1 ? "model" : "models", n === 1 ? "modèle" : "modèles")}`;
  const name = (ids: string[]) => ids.map(id => models.find(model => model.id === id)?.name || id).join(", ") || copy("None", "Aucun");
  const toggle = (id: string) => onChange({ ...group, members: group.members.includes(id) ? group.members.filter(member => member !== id) : [...group.members, id] });

  return <div className="flex min-h-0 flex-1 flex-col gap-4">
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pb-3">
      <div className="space-y-3"><Field><FieldLabel htmlFor="group-name">{copy("Group name", "Nom du groupe")}</FieldLabel><Input id="group-name" autoFocus value={group.name} onChange={event => onChange({ ...group, name: event.target.value })} /></Field><Field><FieldLabel htmlFor="group-description">{copy("Description", "Description")}</FieldLabel><Input id="group-description" value={group.description} onChange={event => onChange({ ...group, description: event.target.value })} placeholder={copy("What is this group for?", "À quoi sert ce groupe ?")} /></Field></div>
      <section className="space-y-3 border-t pt-4"><div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-base font-semibold">{count(group.members.length)}</h3><p className="text-xs text-muted-foreground">{copy("Choose registered models. Every linked provider access is included.", "Choisissez des modèles enregistrés. Tous leurs accès fournisseurs liés sont inclus.")}</p></div><div className="flex gap-1" aria-label={copy("Model selection view", "Affichage de la sélection")}>{(["cards", "tree"] as const).map(view => <Button key={view} type="button" size="sm" variant={selectionView === view ? "secondary" : "ghost"} aria-pressed={selectionView === view} onClick={() => setSelectionView(view)}>{view === "cards" ? <Layers3 data-icon="inline-start" /> : <ListTree data-icon="inline-start" />}{copy(view === "cards" ? "Cards" : "Creator tree", view === "cards" ? "Cartes" : "Arbre des créateurs")}</Button>)}</div></div>
        {models.length ? selectionView === "cards" ? <ModelBrowser models={models} selected={group.members} onToggle={toggle} onSetSelected={ids => onChange({ ...group, members: ids })} preferences={preferences} compact label={copy("Group models", "Modèles du groupe")} selectionNote={copy("All provider accesses for selected models are included.", "Tous les accès fournisseurs des modèles sélectionnés sont inclus.")} /> : <GroupTree models={models} selected={group.members} onToggle={toggle} /> : <p className="rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground">{copy("No registered models are available. Add a model in Models first.", "Aucun modèle enregistré. Ajoutez d’abord un modèle dans Modèles.")}</p>}
        {group.members.some(id => !models.some(model => model.id === id)) && <p className="text-xs text-chart-warning-ink">{copy("Saved IDs no longer available: ", "IDs enregistrés indisponibles : ")}{group.members.filter(id => !models.some(model => model.id === id)).join(", ")}</p>}
      </section>
      <section className="space-y-3 border-t pt-4"><div><h3 className="text-base font-semibold">{copy("Key impact preview", "Aperçu de l’impact sur les clés")}</h3><p className="text-xs text-muted-foreground">{copy("Only Registry-managed keys that already use this group are affected.", "Seules les clés Registry qui utilisent déjà ce groupe sont concernées.")}</p></div>
        {linkedKeys.length ? <div className="space-y-2">{linkedKeys.map(key => {
          const impact = modelImpact(key, groups, nextGroups);
          const changed = changedKeys.has(key.id);
          return <article key={key.id} className="rounded-sm border bg-card p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">{key.name}</h4><Badge variant={changed ? "warning" : "secondary"}>{changed ? copy("Will change on save", "Changera à l’enregistrement") : copy("No model change", "Aucun changement de modèles")}</Badge></div><p className="mt-2 text-xs"><strong>{copy("Added:", "Ajoutés :")}</strong> {name(impact.added)}</p><p className="text-xs"><strong>{copy("Removed:", "Retirés :")}</strong> {name(impact.removed)}</p><p className="text-xs"><strong>{copy("Unchanged:", "Inchangés :")}</strong> {name(impact.unchanged)}</p><p className="text-xs text-muted-foreground"><strong>{copy("Local exclusions preserved:", "Exclusions locales préservées :")}</strong> {name(impact.exclusions)}</p></article>;
        })}</div> : <p className="rounded-sm border border-dashed p-4 text-sm text-muted-foreground">{existing ? copy("No Registry-managed key currently uses this group.", "Aucune clé Registry gérée n’utilise actuellement ce groupe.") : copy("This new group is not assigned to any key yet.", "Ce nouveau groupe n’est encore associé à aucune clé.")}</p>}
      </section>
      {snapshotMode && <p className="text-xs text-muted-foreground">{copy("Saving updates this local copy only. No live gateway change is made.", "L’enregistrement modifie uniquement cette copie locale. Aucun changement n’est appliqué au gateway actif.")}</p>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-background pt-3"><div>{existing && <Button type="button" variant="ghost" className="text-destructive" disabled={busy} onClick={onDelete}>{copy("Delete group", "Supprimer le groupe")}</Button>}</div><div className="ml-auto flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{copy("Cancel", "Annuler")}</Button><Button type="button" disabled={busy || !group.name.trim() || !group.members.length} onClick={onSave}>{snapshotMode ? copy("Save locally", "Enregistrer localement") : copy("Publish group", "Publier le groupe")}</Button></div></div>
  </div>;
}
