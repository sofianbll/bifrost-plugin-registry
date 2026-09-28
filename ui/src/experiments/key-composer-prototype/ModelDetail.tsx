import { useState } from "react";
import { ArrowLeft, Database, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BrandIcon, displayProvider } from "../../components/registry/BrandIcon";
import { ProviderSummary } from "./CompactCollection";
import { AccessDetailDialog } from "./shared";
import { ModelCapabilitiesPanel } from "@/components/registry/model-capabilities";
import type { ProtoAccess, ProtoModel } from "./state";
import { useCopy, useTerm } from "../../lib/locale";

type Tab = "overview" | "access" | "properties" | "sources";

export function ModelDetail({ model, onBack }: { model: ProtoModel; onBack: () => void }) {
  const copy = useCopy();
  const term = useTerm();
  const [tab, setTab] = useState<Tab>("overview");
  const [accessId, setAccessId] = useState(model.accesses[0]?.id ?? "");
  const [detail, setDetail] = useState<ProtoAccess | null>(null);
  const selected = model.accesses.find(access => access.id === accessId) ?? model.accesses[0];
  const tabs: [Tab, string, string][] = [["overview", "Overview", "Vue d’ensemble"], ["access", "Access", "Accès"], ["properties", "Properties", "Propriétés"], ["sources", "Sources", "Sources"]];
  const value = (item: string | null | undefined) => item || copy("Unknown", "Inconnu");
  const factLabel = (label: string) => term(label) !== label ? term(label) : copy(label, ({ "Context length": "Longueur du contexte", "p50 latency": "Latence médiane", "Provisioned throughput": "Débit provisionné", "Upstream provider": "Fournisseur amont", "Max output images": "Nombre maximal d’images générées", "Generation time": "Temps de génération", "Max input": "Entrée maximale" } as Record<string, string>)[label] || label);
  const frenchSummaries: Record<string, string> = { "gpt-5": "Raisonnement et programmation pour les tâches complexes.", "claude-sonnet-4.6": "Modèle polyvalent pour le code, la rédaction et les agents.", "gemini-2.5-pro": "Raisonnement multimodal avec un grand contexte d’entrée.", "kimi-k2": "Modèle ouvert adapté aux agents et au code.", "gpt-5-mini": "Modèle léger pour les requêtes fréquentes.", "claude-opus-4": "Modèle avancé pour le raisonnement exigeant.", "imagen-4": "Génération d’images avec Google.", "text-embedding-3-large": "Vecteurs de représentation à haute dimension." };

  return <section className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
    <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}><ArrowLeft data-icon="inline-start" />{copy("Models", "Modèles")}</Button>
    <header className="flex min-w-0 flex-wrap items-center gap-3">
      <BrandIcon model={model} mode="creator" />
      <div className="min-w-0 flex-1"><h1 className="text-2xl font-semibold tracking-tight">{model.name}</h1><p className="mt-1 break-all font-mono text-sm text-muted-foreground">{model.commonId}</p></div>
      <ProviderSummary ids={model.accesses.map(item => item.provider)} />
    </header>

    <nav aria-label={copy("Model details", "Détails du modèle")} className="grid max-w-full grid-cols-2 gap-1 overflow-x-auto border-b min-[380px]:flex">
      {tabs.map(([id, en, fr]) => <Button key={id} type="button" variant="ghost" aria-pressed={tab === id} className={`shrink-0 rounded-b-none border-b-2 ${tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`} onClick={() => setTab(id)}>{copy(en, fr)}</Button>)}
    </nav>

    {tab === "overview" && <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex flex-col gap-4">
        <Card><CardHeader><CardTitle className="text-base">{copy("Model", "Modèle")}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Fact label={copy("Creator", "Créateur")} value={model.creator} /><Fact label={copy("Series", "Famille")} value={model.family} /><Fact label={copy("Summary", "Résumé")} value={copy(model.summary, frenchSummaries[model.id] || term(model.summary))} /><Fact label={copy("Tasks", "Usages")} value={model.tasks.map(term).join(", ") || null} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">{copy("Modalities and capabilities", "Modalités et capacités")}</CardTitle></CardHeader><CardContent><ModelCapabilitiesPanel model={model} /></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-base">{copy("Provider accesses", "Accès fournisseurs")}</CardTitle></CardHeader><CardContent className="flex flex-col gap-2">{model.accesses.map(access => <Button key={access.id} variant={selected?.id === access.id ? "secondary" : "ghost"} className="h-auto min-w-0 justify-start whitespace-normal" onClick={() => { setAccessId(access.id); setTab("access"); }}><span className="min-w-0 text-left"><span className="block">{displayProvider(access.provider)}</span><span className="block break-all font-mono text-xs text-muted-foreground">{access.nativeModel || value(null)}</span></span></Button>)}</CardContent></Card>
    </div>}

    {tab === "access" && <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Card><CardHeader><CardTitle className="text-base">{copy("Select a provider access", "Choisir un accès fournisseur")}</CardTitle></CardHeader><CardContent className="flex flex-col gap-4"><label className="grid gap-1 text-sm font-medium">{copy("Access", "Accès")}<select className="h-9 min-w-0 rounded-sm border bg-background px-3 text-sm" value={selected?.id ?? ""} onChange={event => setAccessId(event.target.value)}>{model.accesses.map(access => <option key={access.id} value={access.id}>{displayProvider(access.provider)} · {access.nativeModel || access.id}</option>)}</select></label>{selected ? <div className="grid gap-3 sm:grid-cols-2"><Fact label={copy("Access ID", "ID d’accès")} value={selected.id} mono /><Fact label={copy("Native model ID", "ID natif du modèle")} value={selected.nativeModel} mono /><Fact label={copy("Route", "Route")} value={selected.route} /><Fact label={copy("Configuration", "Configuration")} value={selected.configured ? copy("Configured in fixture", "Configuré dans les données fictives") : copy("Not configured in fixture", "Non configuré dans les données fictives")} /></div> : <p>{copy("No provider access", "Aucun accès fournisseur")}</p>}<Button variant="outline" size="sm" className="w-fit" disabled={!selected} onClick={() => setDetail(selected ?? null)}><Info data-icon="inline-start" />{copy("Access details", "Détails de l’accès")}</Button></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">{copy("Documentary comparison", "Comparaison documentaire")}</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-64 text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="py-2 pr-3 font-medium">{copy("Provider", "Fournisseur")}</th><th className="py-2 font-medium">{copy("Model ID", "ID modèle")}</th></tr></thead><tbody>{model.accesses.map(access => <tr key={access.id} className="border-b last:border-0"><td className="py-2 pr-3">{displayProvider(access.provider)}</td><td className="break-all py-2 font-mono text-xs">{value(access.nativeModel)}</td></tr>)}</tbody></table><p className="mt-3 text-xs text-muted-foreground">{copy("Identifiers can differ by access; this does not assert routing or equivalent capabilities.", "Les identifiants peuvent varier selon l’accès ; cela ne prouve ni le routage ni l’équivalence des capacités.")}</p></CardContent></Card>
    </div>}

    {tab === "properties" && <div className="flex flex-col gap-4">
      <Card><CardHeader><CardTitle className="text-base">{copy("Capabilities", "Capacités")}</CardTitle></CardHeader><CardContent><ModelCapabilitiesPanel model={model} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">{copy("Access-specific facts", "Données propres à l’accès")}</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">{selected ? <><label className="grid max-w-md gap-1 text-sm font-medium">{copy("Access", "Accès")}<select className="h-9 rounded-sm border bg-background px-3 text-sm" value={selected.id} onChange={event => setAccessId(event.target.value)}>{model.accesses.map(access => <option key={access.id} value={access.id}>{displayProvider(access.provider)} · {access.nativeModel || access.id}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2">{selected.facts.map(fact => <Fact key={fact.label} label={factLabel(fact.label)} value={fact.value} source={fact.source || copy("No declaration", "Aucune déclaration")} />)}</div></> : <p className="text-sm text-muted-foreground">{copy("Unknown", "Inconnu")}</p>}<Separator /><p className="text-xs text-muted-foreground">{copy("Model declarations do not establish the same capability for each provider access.", "Une déclaration du modèle ne confirme pas la même capacité pour chaque accès fournisseur.")}</p></CardContent></Card>
    </div>}

    {tab === "sources" && <div className="grid gap-4 md:grid-cols-2">{model.accesses.map(access => <Card key={access.id}><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="size-4 text-muted-foreground" />{displayProvider(access.provider)}</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{access.facts.map(fact => <div key={fact.label} className="min-w-0"><p className="text-sm font-medium">{factLabel(fact.label)}: {value(fact.value)}</p><p className="break-words text-xs text-muted-foreground">{value(fact.source)}</p></div>)}{!access.facts.length && <p className="text-sm text-muted-foreground">{copy("Unknown · no source recorded", "Inconnu · aucune source enregistrée")}</p>}<p className="text-xs text-muted-foreground">{copy("Documentary source; provider behavior not tested.", "Source documentaire ; comportement fournisseur non testé.")}</p></CardContent></Card>)}</div>}

    <p className="text-xs text-muted-foreground">{copy("Synthetic prototype data · no edits are saved and no provider request is sent.", "Données fictives du prototype · aucune modification n’est enregistrée et aucune requête fournisseur n’est envoyée.")}</p>
    <AccessDetailDialog model={model} access={detail} onClose={() => setDetail(null)} />
  </section>;
}

function Fact({ label, value, source, mono = false }: { label: string; value: string | null | undefined; source?: string; mono?: boolean }) {
  const copy = useCopy();
  return <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className={`mt-1 break-words text-sm ${mono ? "font-mono" : ""}`}>{value || copy("Unknown", "Inconnu")}</p>{source && <p className="mt-1 break-words text-xs text-muted-foreground">{source}</p>}</div>;
}
