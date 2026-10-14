import { useState } from "react";
import { toast } from "sonner";
import { ApiError, createKey, getWorkspace, type Workspace } from "../../data/api";
import type { Key } from "../../domain/registry";
import type { Copy } from "../../lib/locale";
import { keyFormState, type KeyFormDraft, type KeyFormMessages } from "./key-form";

export function useKeyCreation(
  copyText: Copy,
  keys: Key[],
  keyNameMessages: KeyFormMessages,
  operation: (label: string, work: () => Promise<void>) => Promise<boolean>,
  setCreatedSecret: (secret: string) => void,
  setCreatedSecretError: (error: string) => void,
  applyWorkspace: (workspace: Workspace) => void,
  navigate: (page: "keys", id?: string) => void,
) {
  const [keyForm, setKeyForm] = useState<KeyFormDraft | null>(null);
  const keyFormFields = keyFormState(keyForm, keys, keyNameMessages);

  const saveKey = async () => {
    const form = keyForm;
    if (!form || !keyFormState(form, keys, keyNameMessages).canSubmit) return;
    await operation(copyText("Creating native key…", "Création de la clé native…"), async () => {
      const result = await createKey(form.name.trim(), form.client.trim());
      setCreatedSecretError("");
      setCreatedSecret(result.created.secret);
      setKeyForm(null);
      navigate("keys", result.created.id);
      if (result.workspace) applyWorkspace(result.workspace);
      else {
        try {
          applyWorkspace(await getWorkspace());
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) throw error;
          throw new Error(
            copyText(
              `Native key created, but workspace refresh failed: ${result.refreshError || "connection unavailable"}. Copy the displayed secret and reload later.`,
              `Clé native créée, mais l’actualisation de l’espace a échoué : ${result.refreshError || "connexion indisponible"}. Copiez le secret affiché et rechargez plus tard.`,
            ),
          );
        }
      }
      if (result.managed === false || result.bindingError)
        throw new Error(
          copyText(
            `${result.bindingError || "Registry binding failed"}. Native key is unmanaged; copy its secret and reconcile before using it.`,
            `${result.bindingError || "L’association Registry a échoué"}. La clé native n’est pas gérée ; copiez son secret et réconciliez avant de l’utiliser.`,
          ),
        );
      toast.success(
        copyText(
          "Native virtual key created. Copy its secret now.",
          "Clé virtuelle native créée. Copiez son secret maintenant.",
        ),
      );
    });
  };

  return { keyForm, setKeyForm, keyFormFields, saveKey };
}
