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
import { Input } from "@/components/ui/input";
import type { Copy } from "../../lib/locale";
import type { useKeyRename } from "./useKeyRename";

export function KeyRenameDialog({
  copyText,
  busy,
  busyRef,
  renameForm,
  setRenameForm,
  saveKeyName,
}: ReturnType<typeof useKeyRename> & { copyText: Copy; busy: string; busyRef: RefObject<boolean> }) {
  return (
    <Dialog open={!!renameForm} onOpenChange={open => !open && !busyRef.current && setRenameForm(null)}>
      <DialogContent inert={!!busy}>
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl">{copyText("Rename virtual key", "Renommer la clé virtuelle")}</DialogTitle>
          <DialogDescription>
            {copyText("Updates the saved key name.", "Met à jour le nom enregistré de la clé.")}
          </DialogDescription>
        </DialogHeader>
        {renameForm && (
          <div>
            <label className="mb-2 block text-sm font-medium">{copyText("Name", "Nom")}</label>
            <Input
              aria-label={copyText("Key name", "Nom de la clé")}
              autoFocus
              value={renameForm.name}
              onChange={e => setRenameForm({ ...renameForm, name: e.target.value })}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setRenameForm(null)}>
            {copyText("Cancel", "Annuler")}
          </Button>
          <Button disabled={!!busy} onClick={saveKeyName}>
            {copyText("Save", "Enregistrer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
