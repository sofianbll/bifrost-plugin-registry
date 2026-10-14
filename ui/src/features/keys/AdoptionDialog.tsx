import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, applyKeyAdoption, previewKeyAdoption, type AdoptionOperation, type AdoptionPreview, type AdoptionReceipt } from "../../data/api";
import { useCopy } from "../../lib/locale";

const missingAccess = /^Native route (.+) needs a configured direct Registry access with the same native name$/;
function adoptionReason(reason: string, copyText: ReturnType<typeof useCopy>) {
  const route = reason.match(missingAccess)?.[1];
  const split = route?.indexOf("/") ?? -1;
  return split > 0 ? copyText(`Also register the “${route!.slice(split + 1)}” model from provider “${route!.slice(0, split)}” to preserve this key’s permissions.`, `Enregistrez aussi le modèle « ${route!.slice(split + 1)} » du fournisseur « ${route!.slice(0, split)} » pour conserver les permissions de cette clé.`) : reason;
}

export default function AdoptionDialog({ keyId, operation, onClose, onUnauthorized, onApplied }: { keyId: string; operation: AdoptionOperation; onClose: () => void; onUnauthorized: () => void; onApplied: (receipt: AdoptionReceipt) => void }) {
  const copyText = useCopy();
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

  const missingCards = preview?.blocked.filter(reason => missingAccess.test(reason)).length || 0;
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-xl overflow-auto"><DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>{copyText("Review the selected models and Bifrost permissions before confirming.", "Vérifiez les modèles retenus et les permissions Bifrost avant de confirmer.")}</DialogDescription></DialogHeader>
    {error && <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
    {preview ? <div className="space-y-3 text-sm">{preview.evidence === "snapshot" && <p className="rounded-sm border bg-primary/5 p-3">{copyText(`Preview calculated from the ${preview.source} snapshot. This action prepares the selection in the local copy; it does not modify the key on Pulsar.`, `Aperçu calculé depuis la capture de ${preview.source}. Cette action prépare la sélection dans la copie locale ; elle ne modifie pas la clé sur Pulsar.`)}</p>}<div className="flex flex-wrap gap-2"><Badge variant={preview.canApply ? "success" : "warning"}>{preview.canApply ? copyText("Ready to apply", "Prêt à appliquer") : missingCards > 1 ? copyText("Models to register", "Modèles à enregistrer") : missingCards ? copyText("Model to register", "Modèle à enregistrer") : copyText("Needs attention", "À résoudre")}</Badge><Badge variant="outline">{copyText("Bifrost permissions preserved", "Permissions Bifrost conservées")}</Badge></div><div className="grid gap-3 sm:grid-cols-2"><section className="min-w-0 rounded-sm border p-3"><h3 className="font-medium">{copyText(`Selected Registry accesses (${preview.selectedRoutes.length})`, `Accès Registry retenus (${preview.selectedRoutes.length})`)}</h3><ul className="mt-2 max-h-40 space-y-1 overflow-auto">{preview.selectedRoutes.map(id => <li key={id} className="break-all font-mono text-xs">{id}</li>)}</ul>{!preview.selectedRoutes.length && <p className="mt-2 text-xs text-muted-foreground">{preview.blocked.length ? copyText("Selection unavailable until the items below are resolved.", "Sélection indisponible tant que les points ci-dessous ne sont pas résolus.") : copyText("No access selected.", "Aucun accès sélectionné.")}</p>}</section><section className="min-w-0 rounded-sm border p-3"><h3 className="font-medium">{preview.evidence === "snapshot" ? copyText("Snapshot accesses", "Accès de la capture") : copyText("Current native accesses", "Accès natifs actuels")} ({preview.nativeRoutes.length})</h3><ul className="mt-2 max-h-40 space-y-1 overflow-auto">{preview.nativeRoutes.map(id => <li key={id} className="break-all font-mono text-xs">{id}</li>)}</ul>{!preview.nativeRoutes.length && <p className="mt-2 text-xs text-muted-foreground">{preview.blocked.length ? copyText("Preview unavailable until the items below are resolved.", "Aperçu indisponible tant que les points ci-dessous ne sont pas résolus.") : copyText("No accesses returned.", "Aucun accès renvoyé.")}</p>}</section></div>{preview.blocked.length > 0 && <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-3"><h3 className="font-medium">{copyText("Before continuing", "Avant de continuer")}</h3><ul className="mt-1 list-inside list-disc space-y-1 text-sm">{preview.blocked.map((reason, index) => <li key={`${index}/${reason}`} className="break-words">{adoptionReason(reason, copyText)}</li>)}</ul></div>}{!preview.previewToken && preview.canApply && <p className="text-xs text-destructive">{copyText("Confirmation is unavailable. Refresh the preview.", "La confirmation est indisponible. Actualisez l’aperçu.")}</p>}{stale && <p role="status" className="text-xs text-destructive">{copyText("This preview is out of date.", "Cet aperçu n’est plus à jour.")}</p>}<details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{copyText("Technical identifiers", "Identifiants techniques")}</summary><p className="mt-1 break-all">{copyText("Key", "Clé")} : <code>{keyId}</code></p><p className="break-all">{copyText("Registry revision", "Révision Registry")} : <code>{preview.revision}</code></p></details></div> : <p className="text-sm text-muted-foreground">{busy ? copyText("Loading preview…", "Chargement de l’aperçu…") : copyText("Preview unavailable.", "Aperçu indisponible.")}</p>}
    <DialogFooter className="flex-row flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => void refresh()}>{copyText("Refresh preview", "Actualiser l’aperçu")}</Button><Button variant="outline" disabled={busy} onClick={onClose}>{copyText("Cancel", "Annuler")}</Button><Button disabled={busy || stale || !preview?.canApply || !preview.previewToken} onClick={() => void apply()}>{label}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
