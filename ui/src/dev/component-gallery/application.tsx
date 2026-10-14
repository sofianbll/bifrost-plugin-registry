import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ProviderIcons } from "@/lib/constants/icons";
import { BrandIcon, ProviderMark } from "@/components/registry/BrandIcon";
import ModelBrowser from "@/features/catalog/ModelBrowser";
import HistoricalModelBrowser from "./history/ModelBrowser.prestructure-2026-09-27";
import { ViewControls, defaultViewOptions, type ViewOptions } from "@/components/registry/ViewOptions";
import { SearchableSelect } from "@/components/registry/SearchableSelect";
import { GroupTree } from "@/features/groups/GroupTree";
import ModelEditor from "@/features/catalog/ModelEditor";
import ReferenceCatalogBrowser from "@/features/catalog/ReferenceCatalogBrowser";
import CatalogMetadata from "@/features/catalog/CatalogMetadata";
import AssistantSuggestion from "@/features/assistant/AssistantSuggestion";
import AssistantSettings from "@/features/assistant/AssistantSettings";
import GatewayInventory from "@/features/gateway/GatewayInventory";
import SnapshotTransfer from "@/features/snapshot/SnapshotTransfer";
import VirtualKeySecret from "@/features/keys/VirtualKeySecret";
import AdoptionDialog from "@/features/keys/AdoptionDialog";
import Laboratory from "@/features/laboratory/Laboratory";
import HarnessTargets from "@/features/laboratory/HarnessTargets";
import HarnessRunView from "@/features/laboratory/HarnessRunView";
import { App as LegacyModelCard } from "@/experiments/model-card-prototype/App";
import type { Model } from "@/domain/registry";
import { fixture } from "@/dev/fixtures/registry";
import type { RunRecord } from "@/features/laboratory/harness";
import type { GalleryEntry } from "./types";

const models = fixture.models;
const noop = () => {};
const previewRun: RunRecord = { id: "gallery-run", provenance: "imported-newman", importedAt: "2026-09-27T00:00:00Z", executions: [{ id: "gallery-request", name: "Chat completion · démonstration", method: "POST", url: "https://example.invalid/v1/chat/completions", requestHeaders: [], requestBody: JSON.stringify({ messages: [{ role: "user", content: "Bonjour" }] }), responseStatus: 200, responseTimeMs: 42, responseHeaders: [], responseBody: JSON.stringify({ choices: [{ message: { role: "assistant", content: "Bonjour !" } }] }), assertions: [{ name: "Statut 200", passed: true }], outcome: "passed" }], unmatchedFailures: [], summary: { total: 1, passed: 1, failed: 0, unverified: 0 } };

function Browser({ view, selection = false, original = false }: { view: ViewOptions; selection?: boolean; original?: boolean }) {
  const [selected, setSelected] = useState<string[]>([models[0].id]);
  const [opened, setOpened] = useState<Model | null>(null);
  const BrowserComponent = original ? HistoricalModelBrowser : ModelBrowser;
  return <div className="space-y-3"><BrowserComponent models={models} preferences={view} selected={selection ? selected : undefined} onToggle={selection ? id => setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]) : undefined} onSetSelected={selection ? setSelected : undefined} onOpen={setOpened} label="Modèles de démonstration" />{opened && <p role="status" className="rounded-sm border p-3 text-sm">Fiche ouverte : {opened.name}</p>}</div>;
}
function Controls() { const [view, setView] = useState(defaultViewOptions); return <ViewControls value={view} onChange={setView} onReset={() => setView(defaultViewOptions)} scope="Galerie" />; }
function Selector() { const [value, setValue] = useState(""); return <div className="max-w-md"><SearchableSelect label="Modèle ou valeur personnalisée" value={value} onChange={setValue} options={models.map(model => ({ value: model.id, label: model.name, detail: model.creator }))} placeholder="Chercher un modèle…" /><p className="mt-2 text-xs text-muted-foreground">Valeur : {value || "aucune"}</p></div>; }
function Marks() {
  return <div className="space-y-5"><div className="flex flex-wrap gap-4">{models.map(model => <div key={model.id} className="flex items-center gap-2 rounded-sm border p-2"><BrandIcon model={model} mode="creator" /><span className="text-sm">{model.creator}</span></div>)}</div><div className="flex flex-wrap gap-4">{[...new Set(models.flatMap(model => model.accesses.map(access => access.provider)))].map(id => <div key={id} className="flex items-center gap-2 rounded-sm border p-2"><ProviderMark id={id} /><span className="text-sm">{id}</span></div>)}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{(Object.keys(ProviderIcons) as (keyof typeof ProviderIcons)[]).map(id => { const Icon = ProviderIcons[id]; return <div key={id} className="flex items-center gap-2 rounded-sm border p-2"><Icon size={22} theme="light" /><span className="truncate text-xs" title={id}>{id}</span></div>; })}</div></div>;
}
function Tree() { const [selected, setSelected] = useState<string[]>([models[0].id]); return <GroupTree models={models} selected={selected} onToggle={id => setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id])} />; }
function Editor({ creating = false }: { creating?: boolean }) { const [draft, setDraft] = useState<Model>(structuredClone(models[0])); const [message, setMessage] = useState(""); const [open, setOpen] = useState(false); const close = () => { setOpen(false); setDraft(structuredClone(models[0])); setMessage(""); }; return <><Button onClick={() => setOpen(true)}>{creating ? "Ouvrir la création" : "Ouvrir la fiche existante"}</Button><Sheet open={open} onOpenChange={next => { if (!next) close(); }}><ModelEditor draft={draft} onChange={setDraft} creating={creating} workspace={models} baseline={creating ? undefined : models[0]} error={message} busy={false} snapshotMode onSave={() => setMessage("Enregistrement désactivé dans la galerie.")} onCancel={close} onDelete={() => setMessage("Suppression désactivée dans la galerie.")} onUnauthorized={noop} /></Sheet></>; }
function Reference() { const [opened, setOpened] = useState<Model | null>(null); return <><ReferenceCatalogBrowser revision="gallery-1" models={models} registeredIds={new Set(models.map(model => model.id))} registeredModels={models} preferences={defaultViewOptions} onOpen={setOpened} onMetadata={noop} onUnauthorized={noop} />{opened && <p className="mt-3 rounded-sm border p-3 text-sm">Fiche choisie : {opened.name}</p>}</>; }
function Suggestion() { const [draft, setDraft] = useState(models[0]); return <AssistantSuggestion draft={draft} onChange={setDraft} onOpenSettings={noop} />; }
function Adoption() { const [open, setOpen] = useState(false); return <><Button onClick={() => setOpen(true)}>Ouvrir l’aperçu d’adoption</Button>{open && <AdoptionDialog keyId="hermes" operation="adopt" onClose={() => setOpen(false)} onUnauthorized={noop} onApplied={noop} />}</>; }
function Targets() { const [selected, setSelected] = useState<string[]>([]); return <HarnessTargets models={models} groups={fixture.groups} selectedAccessIds={selected} onChange={setSelected} />; }
function Lab() { const [runs, setRuns] = useState<RunRecord[]>([previewRun]); return <Laboratory models={models} groups={fixture.groups} campaigns={fixture.campaigns} onCampaigns={noop} harnessRuns={runs} onHarnessRuns={setRuns} />; }
function AppPreview({ page }: { page: string }) { return <iframe title={`Application Registry · ${page}`} src={`./component-app-preview.html#/${page}`} sandbox="allow-scripts allow-same-origin" className="h-[900px] w-full rounded-sm border bg-background" />; }

const entry = (id: string, title: string, family: string, level: GalleryEntry["level"], source: string, description: string, Component: GalleryEntry["Component"], version = "Application locale · 2026-09-27"): GalleryEntry => ({ id: `app-${id}`, title, family, level, origin: "Registry", version, source, description, Component });
export const applicationEntries: GalleryEntry[] = [
  entry("browser-grid", "Navigateur · structure acceptée · cartes moyennes", "Cartes", "Organismes", "ui/src/features/catalog/ModelBrowser.tsx · ui/src/components/registry/CatalogCard.tsx", "Structure validée : identité et sélection en haut, faits au centre, accès et actions en bas.", () => <Browser view={defaultViewOptions} />),
  entry("browser-compact", "Navigateur · structure acceptée · cartes compactes", "Cartes", "Organismes", "ui/src/features/catalog/ModelBrowser.tsx · ui/src/components/registry/CatalogCard.tsx", "Même structure dans la variante compacte du navigateur.", () => <Browser view={{ ...defaultViewOptions, size: "small" }} />),
  entry("browser-large", "Navigateur · structure acceptée · grandes cartes", "Cartes", "Organismes", "ui/src/features/catalog/ModelBrowser.tsx · ui/src/components/registry/CatalogCard.tsx", "Même structure avec la taille large du navigateur.", () => <Browser view={{ ...defaultViewOptions, size: "large" }} />),
  entry("browser-original-grid", "Navigateur · avant structure · cartes moyennes", "Cartes", "Organismes", "ui/src/dev/component-gallery/history/ModelBrowser.prestructure-2026-09-27.tsx", "Capture historique du navigateur de production avant la structure acceptée le 27 septembre.", () => <Browser view={defaultViewOptions} original />, "Archive préstructure · 2026-09-27"),
  entry("browser-original-compact", "Navigateur · avant structure · cartes compactes", "Cartes", "Organismes", "ui/src/dev/component-gallery/history/ModelBrowser.prestructure-2026-09-27.tsx", "Capture historique de la variante compacte avant le changement.", () => <Browser view={{ ...defaultViewOptions, size: "small" }} original />, "Archive préstructure · 2026-09-27"),
  entry("browser-original-large", "Navigateur · avant structure · grandes cartes", "Cartes", "Organismes", "ui/src/dev/component-gallery/history/ModelBrowser.prestructure-2026-09-27.tsx", "Capture historique de la variante large avant le changement.", () => <Browser view={{ ...defaultViewOptions, size: "large" }} original />, "Archive préstructure · 2026-09-27"),
  entry("browser-original-table", "Navigateur · avant structure · tableau", "Tableaux", "Organismes", "ui/src/dev/component-gallery/history/ModelBrowser.prestructure-2026-09-27.tsx", "Capture historique du tableau avant le résumé des capacités.", () => <Browser view={{ ...defaultViewOptions, layout: "table" }} original />, "Archive préstructure · 2026-09-27"),
  entry("browser-original-selection", "Navigateur · avant structure · sélection", "Recherche et filtres", "Organismes", "ui/src/dev/component-gallery/history/ModelBrowser.prestructure-2026-09-27.tsx", "Capture historique de la sélection avant le changement.", () => <Browser view={defaultViewOptions} selection original />, "Archive préstructure · 2026-09-27"),
  entry("browser-table", "Navigateur · tableau", "Tableaux", "Organismes", "ui/src/features/catalog/ModelBrowser.tsx", "Même données en tableau.", () => <Browser view={{ ...defaultViewOptions, layout: "table" }} />),
  entry("browser-selection", "Navigateur · sélection", "Recherche et filtres", "Organismes", "ui/src/features/catalog/ModelBrowser.tsx", "Sélection individuelle et groupée.", () => <Browser view={defaultViewOptions} selection />),
  entry("view-controls", "Options d’affichage", "Recherche et filtres", "Molécules", "ui/src/components/registry/ViewOptions.tsx", "Format, taille et détails visibles.", Controls),
  entry("searchable-select", "Sélecteur avec recherche", "Saisie et sélection", "Molécules", "ui/src/components/registry/SearchableSelect.tsx", "Choix exact ou personnalisé.", Selector),
  entry("brands", "Marques et fournisseurs", "Identités et logos", "Atomes", "ui/src/components/registry/BrandIcon.tsx · ui/src/lib/constants/icons.tsx", "Catalogue complet des icônes disponibles et rendu Registry des marques.", Marks),
  entry("group-tree", "Arbre des modèles", "Groupes", "Organismes", "ui/src/features/groups/GroupTree.tsx", "Créateurs, modèles et accès avec sélection.", Tree),
  entry("model-editor", "Fiche modèle existante", "Propriétés et sources", "Templates et pages", "ui/src/features/catalog/ModelEditor.tsx", "Éditeur réel en mode capture locale ; modifications non enregistrées.", Editor),
  entry("model-editor-create", "Créer une fiche modèle", "Propriétés et sources", "Templates et pages", "ui/src/features/catalog/ModelEditor.tsx", "Parcours de création de la fiche.", () => <Editor creating />),
  entry("reference-catalog", "Catalogue de référence", "Recherche et filtres", "Templates et pages", "ui/src/features/catalog/ReferenceCatalogBrowser.tsx", "Références et accès synthétiques, regroupés par modèle.", Reference),
  entry("catalog-metadata", "Métadonnées et provenance", "Propriétés et sources", "Templates et pages", "ui/src/features/catalog/CatalogMetadata.tsx", "Sources, correction et correspondance ; écriture API bloquée.", () => <CatalogMetadata snapshotMode onUnauthorized={noop} onChanged={noop} />),
  entry("assistant-suggestion", "Suggestion IA", "Assistance", "Organismes", "ui/src/features/assistant/AssistantSuggestion.tsx", "État de demande et erreur contrôlée dans la galerie.", Suggestion),
  entry("assistant-settings", "Réglages IA", "Assistance", "Organismes", "ui/src/features/assistant/AssistantSettings.tsx", "Clés et modèles synthétiques ; sauvegarde bloquée.", () => <AssistantSettings />),
  entry("gateway", "Inventaire gateway", "Accès fournisseurs", "Templates et pages", "ui/src/features/gateway/GatewayInventory.tsx", "Fournisseurs, alias, routage et permissions synthétiques.", () => <GatewayInventory onModels={noop} />),
  entry("snapshot", "Import et export", "Import et export", "Templates et pages", "ui/src/features/snapshot/SnapshotTransfer.tsx", "Export local synthétique et aperçu ; import réel désactivé.", () => <SnapshotTransfer onUnauthorized={noop} onApplied={noop} />),
  entry("secret", "Révélation de clé", "Clés virtuelles", "Molécules", "ui/src/features/keys/VirtualKeySecret.tsx", "Dialogue réel ; aucun secret disponible dans la galerie.", () => <VirtualKeySecret keyId="hermes" />),
  entry("adoption", "Adoption de clé", "Clés virtuelles", "Organismes", "ui/src/features/keys/AdoptionDialog.tsx", "Aperçu synthétique ; confirmation bloquée.", Adoption),
  entry("laboratory", "Laboratoire", "Laboratoire", "Templates et pages", "ui/src/features/laboratory/Laboratory.tsx", "Collection locale et exécution importée synthétique ; aucun fournisseur appelé.", Lab),
  entry("harness-targets", "Cibles du laboratoire", "Laboratoire", "Organismes", "ui/src/features/laboratory/HarnessTargets.tsx", "Sélection réelle des accès par filtres et groupes.", Targets),
  entry("harness-run", "Lecture d’une exécution", "Laboratoire", "Organismes", "ui/src/features/laboratory/HarnessRunView.tsx", "Résultat Newman fictif : aperçu, messages, requête, réponse et contrôles.", () => <HarnessRunView record={previewRun} onBack={noop} />),
  entry("legacy-model-card", "Ancien prototype · fiche modèle", "Parcours complets", "Templates et pages", "ui/src/experiments/model-card-prototype/App.tsx", "Prototype historique interactif : choix, fiche, révision et enregistrement simulé.", LegacyModelCard, "Prototype 2026-09-25 · seconde révision"),
  ...([
    ["models", "Application · Mes modèles", "Cartes"],
    ["gateway", "Application · Gateway existant", "Accès fournisseurs"],
    ["catalog", "Application · Données documentaires", "Propriétés et sources"],
    ["groups", "Application · Groupes", "Groupes"],
    ["keys", "Application · Clés virtuelles", "Clés virtuelles"],
    ["qualification", "Application · Qualification", "Laboratoire"],
    ["settings", "Application · Réglages", "Assistance"],
    ["snapshot", "Application · Import et export", "Import et export"],
  ] as const).map(([page, title, family]) => entry(`screen-${page}`, title, family, "Templates et pages", "ui/src/app/App.tsx", "Écran original dans un iframe isolé ; navigation et préférences en mémoire, API synthétique.", () => <AppPreview page={page} />)),
];
