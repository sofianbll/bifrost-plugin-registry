import { useEffect, useRef, useState } from "react";
import { AudioLines, BookMarked, Brain, BrainCircuit, Braces, ChartScatter, CloudUpload, Database, Eye, FileText, Image, ListOrdered, MessageSquare, Mic, Package, Phone, Rows2, Search, Sparkles, SquareActivity, SquarePlay, Video, Volume2, WandSparkles, Wrench, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Capability, Model } from "@/domain/registry";
import { useCopy, useTerm } from "@/lib/locale";

export type CapabilityFacts = Pick<Model, "inputModalities" | "outputModalities" | "capabilities">;
type EvidenceContext = { scope?: string; source?: string; execution?: string };
const icons: Record<string, LucideIcon> = { Text: FileText, Image, Audio: AudioLines, Video, Vector: Database, Reasoning: BrainCircuit, Vision: Eye, "Tool calling": Wrench, Tools: Package, "Image generation": Image, Embeddings: Database, Streaming: AudioLines, "Structured output": Braces, Chat: MessageSquare };
export function CapabilityIcon({ name }: { name: string }) {
  const Icon = icons[name] ?? Sparkles;
  return <Icon aria-hidden="true" className="size-4 shrink-0" />;
}
function stateText(status: Capability, copy: ReturnType<typeof useCopy>) {
  return status === "Declared" ? copy("Declared · untested", "Déclaré · non testé") : status === "Observed in simulated campaign" ? copy("Observed in simulation", "Observé en simulation") : copy("? Not specified", "? Non renseigné");
}
export function CapabilityItem({ name, status }: { name: string; status?: Capability }) {
  const term = useTerm();
  const copy = useCopy();
  const label = `${term(name)} · ${stateText(status ?? "Declared", copy)}`;
  return <Tooltip><TooltipTrigger asChild><span tabIndex={0} aria-label={label} className="inline-flex min-w-0 items-center gap-1.5 rounded-sm text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><CapabilityIcon name={name} /><span>{term(name)}</span></span></TooltipTrigger><TooltipContent className="z-[110] max-w-72">{stateText(status ?? "Declared", copy)}</TooltipContent></Tooltip>;
}
export function ModelCapabilityLegend() {
  const copy = useCopy();
  return <div aria-label={copy("Capability state legend", "Légende des états de capacité")} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border bg-muted/30 px-3 py-2 text-xs"><span className="font-medium">{copy("Capability states", "États des capacités")}</span>{(["Declared", "Observed in simulated campaign", "Unknown"] as const).map(status => <Tooltip key={status}><TooltipTrigger asChild><span tabIndex={0} className="inline-flex items-center gap-1.5 rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{/* The glyph a summary shows for this state: the capability's icon when known, "?" when not specified. */}{status === "Unknown" ? <span aria-hidden="true" className="inline-flex size-4 items-center justify-center">?</span> : <Sparkles aria-hidden="true" className="size-4 shrink-0 text-foreground" />}{status === "Declared" ? copy("Declared", "Déclarée") : status === "Unknown" ? copy("Not specified", "Non renseignée") : copy("Simulated", "Simulée")}</span></TooltipTrigger><TooltipContent>{stateText(status, copy)}</TooltipContent></Tooltip>)}</div>;
}

type Item = { key: string; en: string; fr: string; Icon: LucideIcon; modality?: string };
const output: Item[] = [
  { key: "Text", en: "Text", fr: "Texte", Icon: FileText, modality: "Text" },
  { key: "Image generation", en: "Image", fr: "Image", Icon: WandSparkles, modality: "Image" },
  { key: "Video generation", en: "Video", fr: "Vidéo", Icon: SquarePlay, modality: "Video" },
  { key: "Speech", en: "Speech", fr: "Voix", Icon: Volume2 },
  { key: "Transcription", en: "Transcription", fr: "Transcription", Icon: Mic },
  { key: "Realtime", en: "Realtime", fr: "Temps réel", Icon: Phone },
  { key: "Embeddings", en: "Embed", fr: "Vecteurs", Icon: ChartScatter, modality: "Vector" },
  { key: "Rerank", en: "Rerank", fr: "Reclassement", Icon: ListOrdered },
  { key: "Evaluation", en: "Evaluation", fr: "Évaluation", Icon: ListOrdered },
];
const input: Item[] = [
  { key: "Vision", en: "Vision (Image)", fr: "Vision (image)", Icon: Eye, modality: "Image" },
  { key: "File Input", en: "File Input", fr: "Fichiers", Icon: CloudUpload },
];
const features: Item[] = [
  { key: "Reasoning", en: "Reasoning", fr: "Raisonnement", Icon: Brain },
  { key: "Structured output", en: "Structured Output", fr: "Sortie structurée", Icon: Braces },
  { key: "Tools", en: "Tool", fr: "Outil", Icon: Wrench },
  { key: "Tool calling", en: "Tool Use", fr: "Appels d’outils", Icon: Wrench },
  { key: "Web Search", en: "Web Search", fr: "Recherche web", Icon: Search },
  { key: "Websockets", en: "Websockets", fr: "WebSockets", Icon: SquareActivity },
  { key: "Explicit Caching", en: "Explicit Caching", fr: "Cache explicite", Icon: Rows2 },
  { key: "Implicit Caching", en: "Implicit Caching", fr: "Cache implicite", Icon: BookMarked },
];
const inventoryKeys = new Set([...output, ...input, ...features].map(item => item.key));

export function ModelCapabilitiesPanel({ model, context }: { model: CapabilityFacts; context?: EvidenceContext }) {
  const copy = useCopy();
  const term = useTerm();
  const extra = (names: string[]): Item[] => names.map(name => ({ key: name, en: name, fr: term(name), Icon: icons[name] ?? Sparkles, modality: name }));
  const section = (title: string, items: Item[], modalities: string[] = []) => <section className="min-w-0"><h4 className="mb-2 text-xs font-semibold uppercase leading-none text-muted-foreground">{title}</h4><ul className="grid grid-cols-2 gap-x-2 gap-y-1.5">{items.map(({ key, en, fr, Icon, modality }) => {
    const status = model.capabilities[key] ?? (modality && modalities.includes(modality) ? "Declared" : "Unknown");
    const label = copy(en, fr);
    const explanation = `${label} · ${stateText(status, copy)}`;
    return <li key={key} className="min-w-0"><Tooltip><TooltipTrigger asChild><span tabIndex={0} aria-label={explanation} data-capability={key} data-capability-state={status} className={`flex min-w-0 items-center gap-1.5 rounded-sm text-sm leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${status === "Unknown" ? "text-muted-foreground" : "font-medium text-foreground"}`}>
      {key === "Text" ? <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center font-serif text-[1.0625rem] font-normal">T</span> : <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.25} />}<span className="min-w-0 break-words">{label}</span>
    </span></TooltipTrigger><TooltipContent className="z-[110] max-w-72">{stateText(status, copy)}</TooltipContent></Tooltip></li>;
  })}</ul></section>;
  return <div className="min-w-0 space-y-3.5">
    {section(copy("Output", "Sorties"), [...output, ...extra(model.outputModalities.filter(name => !output.some(item => item.modality === name)))], model.outputModalities)}
    {section(copy("Input", "Entrées"), [...input, ...extra(model.inputModalities.filter(name => !input.some(item => item.modality === name)))], model.inputModalities)}
    {section(copy("Features", "Fonctionnalités"), [...features, ...extra(Object.keys(model.capabilities).filter(name => !inventoryKeys.has(name)))])}
    <details className="border-t pt-2 text-xs text-muted-foreground"><summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{copy("Source and scope", "Source et portée")}</summary><dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1"><dt>{copy("Scope", "Portée")}</dt><dd>{context?.scope || copy("Not specified", "Non renseignée")}</dd><dt>{copy("Source", "Source")}</dt><dd>{context?.source || copy("Not specified", "Non renseignée")}</dd><dt>{copy("Execution", "Exécution")}</dt><dd>{context?.execution || copy("Not verified", "Non vérifiée")}</dd></dl></details>
  </div>;
}

export function ModelModalitiesPanel({ model }: { model: CapabilityFacts }) {
  const copy = useCopy();
  const term = useTerm();
  const section = (title: string, names: string[]) => <section><h4 className="mb-2 text-xs font-semibold uppercase leading-none text-muted-foreground">{title}</h4>
    {names.length ? <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5">{names.map(name => <li key={name} className="flex min-w-0 items-center gap-1.5 text-sm font-medium leading-5"><CapabilityIcon name={name} /><span className="min-w-0 break-words">{term(name)}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">{copy("Not specified", "Non renseigné")}</p>}
  </section>;
  return <div className="min-w-0 space-y-3.5">{section(copy("Output", "Sorties"), model.outputModalities)}{section(copy("Input", "Entrées"), model.inputModalities)}</div>;
}

// label: the card the summary belongs to, so its trigger is not named like every other card's.
function Summary({ model, kind, context, label }: { model: CapabilityFacts; kind: "modalities" | "capabilities"; context?: EvidenceContext; label?: string }) {
  const copy = useCopy();
  const term = useTerm();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const suppressFocus = useRef(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelOpen = () => { clearTimeout(openTimer.current); };
  const cancelClose = () => { clearTimeout(closeTimer.current); };
  useEffect(() => () => { cancelOpen(); cancelClose(); }, []);
  const close = () => { cancelOpen(); cancelClose(); pinned.current = false; suppressFocus.current = true; setOpen(false); };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!pinned.current && document.activeElement !== trigger.current && !panel.current?.contains(document.activeElement)) setOpen(false);
    }, 180);
  };
  const entries = Object.entries(model.capabilities);
  const known = entries.filter(([, status]) => status !== "Unknown");
  const shown = known.slice(0, 4);
  const hidden = entries.length - shown.length;
  const capabilityLabel = `${copy("Model capabilities", "Capacités du modèle")}: ${entries.length ? entries.map(([name, status]) => `${term(name)} (${stateText(status, copy)})`).join(", ") : copy("not specified", "non renseignées")}. ${copy("Show details", "Afficher les détails")}`;
  const modalityLabel = `${copy("Input", "Entrée")}: ${model.inputModalities.map(term).join(", ") || copy("unknown", "inconnue")}; ${copy("Output", "Sortie")}: ${model.outputModalities.map(term).join(", ") || copy("unknown", "inconnue")}. ${copy("Show details", "Afficher les détails")}`;
  const modality = (names: string[], direction: string) => names.length ? <>{names.slice(0, 2).map(name => <span key={name} className="inline-flex size-5 items-center justify-center" title={`${direction}: ${term(name)}`}><CapabilityIcon name={name} /></span>)}{names.length > 2 && <span className="text-muted-foreground">+{names.length - 2}</span>}</> : <span className="text-muted-foreground">?</span>;
  return <Popover open={open} onOpenChange={next => { if (!next) close(); else setOpen(true); }}><PopoverTrigger asChild><button ref={trigger} type="button" aria-label={`${label ? `${label} · ` : ""}${kind === "modalities" ? modalityLabel : capabilityLabel}`}
    onPointerEnter={event => { if (event.pointerType !== "touch") { cancelClose(); cancelOpen(); openTimer.current = setTimeout(() => setOpen(true), 500); } }} onPointerLeave={() => { cancelOpen(); scheduleClose(); }}
    onFocus={() => { cancelOpen(); cancelClose(); if (!suppressFocus.current) setOpen(true); }} onBlur={() => { suppressFocus.current = false; scheduleClose(); }}
    onClick={event => { event.preventDefault(); cancelOpen(); cancelClose(); if (pinned.current) close(); else { pinned.current = true; setOpen(true); panel.current?.focus(); } }}
    onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); close(); } if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey && open)) { event.preventDefault(); panel.current?.focus(); } }}
    className="flex min-h-7 max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-sm px-1 text-left text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    {kind === "modalities" ? <><span className="inline-flex items-center gap-1"><span className="sr-only">{copy("Input", "Entrée")}</span>{modality(model.inputModalities, copy("Input", "Entrée"))}</span><span aria-hidden="true" className="text-muted-foreground">→</span><span className="inline-flex items-center gap-1"><span className="sr-only">{copy("Output", "Sortie")}</span>{modality(model.outputModalities, copy("Output", "Sortie"))}</span></> : <>{shown.map(([name]) => <span key={name} className="inline-flex size-5 items-center justify-center"><CapabilityIcon name={name} /></span>)}{hidden > 0 && <span className="text-muted-foreground">+{hidden}</span>}{!entries.length && <span className="text-muted-foreground">?</span>}</>}
  </button></PopoverTrigger><PopoverContent ref={panel} tabIndex={-1} align="start" aria-label={kind === "modalities" ? copy("Input and output details", "Détails des entrées et sorties") : copy("Capability and modality details", "Détails des capacités et modalités")} onPointerEnter={cancelClose} onPointerLeave={scheduleClose} onBlur={scheduleClose} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => { event.preventDefault(); if (panel.current?.contains(document.activeElement)) { suppressFocus.current = true; trigger.current?.focus(); } }} onEscapeKeyDown={() => { suppressFocus.current = true; trigger.current?.focus(); close(); }} className="w-[min(328px,calc(100vw-2rem))] max-h-[min(36rem,var(--radix-popover-content-available-height))] overflow-y-auto rounded-md p-3">{kind === "modalities" ? <ModelModalitiesPanel model={model} /> : <ModelCapabilitiesPanel model={model} context={context} />}</PopoverContent></Popover>;
}
export function ModelModalitiesSummary({ model, stacked: _stacked, label }: { model: CapabilityFacts; stacked?: boolean; label?: string }) { return <Summary model={model} kind="modalities" label={label} />; }
export function ModelCapabilitiesSummary({ model, stacked: _stacked, context, label }: { model: CapabilityFacts; stacked?: boolean; context?: EvidenceContext; label?: string }) { return <Summary model={model} kind="capabilities" context={context} label={label} />; }
