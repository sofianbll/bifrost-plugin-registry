import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Database, Eye, KeyRound, Link2, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ViewControls, type ViewOptions } from "@/components/registry/ViewOptions";
import { ProviderAppearance } from "./ProviderAppearance";
import AssistantSettings from "@/features/assistant/AssistantSettings";
import { ApiError, request } from "@/data/api";
import { getCatalog, type Catalog } from "@/features/catalog/catalog-api";
import { useCopy, useLanguage } from "@/lib/locale";

type SettingsSection = "general" | "display" | "sources" | "connection" | "assistance" | "help";
type Page = "gateway" | "catalog" | "snapshot";

export type RegistrySettingsProps = {
  preferences: ViewOptions;
  onPreferencesChange: (preferences: ViewOptions) => void;
  snapshotMode: boolean;
  onNavigate: (page: Page) => void;
  onUnauthorized: () => void;
  providers?: string[];
  // My models scope counts, as the models page header shows them.
  modelCounts?: string;
  initialSection?: "general" | "display" | "sources" | "connection" | "assistance" | "help";
};

const sections: { id: SettingsSection; icon: typeof Settings2; en: string; fr: string }[] = [
  { id: "general", icon: Settings2, en: "General", fr: "Général" },
  { id: "display", icon: Eye, en: "Appearance", fr: "Affichage" },
  { id: "sources", icon: Database, en: "Catalog sources", fr: "Sources" },
  { id: "connection", icon: Link2, en: "Connection", fr: "Connexion" },
  { id: "assistance", icon: KeyRound, en: "AI assistance", fr: "Assistance" },
  { id: "help", icon: BookOpen, en: "Help", fr: "Aide" },
];

const formatDate = (value: string | undefined, language: string) => value
  ? new Date(value).toLocaleString(language === "fr" ? "fr-FR" : "en-US")
  : language === "fr" ? "Non renseigné" : "Not recorded";

export default function RegistrySettings({ preferences, onPreferencesChange, snapshotMode, onNavigate, onUnauthorized, providers = [], modelCounts, initialSection = "general" }: RegistrySettingsProps) {
  const copy = useCopy();
  const language = useLanguage();
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [gatewayProviders, setGatewayProviders] = useState<string[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  useEffect(() => {
    if (section !== "sources" && section !== "display") return;
    let active = true;
    setLoadingCatalog(true);
    setCatalogError("");
    if (section === "display" && snapshotMode) void request<{ providers: { name: string }[] }>("review-context").then(value => { if (active) setGatewayProviders(value.providers.map(provider => provider.name)); }).catch(() => { if (active) setCatalogError(copy("Some providers could not be loaded. Reopen Appearance to retry.", "Certains fournisseurs n’ont pas pu être chargés. Rouvrez Affichage pour réessayer.")); });
    void getCatalog().then(value => { if (active) setCatalog(value); }).catch(cause => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized();
      setCatalogError(cause instanceof Error ? cause.message : copy("Catalog status unavailable.", "État du catalogue indisponible."));
    }).finally(() => { if (active) setLoadingCatalog(false); });
    return () => { active = false; };
  }, [section]);

  const navigate = (page: Page) => <Button variant="outline" size="sm" onClick={() => onNavigate(page)}>{page === "catalog" ? copy("Open catalog data", "Ouvrir les données du catalogue") : page === "gateway" ? copy("View gateway", "Voir le gateway") : copy("Import or export", "Importer ou exporter")}<ArrowRight className="size-3.5" /></Button>;
  const sourceNames: Record<string, [string, string]> = {
    "models.dev": ["Models.dev local catalog", "Catalogue local Models.dev"],
    bifrost: ["Bifrost", "Bifrost"],
  };
  const content = () => {
    if (section === "general") return <div className="space-y-4">
      <Card><CardHeader><CardTitle>{copy("Administration", "Administration")}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{navigate("gateway")}{navigate("catalog")}{navigate("snapshot")}</CardContent></Card>
      <Card><CardHeader><CardTitle>{copy("Current workspace", "Espace de travail actuel")}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>{snapshotMode ? copy("You are reviewing a local snapshot. Changes stay in this copy and do not update the connected Bifrost gateway.", "Vous consultez une copie locale. Les changements restent dans cette copie et ne modifient pas le gateway Bifrost connecté.") : copy("Registry catalog and model selections are managed in this workspace. Native Bifrost permissions remain governed by Bifrost.", "Le catalogue Registry et les sélections de modèles sont gérés dans cet espace. Les permissions natives restent régies par Bifrost.")}</p>{modelCounts && <p className="text-foreground">{modelCounts}</p>}<Badge variant={snapshotMode ? "warning" : "success"}>{snapshotMode ? copy("Local snapshot", "Copie locale") : copy("Connected workspace", "Espace connecté")}</Badge></CardContent></Card>
    </div>;
    if (section === "display") return <div className="space-y-3"><Card><CardHeader><CardTitle>{copy("Default model display", "Affichage par défaut des modèles")}</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">{copy("These local preferences control the default information shown in model lists. A page can still offer its own view controls.", "Ces préférences locales déterminent les informations affichées par défaut dans les listes de modèles. Chaque page peut aussi proposer ses propres options.")}</p><ViewControls value={preferences} onChange={onPreferencesChange} scope={copy("Global", "Général")} catalogFormats /><div className="space-y-2 border-t pt-3"><p className="text-sm font-medium">{copy("Primary logo on model cards", "Logo principal des fiches modèles")}</p><div className="flex flex-wrap gap-2"><Button size="sm" variant={preferences.logo === "creator" ? "default" : "outline"} onClick={() => onPreferencesChange({ ...preferences, logo: "creator" })}>{copy("Creator", "Créateur")}</Button><Button size="sm" variant={preferences.logo === "provider" ? "default" : "outline"} onClick={() => onPreferencesChange({ ...preferences, logo: "provider" })}>{copy("Provider", "Fournisseur d’accès")}</Button></div></div></CardContent></Card>{catalogError && <p role="alert" className="text-sm text-destructive">{catalogError}</p>}<ProviderAppearance providers={[...providers, ...gatewayProviders, ...(catalog?.accesses.map(access => access.provider) || [])]} /></div>;
    if (section === "sources") return <div className="space-y-4">
      <Card><CardHeader><CardTitle>{copy("Where model information comes from", "Origine des informations sur les modèles")}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>{copy("Models.dev is the reference source for shared model information. Registry keeps its own catalog so corrections and explicit matches can be preserved across refreshes.", "Models.dev est la source de référence des informations communes sur les modèles. Registry conserve son propre catalogue afin de préserver les corrections et les associations explicites lors des actualisations.")}</p><p>{copy("Bifrost contributes native provider and model configuration. That configuration is separate from documentary model data and does not make an unconfigured model available.", "Bifrost fournit la configuration native des fournisseurs et modèles. Elle reste distincte des données documentaires et ne rend pas disponible un modèle non configuré.")}</p></CardContent></Card>
      <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle>{copy("Synchronization status", "État des synchronisations")}</CardTitle>{navigate("catalog")}</CardHeader><CardContent className="space-y-3">
        {loadingCatalog && <p role="status" className="text-sm text-muted-foreground">{copy("Loading source status…", "Chargement de l’état des sources…")}</p>}
        {catalogError && <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">{catalogError}</p>}
        {catalog && <>
          <p className="text-xs text-muted-foreground">{copy(`${catalog.references.length} reference entries · ${catalog.accesses.length} provider accesses`, `${catalog.references.length} fiches de référence · ${catalog.accesses.length} accès fournisseurs`)}</p>
          {(["models.dev", "bifrost"] as const).map(id => {
            const status = catalog.sources.find(source => source.id === id);
            const [en, fr] = sourceNames[id];
            const references = catalog.references.filter(reference => Object.values(reference.fields).some(field => field.source === id)).length;
            const accesses = id === "bifrost" ? catalog.accesses.filter(access => access.configured).length : 0;
            return <div key={id} className="flex flex-wrap items-start justify-between gap-3 rounded-sm border p-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong>{copy(en, fr)}</strong><Badge variant={status?.error ? "destructive" : status?.lastSuccess ? "success" : "secondary"}>{status?.error ? copy("Sync error", "Erreur de synchro") : status?.lastSuccess ? copy("Synced", "Synchronisée") : copy("No successful sync recorded", "Aucune synchro réussie enregistrée")}</Badge></div>{status?.sourceAt && <p className="mt-1 text-xs text-muted-foreground">{copy("Source date:", "Date de la source :")} {formatDate(status.sourceAt, language)}</p>}{status?.repository && <p className="mt-1 break-all text-xs text-muted-foreground">{copy("Repository:", "Dépôt :")} {status.repository}{status.commit && ` · ${copy("commit", "commit")} ${status.commit}`}</p>}<p className="mt-1 text-xs text-muted-foreground">{copy("Last success:", "Dernière réussite :")} {formatDate(status?.lastSuccess, language)} · {copy("Last attempt:", "Dernière tentative :")} {formatDate(status?.lastAttempt, language)}</p><p className="mt-1 text-xs text-muted-foreground">{id === "models.dev" ? copy(`${references} reference entries`, `${references} fiches de référence`) : copy(`${accesses} configured provider accesses · ${references} reference entries`, `${accesses} accès fournisseurs configurés · ${references} fiches de référence`)}</p>{status?.error && <p role="status" className="mt-1 break-words text-xs text-destructive">{status.error}</p>}</div><span className="text-xs text-muted-foreground">{id === "models.dev" ? copy("Local catalog source", "Source du catalogue local") : copy("Native gateway configuration", "Configuration native du gateway")}</span></div>;
          })}
        </>}
      </CardContent></Card>
      <Card><CardContent className="space-y-2 pt-5"><h3 className="text-sm font-semibold">{copy("Custom model entries", "Fiches de modèles personnalisés")}</h3><p className="text-sm text-muted-foreground">{copy("Add a reference entry in the catalog when a model is missing. A reference documents a model; it does not create a Bifrost provider access or grant permissions.", "Ajoutez une fiche de référence au catalogue si un modèle manque. Elle documente le modèle, sans créer d’accès fournisseur Bifrost ni accorder de permission.")}</p>{navigate("catalog")}</CardContent></Card>
    </div>;
    if (section === "connection") return <div className="space-y-4">
      <Card><CardHeader><CardTitle>{copy("How Registry connects", "Connexion de Registry")}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>{copy("The current plugin serves its own Registry panel. Its server calls Bifrost’s native admin API using REGISTRY_BIFROST_AUTH, configured by the deployment administrator. It is not a personal management key entered in this page.", "Le plugin actuel sert son propre panneau Registry. Le serveur appelle l’API d’administration native Bifrost avec REGISTRY_BIFROST_AUTH, configurée par l’administrateur du déploiement. Ce n’est pas une clé personnelle à saisir ici.")}</p><p>{copy("A shared host login requires a compatible PluginAdminUIHost integration. It is not provided by the stock Bifrost release used by this project.", "Un accès partagé avec l’interface hôte exige une intégration PluginAdminUIHost compatible. La version standard de Bifrost utilisée par ce projet ne la fournit pas.")}</p><p>{copy("The Registry panel’s own access token is separate and is managed on the server.", "Le jeton d’accès au panneau Registry est distinct et se gère côté serveur.")}</p></CardContent></Card>
      {snapshotMode && <Card><CardHeader><CardTitle>{copy("Snapshot evidence", "Informations de la copie")}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{copy("This workspace is a local snapshot. Some captured data may be unavailable; no live gateway connection or mutation is implied.", "Cet espace est une copie locale. Certaines données capturées peuvent manquer ; cela n’implique ni connexion en direct au gateway ni modification de celui-ci.")}</CardContent></Card>}
    </div>;
    if (section === "assistance") return snapshotMode ? <Card><CardHeader><CardTitle>{copy("AI assistance", "Assistance IA")}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{copy("AI settings and provider calls are unavailable in this snapshot copy.", "Les réglages IA et les appels aux fournisseurs ne sont pas disponibles dans cette copie locale.")}</CardContent></Card> : <AssistantSettings onUnauthorized={onUnauthorized} />;
    return <div className="space-y-4">
      <Card><CardHeader><CardTitle>{copy("A short path through Registry", "Parcours rapide dans Registry")}</CardTitle></CardHeader><CardContent><ol className="space-y-3 text-sm"><li className="flex gap-3"><Badge>1</Badge><span><strong>{copy("Models", "Modèles")}</strong> — {copy("review discovered accesses and add reference entries where needed.", "examinez les accès découverts et ajoutez les fiches de référence manquantes.")}</span></li><li className="flex gap-3"><Badge>2</Badge><span><strong>{copy("Groups", "Groupes")}</strong> — {copy("organize reusable model selections.", "organisez des sélections de modèles réutilisables.")}</span></li><li className="flex gap-3"><Badge>3</Badge><span><strong>{copy("Virtual keys", "Clés virtuelles")}</strong> — {copy("compose the model list exposed to each key.", "composez la liste des modèles exposés par chaque clé.")}</span></li><li className="flex gap-3"><Badge>4</Badge><span><strong>{copy("Preview and publish", "Aperçu et publication")}</strong> — {copy("review the impact, publish, then read back /v1/models to verify the result.", "vérifiez l’impact, publiez, puis relisez /v1/models pour contrôler le résultat.")}</span></li></ol></CardContent></Card>
      <Card><CardHeader><CardTitle>{copy("Snapshot or live workspace?", "Copie locale ou espace connecté ?")}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>{copy("A snapshot is a dated local copy that can be partial. Its edits stay in the copy. A connected workspace reads and writes through the Registry service; a saved key change still needs publication and readback verification.", "Une copie locale est un instantané daté qui peut être partiel. Ses changements restent dans cette copie. Un espace connecté lit et écrit via le service Registry ; une modification de clé enregistrée doit encore être publiée et vérifiée par relecture.")}</p>{navigate(snapshotMode ? "gateway" : "catalog")}</CardContent></Card>
      <Card><CardHeader><CardTitle>{copy("Need the gateway details?", "Besoin des détails du gateway ?")}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>{copy("Aliases map a requested model name to a provider target. Routing rules choose among targets and may include conditions, weights, and fallbacks.", "Un alias associe un nom de modèle demandé à une cible fournisseur. Les règles de routage choisissent parmi des cibles et peuvent définir des conditions, des poids et des secours.")}</p>{navigate("gateway")}</CardContent></Card>
    </div>;
  };

  return <div className="mx-auto w-full max-w-5xl space-y-4">
    <header><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy("Settings", "Réglages")}</h2><p className="mt-1 max-w-prose text-sm text-muted-foreground">{copy("Manage display, model data and connection guidance.", "Gérez l’affichage, les données modèles et les informations de connexion.")}</p></header>
    <div className="grid gap-4 md:grid-cols-[11rem_minmax(0,1fr)]">
      <nav aria-label={copy("Settings sections", "Sections des réglages")} className="flex gap-1 overflow-x-auto pb-1 md:block md:space-y-1 md:overflow-visible">
        {sections.map(({ id, icon: Icon, en, fr }) => <button key={id} type="button" aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)} className={`flex shrink-0 items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-full ${section === id ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><Icon className="size-4" /><span>{copy(en, fr)}</span></button>)}
      </nav>
      <section aria-labelledby="settings-section-title" className="min-w-0 space-y-4">
        <h3 id="settings-section-title" className="sr-only">{copy(sections.find(item => item.id === section)!.en, sections.find(item => item.id === section)!.fr)}</h3>
        {content()}
      </section>
    </div>
  </div>;
}
