// PROTOTYPE — draft summary and planned exposures, shared by both modes.
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { BrandIcon } from "../../components/registry/BrandIcon";
import { plannedExposures, resolveDraft, type AccessResolution, type KeyDraft, type ModelResolution, type ProtoAccess, type ProtoGroup, type ProtoModel } from "./state";
import { AccessRow, WitnessNote } from "./shared";
import { useCopy } from "../../lib/locale";

const formats: KeyDraft["naming"][] = ["model", "provider/model", "both"];
const formatLabel = (format: KeyDraft["naming"], copy: ReturnType<typeof useCopy>) => format === "both" ? copy("both", "les deux") : format === "model" ? copy("model", "modèle") : copy("provider/model", "fournisseur/modèle");

export function PlannedExposures({ draft, groups, models, onNaming }: { draft: KeyDraft; groups: ProtoGroup[]; models: ProtoModel[]; onNaming: (naming: KeyDraft["naming"]) => void }) {
  const copy = useCopy();
  const titleId = useId();
  const planned = plannedExposures(draft, groups, models);
  const modelExample = plannedExposures({ ...draft, naming: "model" }, groups, models)[0];
  const accessExample = plannedExposures({ ...draft, naming: "provider/model" }, groups, models)[0];
  return <section className="space-y-3 border-t pt-3" aria-labelledby={titleId}>
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 id={titleId} className="text-sm font-semibold">{copy("Planned IDs", "ID prévus")}</h3>
      <span className="text-xs font-medium text-muted-foreground">{planned.length} {copy(planned.length === 1 ? "ID" : "IDs", planned.length === 1 ? "ID" : "IDs")}</span>
    </div>
    <p className="text-xs text-muted-foreground">{copy("Draft preview only · not published or verified.", "Aperçu du brouillon · ni publié ni vérifié.")}</p>
    <div className="space-y-1.5">
      <p className="text-xs font-medium">{copy("ID format", "Format des ID")}</p>
      <div className="flex flex-wrap gap-1" role="group" aria-label={copy("ID format", "Format des ID") }>
        {formats.map(format => <Button key={format} size="sm" variant={draft.naming === format ? "default" : "outline"} aria-pressed={draft.naming === format} onClick={() => onNaming(format)}>{formatLabel(format, copy)}</Button>)}
      </div>
      <p className="break-all text-[11px] text-muted-foreground">
        {draft.naming === "model" ? <><code className="font-mono">{modelExample || "model-id"}</code> · {copy("model ID", "ID modèle")}</> : draft.naming === "provider/model" ? <><code className="font-mono">{accessExample || "provider/model-id"}</code> · {copy("provider access ID", "ID d’accès fournisseur")}</> : <><code className="font-mono">{modelExample || "model-id"}</code> + <code className="font-mono">{accessExample || "provider/model-id"}</code> · {copy("both names", "les deux noms")}</>}
      </p>
    </div>
    <div className="max-h-40 overflow-auto rounded-sm border bg-card px-3" aria-live="polite">
      {planned.map((id, index) => <div key={`${id}-${index}`} className="break-all border-b py-1.5 font-mono text-xs last:border-0">{id}</div>)}
      {!planned.length && <p className="py-3 text-xs text-muted-foreground">{copy("No active accesses. Select a configured access to preview IDs.", "Aucun accès actif. Sélectionnez un accès configuré pour afficher les ID prévus.")}</p>}
    </div>
  </section>;
}

export function DraftSummary({ draft, groups, models, onToggleModel, onToggleAccess, onShowDetail }: {
  draft: KeyDraft;
  groups: ProtoGroup[];
  models: ProtoModel[];
  onToggleModel: (model: ProtoModel) => void;
  onToggleAccess: (r: AccessResolution) => void;
  onShowDetail: (model: ProtoModel, access: ProtoAccess) => void;
}) {
  const copy = useCopy();
  const resolved = resolveDraft(draft, groups, models);
  const active = resolved.filter(r => r.state === "active");
  const excluded = resolved.filter(r => r.state === "excluded");
  const modelRow = (r: ModelResolution) => {
    const noActive = r.state === "active" && !r.accesses.some(a => a.state === "active");
    return <div key={r.model.id} className={`space-y-1 border-b py-2 ${r.state === "excluded" ? "bg-chart-warning/5" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <BrandIcon model={r.model} mode="creator" />
        <strong className="text-sm">{r.model.name}</strong>
        <span className="break-all font-mono text-[11px] text-muted-foreground">{r.model.commonId}</span>
        {r.direct && <Badge variant="default">{copy("Direct pick", "Choix direct")}</Badge>}
        {r.groups.map(name => <Badge key={name} variant="secondary">{copy("Inherited", "Hérité")} · {name}</Badge>)}
        {r.state === "excluded" && <Badge variant="warning">{copy("Excluded locally", "Exclu pour cette clé")}</Badge>}
        {noActive && <Badge variant="warning">{copy("No active access — not callable", "Aucun accès actif · appel impossible")}</Badge>}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onToggleModel(r.model)}>
          {r.state === "excluded" ? <><RotateCcw className="size-3.5" />{copy("Restore model", "Rétablir le modèle")}</> : copy("Exclude model", "Exclure le modèle")}
        </Button>
      </div>
      <div className="divide-y divide-border/60 pl-1">{r.accesses.map(a => <AccessRow key={a.access.id} resolution={a} locked={r.state === "excluded"} onToggleAccess={onToggleAccess} onShowDetail={access => onShowDetail(r.model, access)} />)}</div>
    </div>;
  };
  return <div className="space-y-3">
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{copy("Composition", "Composition")} — {active.length} {copy(active.length === 1 ? "model" : "models", active.length === 1 ? "modèle" : "modèles")}</h3>
      {!resolved.length && <p className="py-3 text-sm text-muted-foreground">{copy("Nothing selected yet. Pick models or inherit groups.", "Aucune sélection. Choisissez des modèles ou héritez de groupes.")}</p>}
      {active.map(modelRow)}
    </section>
    {excluded.length > 0 && <section className="space-y-2">
      <h3 className="text-sm font-semibold">{copy("Excluded locally — wins over groups and direct picks", "Exclus pour cette clé · priorité sur les groupes et choix directs")}</h3>
      {excluded.map(modelRow)}
    </section>}
    <WitnessNote groups={groups} models={models} />
  </div>;
}
