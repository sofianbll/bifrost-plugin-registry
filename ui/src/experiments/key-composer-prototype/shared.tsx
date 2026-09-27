// PROTOTYPE — shared primitives for the key-composer modes.
// Layouts live in VariantA.tsx / VariantB.tsx; these are data-level fragments.
import { Ban, ChevronRight, Info, Plus, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { displayProvider } from "../../components/registry/BrandIcon";
import { resolveDraft, witnessDraft, type AccessResolution, type KeyDraft, type ModelResolution, type ProtoAccess, type ProtoGroup, type ProtoModel } from "./state";
import { useCopy } from "../../lib/locale";

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

export function StateBadge({ state, scope = "key" }: { state: AccessResolution["state"]; scope?: "key" | "group" }) {
  const copy = useCopy();
  if (state === "excluded") return <Badge variant="warning">{scope === "group" ? copy("Removed from group", "Retiré du groupe") : copy("Excluded locally", "Exclu pour cette clé")}</Badge>;
  if (state === "off") return <Badge variant="secondary">{copy("Off", "Inactif")}</Badge>;
  if (state === "unavailable") return <Badge variant="outline" className="text-muted-foreground">{copy("Not configured", "Non configuré")}</Badge>;
  return null;
}

function originLabel(origin: string, copy: ReturnType<typeof useCopy>) {
  if (origin.startsWith("Inherited · ")) return copy(origin, `Hérité · ${origin.slice(12)}`);
  if (origin === "Direct pick") return copy(origin, "Choix direct");
  if (origin === "Activated directly") return copy(origin, "Activé directement");
  return origin;
}

function factLabel(label: string, copy: ReturnType<typeof useCopy>) {
  const french: Record<string, string> = { "Context length": "Longueur du contexte", "p50 latency": "Latence médiane", "Provisioned throughput": "Débit provisionné", "Upstream provider": "Fournisseur amont", "Max output images": "Images générées au maximum", "Generation time": "Temps de génération", "Max input": "Entrée maximale" };
  return copy(label, french[label] || label);
}

function factSource(source: string, copy: ReturnType<typeof useCopy>) {
  return copy(source, source.replace("Models.dev datasheet · imported ", "fiche Models.dev · importée le ").replace("AWS Bedrock model page · read ", "page du modèle AWS Bedrock · consultée le ").replace("Bifrost datasheet · synced ", "fiche Bifrost · synchronisée le "));
}

export function AccessDetailDialog({ model, access, onClose }: { model: ProtoModel | null; access: ProtoAccess | null; onClose: () => void }) {
  const copy = useCopy();
  return <Dialog open={!!access && !!model} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[min(80dvh,640px)] max-w-md overflow-y-auto p-4">
    {access && model && <>
      <DialogHeader className="border-b pb-2"><DialogTitle className="text-base">{copy(`${displayProvider(access.provider)} access`, `Accès ${displayProvider(access.provider)}`)}</DialogTitle><DialogDescription>{copy(`${model.name} · provider access detail. Synthetic fixture data.`, `${model.name} · détail de l’accès fournisseur. Données fictives.`)}</DialogDescription></DialogHeader>
      <dl className="space-y-2 text-sm">
        <div><dt className="text-xs font-medium text-muted-foreground">{copy("Access ID (exact)", "ID exact de l’accès")}</dt><dd className="break-all font-mono text-xs">{access.id}</dd></div>
        <div><dt className="text-xs font-medium text-muted-foreground">{copy("Native model ID for this provider", "ID natif du modèle chez ce fournisseur")}</dt><dd className="break-all font-mono text-xs">{access.nativeModel || copy("Not specified", "Non renseigné")}</dd></div>
        <div><dt className="text-xs font-medium text-muted-foreground">{copy("Common ID for this access", "ID commun de cet accès")}</dt><dd className="break-all font-mono text-xs">{model.commonId}</dd></div>
        <div><dt className="text-xs font-medium text-muted-foreground">{copy("Fixture configuration", "Configuration fictive")}</dt><dd>{access.configured ? copy("Configured and authorized in the fixture", "Configuré et autorisé dans la démonstration") : copy("Not configured in the fixture — cannot be activated for this key", "Non configuré dans la démonstration : activation impossible pour cette clé")}</dd></div>
      </dl>
      <div className="space-y-1 border-t pt-2">
        <h3 className="text-sm font-medium">{copy("Properties", "Propriétés")}</h3>
        {access.facts.map(fact => <div key={fact.label} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{factLabel(fact.label, copy)}</span>
          {fact.kind === "declared"
            ? <span className="text-right"><strong className="font-medium">{copy(fact.value || "", (fact.value || "").replace(" per request", " par requête"))}</strong><span className="block text-xs text-muted-foreground">{copy("Declared", "Déclaré")} · {factSource(fact.source, copy)}</span></span>
            : <span className="text-right"><strong className="font-medium">{copy("Not specified", "Non renseigné")}</strong><span className="block text-xs text-muted-foreground">{copy("Not measured by any source", "Aucune mesure dans les sources")}</span></span>}
        </div>)}
      </div>
      <p role="note" className="border-t pt-2 text-xs text-muted-foreground">{copy("This prototype sends no requests: execution, alias resolution and routing through Bifrost are unverified here. Declared values are documentary, not observed behavior.", "Ce prototype n’envoie aucune requête : exécution, résolution des alias et routage Bifrost ne sont pas vérifiés ici. Les valeurs déclarées sont documentaires, sans observation du comportement.")}</p>
    </>}
  </DialogContent></Dialog>;
}

export function AccessRow({ resolution, locked, onToggleAccess, onShowDetail, scope = "key" }: { resolution: AccessResolution; locked: boolean; onToggleAccess: (r: AccessResolution) => void; onShowDetail: (access: ProtoAccess) => void; scope?: "key" | "group" }) {
  const copy = useCopy();
  const { access, state, origins } = resolution;
  return <div className="flex min-w-0 items-start gap-2 py-1.5">
    <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${state === "active" ? "bg-chart-success" : state === "excluded" ? "bg-chart-warning" : "bg-muted-foreground/40"}`} />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium">{displayProvider(access.provider)}</span>
        <StateBadge state={state} scope={scope} />
        {state === "active" && origins.map(o => <Badge key={o} variant={o.startsWith("Inherited") ? "secondary" : "default"}>{scope === "group" && o === "Direct pick" ? copy("Group member", "Membre du groupe") : originLabel(o, copy)}</Badge>)}
        {state === "excluded" && origins.length > 0 && <span className="text-xs text-muted-foreground">{copy("was", "avant")} : {origins.map(o => scope === "group" && o === "Direct pick" ? copy("Group member", "Membre du groupe") : originLabel(o, copy)).join(" + ")}</span>}
      </div>
      <p className="break-all font-mono text-[11px] text-muted-foreground">{access.id}</p>
      {state === "off" && <p className="text-xs text-muted-foreground">{scope === "group" ? copy("Not in this group — add explicitly.", "Absent de ce groupe : ajoutez cet accès explicitement.") : copy("Not retained by any selection — activate explicitly.", "Absent des sélections : activez cet accès explicitement.")}</p>}
      {state === "unavailable" && <p className="text-xs text-muted-foreground">{copy("Not configured in the fixture; native rights unchanged.", "Non configuré dans la démonstration ; droits natifs inchangés.")}</p>}
    </div>
    <div className="flex shrink-0 items-center gap-1">
      <Button size="icon" variant="ghost" className="size-8" aria-label={copy(`Details of ${access.id}`, `Détails de ${access.id}`)} title={copy("Access details", "Détails de l’accès")} onClick={() => onShowDetail(access)}><Info className="size-3.5" /></Button>
      {!locked && state === "active" && <Button size="icon" variant="ghost" className="size-8" aria-label={scope === "group" ? copy(`Remove ${access.id} from this group`, `Retirer ${access.id} de ce groupe`) : copy(`Exclude ${access.id} for this key`, `Exclure ${access.id} de cette clé`)} title={scope === "group" ? copy("Remove from group", "Retirer du groupe") : copy("Exclude for this key", "Exclure de cette clé")} onClick={() => onToggleAccess(resolution)}><Ban className="size-3.5" /></Button>}
      {!locked && state === "off" && <Button size="icon" variant="ghost" className="size-8" aria-label={scope === "group" ? copy(`Add ${access.id} to this group`, `Ajouter ${access.id} à ce groupe`) : copy(`Activate ${access.id} for this key`, `Activer ${access.id} pour cette clé`)} title={scope === "group" ? copy("Add to group", "Ajouter au groupe") : copy("Activate for this key", "Activer pour cette clé")} onClick={() => onToggleAccess(resolution)}><Plus className="size-3.5" /></Button>}
      {!locked && state === "excluded" && <Button size="icon" variant="ghost" className="size-8" aria-label={copy(`Restore ${access.id}`, `Rétablir ${access.id}`)} title={copy("Restore (explicit)", "Rétablir explicitement")} onClick={() => onToggleAccess(resolution)}><RotateCcw className="size-3.5" /></Button>}
    </div>
  </div>;
}

export function AccessMenu({ resolution, locked, onToggleAccess, onShowDetail, compact = false, scope = "key" }: { resolution: ModelResolution; locked: boolean; onToggleAccess: (r: AccessResolution) => void; onShowDetail: (model: ProtoModel, access: ProtoAccess) => void; compact?: boolean; scope?: "key" | "group" }) {
  const copy = useCopy();
  const active = resolution.accesses.filter(a => a.state === "active").length;
  return <Popover><PopoverTrigger asChild>
    <Button size="sm" variant={compact ? "ghost" : "outline"} className={compact ? "h-8 shrink-0 gap-0.5 px-1.5 text-[11px] font-normal text-muted-foreground hover:text-foreground" : undefined} aria-label={copy(`Provider accesses for ${resolution.model.name}: ${active} of ${resolution.accesses.length} active`, `Accès fournisseurs de ${resolution.model.name} : ${active} actif${active === 1 ? "" : "s"} sur ${resolution.accesses.length}`)}>{compact ? copy("Access", "Accès") : copy("Accesses", "Accès")} {active}/{resolution.accesses.length}{compact && <ChevronRight className="size-3.5" />}</Button>
  </PopoverTrigger><PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-3">
    <h3 className="border-b pb-1 text-sm font-semibold">{scope === "group" ? copy("Accesses for this group", "Accès pour ce groupe") : copy("Accesses for this key", "Accès pour cette clé")} — {resolution.model.name}</h3>
    {locked && <p className="pt-1 text-xs text-muted-foreground">{scope === "group" ? copy("Select this model to change its accesses.", "Sélectionnez ce modèle pour modifier ses accès.") : copy("Restore this model to change its accesses; exclusions can be restored below.", "Rétablissez ce modèle pour modifier ses accès ; les exclusions peuvent être levées ci-dessous.")}</p>}
    <div className="divide-y">{resolution.accesses.map(r => <AccessRow key={r.access.id} resolution={r} locked={locked} scope={scope} onToggleAccess={onToggleAccess} onShowDetail={access => onShowDetail(resolution.model, access)} />)}</div>
  </PopoverContent></Popover>;
}

export function WitnessNote({ groups, models }: { groups: ProtoGroup[]; models: ProtoModel[] }) {
  const copy = useCopy();
  const witness = resolveDraft(witnessDraft, groups, models);
  const gpt5 = witness.find(r => r.model.id === "gpt-5");
  if (!gpt5) return null;
  const activeIds = gpt5.accesses.filter(a => a.state === "active").map(a => a.access.id);
  return <details className="rounded-sm border bg-muted/40 p-3 text-xs text-muted-foreground">
    <summary className="cursor-pointer font-medium text-foreground">{copy("Other key · unchanged by this draft", "Autre clé · inchangée par ce brouillon")}</summary>
    <dl className="mt-2 space-y-2">
      <div><dt className="font-medium text-foreground">{copy("Selection", "Sélection")}</dt><dd>{copy("Inherits the Code group", "Hérite du groupe Code")}</dd></div>
      <div><dt className="font-medium text-foreground">{copy("Active IDs", "ID actifs")}</dt><dd className="break-all font-mono">{activeIds.length ? activeIds.join(", ") : copy("none", "aucun")}</dd></div>
      <div><dt className="font-medium text-foreground">{copy("Effect", "Effet")}</dt><dd>{copy("Edits to this key do not change the other key or shared groups.", "Les changements de cette clé ne modifient ni l’autre clé ni les groupes partagés.")}</dd></div>
    </dl>
  </details>;
}

export function DemoBar({ lateSimulated, onSimulateLate, onReset }: { lateSimulated: boolean; onSimulateLate: () => void; onReset: () => void }) {
  const copy = useCopy();
  return <details className="rounded-sm border border-dashed px-3 py-2 text-xs text-muted-foreground">
    <summary className="cursor-pointer font-medium text-foreground">{copy("Demo controls · synthetic fixture", "Contrôles de démonstration · données fictives")}{lateSimulated ? copy(" · Azure access added", " · accès Azure ajouté") : ""}</summary>
    <p className="mt-2">{copy("In-memory fixture; no gateway or real keys.", "Données en mémoire ; aucune passerelle ni clé réelle.")}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      <Button size="sm" variant="outline" className="h-auto min-h-7 max-w-full whitespace-normal text-left" disabled={lateSimulated} onClick={onSimulateLate}>{lateSimulated ? copy("Azure access added to Kimi K2", "Accès Azure ajouté à Kimi K2") : copy("Simulate: new Azure access appears on Kimi K2", "Simuler l’arrivée d’un accès Azure sur Kimi K2")}</Button>
      <Button size="sm" variant="ghost" className="h-7" onClick={onReset}>{copy("Reset demo", "Réinitialiser la démonstration")}</Button>
    </div>
  </details>;
}

export type ComposerProps = {
  draft: KeyDraft;
  baseline: KeyDraft;
  editing: boolean;
  setDraft: (d: KeyDraft) => void;
  models: ProtoModel[];
  groups: ProtoGroup[];
  lateSimulated: boolean;
  onSimulateLate: () => void;
  onResetDemo: () => void;
  onCancel: () => void;
  onCreate: () => void;
};
