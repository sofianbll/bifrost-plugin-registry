import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ApiError,
  applyKeyAdoption,
  previewKeyAdoption,
  type AdoptionOperation,
  type AdoptionPreview,
  type AdoptionReceipt,
} from "../../data/api";
import { useCopy, useFormat } from "../../lib/locale";
import { AdoptionBlockers } from "./AdoptionBlockers";
import { NativeEditDialog, type NativeEditRequest } from "./NativePermissionEdit";
import { KeptProviders } from "./KeptNative";
import { adoptionProgress, disabledProviders } from "./key-readiness";

// onShowToAdd: called with the provider/native routes of the unsaved models blocking the key.
// onNativeEdited: called once the key was edited in Bifrost (#93), so the caller reloads its workspace.
// Spec #85: the dialog opens on the decisions left (AdoptionBlockers), then what is kept in Bifrost; the accesses
// Registry will manage wait behind a disclosure. One scroll container (the dialog), so a phone sees the decisions first.
export default function AdoptionDialog({
  keyId,
  operation,
  onClose,
  onUnauthorized,
  onApplied,
  onShowToAdd,
  onNativeEdited,
}: {
  keyId: string;
  operation: AdoptionOperation;
  onClose: () => void;
  onUnauthorized: () => void;
  onApplied: (receipt: AdoptionReceipt) => void;
  onShowToAdd?: (routes: string[]) => void;
  onNativeEdited?: () => void;
}) {
  const copyText = useCopy();
  const { colon } = useFormat();
  const [preview, setPreview] = useState<AdoptionPreview | null>(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nativeEdit, setNativeEdit] = useState<NativeEditRequest | null>(null);
  // Providers kept in Bifrost (#92): the preview and the apply are made for the same choice, so the list
  // only changes together with the preview it belongs to.
  const [kept, setKept] = useState<string[]>([]);
  // Native edits made from this dialog: their rows count as decided once they leave the list.
  const [edited, setEdited] = useState<string[]>([]);
  // A provider Bifrost reports as disabled is kept in Bifrost on the first preview only, so "Stop keeping" sticks.
  const preselected = useRef(false);
  const snapshot = preview?.evidence === "snapshot";
  const title = snapshot
    ? copyText("Prepare local selection", "Préparer la sélection locale")
    : operation === "adopt"
      ? copyText("Adopt this key", "Adopter cette clé")
      : copyText("Reassociate Bifrost key", "Réassocier la clé Bifrost");
  const confirm = snapshot ? title : operation === "adopt" ? copyText("Adopt", "Adopter") : title;

  const report = (cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) {
      onClose();
      onUnauthorized();
      return;
    }
    if (cause instanceof ApiError && cause.status === 409) {
      setStale(true);
      setError(
        copyText(
          "The Registry catalog changed. Refresh the preview before continuing.",
          "Le catalogue Registry a changé. Actualisez l’aperçu avant de continuer.",
        ),
      );
      return;
    }
    setError(
      cause instanceof Error
        ? cause.message
        : copyText("Could not associate this key.", "Impossible d’associer cette clé."),
    );
  };
  const refresh = async (keep = kept) => {
    if (busy) return;
    setBusy(true);
    try {
      let next = await previewKeyAdoption(keyId, operation, keep);
      const disabled = operation === "adopt" && !preselected.current ? disabledProviders(next.readiness) : [];
      preselected.current = true;
      if (disabled.length) {
        keep = [...keep, ...disabled];
        next = await previewKeyAdoption(keyId, operation, keep);
      }
      setPreview(next);
      setKept(keep);
      setStale(false);
      setError("");
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, [keyId, operation]);
  const keep = (provider: string, on: boolean) =>
    void refresh(on ? [...kept.filter(name => name !== provider), provider] : kept.filter(name => name !== provider));
  const apply = async () => {
    if (!preview?.canApply || !preview.previewToken || busy || stale) return;
    setBusy(true);
    try {
      onApplied(await applyKeyAdoption(preview, kept));
      onClose();
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };
  const progress = adoptionProgress(preview?.readiness, kept, edited);
  const routes = (ids: string[]) => (
    <ul className="mt-2 space-y-1">
      {ids.map(id => (
        <li key={id} className="break-all font-mono text-xs">
          {id}
        </li>
      ))}
    </ul>
  );

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-xl scroll-pb-32 overflow-auto pb-0">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {operation === "adopt"
              ? copyText(
                  "Registry takes over the choice of models for this key. Adopting changes nothing in Bifrost: the key keeps its permissions there.",
                  "Registry prend en charge le choix des modèles de cette clé. Adopter ne change rien dans Bifrost : la clé y garde ses permissions.",
                )
              : copyText(
                  "Review the selected models and Bifrost permissions before confirming.",
                  "Vérifiez les modèles retenus et les permissions Bifrost avant de confirmer.",
                )}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {error}
          </p>
        )}
        {preview ? (
          <div className="space-y-3 text-sm">
            {snapshot && (
              <p className="rounded-sm border bg-primary/5 p-3">
                {copyText(
                  `Preview calculated from the ${preview.source} snapshot. This action prepares the selection in the local copy; it does not modify the key on Pulsar.`,
                  `Aperçu calculé depuis la capture de ${preview.source}. Cette action prépare la sélection dans la copie locale ; elle ne modifie pas la clé sur Pulsar.`,
                )}
              </p>
            )}
            {preview.canApply && (
              <Badge variant="success">
                {operation === "adopt"
                  ? copyText("Ready to adopt", "Prête à adopter")
                  : copyText("Ready to apply", "Prêt à appliquer")}
              </Badge>
            )}
            {preview.blocked.length > 0 && (
              <AdoptionBlockers
                readiness={preview.readiness}
                reasons={preview.blocked}
                onShowToAdd={onShowToAdd}
                onKeep={operation === "adopt" ? keep : undefined}
                onEditNative={operation === "adopt" && !snapshot ? setNativeEdit : undefined}
              />
            )}
            <KeptProviders readiness={preview.readiness} kept={kept} onKeep={keep} />
            {preview.selectedRoutes.length > 0 ? (
              <details className="rounded-sm border p-3">
                <summary className="cursor-pointer font-medium">
                  {copyText(
                    `Accesses Registry will manage (${preview.selectedRoutes.length})`,
                    `Accès que Registry gérera (${preview.selectedRoutes.length})`,
                  )}
                </summary>
                {routes(preview.selectedRoutes)}
                {preview.nativeRoutes.length > 0 && (
                  <>
                    <p className="mt-3 font-medium">
                      {snapshot
                        ? copyText(
                            `Snapshot accesses (${preview.nativeRoutes.length})`,
                            `Accès de la capture (${preview.nativeRoutes.length})`,
                          )
                        : copyText(
                            `Bifrost lists today (${preview.nativeRoutes.length})`,
                            `Bifrost liste aujourd’hui (${preview.nativeRoutes.length})`,
                          )}
                    </p>
                    {routes(preview.nativeRoutes)}
                  </>
                )}
              </details>
            ) : (
              !preview.blocked.length && (
                <p className="text-xs text-muted-foreground">
                  {copyText("No access selected.", "Aucun accès sélectionné.")}
                </p>
              )
            )}
            {!preview.previewToken && preview.canApply && (
              <p className="text-xs text-destructive">
                {copyText(
                  "Confirmation is unavailable. Refresh the preview.",
                  "La confirmation est indisponible. Actualisez l’aperçu.",
                )}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {stale && (
                <p role="status" className="text-xs text-destructive">
                  {copyText("This preview is out of date.", "Cet aperçu n’est plus à jour.")}
                </p>
              )}
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void refresh()}>
                {copyText("Refresh preview", "Actualiser l’aperçu")}
              </Button>
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                {copyText("Technical identifiers", "Identifiants techniques")}
              </summary>
              <p className="mt-1 break-all">
                {copyText("Key", "Clé")}
                {colon} <code>{keyId}</code>
              </p>
              <p className="break-all">
                {copyText("Registry revision", "Révision Registry")}
                {colon} <code>{preview.revision}</code>
              </p>
            </details>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {busy
              ? copyText("Loading preview…", "Chargement de l’aperçu…")
              : copyText("Preview unavailable.", "Aperçu indisponible.")}
          </p>
        )}
        {/* Sticky, so Cancel and Adopt stay in reach on a phone while the decisions scroll (the dialog is the one scroll container). */}
        <DialogFooter className="sticky bottom-0 -mx-6 flex-row flex-wrap items-center justify-end gap-2 border-t bg-white px-6 py-3 dark:bg-card">
          {progress.total > 0 && (
            <p className="w-full text-xs text-muted-foreground sm:mr-auto sm:w-auto">
              {copyText(
                `${progress.decided} of ${progress.total} decided`,
                `${progress.decided} sur ${progress.total} ${progress.total > 1 ? "décidées" : "décidée"}`,
              )}
            </p>
          )}
          <Button variant="outline" className="flex-1 sm:flex-none" disabled={busy} onClick={onClose}>
            {copyText("Cancel", "Annuler")}
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            disabled={busy || stale || !preview?.canApply || !preview.previewToken}
            onClick={() => void apply()}
          >
            {confirm}
          </Button>
        </DialogFooter>
        {nativeEdit && (
          <NativeEditDialog
            keyId={keyId}
            request={nativeEdit}
            onClose={() => setNativeEdit(null)}
            onUnauthorized={onUnauthorized}
            onEdited={() => {
              setEdited(done => [...done, nativeEdit.provider]);
              void refresh();
              onNativeEdited?.();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
