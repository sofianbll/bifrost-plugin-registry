import { useState } from "react";
import { toast } from "sonner";
import type { Demo } from "../../domain/registry";
import type { Copy } from "../../lib/locale";

export function useKeyRename(data: Demo, copyText: Copy, commit: (next: Demo, label: string) => Promise<boolean>) {
  const [renameForm, setRenameForm] = useState<{ id: string; name: string } | null>(null);
  const saveKeyName = () => {
    if (
      !renameForm?.name.trim() ||
      data.keys.some(k => k.id !== renameForm.id && k.name.toLowerCase() === renameForm.name.trim().toLowerCase())
    ) {
      toast.error(copyText("Name is empty or already used.", "Le nom est vide ou déjà utilisé."));
      return;
    }
    const form = renameForm;
    void (async () => {
      if (
        await commit(
          {
            ...data,
            keys: data.keys.map(k => (k.id === form.id ? { ...k, name: form.name.trim() } : k)),
          },
          copyText("Renaming key…", "Renommage de la clé…"),
        )
      )
        setRenameForm(null);
    })();
  };

  return { renameForm, setRenameForm, saveKeyName };
}
