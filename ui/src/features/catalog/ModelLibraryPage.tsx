import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import type { ViewOptions } from "../../components/registry/ViewOptions";
import type { Model } from "../../domain/registry";
import type { Copy } from "../../lib/locale";
import type { Page } from "../navigation/navigation";
import type { Catalog } from "./catalog-api";
import ReferenceCatalogBrowser from "./ReferenceCatalogBrowser";

export function ModelLibraryPage({
  copyText,
  modelScope,
  setModelScope,
  scopeLabels,
  effectiveExpert,
  registeredModels,
  toAdd,
  catalog,
  referenceCatalog,
  referenceError,
  loadReferenceCatalog,
  registeredIds,
  preferences,
  setPreferences,
  openModel,
  newModel,
  setCatalogFocus,
  go,
  associateModel,
}: {
  copyText: Copy;
  modelScope: "registry" | "to-add";
  setModelScope: (scope: "registry" | "to-add") => void;
  scopeLabels: { registry: string; toAdd: string };
  effectiveExpert: boolean;
  registeredModels: Model[];
  toAdd: Model[];
  catalog: Model[];
  referenceCatalog: Catalog | null;
  referenceError: string;
  loadReferenceCatalog: () => Promise<boolean>;
  registeredIds: ReadonlySet<string>;
  preferences: ViewOptions;
  setPreferences: (preferences: ViewOptions) => void;
  openModel: (model: Model, creating: boolean, tab?: "access") => void;
  newModel: () => Model;
  setCatalogFocus: (focus: { target: "reference" | "access"; id: string }) => void;
  go: (page: Page, id?: string) => void;
  associateModel: (model: Model, referenceId: string) => Promise<boolean>;
}) {
  return (
    <>
      <div className="mb-4">
        {/* The scope switch sits on the title row: the description under it changes length with the scope
            and must not move the control the person just clicked. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copyText("My models", "Mes modèles")}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              className="bg-card"
              value={modelScope}
              onValueChange={value => value && setModelScope(value as typeof modelScope)}
              aria-label={copyText("Model scope", "Portée des modèles")}
            >
              <ToggleGroupItem value="registry">{scopeLabels.registry}</ToggleGroupItem>
              <ToggleGroupItem value="to-add">{scopeLabels.toAdd}</ToggleGroupItem>
            </ToggleGroup>
            {modelScope === "registry" && (
              <Button onClick={() => setModelScope("to-add")}>
                <Plus className="size-4" />
                {copyText("Register a model", "Enregistrer un modèle")}
              </Button>
            )}
          </div>
        </div>
        <p className="mt-1 max-w-prose text-sm text-foreground/70">
          {modelScope === "registry" ? (
            copyText(
              "Model cards saved in Registry, with their provider accesses.",
              "Fiches modèles enregistrées dans Registry, avec leurs accès fournisseurs.",
            )
          ) : (
            <>
              {copyText(
                "Models discovered in Bifrost and not saved yet. Open one to register it.",
                "Modèles découverts dans Bifrost et pas encore enregistrés. Ouvrez-en un pour l’enregistrer.",
              )}{" "}
              {/* A 24 px target (WCAG 2.5.8); the negative margin keeps the line height. */}
              <Button
                variant="link"
                size="sm"
                className="-my-0.5 h-auto min-h-6 p-0 align-baseline"
                onClick={() => openModel(newModel(), true)}
              >
                {copyText("Advanced: enter an access manually", "Avancé : saisir un accès manuellement")}
              </Button>
            </>
          )}
        </p>
      </div>
      {catalog.length ? (
        <ReferenceCatalogBrowser
          folded={!effectiveExpert}
          scope={modelScope}
          models={modelScope === "registry" ? registeredModels : toAdd}
          allModels={catalog}
          catalog={referenceCatalog}
          error={referenceError}
          onRetry={() => void loadReferenceCatalog()}
          registeredIds={registeredIds}
          registeredModels={registeredModels}
          preferences={preferences}
          onPreferencesChange={setPreferences}
          onOpen={(model, tab) => {
            const saved = registeredModels.find(row => row.id === model.id);
            openModel(saved ?? model, !saved, tab);
          }}
          onMetadata={(target, id) => {
            setCatalogFocus({ target, id });
            go("catalog");
          }}
          onAssociate={associateModel}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="space-y-3 p-6">
            <h3 className="text-lg font-semibold">
              {copyText("Build your model catalog", "Créez votre catalogue de modèles")}
            </h3>
            <p className="max-w-prose text-sm text-muted-foreground">
              {copyText(
                "No models have been discovered yet. Configure a provider in Bifrost to see its models here.",
                "Aucun modèle n’a encore été découvert. Configurez un fournisseur dans Bifrost pour afficher ses modèles ici.",
              )}
            </p>
            <Button variant="outline" onClick={() => openModel(newModel(), true)}>
              {copyText("Register a model", "Enregistrer un modèle")} <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
