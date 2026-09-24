import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, applyKeyAdoption, previewKeyAdoption, type AdoptionOperation, type AdoptionPreview, type AdoptionReceipt } from "./api";

export default function AdoptionDialog({ keyId, operation, onClose, onUnauthorized, onApplied }: { keyId: string; operation: AdoptionOperation; onClose: () => void; onUnauthorized: () => void; onApplied: (receipt: AdoptionReceipt) => void }) {
  const [preview, setPreview] = useState<AdoptionPreview | null>(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = operation === "adopt" ? "Adopt native key" : "Rebind native key";

  const report = (cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) { onClose(); onUnauthorized(); return; }
    if (cause instanceof ApiError && cause.status === 409) {
      setStale(true);
      setError("The Registry changed. Refresh the preview before applying; the previous routes remain visible for review.");
      return;
    }
    setError(cause instanceof Error ? cause.message : "Key binding request failed.");
  };
  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    try { setPreview(await previewKeyAdoption(keyId, operation)); setStale(false); setError(""); }
    catch (cause) { report(cause); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); }, [keyId, operation]);
  const apply = async () => {
    if (!preview?.canApply || !preview.previewToken || busy || stale) return;
    setBusy(true);
    try { onApplied(await applyKeyAdoption(preview)); onClose(); }
    catch (cause) { report(cause); }
    finally { setBusy(false); }
  };

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-xl overflow-auto"><DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>Review the exact Registry routes and native permissions before applying this binding for key <span className="break-all font-mono">{keyId}</span>.</DialogDescription></DialogHeader>
    {error && <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
    {preview ? <div className="space-y-3 text-sm"><div className="flex flex-wrap gap-2"><Badge variant={preview.canApply ? "success" : "warning"}>{preview.canApply ? "Ready to apply" : "Blocked"}</Badge><Badge variant="outline">Native permissions preserved</Badge></div><p className="break-all text-xs text-muted-foreground">Registry revision: {preview.revision}</p><div className="grid gap-3 sm:grid-cols-2"><section className="min-w-0 rounded-sm border p-3"><h3 className="font-medium">Selected Registry routes ({preview.selectedRoutes.length})</h3><ul className="mt-2 max-h-40 space-y-1 overflow-auto">{preview.selectedRoutes.map(id => <li key={id} className="break-all font-mono text-xs">{id}</li>)}</ul>{!preview.selectedRoutes.length && <p className="mt-2 text-xs text-muted-foreground">None selected.</p>}</section><section className="min-w-0 rounded-sm border p-3"><h3 className="font-medium">Current native routes ({preview.nativeRoutes.length})</h3><ul className="mt-2 max-h-40 space-y-1 overflow-auto">{preview.nativeRoutes.map(id => <li key={id} className="break-all font-mono text-xs">{id}</li>)}</ul>{!preview.nativeRoutes.length && <p className="mt-2 text-xs text-muted-foreground">None reported.</p>}</section></div>{preview.blocked.length > 0 && <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-3"><h3 className="font-medium">Cannot apply</h3><ul className="mt-1 list-inside list-disc space-y-1 text-xs">{preview.blocked.map((reason, index) => <li key={`${index}/${reason}`} className="break-words">{reason}</li>)}</ul></div>}{!preview.previewToken && preview.canApply && <p className="text-xs text-destructive">No apply token was returned. Refresh the preview.</p>}{stale && <p role="status" className="text-xs text-destructive">The preview is stale.</p>}</div> : <p className="text-sm text-muted-foreground">{busy ? "Loading binding preview…" : "Preview unavailable."}</p>}
    <DialogFooter className="flex-row flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => void refresh()}>Refresh preview</Button><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy || stale || !preview?.canApply || !preview.previewToken} onClick={() => void apply()}>{label}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
