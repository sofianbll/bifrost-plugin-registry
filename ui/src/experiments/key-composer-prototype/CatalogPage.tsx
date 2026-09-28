// Synthetic, read-only model catalog. Selection belongs to the key composer.
import { Badge } from "@/components/ui/badge";
import { ComposerBrowser } from "./browser";
import { useCopy } from "../../lib/locale";
import type { ProtoModel } from "./state";

export default function CatalogPage({ models, onOpenModel }: { models: ProtoModel[]; onOpenModel: (modelId: string) => void }) {
  const copy = useCopy();
  return <div className="flex min-w-0 flex-col gap-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="text-2xl font-semibold tracking-tight">{copy("Model catalog", "Catalogue de modèles")}</h2><p className="text-sm text-muted-foreground">{copy("Explore reference models and their available provider accesses.", "Explorez les modèles de référence et leurs accès fournisseurs disponibles.")}</p></div>
      <Badge variant="outline">{copy("Synthetic data", "Données fictives")}</Badge>
    </div>
    <ComposerBrowser mode="catalog" models={models} onOpenModel={onOpenModel} />
  </div>;
}
