import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { suggestModel } from "./assistant-api";
import { applySuggestion, normalizeSuggestion, suggestionRows, type Suggestion } from "./assistant-proposal";
import type { Model } from "./demo";

export default function AssistantSuggestion({ draft, onChange, onOpenSettings }: { draft: Model; onChange: (model: Model) => void; onOpenSettings?: () => void }) {
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
      if (JSON.stringify(current.current) !== snapshot) { setError("Model draft changed while the suggestion was running. Generate again to review current values."); return; }
      const suggestion = normalizeSuggestion(response);
      const rows = suggestionRows(current.current, suggestion);
      if (!rows.length) { setError("The assistant returned no usable suggestions for this model."); return; }
      setResult({ suggestion, snapshot, model: response.model, endpoint: response.endpoint });
      setSelected(new Set(rows.filter(row => row.checked).map(row => row.key)));
    } catch (cause) {
      if (requestId === generation.current) setError(JSON.stringify(current.current) === snapshot ? cause instanceof Error ? cause.message : "Suggestion failed. Check AI settings and try again." : "Model draft changed while the suggestion was running. Generate again to review current values.");
    } finally { if (requestId === generation.current) setBusy(false); }
  };
  const review = result && JSON.stringify(draft) === result.snapshot ? result : null;
  const rows = review ? suggestionRows(draft, review.suggestion) : [];
  const apply = () => {
    if (!review || !selected.size) return;
    onChange(applySuggestion(draft, rows, selected));
    setResult(null); setSelected(new Set());
  };
  return <section aria-label="AI model suggestions" className="min-w-0 space-y-3 rounded-sm border bg-muted/30 p-3 sm:p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-semibold">AI suggestion</h3><p className="mt-1 text-xs text-muted-foreground">Generate a proposal, review each field, then save the model separately.</p></div><Button type="button" size="sm" variant="outline" disabled={busy || !(draft.id || draft.name || draft.accesses[0]?.nativeModel)} onClick={() => void generate()}>{busy ? "Generating…" : "Suggest fields"}</Button></div>
    {!(draft.id || draft.name || draft.accesses[0]?.nativeModel) && <p className="text-xs text-muted-foreground">Enter a model ID, display name, or native model before requesting a suggestion.</p>}
    {error && <div role="alert" className="space-y-2 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm"><p>{error}</p>{onOpenSettings && <Button type="button" variant="outline" size="sm" onClick={onOpenSettings}>Open AI settings</Button>}</div>}
    {result && !review && <p role="status" className="text-xs text-muted-foreground">Model draft changed. Generate a new suggestion before applying fields.</p>}
    {review && <div className="max-h-[min(45vh,25rem)] space-y-3 overflow-y-auto rounded-sm border bg-card p-3">
      <p className="text-xs text-muted-foreground">Proposed by {review.model || "configured model"} · {review.endpoint || "configured endpoint"}. AI metadata is declared, never observed.</p>
      {rows.length ? <div className="space-y-2">{rows.map(row => <label key={row.key} className="flex cursor-pointer items-start gap-2 rounded-sm border p-2 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={selected.has(row.key)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(row.key); else next.delete(row.key); return next; })} /><span className="min-w-0"><strong className="block">{row.label}</strong><span className="block break-words text-xs text-muted-foreground">Current: {row.current}</span><span className="block break-words text-xs">Proposed: {row.proposed}</span></span></label>)}</div> : <p className="text-xs text-muted-foreground">No metadata fields proposed.</p>}
      {rows.length > 0 && <Button type="button" size="sm" disabled={!selected.size} onClick={apply}>Apply selected to draft</Button>}
    </div>}
  </section>;
}
