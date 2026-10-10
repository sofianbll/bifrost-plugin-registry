import { useMemo, useState } from "react";
import { ArrowRight, Check, Clipboard, Eye, Layers3, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import ModelBrowser from "../catalog/ModelBrowser";
import { BrandIcon } from "../../components/registry/BrandIcon";
import { displayProvider, ProviderMark } from "../../components/registry/BrandIcon";
import type { ViewOptions } from "../../components/registry/ViewOptions";
import { delta, exposed, members, origin, same, toggleModel, type Group, type Key, type Model, type Policy, type Publication } from "../../domain/registry";
import { useCopy, useFormat } from "../../lib/locale";
import { accessOrigin, keyBaseline, keyComposition, modelOrigin, toggleAccess, toggleVisibleModels, type AccessOrigin, type AliasBadge, type AliasStatus } from "./KeyComposer.state";

type Props = {
  virtualKey: Key;
  draft: Policy;
  onDraftChange: (draft: Policy) => void;
  models: Model[];
  groups: Group[];
  preferences: ViewOptions;
  busy: boolean;
  snapshotMode: boolean;
  expert: boolean;
  publishDisabled?: boolean;
  onPublish: () => void;
  onDiscard: () => void;
  onReread: () => void;
};

const formats: Policy["naming"][] = ["model", "provider/model", "both"];

export default function KeyComposer({ virtualKey, draft, onDraftChange, models, groups, preferences, busy, snapshotMode, expert, publishDisabled, onPublish, onDiscard, onReread }: Props) {
  const copy = useCopy();
  const localized = useFormat();
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<"models" | "groups">("models");
  const [showReadback, setShowReadback] = useState(false);
  const composition = useMemo(() => keyComposition(draft, groups, models), [draft, groups, models]);
  const savedIds = useMemo(() => exposed(virtualKey.policy, groups, models), [virtualKey.policy, groups, models]);
  const baseline = useMemo(() => keyBaseline(virtualKey, groups, models), [virtualKey, groups, models]);
  const changes = delta(baseline.ids, composition.ids);
  const dirty = !same(draft, virtualKey.policy);
  const selected = composition.selected;
  const excluded = composition.excluded;
  const selectedAccessCount = useMemo(() => [...composition.byModel.values()].reduce((sum, m) => sum + m.retained.length, 0), [composition.byModel]);
  const toggleGroup = (id: string) => onDraftChange({ ...draft, groups: draft.groups.includes(id) ? draft.groups.filter(value => value !== id) : [...draft.groups, id] });
  const selectVisible = (visible: string[], target: string[]) => onDraftChange(toggleVisibleModels(draft, visible, target, models, groups));
  const selectionDetails = (id: string) => {
    const state = modelOrigin(id, draft, groups);
    return {
      source: state.excluded
        ? `${state.inherited.length ? `${copy("Inherited", "Hérité")} · ${state.inherited.join(", ")} · ` : ""}${copy("Excluded for this key", "Exclu pour cette clé")}`
        : [state.inherited.length ? `${copy("Inherited", "Hérité")} · ${state.inherited.join(", ")}` : "", state.added ? copy("Added to this key", "Ajouté à cette clé") : ""].filter(Boolean).join(" · ") || copy("Not selected", "Non sélectionné"),
      action: state.excluded
        ? state.inherited.length ? copy("Restore for this key", "Rétablir pour cette clé") : copy("Add to this key", "Ajouter à cette clé")
        : state.inherited.length ? copy("Exclude from this key", "Exclure de cette clé") : state.added ? copy("Remove from this key", "Retirer de cette clé") : copy("Add to this key", "Ajouter à cette clé"),
    };
  };

  const aliasBadge = (badge: AliasBadge) => {
    const labels: Record<AliasStatus, string> = {
      shared: copy("Native routing among ", "Routage natif entre ") + badge.count + copy(" accesses", " accès"),
      pinned: copy("Pinned alias", "Alias épinglé"),
      mono: copy("Single access", "Accès unique"),
    };
    const variants: Record<AliasStatus, "default" | "secondary" | "warning"> = { shared: "warning", pinned: "default", mono: "secondary" };
    return <Badge variant={variants[badge.status]}>{labels[badge.status]}</Badge>;
  };

  const modelList = (ids: string[]) => ids.map(id => {
    const model = models.find(item => item.id === id);
    const from = origin(id, draft, groups);
    const isExcluded = draft.excluded.includes(id);
    return <div key={id} className={`flex min-w-0 items-start gap-2 border-b py-2 last:border-b-0 ${isExcluded ? "bg-chart-warning/5" : ""}`}>
      {model && <BrandIcon model={model} mode={preferences.logo} />}
      <div className="min-w-0 flex-1">
        <details>
          <summary className="cursor-pointer break-words text-sm font-medium">{model?.name || id}{virtualKey.pendingAccessSelection?.[id] && !draft.accessSelection?.[id] && <Badge variant="warning" className="ml-2">{copy("Choose an access", "Choisir un accès")}</Badge>}</summary>
          <div className="mt-1 space-y-1">
            <p className="break-all font-mono text-xs text-muted-foreground">{id}</p>
            <div className="flex flex-wrap gap-1">
              {from.map(name => <Badge key={name} variant="secondary">{copy("Inherited", "Hérité")} · {name}</Badge>)}
              {draft.added.includes(id) && <Badge>{copy("Added directly", "Ajouté directement")}</Badge>}
              {isExcluded && <Badge variant="warning">{copy("Excluded locally", "Exclu pour cette clé")}</Badge>}
            </div>
            {model && <div className="space-y-1">{model.accesses.length ? model.accesses.map(access => <p key={access.id} className="break-all text-xs text-muted-foreground">{displayProvider(access.provider)} · {copy("access ID", "ID d’accès")} {access.id} · {copy("native model", "modèle natif")} {access.nativeModel || "—"} <span>({copy(access.status, access.status === "Configured" ? "Configuré" : "Inconnu")})</span></p>) : <p className="text-xs text-muted-foreground">{copy("No provider access recorded", "Aucun accès fournisseur enregistré")}</p>}</div>}
            {model && composition.selected.includes(id) && (model.accesses.length > 1 || draft.accessSelection?.[id]) && <div className="mt-2 space-y-1">
              <p className="text-xs font-medium">{copy("Accesses", "Accès")}</p>
              {model.accesses.map(access => {
                const o = accessOrigin(access.id, id, draft, groups);
                const checked = o !== "excluded";
                return <label key={access.id} className="flex cursor-pointer items-center gap-2 rounded-sm py-1">
                  <Checkbox checked={checked} disabled={busy} onCheckedChange={() => onDraftChange(toggleAccess(draft, id, access.id, models, groups))} aria-label={`${checked ? copy("Exclude", "Exclure") : copy("Include", "Inclure")} ${access.id}`} />
                  <ProviderMark id={access.provider} />
                  <span className="min-w-0 flex-1 break-all text-xs text-muted-foreground">{access.id}</span>
                  {o && <Badge variant={o === "excluded" ? "warning" : o === "added" ? "default" : "secondary"}>{o === "excluded" ? copy("Excluded locally", "Exclu pour cette clé") : o === "added" ? copy("Added", "Ajouté") : copy("Inherited", "Hérité")}</Badge>}
                </label>;
              })}
              {composition.byModel.get(id)?.unknown.map(accessId => <div key={accessId} className="flex items-center gap-2 rounded-sm py-1">
                <span className="flex size-4 shrink-0 items-center justify-center text-chart-warning"><span aria-hidden="true">!</span></span>
                <span className="min-w-0 flex-1 break-all text-xs text-muted-foreground">{accessId}</span>
                <Badge variant="warning">{copy("Unknown access", "Accès inconnu")}</Badge>
              </div>)}
            </div>}
          </div>
        </details>
      </div>
      <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" disabled={busy} aria-label={isExcluded ? copy(`Restore ${model?.name || id}`, `Rétablir ${model?.name || id}`) : copy(`Remove ${model?.name || id} from this key`, `Retirer ${model?.name || id} de cette clé`)} title={isExcluded ? copy("Restore", "Rétablir") : copy("Remove or exclude", "Retirer ou exclure")} onClick={() => onDraftChange(toggleModel(draft, id, groups))}>
        {isExcluded ? <RotateCcw className="size-3.5" /> : <X className="size-3.5" />}
      </Button>
    </div>;
  });

  const groupBrowser = <div className="space-y-3">
    {groups.map(group => {
      const checked = draft.groups.includes(group.id);
      const count = new Set(group.members).size;
      return <label key={group.id} className={`flex cursor-pointer items-start gap-3 rounded-sm border p-3 shadow-sm transition-colors hover:bg-muted/40 ${checked ? "border-chart-success/50 bg-chart-success/10" : "bg-card"}`}>
        <Checkbox checked={checked} disabled={busy} onCheckedChange={() => toggleGroup(group.id)} aria-label={`${checked ? copy("Remove group", "Retirer le groupe") : copy("Add group", "Ajouter le groupe")}: ${group.name}`} />
        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-medium"><Layers3 className="size-4 text-muted-foreground" />{group.name}{checked && <Badge variant="success">{copy("Inherited", "Hérité")}</Badge>}</span>{group.description && <span className="mt-1 block text-xs text-muted-foreground">{group.description}</span>}<span className="mt-1 block text-xs text-muted-foreground">{count} {copy(count === 1 ? "model" : "models", count === 1 ? "modèle" : "modèles")}</span>{checked && count > 0 && <span className="mt-2 block text-xs text-muted-foreground">{group.members.slice(0, 5).map(id => models.find(model => model.id === id)?.name || id).join(" · ")}{count > 5 ? ` · +${count - 5}` : ""}</span>}</span>
      </label>;
    })}
    {!groups.length && <p className="rounded-sm border border-dashed p-5 text-sm text-muted-foreground">{copy("No groups yet. Select models directly or create a group first.", "Aucun groupe. Choisissez des modèles ou créez d’abord un groupe.")}</p>}
  </div>;

  const browser = <ModelBrowser
    models={models}
    selected={selected}
    selectionDetails={selectionDetails}
    onToggle={id => onDraftChange(toggleModel(draft, id, groups))}
    onSetSelected={ids => selectVisible(models.map(model => model.id), ids)}
    preferences={preferences}
    compact
    label={copy("Key models", "Modèles de la clé")}
    selectionNote={`${selectedAccessCount} ${copy(selectedAccessCount === 1 ? "provider access selected" : "provider accesses selected", selectedAccessCount === 1 ? "accès fournisseur sélectionné" : "accès fournisseurs sélectionnés")}`}
  />;

  const idsPanel = <section className="space-y-3 border-t pt-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-semibold">{copy("IDs offered to applications", "Identifiants proposés aux applications")}</h3><span className="text-xs text-muted-foreground">{composition.ids.length} {copy("planned IDs", "ID prévus")}</span></div>
    <p className="text-xs text-muted-foreground">{copy("Draft preview only · not published or verified.", "Aperçu du brouillon · ni publié ni vérifié.")} {copy("The format changes model IDs; provider routing remains controlled by Bifrost.", "Le format modifie les ID modèle ; Bifrost garde le contrôle du routage fournisseur.")}</p>
    <div className="flex flex-wrap gap-1" role="group" aria-label={copy("ID format", "Format des ID")}>{formats.map(format => <Button key={format} type="button" size="sm" variant={draft.naming === format ? "default" : "outline"} aria-pressed={draft.naming === format} disabled={busy} onClick={() => onDraftChange({ ...draft, naming: format })}>{format === "both" ? copy("Both", "Les deux") : format === "model" ? copy("Model", "Modèle") : copy("Provider / model", "Fournisseur / modèle")}</Button>)}</div>
    <div className="max-h-40 overflow-auto rounded-sm border bg-card px-3" aria-live="polite">{composition.ids.map((id, index) => {
      const alias = models.find(m => m.id === id || m.alias === id)?.alias ?? (id.includes("/") ? id.split("/")[1] : id);
      const badge = composition.aliases[alias];
      return <div key={`${id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 break-all border-b py-1.5 font-mono text-xs last:border-0"><span>{id}</span>{badge && aliasBadge(badge)}</div>;
    })}{!composition.ids.length && <p className="py-3 text-xs text-muted-foreground">{copy("No selected models produce IDs yet.", "Aucun modèle sélectionné ne produit d’ID pour le moment.")}</p>}</div>
    <Button type="button" size="sm" variant="outline" disabled={!composition.ids.length} onClick={() => void copyIds(composition.ids.join("\n"))}><Clipboard className="size-3.5" />{copy("Copy planned IDs", "Copier les ID prévus")}</Button>
  </section>;
  const changesTitle = copy("Changes before publishing", "Changements avant publication");
  const changeList = (label: string, ids: string[], sign: string) => ids.length > 0 && <div><h4 className="text-xs font-semibold">{label} · {ids.length}</h4><ul aria-label={label} className="max-h-32 overflow-auto">{ids.map(id => <li key={id} className="break-all font-mono text-xs"><span aria-hidden="true">{sign} </span>{id}</li>)}</ul></div>;
  const changesPanel = <section aria-label={changesTitle} className="space-y-2 border-t pt-3">
    <h3 className="text-sm font-semibold">{changesTitle}</h3>
    <p className="text-xs text-muted-foreground">{baseline.source === "readback" ? copy("Compared with the last verified readback", "Comparé à la dernière relecture vérifiée") : baseline.source === "plan" ? copy("Compared with the last published plan", "Comparé au dernier plan publié") : copy("Compared with the current Bifrost permissions", "Comparé aux permissions Bifrost actuelles")}</p>
    {!changes.added.length && !changes.removed.length && <p className="text-xs text-muted-foreground">{copy("No change.", "Aucun changement.")}</p>}
    {changeList(copy("Will gain", "Ajoutés"), changes.added, "+")}
    {changeList(copy("Will lose", "Retirés"), changes.removed, "−")}
  </section>;
  const { copy: copyIds } = useCopyToClipboard({ successMessage: copy("Planned IDs copied", "ID prévus copiés"), errorMessage: copy("Could not copy IDs", "Impossible de copier les ID") });

  const readback = virtualKey.publication;
  const pending = Object.entries(virtualKey.pendingAccessSelection || {});
  const publication = (publication: Publication | undefined) => <Card className="gap-0 overflow-hidden py-0">
    <CardHeader className="border-b bg-muted/40 px-4 py-3 sm:px-5"><CardTitle className="flex flex-wrap items-center gap-2 text-base"><Eye className="size-4" />{snapshotMode ? copy("Saved in this local copy", "Enregistré dans cette copie locale") : copy("Published selection and readback", "Sélection publiée et relecture")}{!snapshotMode && <Badge variant={publication?.state === "verified" ? "success" : publication?.state === "drift" ? "warning" : "secondary"}>{publication?.state === "verified" ? copy("Verified", "Vérifiée") : publication?.state === "drift" ? copy("Drift detected", "Écart détecté") : copy("Not verified", "Non vérifiée")}</Badge>}</CardTitle><p className="text-xs text-muted-foreground">{snapshotMode ? copy("Changes stay in this copy; the gateway cannot be read back here.", "Les changements restent dans cette copie ; le gateway ne peut pas y être relu.") : copy("Readback checks the IDs returned by Bifrost. It does not test model inference.", "La relecture vérifie les ID renvoyés par Bifrost, pas les appels aux modèles.")}</p></CardHeader>
    <CardContent className="space-y-3 px-4 py-4 sm:px-5">
      {pending.length > 0 && <div role="alert" className="space-y-1 text-xs text-chart-warning-ink">
        <p>{copy("Several accesses offer these models and none is chosen, so this key does not publish them. In the model's Accesses list, uncheck the accesses this key must not use.", "Plusieurs accès proposent ces modèles et aucun n’est choisi : cette clé ne les publie pas. Dans la liste Accès du modèle, décochez ceux que cette clé ne doit pas utiliser.")}</p>
        {pending.map(([alias, accesses]) => <p key={alias} className="break-all font-mono">{alias} · {accesses.join(" · ")}</p>)}
      </div>}
      {snapshotMode ? <p className="break-all text-xs font-mono">{savedIds.join(" · ") || copy("No saved IDs.", "Aucun ID enregistré.")}</p> : <>
        <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={onReread}><RotateCcw className="size-3.5" />{copy("Read again", "Relire")}</Button>{publication?.checkedAt && <span className="break-all text-xs text-muted-foreground">{localized.date(publication.checkedAt)} · {copy("revision", "révision")} {publication.revision.slice(0, 12)}</span>}</div>
        {publication?.error && <p role="alert" className="text-xs text-chart-warning-ink">{publication.error}</p>}
        {publication?.state === "drift" && <p className="break-all text-xs text-destructive">{copy("Missing", "Manquants")}: {publication.missing.join(", ") || "—"} · {copy("Unexpected", "Inattendus")}: {publication.unexpected.join(", ") || "—"}</p>}
        <div className="max-h-36 space-y-1 overflow-auto">{(virtualKey.observed || publication?.actual || []).map((id, index) => <p key={`${id}-${index}`} className="break-all rounded-sm border px-2 py-1 font-mono text-xs">{id}</p>)}{!(virtualKey.observed || publication?.actual || []).length && <p className="text-xs text-muted-foreground">{copy("No successful readback is available.", "Aucune relecture réussie disponible.")}</p>}</div>
      </>}
    </CardContent>
  </Card>;

  const draftPanelContent = <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{copy("Key draft", "Brouillon de clé")}</h2>{dirty && <Badge variant="warning">{copy("Unpublished", "Non publié")}</Badge>}</div>
    <section className="min-h-0"><h3 className="mb-1 border-b pb-1 text-sm font-semibold">{copy("Composition", "Composition")} · {selected.length} {copy(selected.length === 1 ? "model" : "models", selected.length === 1 ? "modèle" : "modèles")}</h3>
      {!selected.length && !excluded.length && <p className="py-2 text-xs text-muted-foreground">{copy("Empty draft. Choose models or add groups.", "Brouillon vide. Choisissez des modèles ou ajoutez des groupes.")}</p>}
      {modelList(selected)}
      {excluded.length > 0 && <><h4 className="mt-3 text-xs font-semibold text-chart-warning-ink">{copy("Excluded locally · takes priority over groups", "Exclus pour cette clé · priorité sur les groupes")}</h4>{modelList(excluded)}</>}
    </section>
    {changesPanel}
    {idsPanel}
  </div>;
  const draftPanelActions = <div className="flex flex-wrap gap-2"><Button type="button" disabled={publishDisabled ?? (!dirty || busy)} onClick={onPublish}>{snapshotMode ? copy("Save local selection", "Enregistrer la sélection locale") : copy("Publish changes", "Publier les changements")}</Button><Button type="button" variant="outline" disabled={!dirty || busy} onClick={onDiscard}>{copy("Discard draft", "Abandonner le brouillon")}</Button></div>;

  const modelTabContent = tab === "models" ? browser : groupBrowser;
  return <div className="min-w-0 space-y-4 pb-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{copy("Compose the model selection for this Bifrost key.", "Composez la sélection de modèles de cette clé Bifrost.")} {copy("Provider accesses remain governed by Bifrost permissions.", "Les accès fournisseurs restent gouvernés par les permissions Bifrost.")}</p></div>{dirty && <Badge variant="warning">{copy("Unpublished draft", "Brouillon non publié")}</Badge>}</div>

    {!expert ? <>
      <ol className="flex flex-wrap items-center gap-1 rounded-sm border bg-card p-1 shadow-sm" aria-label={copy("Key composition steps", "Étapes de composition de la clé")}>{[copy("Models", "Modèles"), copy("Groups", "Groupes"), copy("Review", "Vérifier")].map((label, index) => <li key={label}><Button type="button" size="sm" variant={step === index ? "default" : "ghost"} aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)}><span className={`mr-1 inline-flex size-5 items-center justify-center rounded-full text-xs ${step === index ? "bg-primary-foreground/20" : "bg-muted"}`}>{index + 1}</span>{label}{index === 0 && selected.length > 0 && <Badge variant="secondary" className="ml-1">{selected.length}</Badge>}{index === 1 && draft.groups.length > 0 && <Badge variant="secondary" className="ml-1">{draft.groups.length}</Badge>}</Button></li>)}</ol>
      {step === 0 && <section className="space-y-3"><p className="text-xs text-muted-foreground">{copy("Select model cards. Filters only change what is visible; hidden selections remain.", "Choisissez des fiches modèles. Les filtres changent l’affichage, pas les sélections masquées.")}</p>{browser}</section>}
      {step === 1 && <section className="space-y-3"><p className="text-xs text-muted-foreground">{copy("Groups add their shared models. Local exclusions still take priority.", "Les groupes ajoutent leurs modèles partagés. Les exclusions locales restent prioritaires.")}</p>{groupBrowser}</section>}
      {step === 2 && <section className="space-y-4"><Card className="gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/40 px-4 py-3"><CardTitle className="text-base">{copy("Review selection", "Vérifier la sélection")}</CardTitle></CardHeader><CardContent className="space-y-3 px-4 py-3">{!selected.length && <p className="text-sm text-muted-foreground">{copy("Nothing selected yet.", "Aucun modèle sélectionné.")}</p>}{modelList(selected)}{excluded.length > 0 && <section><h3 className="mb-1 text-sm font-semibold text-chart-warning-ink">{copy("Local exclusions", "Exclusions locales")}</h3>{modelList(excluded)}</section>}</CardContent></Card><Card className="gap-0 overflow-hidden py-0"><CardContent className="space-y-3 p-4">{changesPanel}{idsPanel}</CardContent></Card>{publication(readback)}</section>}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-sm border bg-card p-3 shadow-sm"><span className="text-xs text-muted-foreground">{selected.length} {copy(selected.length === 1 ? "model selected" : "models selected", selected.length === 1 ? "modèle sélectionné" : "modèles sélectionnés")} · {draft.groups.length} {copy("groups inherited", "groupes hérités")}</span><span className="ml-auto flex flex-wrap gap-2">{step > 0 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>{copy("Previous", "Précédent")}</Button>}{step < 2 ? <Button type="button" onClick={() => setStep(step + 1)}>{step === 0 ? copy("Continue to groups", "Continuer vers les groupes") : copy("Review draft", "Vérifier le brouillon")}<ArrowRight className="size-3.5" /></Button> : <><Button type="button" variant="outline" disabled={!dirty || busy} onClick={onDiscard}>{copy("Discard draft", "Abandonner le brouillon")}</Button><Button type="button" disabled={publishDisabled ?? (!dirty || busy)} onClick={onPublish}>{snapshotMode ? copy("Save local selection", "Enregistrer la sélection locale") : copy("Publish changes", "Publier les changements")}</Button></>}</span></div>
    </> : <>
      <div role="tablist" aria-label={copy("Browse models or groups", "Parcourir les modèles ou groupes")} className="flex gap-1 rounded-sm border bg-card p-1 shadow-sm"><Button type="button" role="tab" aria-selected={tab === "models"} variant={tab === "models" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("models")}>{copy("Models", "Modèles")} {selected.length > 0 && <Badge variant="outline">{selected.length}</Badge>}</Button><Button type="button" role="tab" aria-selected={tab === "groups"} variant={tab === "groups" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("groups")}>{copy("Groups", "Groupes")} {draft.groups.length > 0 && <Badge variant="outline">{draft.groups.length}</Badge>}</Button></div>
      <div className="grid min-w-0 items-start gap-3 min-[1280px]:grid-cols-[minmax(0,1fr)_minmax(20rem,0.48fr)]">
        <div className="min-w-0 space-y-3">{modelTabContent}<div className="rounded-sm border bg-card p-3 text-xs text-muted-foreground">{selected.length} {copy("models selected", "modèles sélectionnés")} · {draft.groups.length} {copy("groups inherited", "groupes hérités")} · {excluded.length} {copy("excluded", "exclus")}</div>{publication(readback)}</div>
        <aside className="sticky top-3 hidden max-h-[calc(100dvh-10rem)] min-w-0 flex-col overflow-hidden rounded-sm border bg-card shadow-sm min-[1280px]:flex">
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{draftPanelContent}</div>
          <div className="shrink-0 border-t bg-card p-3">{draftPanelActions}</div>
        </aside>
      </div>
      <div className="min-w-0 space-y-3 min-[1280px]:hidden">{draftPanelContent}<div className="border-t bg-card py-3">{draftPanelActions}</div></div>
    </>}
  </div>;
}
