// PROTOTYPE — card and table results for the synthetic key composer.
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BrandIcon } from "../../components/registry/BrandIcon";
import { GroupSummary, ProviderSummary } from "./CompactCollection";
import type { ViewOptions } from "../../components/registry/ViewOptions";
import { isSelected, type AccessResolution, type KeyDraft, type ModelResolution, type ProtoAccess, type ProtoGroup, type ProtoModel } from "./state";
import { AccessMenu } from "./shared";
import { useCopy, useTerm } from "../../lib/locale";
import { CatalogCard, CatalogGrid } from "@/components/registry/CatalogCard";
import { ModelCapabilitiesSummary, ModelModalitiesSummary } from "@/components/registry/model-capabilities";

const frenchSummaries: Record<string, string> = {
  "gpt-5": "Raisonnement et programmation pour les tâches complexes.",
  "claude-sonnet-4.6": "Modèle polyvalent pour le code, la rédaction et les agents.",
  "gemini-2.5-pro": "Raisonnement multimodal avec un grand contexte d’entrée.",
  "kimi-k2": "Modèle ouvert adapté aux agents et au code.",
  "gpt-5-mini": "Modèle léger pour les requêtes fréquentes.",
  "claude-opus-4": "Modèle avancé pour le raisonnement exigeant.",
  "imagen-4": "Génération d’images avec Google.",
  "text-embedding-3-large": "Vecteurs de représentation à haute dimension.",
};

const accessResolution = (model: ProtoModel, resolution?: ModelResolution): ModelResolution => resolution ?? { model, state: "active", groups: [], direct: false, accesses: model.accesses.map(access => ({ access, state: "off", origins: [] })) };
const activeProviders = (resolution?: ModelResolution) => new Set(resolution?.state === "active" ? resolution.accesses.filter(item => item.state === "active").map(item => item.access.provider) : []);

export type CardCallbacks = {
  onToggleModel: (model: ProtoModel) => void;
  onToggleAccess: (r: AccessResolution) => void;
  onShowDetail: (model: ProtoModel, access: ProtoAccess) => void;
};

function originBadges(resolution: ModelResolution | undefined, copy: (english: string, french: string) => string, scope: "key" | "group" = "key") {
  if (!resolution) return null;
  return <span className="flex flex-wrap gap-1">
    {resolution.direct && <Badge variant="default">{scope === "group" ? copy("Group member", "Membre du groupe") : copy("Direct pick", "Choix direct")}</Badge>}
    {resolution.groups.length > 0 && <GroupSummary names={resolution.groups} />}
    {resolution.state === "excluded" && <Badge variant="warning">{copy("Excluded locally", "Exclu pour cette clé")}</Badge>}
  </span>;
}

function selectionLabel(model: ProtoModel, resolution: ModelResolution | undefined, selected: boolean, scope: "key" | "group", copy: (english: string, french: string) => string) {
  const target = scope === "group" ? copy("this group", "ce groupe") : copy("this key", "cette clé");
  const action = resolution?.state === "excluded" ? copy("Restore", "Rétablir") : selected ? copy("Remove", "Retirer") : copy("Select", "Sélectionner");
  const preposition = resolution?.state === "excluded" ? copy("for", "pour") : selected ? copy("from", "de") : copy("for", "pour");
  return `${action} ${model.name} ${preposition} ${target}`;
}

function CardSelection({ model, resolution, draft, groups, selectionScope = "key", onToggleModel }: { model: ProtoModel; resolution: ModelResolution | undefined; draft: KeyDraft; groups: ProtoGroup[]; selectionScope?: "key" | "group" } & Pick<CardCallbacks, "onToggleModel">) {
  const copy = useCopy();
  const selected = isSelected(model.id, draft, groups);
  const label = selectionLabel(model, resolution, selected, selectionScope, copy);
  return <Checkbox checked={selected} aria-label={label} title={label} onCheckedChange={() => onToggleModel(model)} className="relative mt-0.5 after:absolute after:-inset-1 [--primary:var(--chart-success)]" />;
}

export type DisplayDetails = { description: boolean; id: boolean; providers: boolean; capabilities: boolean; modalities: boolean };

type ResultsProps = {
  filtered: ProtoModel[];
  view: ViewOptions;
  display: DisplayDetails;
  groupBy: string;
} & ({ mode: "catalog"; onOpenModel: (modelId: string) => void } | {
  mode?: "composer"; selectionScope?: "key" | "group"; draft: KeyDraft; groups: ProtoGroup[];
  resolved: Map<string, ModelResolution>; callbacks: CardCallbacks;
});

export function ComposerModelResults(props: ResultsProps) {
  const { filtered, view, display, groupBy } = props;
  const catalog = props.mode === "catalog";
  const copy = useCopy();
  const byId = (model: ProtoModel) => catalog ? undefined : props.resolved.get(model.id);
  const card = (model: ProtoModel) => {
    const resolution = byId(model);
    const selected = catalog ? false : isSelected(model.id, props.draft, props.groups);
    const square = view.size !== "small";
    return <CatalogCard key={model.id} format={square ? "square" : "compact"} selected={selected} warning={resolution?.state === "excluded"} expanded={display.description || display.id} header={<>
        <BrandIcon model={model} mode="creator" />
        <div className="min-w-0 flex-1">
          <CardTitle>
            {catalog ? <button type="button" onClick={() => props.onOpenModel(model.id)} className="block w-full truncate rounded-sm text-left text-sm leading-snug hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={model.name} aria-label={copy(`Open ${model.name} details`, `Ouvrir la fiche de ${model.name}`)}>{model.name}</button> : <Popover><PopoverTrigger asChild><button type="button" className="block w-full truncate rounded-sm text-left text-sm leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={model.name} aria-label={copy(`About ${model.name}`, `À propos de ${model.name}`)}>{model.name}</button></PopoverTrigger><PopoverContent className="w-64 max-w-[calc(100vw-2rem)] p-3">
              <p className="text-sm font-semibold">{model.name}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{model.commonId}</p><p className="mt-2 text-xs">{copy(model.summary, frenchSummaries[model.id] || model.summary)}</p>
            </PopoverContent></Popover>}
          </CardTitle>
          <CardDescription className="mt-1 truncate text-xs">{model.creator}</CardDescription>
        </div>
        {!catalog && <CardSelection model={model} resolution={resolution} draft={props.draft} groups={props.groups} selectionScope={props.selectionScope} onToggleModel={props.callbacks.onToggleModel} />}
      </>} footer={<>{display.providers && <ProviderSummary ids={model.accesses.map(access => access.provider)} activeIds={catalog ? undefined : activeProviders(resolution)} scope={catalog ? undefined : props.selectionScope} />}{catalog ? <Button type="button" variant="outline" size="sm" onClick={() => props.onOpenModel(model.id)}>{copy("View details", "Voir la fiche")}</Button> : <AccessMenu compact scope={props.selectionScope} resolution={accessResolution(model, resolution)} locked={!selected} onToggleAccess={props.callbacks.onToggleAccess} onShowDetail={props.callbacks.onShowDetail} />}</>}>
        {display.description && <p className="line-clamp-2 text-xs text-muted-foreground" title={copy(model.summary, frenchSummaries[model.id] || model.summary)}>{copy(model.summary, frenchSummaries[model.id] || model.summary)}</p>}
        {display.id && <p className="break-all font-mono text-[11px] text-muted-foreground">{model.commonId}</p>}
        {display.modalities && <ModelModalitiesSummary model={model} stacked={square} />}
        {square && display.capabilities && <Separator className="my-1" />}
        {display.capabilities && <div className={cn("flex gap-1", square ? "flex-col items-start" : "flex-wrap items-center")}>
          {square && <span className="text-xs text-muted-foreground">{copy("Capabilities", "Capacités")}</span>}
          <ModelCapabilitiesSummary model={model} stacked={square} />
        </div>}
        {(resolution?.groups.length || resolution?.state === "excluded") ? <div>{originBadges(resolution, copy, catalog ? "key" : props.selectionScope)}</div> : null}
    </CatalogCard>;
  };
  const row = (model: ProtoModel) => {
    const resolution = byId(model);
    const selected = catalog ? false : isSelected(model.id, props.draft, props.groups);
    return <TableRow key={model.id} className={resolution?.state === "excluded" ? "bg-chart-warning/10" : selected ? "bg-chart-success/10" : ""}>
      <TableCell className="sticky left-0 z-10 min-w-52 max-w-52 whitespace-normal bg-card shadow-[2px_0_4px_-2px_rgba(0,0,0,.2)]"><div className="flex items-center gap-2">{!catalog && <Checkbox checked={selected && resolution?.state !== "excluded"} aria-label={selectionLabel(model, resolution, selected, props.selectionScope ?? "key", copy)} onCheckedChange={() => props.callbacks.onToggleModel(model)} />}<BrandIcon model={model} mode={view.logo} /><div className="min-w-0">{catalog ? <button type="button" className="text-left text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => props.onOpenModel(model.id)}>{model.name}</button> : <p className="text-sm font-semibold">{model.name}</p>}{display.id && <p className="break-all font-mono text-[11px] text-muted-foreground">{model.commonId}</p>}{display.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{copy(model.summary, frenchSummaries[model.id] || model.summary)}</p>}</div></div>{originBadges(resolution, copy, catalog ? "key" : props.selectionScope)}</TableCell>
      {display.providers && <TableCell><ProviderSummary ids={model.accesses.map(access => access.provider)} activeIds={catalog ? undefined : activeProviders(resolution)} scope={catalog ? undefined : props.selectionScope} /></TableCell>}
      {display.capabilities && <TableCell><ModelCapabilitiesSummary model={model} /></TableCell>}
      <TableCell>{catalog ? <Button type="button" variant="outline" size="sm" onClick={() => props.onOpenModel(model.id)}>{copy(`${model.accesses.length} accesses · View details`, `${model.accesses.length} accès · Voir la fiche`)}</Button> : <AccessMenu scope={props.selectionScope} resolution={accessResolution(model, resolution)} locked={!selected} onToggleAccess={props.callbacks.onToggleAccess} onShowDetail={props.callbacks.onShowDetail} />}</TableCell>
      {display.modalities && <TableCell><ModelModalitiesSummary model={model} /></TableCell>}
    </TableRow>;
  };
  const grouped = new Map<string, ProtoModel[]>();
  if (groupBy !== "none") for (const model of filtered) {
    const names = groupBy === "provider" ? [...new Set(model.accesses.map(a => a.provider))] : groupBy === "creator" ? [model.creator] : model.tasks.length ? model.tasks : ["Other"];
    for (const name of names) grouped.set(name, [...(grouped.get(name) || []), model]);
  }
  const sections: [string, ProtoModel[]][] = groupBy === "none" ? [["", filtered]] : [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  return <>{sections.map(([group, items]) => <section key={group || "all"} className="flex flex-col gap-3">
    {group && <h3 className="text-base font-semibold">{group} <span className="ml-1 text-sm font-normal text-muted-foreground">{items.length}</span></h3>}
    {view.layout === "grid"
      ? <CatalogGrid format={view.size === "small" ? "compact" : "square"}>{items.map(card)}</CatalogGrid>
      : <><p className="text-xs text-muted-foreground sm:hidden">{copy("Scroll horizontally to compare columns.", "Faites défiler horizontalement pour comparer les colonnes.")}</p><div className="min-w-0 max-w-full overflow-x-auto rounded-sm border bg-card shadow-sm"><Table><TableHeader className="bg-muted/50"><TableRow><TableHead className="sticky left-0 z-20 bg-muted">{copy("Model", "Modèle")}</TableHead>{display.providers && <TableHead>{copy("Providers", "Fournisseurs")}</TableHead>}{display.capabilities && <TableHead>{copy("Capabilities", "Capacités")}</TableHead>}<TableHead>{copy("Accesses", "Accès")}</TableHead>{display.modalities && <TableHead>{copy("Inputs → outputs", "Entrées → sorties")}</TableHead>}</TableRow></TableHeader><TableBody>{items.map(row)}</TableBody></Table></div></>}
  </section>)}</>;
}

// Shared group picker: adding a group complements direct picks without erasing them.
import { useState } from "react";
import { Layers3, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function GroupsPanel({ draft, groups, models, onToggleGroup }: { draft: KeyDraft; groups: ProtoGroup[]; models: ProtoModel[]; onToggleGroup: (id: string) => void }) {
  const copy = useCopy();
  const term = useTerm();
  const [search, setSearch] = useState("");
  const filtered = groups.filter(g => `${g.name} ${g.description}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-3">
    <div className="relative max-w-sm"><Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input aria-label={copy("Search groups", "Rechercher des groupes")} placeholder={copy("Search groups…", "Rechercher des groupes…")} className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <div className="grid gap-3 sm:grid-cols-2">
      {filtered.map(g => {
        const added = draft.groups.includes(g.id);
        return <Card key={g.id} className={`gap-0 py-0 transition-colors ${added ? "border-chart-success/50 bg-chart-success/5" : ""}`}><CardContent className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0"><p className="flex items-center gap-2 font-semibold"><Layers3 className="size-4 shrink-0" />{term(g.name)}</p><p className="mt-0.5 text-xs text-muted-foreground">{copy(g.description, { code: "Modèles pour les clients de programmation", reasoning: "Recherche et planification complexes", vision: "Entrées visuelles et génération" }[g.id] || g.description)}</p></div>
            <Button size="sm" variant={added ? "secondary" : "outline"} aria-pressed={added} aria-label={added ? copy(`Remove group ${g.name} from this key`, `Retirer le groupe ${term(g.name)} de cette clé`) : copy(`Add group ${g.name} to this key`, `Ajouter le groupe ${term(g.name)} à cette clé`)} onClick={() => onToggleGroup(g.id)}>{added ? <><Check className="size-3.5" />{copy("Added", "Ajouté")}</> : copy("Add group", "Ajouter")}</Button>
          </div>
          <ul className="space-y-1 border-t pt-2">
            {g.members.map(m => {
              const model = models.find(x => x.id === m.modelId);
              if (!model) return null;
              const direct = draft.added.some(a => a.modelId === m.modelId);
              return <li key={m.modelId} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="font-medium">{model.name}</span>
                <span className="text-muted-foreground">{copy(`${m.accesses.length}/${model.accesses.length} accesses retained`, `${m.accesses.length}/${model.accesses.length} accès conservés`)}</span>
                {added && direct && <Badge variant="default">{copy("Also chosen directly", "Aussi choisi directement")}</Badge>}
                {added && draft.excludedModels.includes(m.modelId) && <Badge variant="warning">{copy("Excluded for this key", "Exclu pour cette clé")}</Badge>}
              </li>;
            })}
          </ul>
        </CardContent></Card>;
      })}
      {!filtered.length && <p className="rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground">{copy("No groups match this search.", "Aucun groupe ne correspond à cette recherche.")}</p>}
    </div>
  </div>;
}
