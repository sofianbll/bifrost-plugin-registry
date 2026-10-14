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
import type { useCreatedKeySecret } from "./useCreatedKeySecret";

export function CreatedKeySecretDialog({
  copyText,
  createdSecret,
  setCreatedSecret,
  createdSecretError,
  setCreatedSecretError,
  createdSecretInput,
  copyCreatedSecret,
}: ReturnType<typeof useCreatedKeySecret> & { copyText: Copy }) {
  return (
    <Dialog
      open={!!createdSecret}
      onOpenChange={open => {
        if (!open) {
          setCreatedSecret("");
          setCreatedSecretError("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copyText("Copy the virtual key secret", "Copier le secret de la clé virtuelle")}</DialogTitle>
          <DialogDescription>
            {copyText(
              "This native Bifrost secret is shown once. Store it before closing.",
              "Ce secret Bifrost natif ne s’affiche qu’une fois. Enregistrez-le avant de fermer.",
            )}
          </DialogDescription>
        </DialogHeader>
        <Input
          ref={createdSecretInput}
          readOnly
          value={createdSecret}
          aria-label={copyText("Virtual key secret", "Secret de la clé virtuelle")}
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-xs"
        />
        {createdSecretError && (
          <p role="alert" className="text-sm text-destructive">
            {createdSecretError}
          </p>
        )}
        <DialogFooter>
          <Button onClick={() => void copyCreatedSecret()}>{copyText("Copy secret", "Copier le secret")}</Button>
          <Button
            variant="outline"
            onClick={() => {
              setCreatedSecret("");
              setCreatedSecretError("");
            }}
          >
            {copyText("Done", "Terminé")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
