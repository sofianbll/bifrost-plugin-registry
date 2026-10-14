// Archived from commit c73a82c. Only root-relative import paths adapted for gallery rendering.
// PROTOTYPE — card and table results for the synthetic key composer.
import { AudioLines, BrainCircuit, Check, Code2, Eye, Image, RotateCcw, Sparkles, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BrandIcon } from "@/components/registry/BrandIcon";
import type { ViewOptions } from "@/components/registry/ViewOptions";
import { isSelected, type AccessResolution, type KeyDraft, type ModelResolution, type ProtoAccess, type ProtoGroup, type ProtoModel } from "./state";
import { AccessMenu } from "./shared";

const sizeClass = { small: "[grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))]", medium: "[grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr))]", large: "[grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]" };

const capabilityIcons: Record<string, typeof BrainCircuit> = { Reasoning: BrainCircuit, Vision: Eye, "Tool calling": Wrench, Tools: Wrench, "Image generation": Image, Embeddings: Sparkles, Streaming: AudioLines, "Structured output": Code2, Chat: Sparkles };
function Capabilities({ model }: { model: ProtoModel }) {
  const declared = Object.entries(model.capabilities).filter(([, state]) => state === "Declared");
  const unknown = Object.entries(model.capabilities).filter(([, state]) => state === "Unknown");
  return <div className="flex flex-wrap items-center gap-1" aria-label="Declared capabilities">
    {declared.map(([name]) => { const Icon = capabilityIcons[name] || Sparkles; return <Tooltip key={name}><TooltipTrigger asChild><button type="button" aria-label={`${name}: declared in synthetic fixture; not verified by execution`} className="inline-flex size-7 items-center justify-center rounded-sm border bg-background text-foreground/75 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon className="size-3.5" /></button></TooltipTrigger><TooltipContent className="w-72 max-w-[calc(100vw-2rem)] border bg-popover p-3 text-popover-foreground shadow-md"><p className="mb-2 text-sm font-semibold">{name}</p><table className="w-full text-left text-xs"><tbody>{[["Status", "Declared"], ["Source", "Synthetic model fixture"], ["Provider execution", "Not verified"], ...(name === "Reasoning" ? [["Supported efforts", "Unknown"], ["Default effort", "Unknown"], ["Required", "Unknown"]] : [])].map(([label, value]) => <tr key={label} className="border-b last:border-0"><th scope="row" className="py-2 pr-3 font-medium">{label}</th><td className="py-2 text-muted-foreground">{value}</td></tr>)}</tbody></table></TooltipContent></Tooltip>; })}
    {unknown.length > 0 && <Tooltip><TooltipTrigger asChild><button type="button" aria-label={`${unknown.length} capabilities unknown: ${unknown.map(([name]) => name).join(", ")}`} className="rounded-sm border border-dashed px-1.5 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">+{unknown.length} ?</button></TooltipTrigger><TooltipContent className="max-w-64">Unknown: {unknown.map(([name]) => name).join(", ")}. No negative claim or provider test.</TooltipContent></Tooltip>}
  </div>;
}

const modalities = (items: string[]) => items.length ? items.join(", ") : "Unknown";
const accessResolution = (model: ProtoModel, resolution?: ModelResolution): ModelResolution => resolution ?? { model, state: "active", groups: [], direct: false, accesses: model.accesses.map(access => ({ access, state: "off", origins: [] })) };

export type CardCallbacks = {
  onToggleModel: (model: ProtoModel) => void;
  onToggleAccess: (r: AccessResolution) => void;
  onShowDetail: (model: ProtoModel, access: ProtoAccess) => void;
};

function originBadges(resolution: ModelResolution | undefined) {
  if (!resolution) return null;
  return <span className="flex flex-wrap gap-1">
    {resolution.direct && <Badge variant="default">Direct pick</Badge>}
    {resolution.groups.map(name => <Badge key={name} variant="secondary">Inherited · {name}</Badge>)}
    {resolution.state === "excluded" && <Badge variant="warning">Excluded locally</Badge>}
  </span>;
}

function SelectButton({ model, resolution, draft, groups, onToggleModel }: { model: ProtoModel; resolution: ModelResolution | undefined; draft: KeyDraft; groups: ProtoGroup[] } & Pick<CardCallbacks, "onToggleModel">) {
  const selected = isSelected(model.id, draft, groups);
  if (resolution?.state === "excluded") {
    return <Button size="sm" variant="outline" onClick={() => onToggleModel(model)}><RotateCcw className="size-3.5" />Restore</Button>;
  }
  return <Button size="sm" className="h-11 sm:h-8" variant={selected ? "secondary" : "outline"} aria-pressed={selected} aria-label={selected ? `Remove ${model.name} from this key` : `Select ${model.name} for this key`} onClick={() => onToggleModel(model)}>{selected && <Check className="size-3.5" />}{selected ? "Selected" : "Select model"}</Button>;
}

export function ComposerModelResults({ filtered, view, groupBy, draft, groups, resolved, callbacks }: {
  filtered: ProtoModel[];
  view: ViewOptions;
  groupBy: string;
  draft: KeyDraft;
  groups: ProtoGroup[];
  resolved: Map<string, ModelResolution>;
  callbacks: CardCallbacks;
}) {
  const byId = (model: ProtoModel) => resolved.get(model.id);
  const card = (model: ProtoModel) => {
    const resolution = byId(model);
    return <Card key={model.id} className={`gap-0 py-0 transition-colors hover:border-primary/40 ${resolution?.state === "excluded" ? "border-chart-warning/50 bg-chart-warning/5" : isSelected(model.id, draft, groups) ? "border-chart-success/50 bg-chart-success/5" : ""}`}>
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <BrandIcon model={model} mode={view.logo} />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-snug" title={model.name}>{model.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{model.creator} · {model.family}</p>
          </div>
        </div>
        {view.description && <p className="line-clamp-2 text-sm leading-relaxed text-foreground/75">{model.summary}</p>}
        {view.metadata && <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-3 text-xs"><div><p className="text-muted-foreground">Input</p><p className="font-medium">{modalities(model.inputModalities)}</p></div><div><p className="text-muted-foreground">Output</p><p className="font-medium">{modalities(model.outputModalities)}</p></div></div>}
        {view.providers && <div className="flex items-center gap-2 text-xs text-muted-foreground"><BrandIcon model={model} mode="provider" /><span>{model.accesses.length} serving access{model.accesses.length === 1 ? "" : "es"}</span></div>}
        {view.evidence && <Capabilities model={model} />}
        {originBadges(resolution)}
        <details className="text-xs text-muted-foreground"><summary className="w-fit cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Details</summary><p className="mt-1 break-all font-mono">Common ID: {model.commonId}</p><p className="mt-1">{model.tasks.join(", ") || "Usage unknown"}</p><p className="mt-1">Cost, latency, release date: unknown</p></details>
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
          <SelectButton model={model} resolution={resolution} draft={draft} groups={groups} onToggleModel={callbacks.onToggleModel} />
          <AccessMenu resolution={accessResolution(model, resolution)} locked={!isSelected(model.id, draft, groups)} onToggleAccess={callbacks.onToggleAccess} onShowDetail={callbacks.onShowDetail} />
        </div>
      </CardContent>
    </Card>;
  };
  const row = (model: ProtoModel) => {
    const resolution = byId(model);
    return <TableRow key={model.id} className={resolution?.state === "excluded" ? "bg-chart-warning/10" : isSelected(model.id, draft, groups) ? "bg-chart-success/10" : ""}>
      <TableCell className="sticky left-0 z-10 min-w-48 max-w-48 whitespace-normal bg-card shadow-[2px_0_4px_-2px_rgba(0,0,0,.2)]"><div className="flex items-center gap-2"><BrandIcon model={model} mode={view.logo} /><div className="min-w-0"><p className="text-sm font-semibold">{model.name}</p><p className="break-all font-mono text-[11px] text-muted-foreground">{model.commonId}</p></div></div>{originBadges(resolution)}<div className="mt-2"><SelectButton model={model} resolution={resolution} draft={draft} groups={groups} onToggleModel={callbacks.onToggleModel} /></div></TableCell>
      <TableCell><BrandIcon model={model} mode="provider" /></TableCell>
      <TableCell><Capabilities model={model} /></TableCell>
      <TableCell className="min-w-36 text-xs text-muted-foreground">{modalities(model.inputModalities)}<span className="mx-1">→</span>{modalities(model.outputModalities)}</TableCell>
      <TableCell className="text-xs text-muted-foreground">Unknown<br /><span className="whitespace-nowrap">input / output</span></TableCell>
      <TableCell className="text-xs text-muted-foreground">Unknown</TableCell>
      <TableCell className="text-xs text-muted-foreground">Unknown</TableCell>
      <TableCell className="text-xs text-muted-foreground">Unknown</TableCell><TableCell className="text-xs text-muted-foreground">Unknown</TableCell><TableCell className="text-xs text-muted-foreground">Unknown</TableCell><TableCell><AccessMenu resolution={accessResolution(model, resolution)} locked={!isSelected(model.id, draft, groups)} onToggleAccess={callbacks.onToggleAccess} onShowDetail={callbacks.onShowDetail} /></TableCell>
    </TableRow>;
  };
  const grouped = new Map<string, ProtoModel[]>();
  if (groupBy !== "none") for (const model of filtered) {
    const names = groupBy === "provider" ? [...new Set(model.accesses.map(a => a.provider))] : groupBy === "creator" ? [model.creator] : model.tasks.length ? model.tasks : ["Other"];
    for (const name of names) grouped.set(name, [...(grouped.get(name) || []), model]);
  }
  const sections: [string, ProtoModel[]][] = groupBy === "none" ? [["", filtered]] : [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  return <>{sections.map(([group, items]) => <section key={group || "all"} className="space-y-3">
    {group && <h3 className="text-base font-semibold">{group} <span className="ml-1 text-sm font-normal text-muted-foreground">{items.length}</span></h3>}
    {view.layout === "grid"
      ? <div className={`grid gap-4 ${sizeClass[view.size]}`}>{items.map(card)}</div>
      : <div className="min-w-0 max-w-full overflow-x-auto rounded-sm border bg-card shadow-sm"><Table className="min-w-[980px]"><TableHeader className="bg-muted/50"><TableRow><TableHead className="sticky left-0 z-20 bg-muted">Model · select</TableHead><TableHead>Providers</TableHead><TableHead>Capabilities</TableHead><TableHead>Input → output</TableHead><TableHead>Cost</TableHead><TableHead>Latency</TableHead><TableHead>ZDR</TableHead><TableHead>No Training</TableHead><TableHead>Free Tier</TableHead><TableHead>Released</TableHead><TableHead>Accesses</TableHead></TableRow></TableHeader><TableBody>{items.map(row)}</TableBody></Table></div>}
  </section>)}</>;
}

// Shared group picker: adding a group complements direct picks without erasing them.
import { useState } from "react";
import { Layers3, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function GroupsPanel({ draft, groups, models, onToggleGroup }: { draft: KeyDraft; groups: ProtoGroup[]; models: ProtoModel[]; onToggleGroup: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const filtered = groups.filter(g => `${g.name} ${g.description}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-3">
    <div className="relative max-w-sm"><Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input aria-label="Search groups" placeholder="Search groups…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <div className="grid gap-4 sm:grid-cols-2">
      {filtered.map(g => {
        const added = draft.groups.includes(g.id);
        return <Card key={g.id} className={`gap-0 py-0 transition-colors ${added ? "border-chart-success/50 bg-chart-success/5" : ""}`}><CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0"><p className="flex items-center gap-2 font-semibold"><Layers3 className="size-4 shrink-0" />{g.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{g.description}</p></div>
            <Button size="sm" variant={added ? "secondary" : "outline"} aria-pressed={added} aria-label={added ? `Remove group ${g.name} from this key` : `Add group ${g.name} to this key`} onClick={() => onToggleGroup(g.id)}>{added ? <><Check className="size-3.5" />Added</> : "Add group"}</Button>
          </div>
          <ul className="space-y-1.5 border-t pt-2">
            {g.members.map(m => {
              const model = models.find(x => x.id === m.modelId);
              if (!model) return null;
              const direct = draft.added.some(a => a.modelId === m.modelId);
              return <li key={m.modelId} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="font-medium">{model.name}</span>
                <span className="text-muted-foreground">{m.accesses.length}/{model.accesses.length} accesses retained</span>
                {added && direct && <Badge variant="default">also a direct pick — kept</Badge>}
                {added && draft.excludedModels.includes(m.modelId) && <Badge variant="warning">excluded locally — wins over this group</Badge>}
              </li>;
            })}
          </ul>
          {added && <p className="text-xs text-muted-foreground">Complements your direct picks. Removing the group never removes direct picks; exclusions are restored explicitly.</p>}
        </CardContent></Card>;
      })}
      {!filtered.length && <p className="rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground">No groups match this search.</p>}
    </div>
  </div>;
}
