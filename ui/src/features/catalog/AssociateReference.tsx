import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { knownValue, type Model } from "../../domain/registry";
import { useCopy, useCreatorName } from "../../lib/locale";
import type { CatalogRecord } from "./catalog-api";

const shown = 20;
const nameOf = (reference: CatalogRecord) => knownValue(reference.fields.name?.value) || reference.id;
const textOf = (reference: CatalogRecord) =>
  [reference.id, reference.fields.name?.value, reference.fields.creator?.value, reference.fields.family?.value]
    .filter(value => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase();

// References holding every word of the query (in their ID, name, creator or family), by name.
export function referenceMatches(references: CatalogRecord[], query: string) {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return references
    .filter(reference => words.every(word => textOf(reference).includes(word)))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
}

// The correspondence is saved with the card: each of its accesses points at the reference.
export const associateReference = (model: Model, referenceId: string): Model => ({
  ...model,
  accesses: model.accesses.map(access => ({ ...access, referenceId })),
});

// Mounted per card (keyed), so the search starts from that card's native name each time.
export function AssociateReferenceDialog({
  model,
  references,
  onAssociate,
  onClose,
}: {
  model: Model;
  references: CatalogRecord[];
  onAssociate: (model: Model, referenceId: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const copy = useCopy();
  const creatorName = useCreatorName();
  const [query, setQuery] = useState(model.accesses[0]?.nativeModel || model.id);
  const [saving, setSaving] = useState(false);
  const matches = referenceMatches(references, query);
  const choose = async (reference: CatalogRecord) => {
    setSaving(true);
    if (await onAssociate(model, reference.id)) onClose();
    else setSaving(false);
  };
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy("Associate a datasheet", "Associer une fiche documentaire")}</DialogTitle>
          <DialogDescription>
            {copy(
              "Choose the reference that describes this model. Its facts fill the card, and every access of the card is linked to it.",
              "Choisissez la fiche documentaire qui décrit ce modèle. Ses données remplissent la fiche, et chaque accès de la fiche y est associé.",
            )}
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label={copy("Search datasheets", "Rechercher des fiches documentaires")}
          placeholder={copy("Name, ID or creator", "Nom, identifiant ou créateur")}
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <ul aria-label={copy("Datasheets", "Fiches documentaires")} className="max-h-72 space-y-1.5 overflow-y-auto">
          {matches.slice(0, shown).map(reference => (
            <li key={reference.id}>
              <Button
                variant="outline"
                className="h-auto w-full flex-col items-start gap-0.5 whitespace-normal py-2 text-left"
                disabled={saving}
                onClick={() => void choose(reference)}
              >
                <span className="font-semibold">{nameOf(reference)}</span>
                <span className="break-all font-mono text-xs font-normal text-muted-foreground">{reference.id}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {creatorName(reference.fields.creator?.value)}
                </span>
              </Button>
            </li>
          ))}
        </ul>
        <p role="status" className="text-xs text-muted-foreground">
          {!matches.length
            ? copy(
                "No datasheet matches. Try fewer words.",
                "Aucune fiche documentaire ne correspond. Essayez moins de mots.",
              )
            : matches.length > shown
              ? copy(
                  `${shown} of ${matches.length} shown. Refine the search.`,
                  `${shown} affichées sur ${matches.length}. Affinez la recherche.`,
                )
              : ""}
        </p>
      </DialogContent>
    </Dialog>
  );
}
