import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { suggestModel } from "./assistant-api";
import { applySuggestion, normalizeSuggestion, suggestionRows, type Suggestion } from "./assistant-proposal";
import type { Model } from "../../domain/registry";
import { useCopy, useTerm } from "../../lib/locale";

export default function AssistantSuggestion({ draft, onChange, onOpenSettings }: { draft: Model; onChange: (model: Model) => void; onOpenSettings?: () => void }) {
  const copy = useCopy();
  const colon = copy(":", " :");
  const term = useTerm();
  const [result, setResult] = useState<{ suggestion: Suggestion; snapshot: string; model: string; endpoint: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(draft);
  const generation = useRef(0);
  current.current = draft;
  useEffect(() => () => { generation.current++; }, []);

  const generate = async () => {
    const snapshot = JSON.stringify(draft);
    const requestId = ++generation.current;
    setBusy(true); setResult(null); setError("");
    try {
      const response = await suggestModel({ id: draft.id, name: draft.name, creator: draft.creator, family: draft.family, provider: draft.accesses[0]?.provider || "", nativeModel: draft.accesses[0]?.nativeModel || "" });
      if (requestId !== generation.current) return;
      if (JSON.stringify(current.current) !== snapshot) { setError(copy("Model draft changed while the suggestion was running. Generate again to review current values.", "Le brouillon du modèle a changé pendant la génération. Relancez la proposition pour vérifier les valeurs actuelles.")); return; }
      const suggestion = normalizeSuggestion(response);
      const rows = suggestionRows(current.current, suggestion);
      if (!rows.length) { setError(copy("The assistant returned no usable suggestions for this model.", "L’assistant n’a proposé aucune valeur exploitable pour ce modèle.")); return; }
      setResult({ suggestion, snapshot, model: response.model, endpoint: response.endpoint });
      setSelected(new Set(rows.filter(row => row.checked).map(row => row.key)));
    } catch (cause) {
      const message = cause instanceof Error && cause.message === "The assistant returned an invalid proposal." ? copy(cause.message, "L’assistant a renvoyé une proposition invalide.") : cause instanceof Error ? cause.message : copy("Suggestion failed. Check AI settings and try again.", "Échec de la proposition. Vérifiez les réglages IA puis réessayez.");
      if (requestId === generation.current) setError(JSON.stringify(current.current) === snapshot ? message : copy("Model draft changed while the suggestion was running. Generate again to review current values.", "Le brouillon du modèle a changé pendant la génération. Relancez la proposition pour vérifier les valeurs actuelles."));
    } finally { if (requestId === generation.current) setBusy(false); }
  };
  const review = result && JSON.stringify(draft) === result.snapshot ? result : null;
  const label = (key: string, original: string) => ({ name: copy("Display name", "Nom affiché"), creator: copy("Creator", "Créateur"), family: copy("Model series", "Série du modèle"), context: copy("Context window", "Longueur du contexte"), input_modalities: copy("Input modalities", "Modalités d’entrée"), output_modalities: copy("Output modalities", "Modalités de sortie"), reasoning: term("Reasoning"), tool_call: term("Tool calling"), structured_output: term("Structured output"), referenceId: copy("Reference match for all accesses", "Correspondance documentaire pour tous les accès") } as Record<string, string>)[key] || term(original);
  const state = (value: string) => value === "Unknown" ? copy("Unknown", "Inconnu") : value === "Declared" ? copy("Declared", "Déclaré") : value === "Declared (AI suggestion)" ? copy("Declared (AI suggestion)", "Déclaré (proposition IA)") : value === "Observed in simulated campaign" ? copy("Observed in simulated campaign", "Observé en campagne simulée") : value;
  const rows = review ? suggestionRows(draft, review.suggestion).map(row => ({ ...row, label: label(row.key, row.label), current: state(row.current), proposed: state(row.proposed) })) : [];
  const apply = () => {
    if (!review || !selected.size) return;
    onChange(applySuggestion(draft, rows, selected));
    setResult(null); setSelected(new Set());
  };
  return <section aria-label={copy("AI model suggestions", "Suggestions IA pour le modèle")} className="min-w-0 space-y-3 rounded-sm border bg-muted/30 p-3 sm:p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-semibold">{copy("AI suggestion", "Proposition IA")}</h3><p className="mt-1 text-xs text-muted-foreground">{copy("Generate a proposal, review each field, then save the model separately.", "Générez une proposition, vérifiez chaque champ, puis enregistrez le modèle séparément.")}</p></div><Button type="button" size="sm" variant="outline" disabled={busy || !(draft.id || draft.name || draft.accesses[0]?.nativeModel)} onClick={() => void generate()}>{busy ? copy("Generating…", "Génération…") : copy("Suggest fields", "Proposer des champs")}</Button></div>
    {!(draft.id || draft.name || draft.accesses[0]?.nativeModel) && <p className="text-xs text-muted-foreground">{copy("Enter a model ID, display name, or native model before requesting a suggestion.", "Saisissez un ID de modèle, un nom affiché ou un modèle natif avant de demander une proposition.")}</p>}
    {error && <div role="alert" className="space-y-2 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm"><p>{error}</p>{onOpenSettings && <Button type="button" variant="outline" size="sm" onClick={onOpenSettings}>{copy("Open AI settings", "Ouvrir les réglages IA")}</Button>}</div>}
    {result && !review && <p role="status" className="text-xs text-muted-foreground">{copy("Model draft changed. Generate a new suggestion before applying fields.", "Le brouillon du modèle a changé. Générez une nouvelle proposition avant d’appliquer les champs.")}</p>}
    {review && <div className="max-h-[min(45vh,25rem)] space-y-3 overflow-y-auto rounded-sm border bg-card p-3">
      <p className="text-xs text-muted-foreground">{copy("Proposed by", "Proposition de")} {review.model || copy("configured model", "modèle configuré")} · {review.endpoint || copy("configured endpoint", "point de terminaison configuré")}. {copy("AI metadata is declared, never observed.", "Les métadonnées proposées par l’IA sont déclarées, jamais observées.")}</p>
      {rows.length ? <div className="space-y-2">{rows.map(row => <label key={row.key} className="flex cursor-pointer items-start gap-2 rounded-sm border p-2 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={selected.has(row.key)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(row.key); else next.delete(row.key); return next; })} /><span className="min-w-0"><strong className="block">{row.label}</strong><span className="block break-words text-xs text-muted-foreground">{copy("Current", "Actuel")}{colon} {row.current}</span><span className="block break-words text-xs">{copy("Proposed", "Proposé")} : {row.proposed}</span></span></label>)}</div> : <p className="text-xs text-muted-foreground">{copy("No metadata fields proposed.", "Aucune métadonnée proposée.")}</p>}
      {rows.length > 0 && <Button type="button" size="sm" disabled={!selected.size} onClick={apply}>{copy("Apply selected to draft", "Appliquer au brouillon")}</Button>}
    </div>}
  </section>;
}
