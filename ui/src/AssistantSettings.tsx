import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "./SearchableSelect";
import { ApiError } from "./api";
import { canSaveAssistantSettings, getAssistantChoices, getAssistantSettings, putAssistantSettings, type AssistantChoices, type AssistantConfig } from "./assistant-api";

const empty: AssistantConfig = { model: "", endpoint: "", virtualKeyId: "" };

export default function AssistantSettings({ onSaved, onUnauthorized }: { onSaved?: () => void; onUnauthorized?: () => void }) {
  const [revision, setRevision] = useState("");
  const [settings, setSettings] = useState<AssistantConfig>(empty);
  const [choices, setChoices] = useState<AssistantChoices | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);
  const requestVersion = useRef(0);
  const loadVersion = useRef(0);

  const report = (cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) onUnauthorized?.();
    if (cause instanceof ApiError && cause.status === 409) { setConflict(true); setError("Settings changed elsewhere. Reload, review, and save again."); }
    else setError(cause instanceof Error ? cause.message : "Assistant settings unavailable.");
  };
  const loadModels = async (virtualKeyId: string) => {
    const version = ++requestVersion.current;
    setChoices(previous => previous && { ...previous, models: [] });
    setModelError("");
    if (!virtualKeyId) { setLoadingModels(false); return; }
    setLoadingModels(true);
    try {
      const available = await getAssistantChoices(virtualKeyId);
      if (version === requestVersion.current) setChoices(available);
    } catch (cause) {
      if (version === requestVersion.current) {
        if (cause instanceof ApiError && cause.status === 401) onUnauthorized?.();
        setModelError(cause instanceof Error ? cause.message : "Model discovery failed for this key.");
      }
    } finally { if (version === requestVersion.current) setLoadingModels(false); }
  };
  const loadChoices = async (virtualKeyId: string) => {
    const version = ++requestVersion.current;
    setChoices(null); setModelError(""); setLoadingModels(true);
    try {
      const available = await getAssistantChoices();
      if (version !== requestVersion.current) return;
      setChoices(available);
      if (virtualKeyId) void loadModels(virtualKeyId);
      else setLoadingModels(false);
    } catch (cause) {
      if (version !== requestVersion.current) return;
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized?.();
      setModelError(cause instanceof Error ? cause.message : "Native key discovery failed.");
      setLoadingModels(false);
    }
  };
  const load = async () => {
    const version = ++loadVersion.current;
    requestVersion.current++;
    setBusy(true);
    try {
      const current = await getAssistantSettings();
      if (version !== loadVersion.current) return;
      setRevision(current.revision);
      setSettings(current.settings || empty);
      setError(""); setConflict(false); setSaved(false);
      void loadChoices(current.settings?.virtualKeyId || "");
    } catch (cause) { if (version === loadVersion.current) report(cause); }
    finally { if (version === loadVersion.current) setBusy(false); }
  };
  useEffect(() => { void load(); return () => { loadVersion.current++; requestVersion.current++; }; }, []);

  const valid = !error && canSaveAssistantSettings(settings, revision, choices, loadingModels || !!modelError);
  const save = async () => {
    if (!valid || busy || conflict) return;
    setBusy(true); setSaved(false); setError("");
    try {
      const next = await putAssistantSettings(settings, revision);
      setRevision(next.revision); setSettings(next.settings); setSaved(true); onSaved?.();
    } catch (cause) { report(cause); }
    finally { setBusy(false); }
  };
  return <section aria-label="AI assistance settings" className="min-w-0 space-y-4 rounded-sm border bg-card p-4 sm:p-5">
    <div><h2 className="text-base font-semibold">AI assistance</h2><p className="mt-1 text-sm text-muted-foreground">Choose a configured Bifrost model and virtual key. Suggestions run only when requested and need review before saving a model.</p></div>
    {error && <div role="alert" className="space-y-2 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm"><p>{error}</p><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void load()}>{conflict ? "Reload settings" : "Retry"}</Button></div>}
    {!revision && !error ? <p role="status" className="text-sm text-muted-foreground">Loading AI settings…</p> : !!revision && <form className="grid min-w-0 gap-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label className="block text-sm font-medium sm:col-span-2">Bifrost virtual key<select className="mt-2 flex h-9 w-full rounded-sm border bg-background px-2 text-sm" value={settings.virtualKeyId} onChange={event => { const virtualKeyId = event.target.value; setSettings({ ...settings, virtualKeyId, model: "" }); setSaved(false); void loadModels(virtualKeyId); }} disabled={busy || !choices}><option value="">Choose a key</option>{choices?.virtualKeys.map(key => <option key={key.id} value={key.id}>{key.name || key.id}</option>)}</select>{!choices && settings.virtualKeyId && <span className="mt-1 block break-all text-xs text-muted-foreground">Saved key ID: {settings.virtualKeyId}</span>}</label>
      <div className="min-w-0 sm:col-span-2"><SearchableSelect label="Model visible to this key" value={settings.model} options={(choices?.models || []).map(model => ({ value: model.id, label: model.name || model.id, detail: model.provider }))} onChange={model => { setSettings({ ...settings, model }); setSaved(false); }} placeholder={loadingModels ? "Loading model IDs…" : "Search exact /v1/models IDs"} disabled={busy || loadingModels || !settings.virtualKeyId || !!modelError || !choices} />{loadingModels && <p role="status" className="mt-1 text-xs text-muted-foreground">Reading /v1/models for this key…</p>}{!loadingModels && settings.virtualKeyId && !modelError && choices?.models.length === 0 && <p className="mt-1 text-xs text-muted-foreground">This key currently exposes no models.</p>}{settings.model && !loadingModels && choices && !choices.models.some(model => model.id === settings.model) && <p className="mt-1 text-xs text-destructive">Choose an exact model ID visible to this key.</p>}{modelError && <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-xs text-destructive"><span>{modelError}</span><Button type="button" size="sm" variant="outline" disabled={loadingModels} onClick={() => void (choices ? loadModels(settings.virtualKeyId) : loadChoices(settings.virtualKeyId))}>Retry discovery</Button></div>}</div>
      <label className="block text-sm font-medium sm:col-span-2">Request endpoint<select className="mt-2 flex h-9 w-full rounded-sm border bg-background px-2 text-sm" value={settings.endpoint} onChange={event => { setSettings({ ...settings, endpoint: event.target.value as AssistantConfig["endpoint"] }); setSaved(false); }} disabled={busy}><option value="">Choose an endpoint</option><option value="chat_completions">Chat completions</option><option value="responses">Responses</option></select></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Button type="submit" size="sm" disabled={!valid || busy || conflict}>{busy ? "Saving…" : "Save AI settings"}</Button><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setSettings(empty); setSaved(false); if (choices) void loadModels(""); }}>Clear selection</Button>{saved && <span role="status" className="text-sm text-muted-foreground">Settings saved.</span>}</div>
    </form>}
  </section>;
}
