import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "../../data/api";
import { useCopy } from "../../lib/locale";
import { revealKeySecret } from "./key-secret-api";

export default function VirtualKeySecret({ keyId, disabled = false, onUnauthorized }: { keyId: string; disabled?: boolean; onUnauthorized?: () => void }) {
  const copyText = useCopy();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [revealedKeyId, setRevealedKeyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const visibleSecret = revealedKeyId === keyId ? secret : "";

  const clear = () => {
    pending.current?.abort();
    pending.current = null;
    setSecret("");
    setRevealedKeyId("");
    setBusy(false);
    setError("");
  };
  const close = () => { clear(); setOpen(false); };
  useEffect(() => {
    return () => { pending.current?.abort(); };
  }, []);
  useEffect(() => { clear(); setOpen(false); }, [keyId]);

  const reveal = async () => {
    if (busy || !keyId) return;
    clear();
    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    try {
      const result = await revealKeySecret(keyId, request.signal);
      if (request.signal.aborted) return;
      if (!result.secret || /[*•]|^<redacted>$/i.test(result.secret)) throw new Error(copyText("Native virtual key secret is unavailable or masked.", "Le secret de la clé virtuelle native est indisponible ou masqué."));
      setSecret(result.secret);
      setRevealedKeyId(keyId);
    } catch (cause) {
      if (request.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 401 && onUnauthorized) { close(); onUnauthorized(); return; }
      setError(cause instanceof Error ? cause.message : copyText("Could not reveal the native virtual key.", "Impossible de révéler la clé virtuelle native."));
    } finally {
      if (pending.current === request) { pending.current = null; setBusy(false); }
    }
  };
  const copy = async () => {
    if (!visibleSecret) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(visibleSecret);
      setError("");
      toast.success(copyText("Virtual key copied", "Clé virtuelle copiée"));
    } catch {
      input.current?.focus();
      input.current?.select();
      setError(copyText("Clipboard unavailable. The secret is selected; press Ctrl+C or Cmd+C to copy it.", "Presse-papiers indisponible. Le secret est sélectionné; appuyez sur Ctrl+C ou Cmd+C pour le copier."));
    }
  };

  return <>
    <Button type="button" variant="outline" size="sm" disabled={disabled || !keyId} onClick={() => setOpen(true)}>{copyText("Reveal key", "Révéler la clé")}</Button>
    <Dialog open={open} onOpenChange={next => { if (!next) close(); }}><DialogContent><DialogHeader><DialogTitle>{copyText("Reveal virtual key", "Révéler la clé virtuelle")}</DialogTitle><DialogDescription>{copyText("Only reveal this native Bifrost secret when you need to copy it. It clears when this dialog closes.", "Révélez ce secret Bifrost natif uniquement pour le copier. Il est effacé à la fermeture de cette boîte de dialogue.")}</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {visibleSecret && <Input ref={input} aria-label={copyText("Virtual key secret", "Secret de la clé virtuelle")} readOnly value={visibleSecret} autoComplete="off" spellCheck={false} className="font-mono text-xs" />}
      <DialogFooter><Button type="button" variant="outline" onClick={close}>{copyText("Close", "Fermer")}</Button>{visibleSecret ? <Button type="button" onClick={() => void copy()}>{copyText("Copy secret", "Copier le secret")}</Button> : <Button type="button" disabled={busy} onClick={() => void reveal()}>{busy ? copyText("Revealing…", "Révélation…") : copyText("Reveal secret", "Révéler le secret")}</Button>}</DialogFooter>
    </DialogContent></Dialog>
  </>;
}
