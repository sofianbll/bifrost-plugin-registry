import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { displayProvider } from "../../components/registry/BrandIcon";
import { ApiError, applyNativeEdit, previewNativeEdit, type NativeEditOperation, type NativeEditPreview, type NativeEditReceipt } from "../../data/api";
import type { NativePermissions, Readiness, ReadinessBlocker } from "../../domain/registry";
import { useCopy, type Copy } from "../../lib/locale";

// Native permission edit before adoption (#93), offered from the adoption dialog only. Registry can
// take off the key, in Bifrost, the models it cannot represent (one provider at a time) or replace
// "all providers" by an explicit list. Nothing is written until the person confirms the exact preview.
export type NativeEditRequest = { operation: NativeEditOperation; provider: string };

// The edit a blocker offers, if any. Models are removed only once the key no longer allows every
// provider: dropping the last row of an all-providers key would open that provider completely.
export function nativeEditFor(blocker: ReadinessBlocker, readiness: Readiness): NativeEditRequest | null {
  if (blocker.kind === "all-providers") return { operation: "replace-all-providers", provider: "" };
  if (blocker.kind === "undiscovered" && !readiness.blockers.some(other => other.kind === "all-providers")) return { operation: "remove-models", provider: blocker.provider };
  return null;
}

export const nativeEditLabel = (request: NativeEditRequest, copy: Copy) => request.operation === "remove-models"
  ? copy("Remove these models from the key in Bifrost", "Retirer ces modèles de la clé dans Bifrost")
  : copy("Replace “all providers” by the explicit list", "Remplacer « tous les fournisseurs » par la liste explicite");

// The button and its one-line consequence, inside a blocker of the adoption dialog.
export function NativeEditButton({ blocker, readiness, onEdit }: { blocker: ReadinessBlocker; readiness?: Readiness; onEdit?: (request: NativeEditRequest) => void }) {
  const copy = useCopy();
  const request = readiness && onEdit ? nativeEditFor(blocker, readiness) : null;
  if (!request || !onEdit) return null;
  return <div className="mt-2">
    <Button type="button" variant="outline" size="sm" className="h-auto min-h-8 whitespace-normal text-left" onClick={() => onEdit(request)}>{nativeEditLabel(request, copy)}{request.provider && <span className="sr-only"> · {displayProvider(request.provider)}</span>}</Button>
    <p className="mt-1 text-xs">{request.operation === "remove-models"
      ? copy("Changes the key in Bifrost once you confirm a preview: requests for these models will be refused.", "Modifie la clé dans Bifrost après confirmation d’un aperçu : les requêtes vers ces modèles seront refusées.")
      : copy("Changes the key in Bifrost once you confirm a preview: it will no longer allow every provider, only the list shown.", "Modifie la clé dans Bifrost après confirmation d’un aperçu : elle n’autorisera plus tous les fournisseurs, seulement la liste affichée.")}</p>
  </div>;
}

const edits: [RegExp, string, string][] = [
  [/^Nothing to remove for this provider$/, "$&", "Rien à retirer pour ce fournisseur."],
  [/^This key allows all providers: replace that first$/, "$&", "Cette clé autorise tous les fournisseurs : remplacez d’abord cette autorisation."],
  [/^This key does not allow all providers$/, "$&", "Cette clé n’autorise pas tous les fournisseurs."],
  [/^Native key identity changed$/, "$&", "L’identité de la clé native a changé."],
  [/^Native key is controlled by an external access profile$/, "$&", "La clé native dépend d’un profil d’accès externe."],
];
const editReason = (reason: string, copy: Copy) => {
  const known = edits.find(([pattern]) => pattern.test(reason));
  return known ? reason.replace(known[0], copy(known[1], known[2])) : reason;
};

const modelCount = (count: number, copy: Copy) => `${count} ${copy(count === 1 ? "model" : "models", count === 1 ? "modèle" : "modèles")}`;

// One line per provider with a count; the model IDs wait behind a disclosure.
function PermissionLines({ label, permissions, lines }: { label: string; permissions?: NativePermissions | null; lines?: { provider: string; models: string[] }[] }) {
  const copy = useCopy();
  const rows: { provider: string; models: string[]; note?: string }[] = lines ?? permissions?.providers.map(({ provider, allModels, models, versionDependent }) => ({ provider, models, note: allModels ? copy("all models", "tous les modèles") : versionDependent ? copy("depends on the Bifrost version", "selon la version de Bifrost") : "" })) ?? [];
  if (permissions?.allProviders) return <ul aria-label={label} className="mt-1 space-y-1 text-xs"><li>{copy("All providers", "Tous les fournisseurs")}</li></ul>;
  if (!rows.length) return <p className="mt-1 text-xs text-muted-foreground">{lines ? copy("No model.", "Aucun modèle.") : copy("No provider.", "Aucun fournisseur.")}</p>;
  return <ul aria-label={label} className="mt-1 space-y-1 text-xs">{rows.map(row => {
    const name = displayProvider(row.provider);
    if (row.note) return <li key={row.provider}>{name} · {row.note}</li>;
    return <li key={row.provider}><details><summary className="cursor-pointer">{name} · {modelCount(row.models.length, copy)}</summary><p className="mt-1 break-all font-mono">{row.models.join(", ")}</p></details></li>;
  })}</ul>;
}

// The exact change and what follows from it. A blocked edit shows its reasons and nothing to confirm.
export function NativeEditPreviewBody({ preview }: { preview: NativeEditPreview }) {
  const copy = useCopy();
  const replace = preview.operation === "replace-all-providers";
  const emptied = !!preview.after && !preview.after.allProviders && !preview.after.providers.length;
  const dropped = !replace && !!preview.provider && !!preview.after && !preview.after.providers.some(row => row.provider === preview.provider);
  const today = copy("Allowed today", "Autorisé aujourd’hui");
  const afterwards = copy("Allowed afterwards", "Autorisé ensuite");
  const removed = copy("Removed from the key", "Retiré de la clé");
  return <div className="space-y-3 text-sm">
    {preview.canApply ? <p className="rounded-sm border border-destructive/40 bg-destructive/10 p-3">
      {copy("This changes the key in Bifrost, not only in Registry. ", "Cette action modifie la clé dans Bifrost, pas seulement dans Registry. ")}
      {replace
        ? copy(`The key stops allowing every provider: afterwards it allows only the providers and models listed under “${afterwards}”. Providers added to Bifrost later are not allowed until you add them to the key. Registry adopts one access per model: when several providers serve the same model, the first one by name is kept.${preview.remove.length ? ` The models listed under “${removed}” are no longer allowed.` : ""}`,
          `La clé n’autorise plus tous les fournisseurs : ensuite, elle n’autorise que les fournisseurs et modèles listés sous « ${afterwards} ». Les fournisseurs ajoutés plus tard à Bifrost ne seront pas autorisés tant que vous ne les ajoutez pas à la clé. Registry n’adopte qu’un accès par modèle : quand plusieurs fournisseurs servent le même modèle, le premier par nom est conservé.${preview.remove.length ? ` Les modèles listés sous « ${removed} » ne sont plus autorisés.` : ""}`)
        : copy("Requests that use these models will be refused. Bifrost does not list them today, and no other permission of the key changes.",
          "Les requêtes qui utilisent ces modèles seront refusées. Bifrost ne les liste pas aujourd’hui, et aucune autre permission de la clé ne change.")}
      {dropped && ` ${copy(`${displayProvider(preview.provider!)} has no model left on the key, so it is removed from it.`, `${displayProvider(preview.provider!)} n’a plus aucun modèle sur la clé : le fournisseur en est retiré.`)}`}
      {dropped && preview.remove.some(row => row.dropsLimits) && ` ${copy("Its budgets and rate limit are deleted with it.", "Ses budgets et sa limite de débit sont supprimés avec lui.")}`}
      {emptied && ` ${copy("The key will allow no model.", "La clé n’autorisera plus aucun modèle.")}`}
    </p> : <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-3">{preview.blocked.map((reason, index) => <p key={`${index}/${reason}`} className="break-words">{editReason(reason, copy)}</p>)}</div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <section className="min-w-0 rounded-sm border p-3"><h3 className="font-medium">{today}</h3><PermissionLines label={today} permissions={preview.before} /></section>
      {preview.after && <section className="min-w-0 rounded-sm border p-3"><h3 className="font-medium">{afterwards}</h3><PermissionLines label={afterwards} permissions={preview.after} /></section>}
    </div>
    {preview.canApply && preview.remove.length > 0 && <section className="min-w-0 rounded-sm border p-3"><h3 className="font-medium">{removed}</h3><PermissionLines label={removed} lines={preview.remove} /></section>}
  </div>;
}

const titles = (request: NativeEditRequest, copy: Copy) => request.operation === "remove-models"
  ? copy("Remove models from the key in Bifrost", "Retirer des modèles de la clé dans Bifrost")
  : copy("Replace “all providers” on the key", "Remplacer « tous les fournisseurs » sur la clé");

// Preview, explicit confirmation, result. onEdited runs once Bifrost may have changed, so the caller can reload.
export function NativeEditDialog({ keyId, request, onClose, onUnauthorized, onEdited }: { keyId: string; request: NativeEditRequest; onClose: () => void; onUnauthorized: () => void; onEdited: () => void }) {
  const copy = useCopy();
  const [preview, setPreview] = useState<NativeEditPreview | null>(null);
  const [receipt, setReceipt] = useState<NativeEditReceipt | null>(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const report = (cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) { onClose(); onUnauthorized(); return; }
    if (cause instanceof ApiError && cause.status === 409) { setStale(true); setError(copy("The key or the Registry changed since this preview. Refresh the preview before confirming.", "La clé ou Registry a changé depuis cet aperçu. Actualisez l’aperçu avant de confirmer.")); return; }
    setError(cause instanceof Error ? cause.message : copy("Could not change this key in Bifrost.", "Impossible de modifier cette clé dans Bifrost."));
  };
  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    try { setPreview(await previewNativeEdit(keyId, request.operation, request.provider)); setStale(false); setError(""); }
    catch (cause) { report(cause); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); }, [keyId, request.operation, request.provider]);
  const confirm = async () => {
    if (!preview?.canApply || !preview.previewToken || busy || stale) return;
    setBusy(true);
    try { setReceipt(await applyNativeEdit(preview)); setError(""); onEdited(); }
    catch (cause) { report(cause); if (cause instanceof ApiError && cause.status === 502) onEdited(); }
    finally { setBusy(false); }
  };
  const removedCount = preview?.remove.reduce((total, row) => total + row.models.length, 0) ?? 0;
  const confirmLabel = request.operation === "remove-models"
    ? copy(`Confirm: remove ${modelCount(removedCount, copy)}`, `Confirmer : retirer ${modelCount(removedCount, copy)}`)
    : copy("Confirm: replace “all providers”", "Confirmer : remplacer « tous les fournisseurs »");

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-xl overflow-auto"><DialogHeader><DialogTitle>{titles(request, copy)}</DialogTitle><DialogDescription>{receipt ? copy("Bifrost now holds the key as shown below.", "Bifrost détient maintenant la clé telle qu’affichée ci-dessous.") : copy("Review the exact change. Nothing is written to Bifrost until you confirm.", "Vérifiez le changement exact. Rien n’est écrit dans Bifrost avant votre confirmation.")}</DialogDescription></DialogHeader>
    {error && <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
    {receipt ? <div className="space-y-3 text-sm"><p role="status" className="rounded-sm border bg-primary/5 p-3">{request.operation === "remove-models"
        ? copy(`Done. ${modelCount(removedCount, copy)} removed from the key in Bifrost.`, `Terminé. ${modelCount(removedCount, copy)} retiré${removedCount === 1 ? "" : "s"} de la clé dans Bifrost.`)
        : copy("Done. The key no longer allows every provider: it allows the explicit list below.", "Terminé. La clé n’autorise plus tous les fournisseurs : elle autorise la liste explicite ci-dessous.")}</p>
      <section className="rounded-sm border p-3"><h3 className="font-medium">{copy("Allowed now", "Autorisé maintenant")}</h3><PermissionLines label={copy("Allowed now", "Autorisé maintenant")} permissions={receipt.permissions} /></section></div>
    : preview ? <NativeEditPreviewBody preview={preview} />
    : <p className="text-sm text-muted-foreground">{busy ? copy("Loading preview…", "Chargement de l’aperçu…") : copy("Preview unavailable.", "Aperçu indisponible.")}</p>}
    <DialogFooter className="flex-row flex-wrap justify-end gap-2">
      {receipt ? <Button onClick={onClose}>{copy("Back to adoption", "Retour à l’adoption")}</Button> : <>
        {stale && <Button variant="outline" disabled={busy} onClick={() => void refresh()}>{copy("Refresh preview", "Actualiser l’aperçu")}</Button>}
        <Button variant="outline" disabled={busy} onClick={onClose}>{copy("Cancel", "Annuler")}</Button>
        <Button variant="destructive" disabled={busy || stale || !preview?.canApply || !preview.previewToken} onClick={() => void confirm()}>{confirmLabel}</Button></>}
    </DialogFooter>
  </DialogContent></Dialog>;
}
