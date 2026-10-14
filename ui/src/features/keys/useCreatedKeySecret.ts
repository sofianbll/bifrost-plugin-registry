import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Copy } from "../../lib/locale";

export function useCreatedKeySecret(copyText: Copy) {
  const [createdSecret, setCreatedSecret] = useState("");
  const [createdSecretError, setCreatedSecretError] = useState("");
  const createdSecretInput = useRef<HTMLInputElement>(null);
  const copyCreatedSecret = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(createdSecret);
      setCreatedSecretError("");
      toast.success(copyText("Secret copied.", "Secret copié."));
    } catch {
      createdSecretInput.current?.focus();
      createdSecretInput.current?.select();
      setCreatedSecretError(
        copyText(
          "Clipboard unavailable. The secret is selected; press Ctrl+C or Cmd+C to copy it.",
          "Presse-papiers indisponible. Le secret est sélectionné ; appuyez sur Ctrl+C ou Cmd+C pour le copier.",
        ),
      );
    }
  };

  return {
    createdSecret,
    setCreatedSecret,
    createdSecretError,
    setCreatedSecretError,
    createdSecretInput,
    copyCreatedSecret,
  };
}
