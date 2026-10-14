// PROTOTYPE — Basic mode "Guided steps": Models → Groups → Review.
// Sequential gesture: pick model cards, optionally complement with groups,
// then review the planned catalog. Advanced access settings open on demand.
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isSelected, reconcileSelection, resolveDraft, sameDraft, toggleAccess, toggleGroup, toggleModel, type AccessResolution, type ProtoAccess, type ProtoModel } from "./state";
import { GroupsPanel } from "./cards";
import { ComposerBrowser } from "./browser";
import { AccessDetailDialog, DemoBar, type ComposerProps } from "./shared";
import { DraftSummary, PlannedExposures } from "./summary";
import { useCopy } from "../../lib/locale";

const steps = ["Models", "Groups", "Review"] as const;

export default function VariantA({ draft, baseline, editing, setDraft, models, groups, lateSimulated, onSimulateLate, onResetDemo, onCancel, onCreate }: ComposerProps) {
  const copy = useCopy();
  const [step, setStep] = useState(0);
  const [detail, setDetail] = useState<{ model: ProtoModel; access: ProtoAccess } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const resolved = useMemo(() => resolveDraft(draft, groups, models), [draft, groups, models]);
  const resolvedMap = useMemo(() => new Map(resolved.map(r => [r.model.id, r])), [resolved]);
  const selectedIds = models.filter(m => isSelected(m.id, draft, groups)).map(m => m.id);
  const dirty = !sameDraft(draft, baseline);
  const callbacks = {
    onToggleModel: (model: ProtoModel) => setDraft(toggleModel(draft, model, groups)),
    onToggleAccess: (r: AccessResolution) => setDraft(toggleAccess(draft, r)),
    onShowDetail: (model: ProtoModel, access: ProtoAccess) => setDetail({ model, access }),
  };
  const requestCancel = () => { if (dirty) setConfirmCancel(true); else onCancel(); };
  const create = () => {
    if (!draft.name.trim()) { toast.error(copy("Enter a key name.", "Saisissez un nom de clé.")); return; }
    if (!resolved.some(r => r.state === "active" && r.accesses.some(a => a.state === "active"))) { toast.error(copy("Select at least one model with an active access.", "Sélectionnez au moins un modèle avec un accès actif.")); return; }
    onCreate();
  };
  return <div className="mx-auto max-w-5xl space-y-3 pb-24">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{editing ? copy("Edit virtual key", "Modifier la clé virtuelle") : copy("Create virtual key", "Créer une clé virtuelle")}</h2>
        <p className="text-xs text-muted-foreground">{copy("Choose models, optionally add groups, then review.", "Choisissez des modèles, ajoutez éventuellement des groupes, puis vérifiez.")}</p>
      </div>
      {dirty && <Badge variant="warning">{copy("Unsaved draft", "Brouillon non enregistré")}</Badge>}
    </div>
    <ol className="flex flex-wrap items-center gap-1 rounded-sm border bg-card p-1 shadow-sm" aria-label={copy("Create key steps", "Étapes de création de la clé")}>
      {steps.map((label, i) => <li key={label} className="min-w-0">
        <Button variant={step === i ? "default" : "ghost"} size="sm" aria-current={step === i ? "step" : undefined} onClick={() => setStep(i)}>
          <span className={`mr-1 inline-flex size-5 items-center justify-center rounded-full text-[11px] ${step === i ? "bg-primary-foreground/20" : "bg-muted"}`}>{i + 1}</span>{copy(label, ["Modèles", "Groupes", "Vérifier"][i])}
          {i === 0 && selectedIds.length > 0 && <Badge variant="secondary" className="ml-1.5">{selectedIds.length}</Badge>}
          {i === 1 && draft.groups.length > 0 && <Badge variant="secondary" className="ml-1.5">{draft.groups.length}</Badge>}
        </Button>
      </li>)}
    </ol>

    {step === 0 && <section className="space-y-4">
      <p className="text-xs text-muted-foreground">{copy("Select model cards. Refine configured accesses in Accesses.", "Sélectionnez des modèles. Ajustez leurs accès configurés dans Accès.")}</p>
      <ComposerBrowser
        models={models}
        selected={selectedIds}
        onSetSelected={ids => setDraft(reconcileSelection(draft, ids, groups, models))}
        draft={draft} groups={groups} resolved={resolvedMap} callbacks={callbacks}
      />
    </section>}

    {step === 1 && <section className="space-y-4">
      <p className="text-xs text-muted-foreground">{copy("Groups add shared selections; local exclusions take priority.", "Les groupes ajoutent des sélections ; vos exclusions gardent la priorité.")}</p>
      <GroupsPanel draft={draft} groups={groups} models={models} onToggleGroup={id => setDraft(toggleGroup(draft, id))} />
    </section>}

    {step === 2 && <section className="space-y-4">
      <FieldGroup className="grid gap-3 sm:grid-cols-2">
        <Field className="gap-2"><FieldLabel htmlFor="va-key-name">{copy("Key name", "Nom de la clé")}</FieldLabel><Input id="va-key-name" autoComplete="off" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder={copy("e.g. Hermes staging", "ex. Hermes préproduction")} /></Field>
        <Field className="gap-2"><FieldLabel htmlFor="va-key-client">{copy("Client", "Client")}</FieldLabel><Input id="va-key-client" autoComplete="off" value={draft.client} onChange={e => setDraft({ ...draft, client: e.target.value })} placeholder={copy("e.g. Hermes", "ex. Hermes")} /></Field>
      </FieldGroup>
      <DraftSummary draft={draft} groups={groups} models={models} onToggleModel={callbacks.onToggleModel} onToggleAccess={callbacks.onToggleAccess} onShowDetail={callbacks.onShowDetail} />
      <PlannedExposures draft={draft} groups={groups} models={models} onNaming={naming => setDraft({ ...draft, naming })} />
    </section>}

    <div className="flex flex-wrap items-center gap-2 rounded-sm border bg-card p-3 shadow-sm">
      <span className="text-xs text-muted-foreground" aria-live="polite">{selectedIds.length} {copy(selectedIds.length === 1 ? "model selected" : "models selected", selectedIds.length === 1 ? "modèle sélectionné" : "modèles sélectionnés")} · {draft.groups.length} {copy(draft.groups.length === 1 ? "group inherited" : "groups inherited", draft.groups.length === 1 ? "groupe hérité" : "groupes hérités")}</span>
      <span className="ml-auto flex flex-wrap gap-2">
        <Button variant="ghost" onClick={requestCancel}><X className="size-3.5" />{copy("Cancel", "Annuler")}</Button>
        {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}><ArrowLeft className="size-3.5" />{copy("Back", "Retour")}</Button>}
        {step < 2 && <Button onClick={() => setStep(step + 1)}>{step === 0 ? copy("Continue to groups (optional)", "Continuer vers les groupes (facultatif)") : copy("Review draft", "Vérifier le brouillon")}<ArrowRight className="size-3.5" /></Button>}
        {step === 2 && <Button onClick={create}>{editing ? copy("Save changes (simulated)", "Enregistrer (simulation)") : copy("Create key (simulated)", "Créer la clé (simulation)")}</Button>}
      </span>
    </div>

    <DemoBar lateSimulated={lateSimulated} onSimulateLate={onSimulateLate} onReset={onResetDemo} />

    <AccessDetailDialog model={detail?.model ?? null} access={detail?.access ?? null} onClose={() => setDetail(null)} />
    <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}><DialogContent>
      <DialogHeader className="border-b pb-4"><DialogTitle className="text-xl">{copy("Discard this draft?", "Abandonner ce brouillon ?")}</DialogTitle><DialogDescription>{copy("Selections and simulated corrections will be lost. No group, key or fixture data changes.", "Les sélections et corrections simulées seront perdues. Aucun groupe, clé ou donnée fictive ne sera modifié.")}</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" onClick={() => setConfirmCancel(false)}>{copy("Keep editing", "Continuer la modification")}</Button><Button variant="destructive" onClick={() => { setConfirmCancel(false); onCancel(); }}>{copy("Discard draft", "Abandonner le brouillon")}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
