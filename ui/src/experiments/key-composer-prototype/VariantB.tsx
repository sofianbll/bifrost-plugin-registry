// PROTOTYPE — Expert mode "Composition tray": one surface, persistent draft panel.
// Browser (Models / Groups tabs) on the left; the key draft with live planned
// catalog stays visible on the right (bottom sheet on small screens).
import { useMemo, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BrandIcon } from "../../components/registry/BrandIcon";
import { isSelected, reconcileSelection, resolveDraft, sameDraft, toggleAccess, toggleGroup, toggleModel, type AccessResolution, type ModelResolution, type ProtoAccess, type ProtoModel } from "./state";
import { GroupsPanel } from "./cards";
import { ComposerBrowser } from "./browser";
import { AccessDetailDialog, AccessMenu, DemoBar, type ComposerProps } from "./shared";
import { PlannedExposures } from "./summary";
import { WitnessNote } from "./shared";
import { useCopy } from "../../lib/locale";

export default function VariantB({ draft, baseline, editing, setDraft, models, groups, lateSimulated, onSimulateLate, onResetDemo, onCancel, onCreate }: ComposerProps) {
  const copy = useCopy();
  const [tab, setTab] = useState<"models" | "groups">("models");
  const [detail, setDetail] = useState<{ model: ProtoModel; access: ProtoAccess } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
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
    if (!draft.name.trim()) { toast.error(copy("Enter a key name in the draft panel.", "Saisissez un nom pour la clé dans le brouillon.")); return; }
    if (!resolved.some(r => r.state === "active" && r.accesses.some(a => a.state === "active"))) { toast.error(copy("Select at least one model with an active access.", "Sélectionnez au moins un modèle avec un accès actif.")); return; }
    onCreate();
  };
  const trayRow = (r: ModelResolution) => <div key={r.model.id} className={`flex min-w-0 items-center gap-2 border-b py-2.5 last:border-b-0 ${r.state === "excluded" ? "opacity-75" : ""}`}>
    <BrandIcon model={r.model} mode="creator" />
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium" title={r.model.name}>{r.model.name}</p>
      <div className="mt-0.5 flex flex-wrap gap-1">
        {r.direct && <Badge variant="default">{copy("Direct", "Direct")}</Badge>}
        {r.groups.map(name => <Badge key={name} variant="secondary">{name}</Badge>)}
        {r.state === "excluded" && <Badge variant="warning">{copy("Excluded locally", "Exclu pour cette clé")}</Badge>}
      </div>
    </div>
    <AccessMenu resolution={r} locked={r.state === "excluded"} onToggleAccess={callbacks.onToggleAccess} onShowDetail={callbacks.onShowDetail} />
    <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label={r.state === "excluded" ? copy(`Restore ${r.model.name}`, `Rétablir ${r.model.name}`) : copy(`Remove ${r.model.name} from this key`, `Retirer ${r.model.name} de cette clé`)} title={r.state === "excluded" ? copy("Restore explicitly", "Rétablir explicitement") : copy("Remove or exclude", "Retirer ou exclure")} onClick={() => callbacks.onToggleModel(r.model)}>
      {r.state === "excluded" ? <RotateCcw className="size-3.5" /> : <X className="size-3.5" />}
    </Button>
  </div>;
  const tray = <div className="flex min-h-full flex-col gap-3">
    <FieldGroup className="grid gap-2">
      <Field className="gap-1"><FieldLabel htmlFor="vb-key-name" className="text-xs">{copy("Key name", "Nom de la clé")}</FieldLabel><Input id="vb-key-name" autoComplete="off" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder={copy("e.g. Hermes staging", "Ex. Hermes préproduction")} /></Field>
      <Field className="gap-1"><FieldLabel htmlFor="vb-key-client" className="text-xs">Client</FieldLabel><Input id="vb-key-client" autoComplete="off" value={draft.client} onChange={e => setDraft({ ...draft, client: e.target.value })} placeholder="Ex. Hermes" /></Field>
    </FieldGroup>
    <section>
      <h3 className="border-b pb-1 text-sm font-semibold">Composition <span className="font-normal text-muted-foreground">{copy(`${resolved.filter(r => r.state === "active").length} models`, `${resolved.filter(r => r.state === "active").length} modèle${resolved.filter(r => r.state === "active").length === 1 ? "" : "s"}`)}</span></h3>
      {!resolved.length && <p className="py-2 text-xs text-muted-foreground">{copy("Empty draft. Pick models or add groups on the left.", "Brouillon vide. Choisissez des modèles ou ajoutez un groupe à gauche.")}</p>}
      {resolved.map(trayRow)}
    </section>
    <PlannedExposures draft={draft} groups={groups} models={models} onNaming={naming => setDraft({ ...draft, naming })} />
    <WitnessNote groups={groups} models={models} />
    <div className="sticky bottom-0 z-10 -mx-3 mt-auto flex flex-wrap gap-2 border-t bg-card px-3 py-3">
      <Button onClick={create}>{editing ? copy("Save changes (simulated)", "Enregistrer (simulation)") : copy("Create key (simulated)", "Créer la clé (simulation)")}</Button>
      <Button variant="outline" onClick={requestCancel}>{copy("Discard draft", "Supprimer le brouillon")}</Button>
    </div>
  </div>;
  return <div className="min-w-0 space-y-3 pb-16">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{editing ? copy("Edit virtual key", "Modifier la clé virtuelle") : copy("Create virtual key", "Créer une clé virtuelle")}</h2>
      {dirty && <Badge variant="warning">{copy("Unsaved draft", "Brouillon non enregistré")}</Badge>}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <div role="tablist" aria-label={copy("Browse models or groups", "Parcourir les modèles ou les groupes")} className="flex gap-1 rounded-sm border bg-card p-0.5 shadow-sm">
        <Button role="tab" aria-selected={tab === "models"} variant={tab === "models" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("models")}>{copy("Models", "Modèles")}{selectedIds.length > 0 && <Badge variant="outline" className="ml-1.5">{selectedIds.length}</Badge>}</Button>
        <Button role="tab" aria-selected={tab === "groups"} variant={tab === "groups" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("groups")}>{copy("Groups", "Groupes")}{draft.groups.length > 0 && <Badge variant="outline" className="ml-1.5">{draft.groups.length}</Badge>}</Button>
      </div>
      <Button variant="outline" size="sm" className="ml-auto xl:hidden" onClick={() => setTrayOpen(true)}>{copy("Draft", "Brouillon")} ({selectedIds.length + resolved.filter(r => r.state === "excluded").length})</Button>
    </div>
    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-2.5">
      {tab === "models"
        ? <ComposerBrowser
            models={models}
            selected={selectedIds}
            onSetSelected={ids => setDraft(reconcileSelection(draft, ids, groups, models))}
            draft={draft} groups={groups} resolved={resolvedMap} callbacks={callbacks}
          />
        : <GroupsPanel draft={draft} groups={groups} models={models} onToggleGroup={id => setDraft(toggleGroup(draft, id))} />}
      <DemoBar lateSimulated={lateSimulated} onSimulateLate={onSimulateLate} onReset={onResetDemo} />
    </div>
    <aside className="hidden min-w-0 xl:block">
      <div className="custom-scrollbar sticky top-4 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-sm border bg-card p-3 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">{copy("Key draft", "Brouillon de clé")} {dirty && <Badge variant="warning" className="ml-2 align-middle">{copy("Unsaved", "Non enregistré")}</Badge>}</h2>
        {tray}
      </div>
    </aside>
    </div>
    <Sheet open={trayOpen} onOpenChange={setTrayOpen}><SheetContent className="overflow-y-auto p-3">
      <SheetHeader className="border-b pb-2"><SheetTitle>{copy("Key draft", "Brouillon de clé")}</SheetTitle><SheetDescription>{copy("Selections are preserved when this panel closes.", "Les sélections restent conservées après la fermeture de ce panneau.")}</SheetDescription></SheetHeader>
      {tray}
    </SheetContent></Sheet>
    <AccessDetailDialog model={detail?.model ?? null} access={detail?.access ?? null} onClose={() => setDetail(null)} />
    <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}><DialogContent>
      <DialogHeader className="border-b pb-4"><DialogTitle className="text-xl">{copy("Discard this draft?", "Supprimer ce brouillon ?")}</DialogTitle><DialogDescription>{copy("Selections will be lost. Groups and fixture data stay unchanged.", "Les sélections seront perdues. Les groupes et données fictives restent inchangés.")}</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" onClick={() => setConfirmCancel(false)}>{copy("Keep editing", "Continuer l’édition")}</Button><Button variant="destructive" onClick={() => { setConfirmCancel(false); onCancel(); }}>{copy("Discard draft", "Supprimer le brouillon")}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
