export type KeyFormDraft = { name: string; client: string };

export type KeyFormMessages = { required: string; duplicate: string };

export function keyFormState(draft: KeyFormDraft | null, keys: { name: string }[], messages: KeyFormMessages) {
  const name = draft?.name.trim() ?? "";
  if (!draft) return { name, error: "", canSubmit: false };
  const duplicate = keys.some(key => key.name.trim().toLowerCase() === name.toLowerCase());
  const error = !name ? messages.required : duplicate ? messages.duplicate : "";
  return { name, error, canSubmit: !error };
}
