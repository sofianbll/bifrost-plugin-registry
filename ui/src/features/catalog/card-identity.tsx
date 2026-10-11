import { Badge } from "@/components/ui/badge";
import type { Model } from "../../domain/registry";
import { useCopy } from "../../lib/locale";

export const hasReference = (model: Model) => model.accesses.some(access => access.referenceId);
// No modality and no known capability: what a reference would fill in.
export const factsUnknown = (model: Pick<Model, "inputModalities" | "outputModalities" | "capabilities">) =>
  !model.inputModalities.length && !model.outputModalities.length && Object.values(model.capabilities).every(state => state === "Unknown");

// Marks a creator the panel guessed from the card's provider; a manual or reference creator has none.
export function InferredMark({ model }: { model: Pick<Model, "creatorSource"> }) {
  const copy = useCopy();
  return model.creatorSource === "inferred" ? <Badge variant="outline" className="ml-1.5 align-middle" title={copy("Guessed from the model name or the provider serving it. Edit the card to correct or clear it.", "Déduit du nom du modèle ou du fournisseur qui le sert. Modifiez la fiche pour le corriger ou l’effacer.")}>{copy("inferred", "déduit")}</Badge> : null;
}

// What an empty fact row says: a card without reference is told what to do.
export function FactsUnknown({ associate }: { associate: boolean }) {
  const copy = useCopy();
  return <p className="text-xs text-muted-foreground">{associate ? copy("Facts unknown — associate a reference", "Données inconnues — associer une fiche documentaire") : copy("Facts unknown", "Données inconnues")}</p>;
}
