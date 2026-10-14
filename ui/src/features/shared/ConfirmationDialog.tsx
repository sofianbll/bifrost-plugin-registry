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
import type { Confirm } from "./useConfirmation";

export function ConfirmationDialog({
  confirm,
  busy,
  copyText,
  onClose,
}: {
  confirm: Confirm;
  busy: string;
  copyText: Copy;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!confirm} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl">{confirm?.title}</DialogTitle>
          <DialogDescription>{confirm?.text}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {confirm?.cancelLabel || copyText("Cancel", "Annuler")}
          </Button>
          <Button
            variant="destructive"
            disabled={!!busy}
            onClick={() => {
              confirm?.action();
              onClose();
            }}
          >
            {confirm?.confirmLabel || copyText("Delete", "Supprimer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
