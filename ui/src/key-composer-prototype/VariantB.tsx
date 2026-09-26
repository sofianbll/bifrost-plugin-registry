// PROTOTYPE — Expert mode "Composition tray": one surface, persistent draft panel.
// Browser (Models / Groups tabs) on the left; the key draft with live planned
// catalog stays visible on the right (bottom sheet on small screens).
import { useMemo, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BrandIcon } from "../BrandIcon";
import { emptyDraft, isSelected, reconcileSelection, resolveDraft, sameDraft, toggleAccess, toggleGroup, toggleModel, type AccessResolution, type ModelResolution, type ProtoAccess, type ProtoModel } from "./state";
import { GroupsPanel } from "./cards";
import { ComposerBrowser } from "./browser";
import { AccessDetailDialog, AccessMenu, DemoBar, type ComposerProps } from "./shared";
import { PlannedExposures } from "./summary";
import { WitnessNote } from "./shared";

export default function VariantB({ draft, setDraft, models, groups, lateSimulated, onSimulateLate, onResetDemo, onCancel, onCreate }: ComposerProps) {
  const [tab, setTab] = useState<"models" | "groups">("models");
  const [detail, setDetail] = useState<{ model: ProtoModel; access: ProtoAccess } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const resolved = useMemo(() => resolveDraft(draft, groups, models), [draft, groups, models]);
  const resolvedMap = useMemo(() => new Map(resolved.map(r => [r.model.id, r])), [resolved]);
  const selectedIds = models.filter(m => isSelected(m.id, draft, groups)).map(m => m.id);
  const dirty = !sameDraft(draft, emptyDraft());
  const callbacks = {
    onToggleModel: (model: ProtoModel) => setDraft(toggleModel(draft, model, groups)),
    onToggleAccess: (r: AccessResolution) => setDraft(toggleAccess(draft, r)),
    onShowDetail: (model: ProtoModel, access: ProtoAccess) => setDetail({ model, access }),
  };
  const requestCancel = () => { if (dirty) setConfirmCancel(true); else onCancel(); };
  const create = () => {
    if (!draft.name.trim()) { toast.error("Enter a key name in the draft panel."); return; }
    if (!resolved.some(r => r.state === "active" && r.accesses.some(a => a.state === "active"))) { toast.error("Select at least one model with an active access."); return; }
    onCreate();
  };
  const trayRow = (r: ModelResolution) => <div key={r.model.id} className={`flex min-w-0 items-center gap-2 border-b py-2.5 last:border-b-0 ${r.state === "excluded" ? "opacity-75" : ""}`}>
    <BrandIcon model={r.model} mode="creator" />
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium" title={r.model.name}>{r.model.name}</p>
      <div className="mt-0.5 flex flex-wrap gap-1">
        {r.direct && <Badge variant="default">Direct</Badge>}
        {r.groups.map(name => <Badge key={name} variant="secondary">{name}</Badge>)}
        {r.state === "excluded" && <Badge variant="warning">Excluded locally</Badge>}
      </div>
    </div>
    <AccessMenu resolution={r} locked={r.state === "excluded"} onToggleAccess={callbacks.onToggleAccess} onShowDetail={callbacks.onShowDetail} />
    <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={r.state === "excluded" ? `Restore ${r.model.name}` : `Remove ${r.model.name} from this key`} title={r.state === "excluded" ? "Restore (explicit)" : r.direct && !r.groups.length ? "Remove direct pick" : "Exclude locally"} onClick={() => callbacks.onToggleModel(r.model)}>
      {r.state === "excluded" ? <RotateCcw className="size-3.5" /> : <X className="size-3.5" />}
    </Button>
  </div>;
  const tray = <div className="space-y-4">
    <div className="grid gap-3">
      <div><label htmlFor="vb-key-name" className="mb-1.5 block text-sm font-medium">Key name</label><Input id="vb-key-name" autoComplete="off" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Hermes staging" /></div>
      <div><label htmlFor="vb-key-client" className="mb-1.5 block text-sm font-medium">Client</label><Input id="vb-key-client" autoComplete="off" value={draft.client} onChange={e => setDraft({ ...draft, client: e.target.value })} placeholder="e.g. Hermes" /></div>
    </div>
    <section>
      <h3 className="border-b pb-2 text-sm font-semibold">Composition <span className="font-normal text-muted-foreground">{resolved.filter(r => r.state === "active").length} models</span></h3>
      {!resolved.length && <p className="py-4 text-center text-xs text-muted-foreground">Empty draft. Pick models or add groups on the left.</p>}
      {resolved.map(trayRow)}
    </section>
    <PlannedExposures draft={draft} groups={groups} models={models} onNaming={naming => setDraft({ ...draft, naming })} />
    <WitnessNote groups={groups} models={models} />
    <div className="flex flex-wrap gap-2 border-t pt-3">
      <Button onClick={create}>Create key (simulated)</Button>
      <Button variant="outline" onClick={requestCancel}>Discard draft</Button>
    </div>
  </div>;
  return <div className="grid min-w-0 gap-4 pb-24 xl:grid-cols-[minmax(0,1fr)_300px]">
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create virtual key</h2>
          <p className="mt-1 text-sm text-muted-foreground">Expert mode — composition tray. Everything stays visible; the draft panel updates live.</p>
        </div>
        {dirty && <Badge variant="warning">Unsaved draft</Badge>}
      </div>
      <DemoBar lateSimulated={lateSimulated} onSimulateLate={onSimulateLate} onReset={onResetDemo} />
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Browse models or groups" className="flex gap-1 rounded-sm border bg-card p-1 shadow-sm">
          <Button role="tab" aria-selected={tab === "models"} variant={tab === "models" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("models")}>Models{selectedIds.length > 0 && <Badge variant="outline" className="ml-1.5">{selectedIds.length}</Badge>}</Button>
          <Button role="tab" aria-selected={tab === "groups"} variant={tab === "groups" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("groups")}>Groups{draft.groups.length > 0 && <Badge variant="outline" className="ml-1.5">{draft.groups.length}</Badge>}</Button>
        </div>
        <Button variant="outline" size="sm" className="ml-auto xl:hidden" onClick={() => setTrayOpen(true)}>Draft ({selectedIds.length + resolved.filter(r => r.state === "excluded").length})</Button>
      </div>
      {tab === "models"
        ? <ComposerBrowser
            models={models}
            selected={selectedIds}
            onSetSelected={ids => setDraft(reconcileSelection(draft, ids, groups, models))}
            draft={draft} groups={groups} resolved={resolvedMap} callbacks={callbacks}
          />
        : <GroupsPanel draft={draft} groups={groups} models={models} onToggleGroup={id => setDraft(toggleGroup(draft, id))} />}
    </div>
    <aside className="hidden min-w-0 xl:block">
      <div className="custom-scrollbar sticky top-4 max-h-[calc(100dvh-6rem)] space-y-4 overflow-auto rounded-sm border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Key draft {dirty && <Badge variant="warning" className="ml-2 align-middle">Unsaved</Badge>}</h2>
        {tray}
      </div>
    </aside>
    <Sheet open={trayOpen} onOpenChange={setTrayOpen}><SheetContent className="overflow-auto p-4">
      <SheetHeader className="border-b pb-3"><SheetTitle>Key draft</SheetTitle><SheetDescription>Live composition for this key. Selections made on the left stay intact when this panel closes.</SheetDescription></SheetHeader>
      {tray}
    </SheetContent></Sheet>
    <AccessDetailDialog model={detail?.model ?? null} access={detail?.access ?? null} onClose={() => setDetail(null)} />
    <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}><DialogContent>
      <DialogHeader className="border-b pb-4"><DialogTitle className="text-xl">Discard this draft?</DialogTitle><DialogDescription>Selections and simulated corrections will be lost. No group, key or fixture data changes.</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" onClick={() => setConfirmCancel(false)}>Keep editing</Button><Button variant="destructive" onClick={() => { setConfirmCancel(false); onCancel(); }}>Discard draft</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
