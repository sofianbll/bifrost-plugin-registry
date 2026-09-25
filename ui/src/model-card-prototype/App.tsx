import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { change, effective, emptyDraft, readPath, validLimit, type Access, type Data, type Draft, type Field } from "./state";
import catalog from "./catalog.json";

const model = catalog.model.metadata as Data;
const accesses = catalog.accesses as Access[];
const fields: { key: Field; label: string; native: string }[] = [
  { key: "limit.context", label: "Fenêtre de contexte", native: "governance_model_pricing.context_length" },
  { key: "limit.output", label: "Sortie maximale", native: "governance_model_pricing.max_output_tokens" },
  { key: "tool_call", label: "Appels d’outils", native: "supports_function_calling" },
  { key: "structured_output", label: "Sortie structurée", native: "supports_response_schema" },
];
type Screen = "choose" | "card" | "review" | "registered";
type Snapshot = { selectedIds: string[]; name: string; alias: string; draft: Draft };
type Editing = { field: Field; scope: string; value: string | undefined; dirty: boolean };
const initial = (): Snapshot => ({
  selectedIds: accesses.map(access => access.id),
  name: String(model.name ?? catalog.model.id),
  alias: "claude-sonnet-4.6",
  draft: emptyDraft(),
});
const label = (field: Field) => fields.find(item => item.key === field)?.label ?? field;
const format = (value: unknown, field: Field) => value === undefined ? "Inconnu"
  : field.startsWith("limit.") && Number.isFinite(Number(value)) ? `${Number(value).toLocaleString("fr-FR")} tokens`
  : value === true || value === "true" ? "Oui" : value === false || value === "false" ? "Non" : String(value);
const source = (name: string) => {
  if (name === "Inconnu") return "Source inconnue";
  const owner = name.startsWith("Correction") ? "Vous" : "Models.dev";
  return `${owner} · ${name.includes("accès") || name.includes("provider") ? "fournisseur" : "fiche"}`;
};
const same = (a: unknown, b: unknown) => String(a) === String(b);
const accessFor = (id: string) => accesses.find(access => access.id === id);
const scopeName = (id: string) => id === "common" ? "Fiche commune" : `${accessFor(id)?.providerName ?? id} uniquement`;
const local = (snapshot: Snapshot, scope: string, field: Field) => scope === "common" ? snapshot.draft.common[field] : snapshot.draft.access[scope]?.[field];
const result = (snapshot: Snapshot, scope: string, field: Field) => effective(model, accessFor(scope), field, snapshot.draft);
const price = (access: Access, type: "input" | "output") => {
  const value = readPath(access.resolved, `cost.${type}`);
  return typeof value === "number" ? `${value.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} $` : "Inconnu";
};

function Value({ field, access, draft }: { field: Field; access?: Access; draft: Draft }) {
  const value = effective(model, access, field, draft);
  return <div className="flex flex-col items-start gap-1">
    <strong className="font-medium tabular-nums">{format(value.value, field)}</strong>
    <span className="text-xs text-muted-foreground">{source(value.source)}</span>
  </div>;
}

export function App() {
  const editorOpener = useRef<HTMLElement | null>(null);
  const [screen, setScreen] = useState<Screen>("choose");
  const [current, setCurrent] = useState<Snapshot>(initial);
  const [saved, setSaved] = useState<Snapshot | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identity, setIdentity] = useState({ name: "", alias: "" });
  const selected = accesses.filter(access => current.selectedIds.includes(access.id));
  const baseline = saved ?? { ...initial(), selectedIds: [] };
  const changedFields = fields.filter(item => local(current, "common", item.key) !== local(baseline, "common", item.key)
    || selected.some(access => local(current, access.id, item.key) !== local(baseline, access.id, item.key)));
  const patch = (value: Partial<Snapshot>) => setCurrent(previous => ({ ...previous, ...value }));

  function openField(field: Field, scope = "common") {
    editorOpener.current = document.activeElement as HTMLElement | null;
    const existing = local(current, scope, field) ?? result(current, scope, field).value;
    setEditing({ field, scope, value: existing === undefined ? undefined : String(existing), dirty: false });
  }
  function chooseScope(scope: string) {
    if (!editing) return;
    const existing = local(current, scope, editing.field) ?? result(current, scope, editing.field).value;
    setEditing({ ...editing, scope, value: existing === undefined ? undefined : String(existing), dirty: false });
  }
  function cancelEdit() {
    setCurrent(saved ?? initial());
    setScreen(saved ? "registered" : "choose");
  }

  function openIdentity() {
    editorOpener.current = document.activeElement as HTMLElement | null;
    setIdentity({ name: current.name, alias: current.alias });
    setIdentityOpen(true);
  }

  function restoreEditorFocus(event: Event) {
    event.preventDefault();
    editorOpener.current?.focus();
  }

  const proposed = editing ? change(current.draft, editing.scope === "common" ? undefined : editing.scope, editing.field, editing.value) : current.draft;
  const invalid = !!editing && editing.field.startsWith("limit.") && editing.value !== undefined && !validLimit(editing.value);
  const preview = editing && selected.map(access => ({
    access,
    before: effective(model, access, editing.field, current.draft),
    after: effective(model, access, editing.field, proposed),
  }));
  const unchanged = preview?.every(row => same(row.before.value, row.after.value));
  const reference = editing && effective(model, accessFor(editing.scope), editing.field,
    change(current.draft, editing.scope === "common" ? undefined : editing.scope, editing.field, undefined)).value;
  const actualChange = !!editing?.dirty && editing.value !== local(current, editing.scope, editing.field)
    && (local(current, editing.scope, editing.field) !== undefined || !same(editing.value, result(current, editing.scope, editing.field).value));
  const ownsEveryValue = !!editing && editing.scope === "common" && selected.every(access => readPath(access.authored, editing.field) !== undefined);

  return <main className="min-h-screen bg-muted/30 text-foreground">
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-7 sm:px-8 sm:pt-10">
      <header className="mb-6 space-y-4">
        <nav aria-label="Fil d’Ariane" className="text-sm text-muted-foreground">Registry / Modèles / {screen === "choose" ? "Enregistrer un modèle" : current.name}</nav>
        <p className="rounded-sm border bg-card px-4 py-3 text-sm font-medium">Démonstration · aucune modification de votre gateway</p>
      </header>

      {screen === "choose" && <div className="space-y-5">
        <div><h1 className="text-3xl font-semibold tracking-tight">Enregistrer un modèle</h1><p className="mt-2 text-muted-foreground">Regroupez les accès à un même modèle dans une seule fiche.</p></div>
        <Card><CardHeader className="pb-3"><CardDescription>Correspondance suggérée · Models.dev</CardDescription><CardTitle className="text-2xl">{String(model.name)}</CardTitle><CardDescription>Anthropic · Texte · Entrées : texte, image, PDF · Sortie : texte</CardDescription></CardHeader>
          <CardContent className="space-y-2"><p className="text-sm font-medium">Exemple d’un gateway avec deux fournisseurs</p>{accesses.map(access => <label key={access.id} className="flex cursor-pointer items-start gap-3 rounded-sm border bg-background px-3 py-2">
            <Checkbox checked={current.selectedIds.includes(access.id)} onCheckedChange={checked => patch({ selectedIds: checked === true ? [...current.selectedIds, access.id] : current.selectedIds.filter(id => id !== access.id) })} aria-label={`Regrouper ${access.providerName}`} />
            <span className="min-w-0"><span className="block font-medium">{access.providerName}</span><span className="block break-all font-mono text-xs text-muted-foreground">{access.modelId}</span></span>
          </label>)}<p className="pt-1 text-sm text-muted-foreground">{selected.length} fournisseur{selected.length > 1 ? "s" : ""} à regrouper dans cette fiche.</p><details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Identifiant de référence et portée</summary><code className="mt-2 block break-all">{catalog.model.id}</code><p>Ce choix ne change ni le routage ni les clés virtuelles.</p></details></CardContent>
        </Card>
      </div>}

      {(screen === "card" || screen === "registered") && <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{screen === "registered" ? "Fiche enregistrée dans la démo" : "Aperçu de la fiche"}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{current.name}</h1><p className="mt-2 text-sm text-muted-foreground">Anthropic · Texte · Entrées : texte, image, PDF · Sortie : texte</p><div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span className="text-muted-foreground">Alias de la fiche · local, non appelable ici</span><code className="break-all">{current.alias}</code>{screen === "card" && <Button variant="outline" onClick={openIdentity}>Modifier l’identité</Button>}</div></div>
          {screen === "registered" && <Button onClick={() => setScreen("card")}>Modifier</Button>}</div>
        {screen === "registered" && <p role="status" className="rounded-sm border bg-primary/10 p-4 text-sm">Enregistré dans cette démo uniquement. La fiche reste en mémoire jusqu’au rechargement de la page.</p>}
        <Card className="hidden md:block"><CardHeader><CardTitle>Comparer les fournisseurs</CardTitle><CardDescription>Valeurs déclarées et tarifs standard Models.dev. Limite documentée, pas un plafond imposé aux requêtes.</CardDescription></CardHeader><CardContent>
          <Table><TableHeader><TableRow><TableHead>Caractéristique</TableHead><TableHead>Fiche commune</TableHead>{selected.map(access => <TableHead key={access.id}>{access.providerName}<span className="block max-w-48 break-all font-mono text-xs font-normal text-muted-foreground">{access.modelId}</span></TableHead>)}</TableRow></TableHeader>
            <TableBody>{fields.map(item => <TableRow key={item.key}><TableCell className="font-medium">{item.label}</TableCell><TableCell className="whitespace-normal"><Value field={item.key} draft={current.draft} />{screen === "card" && <Button variant="ghost" className="mt-1" onClick={() => openField(item.key)}>Modifier <span className="sr-only">{item.label} · fiche commune</span></Button>}</TableCell>{selected.map(access => <TableCell key={access.id} className="whitespace-normal"><Value field={item.key} access={access} draft={current.draft} />{screen === "card" && <Button variant="ghost" className="mt-1" onClick={() => openField(item.key, access.id)}>Modifier <span className="sr-only">{item.label} · {access.providerName}</span></Button>}</TableCell>)}</TableRow>)}
              {(["input", "output"] as const).map(kind => <TableRow key={kind}><TableCell className="font-medium">Prix {kind === "input" ? "entrée" : "sortie"}</TableCell><TableCell>—</TableCell>{selected.map(access => <TableCell key={access.id}>{price(access, kind)} <span className="block text-xs text-muted-foreground">USD / 1 M tokens · Models.dev</span></TableCell>)}</TableRow>)}</TableBody>
          </Table>
        </CardContent></Card>
        <Card className="md:hidden"><CardHeader><CardTitle>Caractéristiques communes</CardTitle><CardDescription>Limites et prise en charge déclarées. Limite documentée, pas un plafond imposé aux requêtes.</CardDescription></CardHeader>
          <CardContent className="divide-y rounded-sm border bg-background">{fields.map(item => <div key={item.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div><p className="text-sm text-muted-foreground">{item.label}</p><Value field={item.key} draft={current.draft} /></div>
            {screen === "card" && <Button variant="ghost" onClick={() => openField(item.key)}>Modifier <span className="sr-only">{item.label}</span></Button>}
          </div>)}</CardContent>
        </Card>
        <Card className="md:hidden"><CardHeader><CardTitle>Comparer les fournisseurs</CardTitle><CardDescription>Valeurs propres à chaque accès. Tarifs standard en USD pour un million de tokens.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">{selected.map(access => <section key={access.id} aria-label={access.providerName} className="min-w-0 rounded-sm border bg-background p-4">
            <h3 className="font-semibold">{access.providerName}</h3><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{access.modelId}</p>
            <div className="mt-4 divide-y border-t">{fields.map(item => <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div><p className="text-xs text-muted-foreground">{item.label}</p><Value field={item.key} access={access} draft={current.draft} /></div>
              {screen === "card" && <Button variant="ghost" onClick={() => openField(item.key, access.id)}>Modifier <span className="sr-only">{item.label} pour {access.providerName}</span></Button>}
            </div>)}</div>
            <div className="mt-2 border-t pt-3 text-sm"><p className="mb-2 font-medium">Tarifs standard <span className="font-normal text-muted-foreground">· Models.dev</span></p><div className="flex flex-wrap gap-x-5 gap-y-1"><p>Entrée <strong>{price(access, "input")}</strong></p><p>Sortie <strong>{price(access, "output")}</strong></p></div><p className="mt-1 text-xs text-muted-foreground">USD / 1 M tokens</p></div>
          </section>)}</CardContent>
        </Card>
        <details className="rounded-sm border bg-card p-4 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Sources et champs techniques</summary>
          <div className="mt-3 space-y-2 break-words"><p>Référence : {catalog.source.repository} · révision {catalog.source.commit.slice(0, 12)} · {catalog.model.sourcePath}</p><p>Identifiant canonique : <code>{catalog.model.id}</code></p>{fields.map(item => <p key={item.key}>{item.label} : <code>{item.key}</code> → destination Bifrost envisagée <code>{item.native}</code></p>)}{selected.map(access => <p key={access.id}>{access.providerName} : {access.sourcePath}</p>)}<p>Ce mapping n’est pas appliqué ; capacité et routage réels nécessitent une vérification distincte.</p></div>
        </details>
      </div>}

      {screen === "review" && <div className="space-y-6">
        <div><h1 className="text-3xl font-semibold tracking-tight">Vérifier la fiche</h1><p className="mt-2 text-muted-foreground">Aperçu local avant l’enregistrement dans la démo.</p></div>
        <Card><CardHeader><CardTitle>{current.name}</CardTitle><CardDescription>Anthropic · alias de fiche : {current.alias}</CardDescription></CardHeader><CardContent><p className="text-sm font-medium">{selected.length} fournisseur{selected.length > 1 ? "s" : ""} lié{selected.length > 1 ? "s" : ""} à cette fiche</p><ul className="mt-2 space-y-1 text-sm text-muted-foreground">{selected.map(access => <li key={access.id}>{access.providerName} · <code className="break-all">{access.modelId}</code></li>)}</ul><p className="mt-3 text-xs text-muted-foreground">Alias et liaison non actifs dans votre gateway.</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Changements prévus</CardTitle><CardDescription>Comparaison avec {saved ? "la fiche enregistrée dans la démo" : "les données Models.dev"}.</CardDescription></CardHeader><CardContent className="space-y-4">
          {changedFields.length === 0 && <p className="text-sm text-muted-foreground">Aucune caractéristique corrigée. Les valeurs source seront conservées.</p>}
          {changedFields.map(item => <div key={item.key} className="rounded-sm border p-4"><h3 className="font-medium">{item.label}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{local(current, "common", item.key) !== local(baseline, "common", item.key) ? `Fiche commune : ${format(effective(model, undefined, item.key, baseline.draft).value, item.key)} → ${format(effective(model, undefined, item.key, current.draft).value, item.key)}` : "Fiche commune inchangée"}</p>
            <div className="mt-3 divide-y border-t">{selected.map(access => {
              const before = effective(model, access, item.key, baseline.draft);
              const after = effective(model, access, item.key, current.draft);
              return <div key={access.id} className="grid grid-cols-2 gap-3 py-3 text-sm sm:grid-cols-3">
                <strong className="col-span-2 font-medium sm:col-span-1">{access.providerName}</strong>
                <div><p className="text-xs text-muted-foreground">Avant</p><p>{format(before.value, item.key)}</p></div>
                <div className="min-w-0"><p className="text-xs text-muted-foreground">Après</p><p>{format(after.value, item.key)}</p><p className="text-xs text-muted-foreground">{source(after.source)}{same(before.value, after.value) ? " · inchangé" : ""}</p></div>
              </div>;
            })}</div>
          </div>)}
          {changedFields.length > 0 && <p className="text-xs text-muted-foreground">Une valeur propre au fournisseur garde priorité sur une correction commune.</p>}
        </CardContent></Card>
      </div>}

      {screen !== "registered" && <footer className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-3 shadow-lg backdrop-blur sm:p-4"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        {screen === "choose" ? <span className="text-sm text-muted-foreground">{selected.length} fournisseur{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}</span> : <Button variant="ghost" onClick={() => setScreen(screen === "review" ? "card" : "choose")}><ArrowLeft /> Retour</Button>}
        <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-3">{screen === "card" && <Button variant="ghost" onClick={cancelEdit}>Annuler les modifications</Button>}
          {screen === "choose" && <Button disabled={selected.length === 0} onClick={() => setScreen("card")}>Préparer la fiche <ArrowRight /></Button>}
          {screen === "card" && <Button className="w-full sm:w-auto" disabled={!current.name.trim() || !current.alias.trim() || selected.length === 0} onClick={() => setScreen("review")}>Vérifier et enregistrer</Button>}
          {screen === "review" && <Button onClick={() => { setSaved(current); setScreen("registered"); }}>Enregistrer dans la démo</Button>}
        </div>
      </div></footer>}

      <Dialog open={identityOpen} onOpenChange={setIdentityOpen}><DialogContent onCloseAutoFocus={restoreEditorFocus}><DialogHeader><DialogTitle>Modifier l’identité</DialogTitle><DialogDescription>Nom et alias de cette fiche locale. L’alias n’est pas activé pour les appels.</DialogDescription></DialogHeader>
        <div className="space-y-4"><div><Label htmlFor="identity-name">Nom affiché</Label><Input id="identity-name" className="mt-2" value={identity.name} onChange={event => setIdentity({ ...identity, name: event.target.value })} /></div><div><Label htmlFor="identity-alias">Alias de la fiche</Label><Input id="identity-alias" className="mt-2" value={identity.alias} onChange={event => setIdentity({ ...identity, alias: event.target.value })} /></div><details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Identifiant canonique Models.dev</summary><code className="mt-2 block break-all">{catalog.model.id}</code></details></div>
        <DialogFooter><Button variant="outline" onClick={() => setIdentityOpen(false)}>Annuler</Button><Button disabled={!identity.name.trim() || !identity.alias.trim()} onClick={() => { patch({ name: identity.name.trim(), alias: identity.alias.trim() }); setIdentityOpen(false); }}>Garder cette modification</Button></DialogFooter>
      </DialogContent></Dialog>

      <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent onCloseAutoFocus={restoreEditorFocus}><DialogHeader><DialogTitle>Modifier {editing && label(editing.field)}</DialogTitle><DialogDescription>Choisissez la portée et vérifiez l’effet avant de garder cette modification.</DialogDescription></DialogHeader>
        {editing && <div className="space-y-4"><fieldset><legend className="mb-2 text-sm font-medium">Portée</legend><div className="flex flex-wrap gap-2">{["common", ...selected.map(access => access.id)].map(scope => <Button key={scope} type="button" variant={editing.scope === scope ? "default" : "outline"} aria-pressed={editing.scope === scope} onClick={() => chooseScope(scope)}>{scopeName(scope)}</Button>)}</div></fieldset>
          <div><Label htmlFor="field-value">Valeur proposée · {scopeName(editing.scope)}</Label>{editing.field.startsWith("limit.")
            ? <Input id="field-value" type="number" min="0" step="1" inputMode="numeric" className="mt-2" value={editing.value ?? ""} aria-invalid={invalid} aria-describedby={invalid ? "field-error" : undefined} onChange={event => setEditing({ ...editing, value: event.target.value || undefined, dirty: true })} />
            : <select id="field-value" className="mt-2 h-9 w-full rounded-sm border bg-background px-3 text-sm" value={editing.value ?? ""} onChange={event => setEditing({ ...editing, value: event.target.value || undefined, dirty: true })}><option value="">Valeur de référence ({format(reference, editing.field)})</option><option value="true">Oui</option><option value="false">Non</option></select>}
            <p className="mt-2 text-xs text-muted-foreground">Actuel : {format(result(current, editing.scope, editing.field).value, editing.field)} · {source(result(current, editing.scope, editing.field).source)}</p>
            {invalid && <p id="field-error" role="alert" className="mt-2 text-xs text-destructive">Saisir un entier entre 0 et {Number.MAX_SAFE_INTEGER.toLocaleString("fr-FR")}.</p>}
            {editing.field.startsWith("limit.") && <p className="mt-2 text-xs text-muted-foreground">Limite documentée, pas un plafond imposé aux requêtes.</p>}
            {local(current, editing.scope, editing.field) !== undefined && <Button type="button" variant="ghost" className="mt-2" onClick={() => setEditing({ ...editing, value: undefined, dirty: true })}><RotateCcw /> Retirer la correction</Button>}
          </div>
          <div className="rounded-sm border bg-muted/30 p-3"><p className="mb-2 text-sm font-medium">Aperçu avant confirmation</p><div className="space-y-2">{editing.scope === "common" && <p className="text-sm"><strong>Fiche commune</strong> · {format(effective(model, undefined, editing.field, current.draft).value, editing.field)} → {format(effective(model, undefined, editing.field, proposed).value, editing.field)}</p>}{preview?.map(row => <p key={row.access.id} className="text-sm"><strong>{row.access.providerName}</strong> · {format(row.before.value, editing.field)} → {format(row.after.value, editing.field)} <span className="text-xs text-muted-foreground">({source(row.after.source)}{same(row.before.value, row.after.value) ? " · inchangé" : ""})</span></p>)}</div>
            {unchanged && <p className="mt-3 text-sm text-muted-foreground">{ownsEveryValue && actualChange ? "Aucun fournisseur modifié : chacun possède sa propre valeur." : "Valeur inchangée pour les fournisseurs sélectionnés."}</p>}
          </div>
          <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Source et destination envisagée</summary><p className="mt-2">Models.dev : {editing.field} · {result(current, editing.scope, editing.field).source} → {fields.find(item => item.key === editing.field)?.native}. Destination native à qualifier.</p></details>
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button><Button disabled={invalid || !actualChange} onClick={() => { patch({ draft: proposed }); setEditing(null); }}>Garder cette modification</Button></DialogFooter>
        </div>}
      </DialogContent></Dialog>
    </div>
  </main>;
}
