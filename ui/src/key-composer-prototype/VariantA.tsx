// PROTOTYPE — Basic mode "Guided steps": Models → Groups → Review.
// Sequential gesture: pick model cards, optionally complement with groups,
// then review the planned catalog. Advanced access settings open on demand.
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import ModelBrowser from "../ModelBrowser";
import { defaultViewOptions } from "../ViewOptions";
import { emptyDraft, isSelected, reconcileSelection, resolveDraft, sameDraft, toggleAccess, toggleGroup, toggleModel, type AccessResolution, type ProtoAccess, type ProtoModel } from "./state";
import { ComposerModelResults, GroupsPanel } from "./cards";
import { AccessDetailDialog, DemoBar, type ComposerProps } from "./shared";
import { DraftSummary, PlannedExposures } from "./summary";

const steps = ["Models", "Groups", "Review"] as const;

export default function VariantA({ draft, setDraft, models, groups, lateSimulated, onSimulateLate, onResetDemo, onCancel, onCreate }: ComposerProps) {
  const [step, setStep] = useState(0);
  const [detail, setDetail] = useState<{ model: ProtoModel; access: ProtoAccess } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
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
    if (!draft.name.trim()) { toast.error("Enter a key name."); return; }
    if (!resolved.some(r => r.state === "active" && r.accesses.some(a => a.state === "active"))) { toast.error("Select at least one model with an active access."); return; }
    onCreate();
  };
  return <div className="mx-auto max-w-5xl space-y-5 pb-24">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create virtual key</h2>
        <p className="mt-1 text-sm text-muted-foreground">Basic mode — guided steps. Model cards first; groups complement; access details on demand.</p>
      </div>
      {dirty && <Badge variant="warning">Unsaved draft</Badge>}
    </div>
    <DemoBar lateSimulated={lateSimulated} onSimulateLate={onSimulateLate} onReset={onResetDemo} />
    <ol className="flex flex-wrap items-center gap-1 rounded-sm border bg-card p-1 shadow-sm" aria-label="Create key steps">
      {steps.map((label, i) => <li key={label} className="min-w-0">
        <Button variant={step === i ? "default" : "ghost"} size="sm" aria-current={step === i ? "step" : undefined} onClick={() => setStep(i)}>
          <span className={`mr-1.5 inline-flex size-5 items-center justify-center rounded-full text-[11px] ${step === i ? "bg-primary-foreground/20" : "bg-muted"}`}>{i + 1}</span>{label}
          {i === 0 && selectedIds.length > 0 && <Badge variant="secondary" className="ml-1.5">{selectedIds.length}</Badge>}
          {i === 1 && draft.groups.length > 0 && <Badge variant="secondary" className="ml-1.5">{draft.groups.length}</Badge>}
        </Button>
      </li>)}
    </ol>

    {step === 0 && <section className="space-y-4">
      <p className="text-sm text-muted-foreground">Start with model cards. Selecting a card activates its configured and authorized accesses by default; refine them per key in the Accesses menu. Selections survive tab, filter and view changes.</p>
      <ModelBrowser
        models={models}
        selected={selectedIds}
        onToggle={id => { const model = models.find(m => m.id === id); if (model) callbacks.onToggleModel(model); }}
        onSetSelected={ids => setDraft(reconcileSelection(draft, ids, groups, models))}
        preferences={defaultViewOptions}
        label="Key models"
        providerFilterLabel="Serving provider"
        selectionNote="The provider filter only narrows the display. Selecting a card activates its configured accesses by default; refine them in each card's Accesses menu."
        renderResults={(filtered, view, groupBy) => <ComposerModelResults filtered={filtered as ProtoModel[]} view={view} groupBy={groupBy} draft={draft} groups={groups} resolved={resolvedMap} callbacks={callbacks} />}
      />
    </section>}

    {step === 1 && <section className="space-y-4">
      <p className="text-sm text-muted-foreground">Optionally inherit shared selections. Groups <strong>complement</strong> your direct picks — they never erase them — and your local exclusions keep priority over every group.</p>
      <GroupsPanel draft={draft} groups={groups} models={models} onToggleGroup={id => setDraft(toggleGroup(draft, id))} />
    </section>}

    {step === 2 && <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="va-key-name" className="mb-2 block text-sm font-medium">Key name</label><Input id="va-key-name" autoComplete="off" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Hermes staging" /></div>
        <div><label htmlFor="va-key-client" className="mb-2 block text-sm font-medium">Client</label><Input id="va-key-client" autoComplete="off" value={draft.client} onChange={e => setDraft({ ...draft, client: e.target.value })} placeholder="e.g. Hermes" /></div>
      </div>
      <DraftSummary draft={draft} groups={groups} models={models} onToggleModel={callbacks.onToggleModel} onToggleAccess={callbacks.onToggleAccess} onShowDetail={callbacks.onShowDetail} />
      <PlannedExposures draft={draft} groups={groups} models={models} onNaming={naming => setDraft({ ...draft, naming })} />
    </section>}

    <div className="flex flex-wrap items-center gap-2 rounded-sm border bg-card p-3 shadow-sm">
      <span className="text-xs text-muted-foreground" aria-live="polite">{selectedIds.length} model{selectedIds.length === 1 ? "" : "s"} selected · {draft.groups.length} group{draft.groups.length === 1 ? "" : "s"} inherited</span>
      <span className="ml-auto flex flex-wrap gap-2">
        <Button variant="ghost" onClick={requestCancel}><X className="size-3.5" />Cancel</Button>
        {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}><ArrowLeft className="size-3.5" />Back</Button>}
        {step < 2 && <Button onClick={() => setStep(step + 1)}>{step === 0 ? "Continue to groups (optional)" : "Review draft"}<ArrowRight className="size-3.5" /></Button>}
        {step === 2 && <Button onClick={create}>Create key (simulated)</Button>}
      </span>
    </div>

    <AccessDetailDialog model={detail?.model ?? null} access={detail?.access ?? null} onClose={() => setDetail(null)} />
    <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}><DialogContent>
      <DialogHeader className="border-b pb-4"><DialogTitle className="text-xl">Discard this draft?</DialogTitle><DialogDescription>Selections and simulated corrections will be lost. No group, key or fixture data changes.</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" onClick={() => setConfirmCancel(false)}>Keep editing</Button><Button variant="destructive" onClick={() => { setConfirmCancel(false); onCancel(); }}>Discard draft</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
