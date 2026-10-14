import { useState } from "react";

export type Confirm = {
  title: string;
  text: string;
  action: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
} | null;

export function useConfirmation() {
  const [confirm, setConfirm] = useState<Confirm>(null);
  return { confirm, setConfirm };
}
