import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { change, effective, emptyDraft, readPath, validLimit, type Access, type Data, type Draft, type Field } from "./state";
import catalog from "./catalog.json";

const model = catalog.model.metadata as Data;
const accesses = catalog.accesses as Access[];
const fields: { key: Field; label: string; destination: string; nativePath: string }[] = [
  { key: "limit.context", label: "Fenêtre de contexte", destination: "Bifrost pricing · portée à qualifier", nativePath: "governance_model_pricing.context_length" },
  { key: "limit.output", label: "Sortie maximale", destination: "Bifrost pricing · portée à qualifier", nativePath: "governance_model_pricing.max_output_tokens" },
  { key: "tool_call", label: "Appels d’outils", destination: "Bifrost parameters · portée à qualifier", nativePath: "supports_function_calling" },
  { key: "structured_output", label: "Sortie structurée", destination: "Bifrost parameters · portée à qualifier", nativePath: "supports_response_schema" },
];
const yesNo = (value: unknown) => value === undefined ? "Inconnu" : value === true || value === "true" ? "Oui" : value === false || value === "false" ? "Non" : String(value);
const formatted = (value: unknown, field: Field) => value === undefined ? "Inconnu" : field.startsWith("limit.") && Number.isFinite(Number(value)) ? `${Number(value).toLocaleString("fr-FR")} tokens` : yesNo(value);
const price = (access: Access, key: "input" | "output") => {
  const value = readPath(access.resolved, `cost.${key}`);
  return typeof value === "number" ? `${value.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} $ / M tokens` : "Inconnu";
};

function Value({ field, access, draft }: { field: Field; access?: Access; draft: Draft }) {
  const result = effective(model, access, field, draft);
  return <div className="flex flex-wrap items-center gap-2"><strong className="font-medium tabular-nums">{formatted(result.value, field)}</strong><Badge variant="secondary" className="font-normal">{result.source}</Badge></div>;
}

export function App() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(accesses[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [alias, setAlias] = useState("claude-sonnet-4.6");
  const [displayName, setDisplayName] = useState("Claude Sonnet 4.6");
  const [simulated, setSimulated] = useState(false);
  const access = accesses.find(item => item.id === selected) ?? accesses[0];
  const entries = ["Identifier", "Ajuster", "Relire"];
  const edits = Object.entries(draft.common).map(([field, value]) => ({ scope: "Fiche commune", field: field as Field, value }));
  for (const item of accesses) for (const [field, value] of Object.entries(draft.access[item.id] ?? {})) edits.push({ scope: item.providerName, field: field as Field, value });
  const invalidLimits = edits.filter(edit => edit.field.startsWith("limit.") && !validLimit(edit.value ?? ""));
  const fieldName = (field: Field) => fields.find(item => item.key === field)?.label ?? field;
  const update = (accessId: string | undefined, field: Field, value: string | undefined) => { setDraft(current => change(current, accessId, field, value)); setSimulated(false); };

  return <main className="min-h-screen bg-muted/30 text-foreground">
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Registry · étude de fiche</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Claude Sonnet 4.6</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Une identité commune, deux accès fournisseurs et leurs valeurs propres.</p></div>
        <Badge variant="outline" className="mt-1 max-w-full whitespace-normal [overflow-wrap:anywhere]">Prototype · connexions d’exemple · aucune application gateway</Badge>
      </header>

      <nav aria-label="Étapes du prototype" className="mb-7 grid grid-cols-3 gap-2">
        {entries.map((name, index) => <button key={name} type="button" onClick={() => setStep(index)} aria-current={step === index ? "step" : undefined} className={`rounded-sm border px-3 py-3 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${step === index ? "border-primary bg-primary/10 font-semibold" : "bg-card hover:bg-accent"}`}><span className="mr-2 text-muted-foreground">0{index + 1}</span>{name}</button>)}
      </nav>

      {step === 0 && <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <Card><CardHeader><CardTitle>Le modèle de référence</CardTitle><CardDescription>Une seule fiche canonique pour les deux offres.</CardDescription></CardHeader><CardContent className="space-y-5">
          <div><p className="text-xs text-muted-foreground">Nom public</p><p className="text-xl font-semibold">{String(model.name ?? catalog.model.id)}</p></div>
          <div><p className="text-xs text-muted-foreground">Identifiant source</p><code className="break-all text-sm">{catalog.model.id}</code></div>
          <div className="grid gap-4 sm:grid-cols-2">{fields.slice(0, 2).map(item => <div key={item.key} className="rounded-sm border bg-muted/30 p-3"><p className="mb-1 text-xs text-muted-foreground">{item.label}</p><Value field={item.key} draft={draft} /></div>)}</div>
          <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Source technique</summary><p className="mt-2 break-all">{catalog.source.repository} · {catalog.source.commit.slice(0, 12)} · {catalog.model.sourcePath}</p></details>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Deux accès d’exemple</CardTitle><CardDescription>Identifiants exacts fournis par Models.dev ; aucune connexion privée de votre gateway n’est lue.</CardDescription></CardHeader><CardContent className="space-y-3">
          {accesses.map(item => <div key={item.id} className="rounded-sm border p-4"><div className="mb-2 flex items-center justify-between gap-2"><strong>{item.providerName}</strong><Badge variant="outline">Accès source</Badge></div><p className="break-all font-mono text-xs">{item.modelId}</p><p className="mt-2 text-xs text-muted-foreground">base_model → {item.baseModelId}</p></div>)}
          <div className="rounded-sm bg-primary/5 p-4"><Label htmlFor="display-name">Nom affiché dans Registry</Label><Input id="display-name" className="mt-2" value={displayName} onChange={event => { setDisplayName(event.target.value); setSimulated(false); }} /><p className="mt-1 text-xs text-muted-foreground">Nom de présentation local ; le nom source reste {String(model.name)}.</p><Label htmlFor="alias" className="mt-4 block">Alias commun appelable · brouillon Registry</Label><Input id="alias" className="mt-2" value={alias} onChange={event => { setAlias(event.target.value); setSimulated(false); }} aria-describedby="alias-help" /><p id="alias-help" className="mt-2 text-xs text-muted-foreground">L’alias identifie la fiche. Il ne choisit pas à lui seul l’accès utilisé lors d’un appel.</p></div>
        </CardContent></Card>
      </div>}

      {step === 1 && <div className="space-y-5">
        <Card><CardHeader><CardTitle>Propriétés communes</CardTitle><CardDescription>Une correction de la fiche se propage aux accès qui héritent de ce champ.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
          {fields.map(item => <FieldEditor key={item.key} item={item} draft={draft} onChange={value => update(undefined, item.key, value)} />)}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Ajustement d’un accès</CardTitle><CardDescription>Une valeur rédigée pour le provider garde priorité sur la fiche commune, même si elle a le même nombre.</CardDescription></CardHeader><CardContent>
          <div role="group" aria-label="Choisir l’accès à examiner" className="mb-5 flex flex-wrap gap-2">{accesses.map(item => <Button key={item.id} type="button" variant={selected === item.id ? "default" : "outline"} onClick={() => setSelected(item.id)}>{item.providerName}</Button>)}</div>
          {access && <><div className="grid gap-3 sm:grid-cols-2">{fields.map(item => <FieldEditor key={`${access.id}-${item.key}`} item={item} access={access} draft={draft} onChange={value => update(access.id, item.key, value)} />)}</div>
            <div className="mt-5 border-t pt-4"><p className="mb-3 text-sm font-medium">Tarifs standard de cet accès · lecture seule</p><div className="grid gap-3 sm:grid-cols-2"><p className="rounded-sm bg-muted/40 p-3 text-sm">Entrée <strong className="ml-2">{price(access, "input")}</strong></p><p className="rounded-sm bg-muted/40 p-3 text-sm">Sortie <strong className="ml-2">{price(access, "output")}</strong></p></div><p className="mt-2 text-xs text-muted-foreground">Source Models.dev · provider → destination proposée Bifrost pricing. Conversion en coût par token et application à qualifier.</p></div>
          </>}
        </CardContent></Card>
      </div>}

      {step === 2 && <Card><CardHeader><CardTitle>Relire le brouillon</CardTitle><CardDescription>Ce résumé prépare un mapping ; il ne modifie ni Bifrost ni Registry.</CardDescription></CardHeader><CardContent className="space-y-5">
        <div className="rounded-sm border p-4"><p className="text-xs text-muted-foreground">Nom affiché Registry</p><p className="mt-1 text-lg font-semibold">{displayName.trim() || "À renseigner"}</p><p className="mt-3 text-xs text-muted-foreground">Alias commun proposé</p><p className="mt-1 break-all font-mono text-lg">{alias.trim() || "À renseigner"}</p><Badge variant="outline" className="mt-2 max-w-full whitespace-normal [overflow-wrap:anywhere]">Destination proposée · Registry / alias Bifrost à qualifier</Badge></div>
        <div><h2 className="mb-3 font-semibold">Impact des corrections</h2>{edits.length === 0 ? <p className="rounded-sm bg-muted/40 p-4 text-sm text-muted-foreground">Aucune correction. Les valeurs source restent visibles dans la fiche.</p> : <div className="space-y-2">{edits.map(edit => <div key={`${edit.scope}-${edit.field}`} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border p-3 text-sm"><span><strong>{edit.scope}</strong> · {fieldName(edit.field)} → {formatted(edit.value, edit.field)}</span><Badge variant="outline" className="max-w-full whitespace-normal [overflow-wrap:anywhere]">Destination proposée · {fields.find(field => field.key === edit.field)?.destination}</Badge></div>)}</div>}</div>
        <div><h2 className="mb-3 font-semibold">Valeurs effectives par accès</h2><div className="grid gap-3 sm:grid-cols-2">{accesses.map(item => <div key={item.id} className="rounded-sm border p-4"><strong>{item.providerName}</strong><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{item.modelId}</p><div className="mt-4 space-y-3">{fields.map(field => <div key={field.key} className="text-sm"><p className="text-xs text-muted-foreground">{field.label}</p><Value field={field.key} access={item} draft={draft} /></div>)}</div></div>)}</div></div>
        <div className="rounded-sm border border-dashed p-4 text-sm"><p className="font-medium">Avant tout enregistrement réel</p><p className="mt-1 text-muted-foreground">Confirmer le mapping des identifiants, la destination native de chaque champ et l’effet sur les deux accès. L’état « appliqué » exigerait une relecture Bifrost.</p></div>
        {invalidLimits.length > 0 && <p role="alert" className="text-sm text-destructive">Corriger les limites invalides avant la simulation.</p>}
        <Button type="button" disabled={!alias.trim() || !displayName.trim() || invalidLimits.length > 0} onClick={() => setSimulated(true)}>Simuler l’enregistrement local</Button>
        {simulated && <p role="status" className="rounded-sm bg-primary/10 p-3 text-sm">Simulation terminée dans cette page. Aucun enregistrement Registry ou Bifrost ; recharger efface le brouillon.</p>}
      </CardContent></Card>}

      <div className="mt-7 flex items-center justify-between"><Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft /> Retour</Button><Button type="button" disabled={step === 2} onClick={() => setStep(step + 1)}>Continuer <ArrowRight /></Button></div>
    </div>
  </main>;
}

function FieldEditor({ item, access, draft, onChange }: { item: typeof fields[number]; access?: Access; draft: Draft; onChange: (value: string | undefined) => void }) {
  const local = access ? draft.access[access.id]?.[item.key] : draft.common[item.key];
  const authored = access && readPath(access.authored, item.key) !== undefined;
  const id = `${access?.id ?? "common"}-${item.key.replace(".", "-")}`;
  const invalid = item.key.startsWith("limit.") && local !== undefined && !validLimit(local);
  return <div className="rounded-sm border bg-card p-4"><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><Label htmlFor={id}>{item.label}</Label><p className="mt-1 text-xs text-muted-foreground">{item.key}</p></div><Badge variant="outline" className="font-normal">{item.destination}</Badge></div>
    <Value field={item.key} access={access} draft={draft} />
    <div className="mt-3 flex gap-2">{item.key.startsWith("limit.") ? <Input id={id} type="number" min="0" step="1" inputMode="numeric" placeholder="Correction locale" value={local ?? ""} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} onChange={event => onChange(event.target.value || undefined)} /> : <select id={id} className="h-9 flex-1 rounded-sm border bg-background px-2 text-sm" value={local ?? ""} onChange={event => onChange(event.target.value || undefined)}><option value="">Hériter de la source</option><option value="true">Oui</option><option value="false">Non</option></select>}
      {local !== undefined && <Button type="button" variant="ghost" size="icon" onClick={() => onChange(undefined)} aria-label={`Retirer la correction de ${item.label}`} title="Retirer la correction"><RotateCcw /></Button>}</div>
    {invalid && <p id={`${id}-error`} role="alert" className="mt-2 text-xs text-destructive">Saisir un nombre entier positif ou zéro.</p>}
    {access && <p className="mt-2 text-xs text-muted-foreground">{authored ? "Valeur définie dans le TOML provider : retirer la correction restaure cette contrainte." : "Champ hérité du modèle : une correction commune s’applique ici."}</p>}
    <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Champ technique et portée</summary><p className="mt-1 break-all">Models.dev : {item.key} → {item.key.startsWith("limit.") ? "Table Bifrost" : "Paramètres Bifrost"} : {item.nativePath}. {item.key.startsWith("limit.") ? "La valeur provider effective peut primer." : "La datasheet parameters est indexée par modèle ; une écriture indépendante par provider reste à qualifier. Ce choix ne prouve pas que la capacité fonctionne."}</p></details>
  </div>;
}
