import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, applyKeyAdoption, previewKeyAdoption, type AdoptionOperation, type AdoptionPreview, type AdoptionReceipt } from "../../data/api";
import { useCopy, useFormat } from "../../lib/locale";
import { AdoptionBlockers } from "./AdoptionBlockers";

// onShowToAdd: called with the provider/native routes of the unsaved models blocking the key.
export default function AdoptionDialog({ keyId, operation, onClose, onUnauthorized, onApplied, onShowToAdd }: { keyId: string; operation: AdoptionOperation; onClose: () => void; onUnauthorized: () => void; onApplied: (receipt: AdoptionReceipt) => void; onShowToAdd?: (routes: string[]) => void }) {
  const copyText = useCopy();
  const { colon } = useFormat();
  const [preview, setPreview] = useState<AdoptionPreview | null>(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = preview?.evidence === "snapshot" ? copyText("Prepare local selection", "Préparer la sélection locale") : operation === "adopt" ? copyText("Use this key with Registry", "Utiliser cette clé avec Registry") : copyText("Reassociate Bifrost key", "Réassocier la clé Bifrost");

  const report = (cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) { onClose(); onUnauthorized(); return; }
    if (cause instanceof ApiError && cause.status === 409) {
      setStale(true);
      setError(copyText("The Registry catalog changed. Refresh the preview before continuing.", "Le catalogue Registry a changé. Actualisez l’aperçu avant de continuer."));
      return;
    }
    setError(cause instanceof Error ? cause.message : copyText("Could not associate this key.", "Impossible d’associer cette clé."));
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

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-xl overflow-auto"><DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>{copyText("Review the selected models and Bifrost permissions before confirming.", "Vérifiez les modèles retenus et les permissions Bifrost avant de confirmer.")}</DialogDescription></DialogHeader>
    {error && <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
    {preview ? <div className="space-y-3 text-sm">{preview.evidence === "snapshot" && <p className="rounded-sm border bg-primary/5 p-3">{copyText(`Preview calculated from the ${preview.source} snapshot. This action prepares the selection in the local copy; it does not modify the key on Pulsar.`, `Aperçu calculé depuis la capture de ${preview.source}. Cette action prépare la sélection dans la copie locale ; elle ne modifie pas la clé sur Pulsar.`)}</p>}<div className="flex flex-wrap gap-2"><Badge variant={preview.canApply ? "success" : "warning"}>{preview.canApply ? copyText("Ready to apply", "Prêt à appliquer") : copyText("Needs attention", "À résoudre")}</Badge><Badge variant="outline">{copyText("Bifrost permissions preserved", "Permissions Bifrost conservées")}</Badge></div><div className="grid gap-3 sm:grid-cols-2"><section className="min-w-0 rounded-sm border p-3"><h3 className="font-medium">{copyText(`Selected Registry accesses (${preview.selectedRoutes.length})`, `Accès Registry retenus (${preview.selectedRoutes.length})`)}</h3><ul className="mt-2 max-h-40 space-y-1 overflow-auto">{preview.selectedRoutes.map(id => <li key={id} className="break-all font-mono text-xs">{id}</li>)}</ul>{!preview.selectedRoutes.length && <p className="mt-2 text-xs text-muted-foreground">{preview.blocked.length ? copyText("Selection unavailable until the items below are resolved.", "Sélection indisponible tant que les points ci-dessous ne sont pas résolus.") : copyText("No access selected.", "Aucun accès sélectionné.")}</p>}</section><section className="min-w-0 rounded-sm border p-3"><h3 className="font-medium">{preview.evidence === "snapshot" ? copyText("Snapshot accesses", "Accès de la capture") : copyText("Current native accesses", "Accès natifs actuels")} {preview.blocked.length > 0 && preview.nativeRoutes.length === 0 ? `· ${copyText("not verified", "non vérifiés")}` : `(${preview.nativeRoutes.length})`}</h3><ul className="mt-2 max-h-40 space-y-1 overflow-auto">{preview.nativeRoutes.map(id => <li key={id} className="break-all font-mono text-xs">{id}</li>)}</ul>{!preview.nativeRoutes.length && <p className="mt-2 text-xs text-muted-foreground">{preview.blocked.length ? copyText("Native routes were not read back because blockers remain.", "Les routes natives n’ont pas été relues car des blocages subsistent.") : copyText("No accesses returned.", "Aucun accès renvoyé.")}</p>}</section></div>{preview.blocked.length > 0 && <AdoptionBlockers readiness={preview.readiness} reasons={preview.blocked} onShowToAdd={onShowToAdd} />}{!preview.previewToken && preview.canApply && <p className="text-xs text-destructive">{copyText("Confirmation is unavailable. Refresh the preview.", "La confirmation est indisponible. Actualisez l’aperçu.")}</p>}{stale && <p role="status" className="text-xs text-destructive">{copyText("This preview is out of date.", "Cet aperçu n’est plus à jour.")}</p>}<details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{copyText("Technical identifiers", "Identifiants techniques")}</summary><p className="mt-1 break-all">{copyText("Key", "Clé")}{colon} <code>{keyId}</code></p><p className="break-all">{copyText("Registry revision", "Révision Registry")} : <code>{preview.revision}</code></p></details></div> : <p className="text-sm text-muted-foreground">{busy ? copyText("Loading preview…", "Chargement de l’aperçu…") : copyText("Preview unavailable.", "Aperçu indisponible.")}</p>}
    <DialogFooter className="flex-row flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => void refresh()}>{copyText("Refresh preview", "Actualiser l’aperçu")}</Button><Button variant="outline" disabled={busy} onClick={onClose}>{copyText("Cancel", "Annuler")}</Button><Button disabled={busy || stale || !preview?.canApply || !preview.previewToken} onClick={() => void apply()}>{label}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
