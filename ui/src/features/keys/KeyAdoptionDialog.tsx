import type { RefObject } from "react";
import { toast } from "sonner";
import { ApiError, getWorkspace, type AdoptionOperation, type Workspace } from "../../data/api";
import { copy, emptyModelFilters, same, type Key, type Policy } from "../../domain/registry";
import type { Copy } from "../../lib/locale";
import { setSessionState } from "../../lib/session-state";
import { modelFiltersKey } from "../catalog/ModelBrowser";
import type { Page } from "../navigation/navigation";
import AdoptionDialog from "./AdoptionDialog";
import { preserveAdoptionDraft } from "./KeyComposer.state";

export function KeyAdoptionDialog({
  adoption,
  setAdoption,
  currentKey: key,
  draft,
  pendingKeyDraft,
  setModelScope,
  navigate,
  snapshotMode,
  copyText,
  applyWorkspace,
  setDraft,
  requireLogin,
  setApiError,
}: {
  adoption: { keyId: string; operation: AdoptionOperation };
  setAdoption: (adoption: null) => void;
  currentKey: Key | undefined;
  draft: Policy | null;
  pendingKeyDraft: RefObject<{ keyId: string; policy: Policy } | null>;
  setModelScope: (scope: "registry" | "to-add") => void;
  navigate: (page: Page, id?: string) => void;
  snapshotMode: boolean;
  copyText: Copy;
  applyWorkspace: (workspace: Workspace) => void;
  setDraft: (draft: Policy | null) => void;
  requireLogin: () => void;
  setApiError: (error: string) => void;
}) {
  return (
    <AdoptionDialog
      key={`${adoption.keyId}/${adoption.operation}`}
      keyId={adoption.keyId}
      operation={adoption.operation}
      onClose={() => setAdoption(null)}
      onUnauthorized={requireLogin}
      onShowToAdd={routes => {
        if (key && draft) pendingKeyDraft.current = { keyId: key.id, policy: draft };
        setAdoption(null);
        // To add, filtered on the blocking models only (the browser reads this state when it mounts).
        setSessionState(modelFiltersKey("models.to-add"), { ...emptyModelFilters, routes: routes.join("\n") });
        setModelScope("to-add");
        navigate("models");
      }}
      onApplied={receipt => {
        const stagedDraft = key?.id === receipt.keyId && draft && !same(key.policy, draft) ? draft : null;
        toast.success(
          snapshotMode
            ? copyText(
                "Key prepared in the local copy. Pulsar is unchanged.",
                "Clé préparée dans la copie locale. Pulsar reste inchangé.",
              )
            : adoption.operation === "adopt"
              ? copyText("Native key adopted.", "Clé native adoptée.")
              : copyText("Key binding updated.", "Association de clé mise à jour."),
        );
        void getWorkspace()
          .then(workspace => {
            applyWorkspace(workspace);
            const adopted = workspace.data.keys.find(item => item.id === receipt.keyId);
            setDraft(
              adopted
                ? stagedDraft
                  ? preserveAdoptionDraft(copy(adopted.policy), stagedDraft)
                  : copy(adopted.policy)
                : stagedDraft,
            );
          })
          .catch(error => {
            if (error instanceof ApiError && error.status === 401) requireLogin();
            else
              setApiError(
                error instanceof Error
                  ? error.message
                  : copyText("Could not refresh the key selection.", "Impossible d’actualiser la sélection de la clé."),
              );
          });
      }}
      onNativeEdited={() =>
        void getWorkspace()
          .then(applyWorkspace)
          .catch(error => {
            if (error instanceof ApiError && error.status === 401) requireLogin();
          })
      }
    />
  );
}
