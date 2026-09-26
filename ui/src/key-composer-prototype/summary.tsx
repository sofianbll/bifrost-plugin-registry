// PROTOTYPE — draft summary and planned exposures, shared by both modes.
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { BrandIcon } from "../BrandIcon";
import { plannedExposures, resolveDraft, type AccessResolution, type KeyDraft, type ModelResolution, type ProtoAccess, type ProtoGroup, type ProtoModel } from "./state";
import { AccessRow, WitnessNote } from "./shared";

const formats: KeyDraft["naming"][] = ["model", "provider/model", "both"];

export function PlannedExposures({ draft, groups, models, onNaming }: { draft: KeyDraft; groups: ProtoGroup[]; models: ProtoModel[]; onNaming: (naming: KeyDraft["naming"]) => void }) {
  const planned = plannedExposures(draft, groups, models);
  return <div className="space-y-3 rounded-sm border border-primary/30 bg-primary/5 p-4">
    <h3 className="text-sm font-semibold">Planned for this draft — {planned.length} ID{planned.length === 1 ? "" : "s"}</h3>
    <p className="text-xs text-muted-foreground">What this key would expose after creation. <strong>Not published, not verified</strong> — routing stays native Bifrost, restricted to the accesses retained for this key. This demo performs no requests.</p>
    <details className="text-xs">
      <summary className="cursor-pointer font-medium">Exposed ID format: {draft.naming} · change</summary>
      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Exposed name format">
        {formats.map(format => <Button key={format} size="sm" variant={draft.naming === format ? "default" : "outline"} aria-pressed={draft.naming === format} onClick={() => onNaming(format)}>{format}</Button>)}
      </div>
    </details>
    <div className="max-h-44 space-y-1 overflow-auto">
      {planned.map(id => <div key={id} className="break-all rounded-sm border bg-background px-2.5 py-1.5 font-mono text-[11px]">{id}</div>)}
      {!planned.length && <p className="rounded-sm border border-dashed p-4 text-center text-xs text-muted-foreground">No active access: this key would see no models.</p>}
    </div>
  </div>;
}

export function DraftSummary({ draft, groups, models, onToggleModel, onToggleAccess, onShowDetail }: {
  draft: KeyDraft;
  groups: ProtoGroup[];
  models: ProtoModel[];
  onToggleModel: (model: ProtoModel) => void;
  onToggleAccess: (r: AccessResolution) => void;
  onShowDetail: (model: ProtoModel, access: ProtoAccess) => void;
}) {
  const resolved = resolveDraft(draft, groups, models);
  const active = resolved.filter(r => r.state === "active");
  const excluded = resolved.filter(r => r.state === "excluded");
  const modelRow = (r: ModelResolution) => {
    const noActive = r.state === "active" && !r.accesses.some(a => a.state === "active");
    return <div key={r.model.id} className={`space-y-1 rounded-sm border p-3 ${r.state === "excluded" ? "border-chart-warning/50 bg-chart-warning/5" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <BrandIcon model={r.model} mode="creator" />
        <strong className="text-sm">{r.model.name}</strong>
        <span className="break-all font-mono text-[11px] text-muted-foreground">{r.model.commonId}</span>
        {r.direct && <Badge variant="default">Direct pick</Badge>}
        {r.groups.map(name => <Badge key={name} variant="secondary">Inherited · {name}</Badge>)}
        {r.state === "excluded" && <Badge variant="warning">Excluded locally</Badge>}
        {noActive && <Badge variant="warning">No active access — not callable</Badge>}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onToggleModel(r.model)}>
          {r.state === "excluded" ? <><RotateCcw className="size-3.5" />Restore model</> : "Exclude model"}
        </Button>
      </div>
      <div className="divide-y divide-border/60 pl-1">{r.accesses.map(a => <AccessRow key={a.access.id} resolution={a} locked={r.state === "excluded"} onToggleAccess={onToggleAccess} onShowDetail={access => onShowDetail(r.model, access)} />)}</div>
    </div>;
  };
  return <div className="space-y-4">
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Composition — {active.length} model{active.length === 1 ? "" : "s"}</h3>
      {!resolved.length && <p className="rounded-sm border border-dashed p-4 text-center text-sm text-muted-foreground">Nothing selected yet. Pick models or inherit groups.</p>}
      {active.map(modelRow)}
    </section>
    {excluded.length > 0 && <section className="space-y-2">
      <h3 className="text-sm font-semibold">Excluded locally — wins over groups and direct picks</h3>
      {excluded.map(modelRow)}
    </section>}
    <WitnessNote groups={groups} models={models} />
  </div>;
}
