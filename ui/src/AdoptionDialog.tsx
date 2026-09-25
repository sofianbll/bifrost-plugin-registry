import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, applyKeyAdoption, previewKeyAdoption, type AdoptionOperation, type AdoptionPreview, type AdoptionReceipt } from "./api";

const missingAccess = /^Native route (.+) needs a configured direct Registry access with the same native name$/;
function adoptionReason(reason: string) {
  const route = reason.match(missingAccess)?.[1];
  const split = route?.indexOf("/") ?? -1;
  return split > 0 ? `Enregistrez aussi le modèle « ${route!.slice(split + 1)} » du fournisseur « ${route!.slice(0, split)} » pour conserver les permissions de cette clé.` : reason;
}

export default function AdoptionDialog({ keyId, operation, onClose, onUnauthorized, onApplied }: { keyId: string; operation: AdoptionOperation; onClose: () => void; onUnauthorized: () => void; onApplied: (receipt: AdoptionReceipt) => void }) {
  const [preview, setPreview] = useState<AdoptionPreview | null>(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = preview?.evidence === "snapshot" ? "Préparer la sélection locale" : operation === "adopt" ? "Utiliser cette clé avec Registry" : "Réassocier la clé Bifrost";

  const report = (cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) { onClose(); onUnauthorized(); return; }
    if (cause instanceof ApiError && cause.status === 409) {
      setStale(true);
      setError("Le catalogue Registry a changé. Actualisez l’aperçu avant de continuer.");
      return;
    }
    setError(cause instanceof Error ? cause.message : "Impossible d’associer cette clé.");
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
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-xl overflow-auto"><DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>Vérifiez les modèles retenus et les permissions Bifrost avant de confirmer.</DialogDescription></DialogHeader>
    {error && <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
    {preview ? <div className="space-y-3 text-sm">{preview.evidence === "snapshot" && <p className="rounded-sm border bg-primary/5 p-3">Aperçu calculé depuis la capture de {preview.source}. Cette action prépare la sélection dans la copie locale ; elle ne modifie pas la clé sur Pulsar.</p>}<div className="flex flex-wrap gap-2"><Badge variant={preview.canApply ? "success" : "warning"}>{preview.canApply ? "Prêt à appliquer" : missingCards > 1 ? "Modèles à enregistrer" : missingCards ? "Modèle à enregistrer" : "À résoudre"}</Badge><Badge variant="outline">Permissions Bifrost conservées</Badge></div><div className="grid gap-3 sm:grid-cols-2"><section className="min-w-0 rounded-sm border p-3"><h3 className="font-medium">Accès Registry retenus ({preview.selectedRoutes.length})</h3><ul className="mt-2 max-h-40 space-y-1 overflow-auto">{preview.selectedRoutes.map(id => <li key={id} className="break-all font-mono text-xs">{id}</li>)}</ul>{!preview.selectedRoutes.length && <p className="mt-2 text-xs text-muted-foreground">{preview.blocked.length ? "Sélection indisponible tant que les points ci-dessous ne sont pas résolus." : "Aucun accès sélectionné."}</p>}</section><section className="min-w-0 rounded-sm border p-3"><h3 className="font-medium">{preview.evidence === "snapshot" ? "Accès de la capture" : "Accès natifs actuels"} ({preview.nativeRoutes.length})</h3><ul className="mt-2 max-h-40 space-y-1 overflow-auto">{preview.nativeRoutes.map(id => <li key={id} className="break-all font-mono text-xs">{id}</li>)}</ul>{!preview.nativeRoutes.length && <p className="mt-2 text-xs text-muted-foreground">{preview.blocked.length ? "Aperçu indisponible tant que les points ci-dessous ne sont pas résolus." : "Aucun accès renvoyé."}</p>}</section></div>{preview.blocked.length > 0 && <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-3"><h3 className="font-medium">Avant de continuer</h3><ul className="mt-1 list-inside list-disc space-y-1 text-sm">{preview.blocked.map((reason, index) => <li key={`${index}/${reason}`} className="break-words">{adoptionReason(reason)}</li>)}</ul></div>}{!preview.previewToken && preview.canApply && <p className="text-xs text-destructive">La confirmation est indisponible. Actualisez l’aperçu.</p>}{stale && <p role="status" className="text-xs text-destructive">Cet aperçu n’est plus à jour.</p>}<details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Identifiants techniques</summary><p className="mt-1 break-all">Clé : <code>{keyId}</code></p><p className="break-all">Révision Registry : <code>{preview.revision}</code></p></details></div> : <p className="text-sm text-muted-foreground">{busy ? "Chargement de l’aperçu…" : "Aperçu indisponible."}</p>}
    <DialogFooter className="flex-row flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => void refresh()}>Actualiser l’aperçu</Button><Button variant="outline" disabled={busy} onClick={onClose}>Annuler</Button><Button disabled={busy || stale || !preview?.canApply || !preview.previewToken} onClick={() => void apply()}>{label}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
