import { ModelModalitiesSummary } from "./history/2026-09-27-text-capabilities-summary";
import { fixtureModels } from "@/experiments/key-composer-prototype/state";
import { previousCapabilityEntries } from "./previous-capabilities";
import type { GalleryEntry } from "./types";

const model = fixtureModels[0];
const previousInline = previousCapabilityEntries.find(entry => entry.id === "previous-modalities-inline")!;
const previousStacked = previousCapabilityEntries.find(entry => entry.id === "previous-modalities-stacked")!;

function ChoiceFrame({ title, source, children }: { title: string; source: string; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-sm border p-3">
    <h3 className="text-sm font-semibold">{title}</h3>
    <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{source}</p>
    <div className="mt-3 min-h-12 rounded-sm bg-muted/30 p-2">{children}</div>
  </section>;
}

function ModalityChoice() {
  const PreviousInline = previousInline.Component;
  const PreviousStacked = previousStacked.Component;
  return <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
    <ChoiceFrame title="A · Icônes entrée → sortie · retenu" source={previousInline.source}>
      <PreviousInline />
    </ChoiceFrame>
    <ChoiceFrame title="B · Icônes empilées" source={previousStacked.source}>
      <PreviousStacked />
    </ChoiceFrame>
    <ChoiceFrame title="C · Texte et icônes" source="ui/src/dev/component-gallery/history/2026-09-27-text-capabilities-summary.tsx">
      <ModelModalitiesSummary model={model} />
    </ChoiceFrame>
  </div>;
}

export const modalityChoiceEntries: GalleryEntry[] = [{
  id: "modality-choice-summary",
  title: "Modalités · choisir le résumé",
  family: "Capacités et modalités",
  level: "Molécules",
  origin: "Registry · comparaison locale",
  version: "A retenu · affichage facultatif",
  source: "ui/src/dev/component-gallery/modality-choice.tsx",
  description: "Comparer trois résumés de modalités avec les mêmes modalités de référence synthétiques. A est retenu, avec visibilité indépendante dans les options d’affichage. B et C restent des références historiques.",
  Component: ModalityChoice,
}];
