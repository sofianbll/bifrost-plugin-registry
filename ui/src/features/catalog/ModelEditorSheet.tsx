import { Sheet } from "@/components/ui/sheet";
import type { Demo, Model, PricingProof } from "../../domain/registry";
import type { Copy } from "../../lib/locale";
import AssistantSuggestion from "../assistant/AssistantSuggestion";
import type { Page } from "../navigation/navigation";
import type { Confirm } from "../shared/useConfirmation";
import type { Catalog } from "./catalog-api";
import ModelEditor from "./ModelEditor";
import type { useModelEditing } from "./useModelEditing";

export function ModelEditorSheet({
  modelDraft,
  setModelDraft,
  modelTab,
  setModelOverrides,
  creatingModel,
  modelError,
  closeModel,
  updateModel,
  deleteModel,
  discardModelEdits,
  data,
  copyText,
  snapshotMode,
  busy,
  effectiveExpert,
  catalog,
  referenceCatalog,
  referenceError,
  pricingProofs,
  setConfirm,
  go,
}: Pick<
  ReturnType<typeof useModelEditing>,
  | "modelDraft"
  | "setModelDraft"
  | "modelTab"
  | "setModelOverrides"
  | "creatingModel"
  | "modelError"
  | "closeModel"
  | "updateModel"
  | "deleteModel"
  | "discardModelEdits"
> & {
  data: Demo;
  copyText: Copy;
  snapshotMode: boolean;
  busy: string;
  effectiveExpert: boolean;
  catalog: Model[];
  referenceCatalog: Catalog | null;
  referenceError: string;
  pricingProofs: PricingProof[];
  setConfirm: (confirm: Confirm) => void;
  go: (page: Page, id?: string) => void;
}) {
  return (
    <Sheet
      open={!!modelDraft}
      onOpenChange={open => {
        if (!open) closeModel();
      }}
    >
      {modelDraft && (
        <ModelEditor
          initialTab={modelTab}
          expert={effectiveExpert}
          snapshotMode={snapshotMode}
          saved={data.models}
          draft={modelDraft}
          onOverridesChange={setModelOverrides}
          onChange={setModelDraft}
          creating={creatingModel}
          workspace={catalog}
          catalog={referenceCatalog}
          catalogError={referenceError}
          pricingProofs={pricingProofs}
          error={modelError}
          busy={!!busy}
          onSave={updateModel}
          onCancel={closeModel}
          onDelete={deleteModel}
          onDiscardEdits={discardModelEdits}
          actionSlot={
            snapshotMode ? undefined : (
              <AssistantSuggestion
                draft={modelDraft}
                onChange={setModelDraft}
                onOpenSettings={() =>
                  setConfirm({
                    title: copyText("Open AI settings?", "Ouvrir les réglages IA ?"),
                    text: copyText(
                      "This closes the model editor and discards its unsaved changes.",
                      "Les modifications non enregistrées de la fiche seront abandonnées.",
                    ),
                    confirmLabel: copyText("Open settings", "Ouvrir les réglages"),
                    cancelLabel: copyText("Keep editing", "Continuer à modifier"),
                    action: () => {
                      setModelDraft(null);
                      go("settings");
                    },
                  })
                }
              />
            )
          }
        />
      )}
    </Sheet>
  );
}
