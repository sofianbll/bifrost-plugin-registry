// Archived from commit c73a82c. Only root-relative import paths adapted for gallery rendering.
// PROTOTYPE — shared primitives for the key-composer modes.
// Layouts live in VariantA.tsx / VariantB.tsx; these are data-level fragments.
import { Ban, Info, Plus, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { displayProvider } from "@/components/registry/BrandIcon";
import { resolveDraft, witnessDraft, type AccessResolution, type KeyDraft, type ModelResolution, type ProtoAccess, type ProtoGroup, type ProtoModel } from "./state";

export type Mode = "basic" | "expert";

export function readMode(): Mode {
  const params = new URLSearchParams(location.search);
  const modeParam = params.get("mode");
  if (modeParam === "basic" || modeParam === "expert") return modeParam;
  // Backward compatibility with the older ?variant=A|B parameter.
  const variantParam = params.get("variant")?.toLowerCase();
  if (variantParam === "b") return "expert";
  if (variantParam === "a") return "basic";
  return "basic";
}

export function StateBadge({ state }: { state: AccessResolution["state"] }) {
  if (state === "excluded") return <Badge variant="warning">Excluded locally</Badge>;
  if (state === "off") return <Badge variant="secondary">Off</Badge>;
  if (state === "unavailable") return <Badge variant="outline" className="text-muted-foreground">Not configured</Badge>;
  return null;
}

export function AccessDetailDialog({ model, access, onClose }: { model: ProtoModel | null; access: ProtoAccess | null; onClose: () => void }) {
  return <Dialog open={!!access && !!model} onOpenChange={open => { if (!open) onClose(); }}><DialogContent>
    {access && model && <>
      <DialogHeader className="border-b pb-4"><DialogTitle className="text-xl">{displayProvider(access.provider)} access</DialogTitle><DialogDescription>{model.name} · provider access detail. Synthetic fixture data.</DialogDescription></DialogHeader>
      <dl className="space-y-3 text-sm">
        <div><dt className="text-xs font-medium text-muted-foreground">Access ID (exact)</dt><dd className="break-all font-mono text-xs">{access.id}</dd></div>
        <div><dt className="text-xs font-medium text-muted-foreground">Native model ID sent to this provider</dt><dd className="break-all font-mono text-xs">{access.nativeModel || "Unknown"}</dd></div>
        <div><dt className="text-xs font-medium text-muted-foreground">Common ID answered by this access</dt><dd className="break-all font-mono text-xs">{model.commonId}</dd></div>
        <div><dt className="text-xs font-medium text-muted-foreground">Native status</dt><dd>{access.configured ? "Configured and authorized on the gateway" : "Not configured on the gateway — cannot be activated for a key"}</dd></div>
      </dl>
      <div className="space-y-2 border-t pt-3">
        <h3 className="text-sm font-medium">Properties</h3>
        {access.facts.map(fact => <div key={fact.label} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{fact.label}</span>
          {fact.kind === "declared"
            ? <span className="text-right"><strong className="font-medium">{fact.value}</strong><span className="block text-xs text-muted-foreground">Declared · {fact.source}</span></span>
            : <span className="text-right"><strong className="font-medium">Unknown</strong><span className="block text-xs text-muted-foreground">Not measured by any source</span></span>}
        </div>)}
      </div>
      <div className="space-y-2 border-t pt-3">
        <h3 className="text-sm font-medium text-muted-foreground">Advanced access settings</h3>
        <p className="text-xs text-muted-foreground">Provider-specific overrides (region, project, endpoint profile) would be edited here, on demand. Not part of this prototype.</p>
      </div>
      <p role="note" className="rounded-sm border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">This prototype sends no requests: execution, alias resolution and routing through Bifrost are <strong>not verified</strong> here. Declared values are documentary, not observed behavior.</p>
    </>}
  </DialogContent></Dialog>;
}

export function AccessRow({ resolution, locked, onToggleAccess, onShowDetail }: { resolution: AccessResolution; locked: boolean; onToggleAccess: (r: AccessResolution) => void; onShowDetail: (access: ProtoAccess) => void }) {
  const { access, state, origins } = resolution;
  return <div className="flex min-w-0 items-start gap-2 py-1.5">
    <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${state === "active" ? "bg-chart-success" : state === "excluded" ? "bg-chart-warning" : "bg-muted-foreground/40"}`} />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium">{displayProvider(access.provider)}</span>
        <StateBadge state={state} />
        {state === "active" && origins.map(o => <Badge key={o} variant={o.startsWith("Inherited") ? "secondary" : "default"}>{o}</Badge>)}
        {state === "excluded" && origins.length > 0 && <span className="text-xs text-muted-foreground">was: {origins.join(" + ")}</span>}
      </div>
      <p className="break-all font-mono text-[11px] text-muted-foreground">{access.id}</p>
      {state === "off" && <p className="text-xs text-muted-foreground">Not retained by any source — activate explicitly.</p>}
      {state === "unavailable" && <p className="text-xs text-muted-foreground">Not configured on the gateway; native rights unchanged.</p>}
    </div>
    <div className="flex shrink-0 items-center gap-1">
      <Button size="icon" variant="ghost" className="size-7" aria-label={`Details of ${access.id}`} title="Access details" onClick={() => onShowDetail(access)}><Info className="size-3.5" /></Button>
      {!locked && state === "active" && <Button size="icon" variant="ghost" className="size-7" aria-label={`Exclude ${access.id} for this key`} title="Exclude for this key" onClick={() => onToggleAccess(resolution)}><Ban className="size-3.5" /></Button>}
      {!locked && state === "off" && <Button size="icon" variant="ghost" className="size-7" aria-label={`Activate ${access.id} for this key`} title="Activate for this key" onClick={() => onToggleAccess(resolution)}><Plus className="size-3.5" /></Button>}
      {!locked && state === "excluded" && <Button size="icon" variant="ghost" className="size-7" aria-label={`Restore ${access.id}`} title="Restore (explicit)" onClick={() => onToggleAccess(resolution)}><RotateCcw className="size-3.5" /></Button>}
    </div>
  </div>;
}

export function AccessMenu({ resolution, locked, onToggleAccess, onShowDetail }: { resolution: ModelResolution; locked: boolean; onToggleAccess: (r: AccessResolution) => void; onShowDetail: (model: ProtoModel, access: ProtoAccess) => void }) {
  const active = resolution.accesses.filter(a => a.state === "active").length;
  return <Popover><PopoverTrigger asChild>
    <Button size="sm" variant="outline" aria-label={`Provider accesses for ${resolution.model.name}: ${active} of ${resolution.accesses.length} active`}>Accesses {active}/{resolution.accesses.length}</Button>
  </PopoverTrigger><PopoverContent align="start" className="w-96 max-w-[calc(100vw-2rem)]">
    <h3 className="border-b pb-2 text-sm font-semibold">Accesses for this key — {resolution.model.name}</h3>
    <p className="pt-2 text-xs text-muted-foreground">Common ID <span className="font-mono">{resolution.model.commonId}</span> routes natively through the accesses active for this key.</p>
    {locked && <p className="pt-1 text-xs text-muted-foreground">Select this model to change its accesses; exclusions can be restored below.</p>}
    <div className="divide-y">{resolution.accesses.map(r => <AccessRow key={r.access.id} resolution={r} locked={locked} onToggleAccess={onToggleAccess} onShowDetail={access => onShowDetail(resolution.model, access)} />)}</div>
  </PopoverContent></Popover>;
}

export function WitnessNote({ groups, models }: { groups: ProtoGroup[]; models: ProtoModel[] }) {
  const witness = resolveDraft(witnessDraft, groups, models);
  const gpt5 = witness.find(r => r.model.id === "gpt-5");
  if (!gpt5) return null;
  return <details className="rounded-sm border bg-muted/40 p-3 text-xs text-muted-foreground">
    <summary className="cursor-pointer font-medium text-foreground">Witness key isolation · synthetic</summary>
    <p className="mt-2">Witness key (inherits Code) is not editable here. Its selection is unaffected by this draft: {gpt5.accesses.filter(a => a.state === "active").map(a => a.access.id).join(", ") || "no active accesses"} remain active. Group definitions are unchanged too.</p>
  </details>;
}

export function DemoBar({ lateSimulated, onSimulateLate, onReset }: { lateSimulated: boolean; onSimulateLate: () => void; onReset: () => void }) {
  return <details className="rounded-sm border border-dashed px-3 py-2 text-xs text-muted-foreground">
    <summary className="cursor-pointer font-medium text-foreground">Demo controls · synthetic fixture{lateSimulated ? " · Azure access added" : ""}</summary>
    <p className="mt-2">No gateway, no real keys; mutations stay in memory.</p>
    <div className="mt-2 flex flex-wrap gap-2">
      <Button size="sm" variant="outline" className="h-7" disabled={lateSimulated} onClick={onSimulateLate}>{lateSimulated ? "Azure access added to Kimi K2" : "Simulate: new Azure access appears on Kimi K2"}</Button>
      <Button size="sm" variant="ghost" className="h-7" onClick={onReset}>Reset demo</Button>
    </div>
  </details>;
}

export type ComposerProps = {
  draft: KeyDraft;
  setDraft: (d: KeyDraft) => void;
  models: ProtoModel[];
  groups: ProtoGroup[];
  lateSimulated: boolean;
  onSimulateLate: () => void;
  onResetDemo: () => void;
  onCancel: () => void;
  onCreate: () => void;
};
