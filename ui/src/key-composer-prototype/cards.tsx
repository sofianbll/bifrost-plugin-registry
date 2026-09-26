// PROTOTYPE — model selection cards rendered inside the real ModelBrowser
// (search, filters, grouping, select-visible and out-of-filter preservation
// come from ModelBrowser; only the result rendering is prototype-specific).
import { Check, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BrandIcon } from "../BrandIcon";
import type { ViewOptions } from "../ViewOptions";
import { isSelected, type AccessResolution, type KeyDraft, type ModelResolution, type ProtoAccess, type ProtoGroup, type ProtoModel } from "./state";
import { AccessMenu } from "./shared";

const sizeClass = { small: "min-[560px]:grid-cols-2 xl:grid-cols-4", medium: "min-[560px]:grid-cols-2 xl:grid-cols-3", large: "lg:grid-cols-2" };

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
  return <Button size="sm" variant={selected ? "secondary" : "outline"} aria-pressed={selected} aria-label={selected ? `Remove ${model.name} from this key` : `Select ${model.name} for this key`} onClick={() => onToggleModel(model)}>{selected && <Check className="size-3.5" />}{selected ? "Selected" : "Select model"}</Button>;
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
      <CardContent className="space-y-2 p-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <BrandIcon model={model} mode={view.logo} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-snug" title={model.name}>{model.name}</p>
            <p className="text-xs text-muted-foreground">{model.creator} · {model.family}</p>
            <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground" title={`Common ID: ${model.commonId}`}>{model.commonId}</p>
          </div>
        </div>
        {view.description && <p className="line-clamp-2 text-xs leading-relaxed text-foreground/75">{model.summary}</p>}
        {view.metadata && <div className="flex flex-wrap gap-1">{model.tasks.map(task => <Badge key={task} variant="secondary">{task}</Badge>)}<Badge variant="outline">{model.inputModalities.join(", ") || "?"} → {model.outputModalities.join(", ") || "?"}</Badge></div>}
        {originBadges(resolution)}
        <div className="flex flex-wrap items-center gap-2">
          <SelectButton model={model} resolution={resolution} draft={draft} groups={groups} onToggleModel={callbacks.onToggleModel} />
          <AccessMenu resolution={resolution ?? { model, state: "active", groups: [], direct: false, accesses: model.accesses.map(access => ({ access, state: "off" as const, origins: [] })) }} locked={!isSelected(model.id, draft, groups)} onToggleAccess={callbacks.onToggleAccess} onShowDetail={callbacks.onShowDetail} />
        </div>
      </CardContent>
    </Card>;
  };
  const row = (model: ProtoModel) => {
    const resolution = byId(model);
    return <TableRow key={model.id} className={resolution?.state === "excluded" ? "bg-chart-warning/10" : isSelected(model.id, draft, groups) ? "bg-chart-success/10" : ""}>
      <TableCell><div className="flex items-center gap-2"><BrandIcon model={model} mode={view.logo} /><div><p className="text-sm font-semibold">{model.name}</p><p className="font-mono text-[11px] text-muted-foreground">{model.commonId}</p></div></div>{originBadges(resolution)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{model.creator} · {model.family}</TableCell>
      <TableCell><div className="flex flex-wrap items-center justify-end gap-2"><SelectButton model={model} resolution={resolution} draft={draft} groups={groups} onToggleModel={callbacks.onToggleModel} /><AccessMenu resolution={resolution ?? { model, state: "active", groups: [], direct: false, accesses: model.accesses.map(access => ({ access, state: "off" as const, origins: [] })) }} locked={!isSelected(model.id, draft, groups)} onToggleAccess={callbacks.onToggleAccess} onShowDetail={callbacks.onShowDetail} /></div></TableCell>
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
      : <div className="overflow-x-auto rounded-sm border bg-card shadow-sm"><Table><TableHeader className="bg-muted/50"><TableRow><TableHead>Model</TableHead><TableHead>Creator / series</TableHead><TableHead className="text-right">Key selection</TableHead></TableRow></TableHeader><TableBody>{items.map(row)}</TableBody></Table></div>}
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
