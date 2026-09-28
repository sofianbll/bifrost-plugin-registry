import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCopy } from "../../lib/locale";
import type { KeyFormDraft } from "./key-form";

type Props = { draft: KeyFormDraft; error: string; onChange: (draft: KeyFormDraft) => void };

export function KeyCreateForm({ draft, error, onChange }: Props) {
  const copy = useCopy();
  return <div className="space-y-4">
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor="key-name">{copy("Name", "Nom")} *</FieldLabel>
      <Input id="key-name" aria-label={copy("Key name", "Nom de la clé")} aria-required="true" aria-invalid={!!error} autoFocus value={draft.name} onChange={event => onChange({ ...draft, name: event.target.value })} placeholder={copy("e.g. Hermes staging", "ex. Hermes staging")} />
      <FieldDescription className={error ? "text-destructive" : undefined}>{error || copy("Required", "Obligatoire")}</FieldDescription>
    </Field>
    <Field>
      <FieldLabel htmlFor="key-client">{copy("Client", "Client")}</FieldLabel>
      <Input id="key-client" aria-label={copy("Client name", "Nom du client")} value={draft.client} onChange={event => onChange({ ...draft, client: event.target.value })} placeholder={copy("e.g. Hermes", "ex. Hermes")} />
    </Field>
  </div>;
}

export default KeyCreateForm;
