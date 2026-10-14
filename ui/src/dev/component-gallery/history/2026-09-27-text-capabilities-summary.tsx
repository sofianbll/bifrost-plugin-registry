import { AudioLines, BrainCircuit, Code2, Database, Eye, FileText, Image, MessageSquare, Package, Sparkles, Video, Wrench, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Capability, Model } from "@/domain/registry";
import { useCopy, useTerm } from "@/lib/locale";

type Facts = Pick<Model, "inputModalities" | "outputModalities" | "capabilities">;
const icons: Record<string, LucideIcon> = {
  Text: FileText, Image, Audio: AudioLines, Video, Vector: Database,
  Reasoning: BrainCircuit, Vision: Eye, "Tool calling": Wrench, Tools: Package,
  "Image generation": Image, Embeddings: Database, Streaming: AudioLines,
  "Structured output": Code2, Chat: MessageSquare,
};

export function CapabilityIcon({ name }: { name: string }) {
  const Icon = icons[name] ?? Sparkles;
  return <Icon aria-hidden="true" className="size-4 shrink-0" />;
}

export function CapabilityItem({ name, status }: { name: string; status?: Capability }) {
  const term = useTerm();
  const copy = useCopy();
  return <span className="inline-flex min-w-0 items-start gap-2 text-sm">
    <CapabilityIcon name={name} />
    <span className="flex min-w-0 flex-col items-start gap-1"><span className="min-w-0 break-words">{term(name)}</span>
      {status && status !== "Declared" && <Badge variant={status === "Unknown" ? "secondary" : "outline"}>{status === "Unknown" ? copy("Unknown", "Inconnu") : copy("Simulated", "Simulé")}</Badge>}
    </span>
  </span>;
}

function Direction({ title, names }: { title: string; names: string[] }) {
  const copy = useCopy();
  return <section className="min-w-0"><h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
    {names.length ? <ul className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2">{names.map(name => <li key={name} className="min-w-0"><CapabilityItem name={name} /></li>)}</ul> : <p className="text-sm text-muted-foreground">{copy("Not specified", "Non renseigné")}</p>}
  </section>;
}

export function ModelCapabilitiesPanel({ model }: { model: Facts }) {
  const copy = useCopy();
  return <div className="@container flex min-w-0 flex-col gap-4">
    <Direction title={copy("Output", "Sortie")} names={model.outputModalities} />
    <Direction title={copy("Input", "Entrée")} names={model.inputModalities} />
    <section className="min-w-0"><h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy("Features", "Fonctions")}</h4>
      {Object.entries(model.capabilities).length ? <ul className="grid min-w-0 gap-x-5 gap-y-2 @min-[18rem]:grid-cols-2">{Object.entries(model.capabilities).map(([name, status]) => <li key={name}><CapabilityItem name={name} status={status} /></li>)}</ul> : <p className="text-sm text-muted-foreground">{copy("Not specified", "Non renseigné")}</p>}
      <p className="mt-2 text-xs text-muted-foreground">{copy("Unmarked features are declared for the reference model.", "Les fonctions sans étiquette sont déclarées pour le modèle de référence.")}</p>
    </section>
    <details className="border-t pt-3 text-xs text-muted-foreground"><summary className="cursor-pointer rounded-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{copy("Source and scope", "Source et portée")}</summary><p className="mt-2">{copy("Reference model · synthetic fixture. Provider access not specified; execution not tested. Unknown does not mean unsupported. Simulated observations are not provider verification.", "Modèle de référence · donnée fictive. Accès fournisseur non renseigné ; exécution non testée. Inconnu ne signifie pas non pris en charge. Une observation simulée ne vérifie pas le fournisseur.")}</p></details>
  </div>;
}

function Summary({ model, kind, stacked = false }: { model: Facts; kind: "modalities" | "capabilities"; stacked?: boolean }) {
  const copy = useCopy();
  const term = useTerm();
  const entries = Object.entries(model.capabilities);
  const shown = entries.filter(([, status]) => status !== "Unknown").slice(0, stacked ? 3 : 2);
  const hidden = entries.length - shown.length;
  const unknownOnly = entries.length > 0 && shown.length === 0;
  const modality = (names: string[]) => names.length ? <>{names.slice(0, 2).map(name => <span key={name} className="inline-flex min-w-0 items-center gap-1"><CapabilityIcon name={name} /><span className="truncate">{term(name)}</span></span>)}{names.length > 2 && <span className="shrink-0 text-muted-foreground">+{names.length - 2}</span>}</> : <span className="text-muted-foreground">?</span>;
  return <Popover><PopoverTrigger asChild><button type="button" aria-label={kind === "modalities" ? copy("Input and output modalities. Show details", "Modalités en entrée et sortie. Afficher les détails") : copy("Model capabilities. Show details", "Capacités du modèle. Afficher les détails")} className="flex min-h-7 max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-sm px-1 text-left text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    {kind === "modalities" ? <><span className="inline-flex min-w-0 max-w-full items-center gap-1"><span className="text-muted-foreground">{copy("In", "Entrée")}</span>{modality(model.inputModalities)}</span><span aria-hidden="true" className="text-muted-foreground">→</span><span className="inline-flex min-w-0 max-w-full items-center gap-1"><span className="text-muted-foreground">{copy("Out", "Sortie")}</span>{modality(model.outputModalities)}</span></> : <>{shown.map(([name, status]) => <span key={name} className="inline-flex max-w-full items-center gap-1" title={`${term(name)} · ${status}`}><CapabilityIcon name={name} /><span className="truncate">{term(name)}</span>{status === "Observed in simulated campaign" && <span className="text-muted-foreground">({copy("sim.", "sim.")})</span>}</span>)}{hidden > 0 && <span className="text-muted-foreground">{unknownOnly ? copy(`${hidden} unknown`, `${hidden} inconnu${hidden > 1 ? "es" : "e"}`) : `+${hidden}`}</span>}{!entries.length && <span className="text-muted-foreground">{copy("Not specified", "Non renseigné")}</span>}</>}
  </button></PopoverTrigger><PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] max-h-[min(34rem,var(--radix-popover-content-available-height))] overflow-y-auto p-4"><ModelCapabilitiesPanel model={model} /></PopoverContent></Popover>;
}

export function ModelModalitiesSummary({ model, stacked }: { model: Facts; stacked?: boolean }) { return <Summary model={model} kind="modalities" stacked={stacked} />; }
export function ModelCapabilitiesSummary({ model, stacked }: { model: Facts; stacked?: boolean }) { return <Summary model={model} kind="capabilities" stacked={stacked} />; }
