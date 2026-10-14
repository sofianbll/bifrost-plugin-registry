import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Copy } from "../../lib/locale";
import { KeyCreateForm } from "./KeyCreateForm";
import type { useKeyCreation } from "./useKeyCreation";

export function KeyCreateDialog({
  copyText,
  busy,
  busyRef,
  keyForm,
  setKeyForm,
  keyFormFields,
  saveKey,
}: ReturnType<typeof useKeyCreation> & { copyText: Copy; busy: string; busyRef: RefObject<boolean> }) {
  return (
    <Dialog open={!!keyForm} onOpenChange={open => !open && !busyRef.current && setKeyForm(null)}>
      <DialogContent inert={!!busy}>
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl">{copyText("Create virtual key", "Créer une clé virtuelle")}</DialogTitle>
          <DialogDescription>
            {copyText(
              "A native Bifrost virtual key will be created. Its secret is shown once.",
              "Une clé virtuelle Bifrost native sera créée. Son secret ne s’affichera qu’une fois.",
            )}
          </DialogDescription>
        </DialogHeader>
        {keyForm && <KeyCreateForm draft={keyForm} error={keyFormFields.error} onChange={setKeyForm} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => setKeyForm(null)}>
            {copyText("Cancel", "Annuler")}
          </Button>
          <Button disabled={!!busy || !keyFormFields.canSubmit} onClick={saveKey}>
            {copyText("Create key", "Créer la clé")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
