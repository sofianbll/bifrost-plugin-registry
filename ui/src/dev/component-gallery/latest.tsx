// Actual September prototype components, mounted with local synthetic fixtures only.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { BrandIcon } from "@/components/registry/BrandIcon";
import { defaultViewOptions } from "@/components/registry/ViewOptions";
import type { GalleryEntry } from "./types";
import { CatalogCard, CatalogGrid } from "@/components/registry/CatalogCard";
import { ProviderSummary, GroupSummary } from "@/experiments/key-composer-prototype/CompactCollection";
import { ViewMenu, type DisplayFormat } from "@/experiments/key-composer-prototype/ViewMenu";
import { StateBadge, AccessRow, AccessMenu, AccessDetailDialog } from "@/experiments/key-composer-prototype/shared";
import { ComposerModelResults, GroupsPanel } from "@/experiments/key-composer-prototype/cards";
import { ComposerBrowser } from "@/experiments/key-composer-prototype/browser";
import { DraftSummary, PlannedExposures } from "@/experiments/key-composer-prototype/summary";
import CatalogPage from "@/experiments/key-composer-prototype/CatalogPage";
import { ModelDetail } from "@/experiments/key-composer-prototype/ModelDetail";
import GroupWorkspace from "@/experiments/key-composer-prototype/GroupWorkspace";
import KeyLibrary from "@/experiments/key-composer-prototype/KeyLibrary";
import VariantA from "@/experiments/key-composer-prototype/VariantA";
import VariantB from "@/experiments/key-composer-prototype/VariantB";
import { initialKeys } from "@/experiments/key-composer-prototype/key-state";
import {
  emptyDraft, fixtureGroups, fixtureModels, isSelected, lateAccess, reconcileSelection,
  resolveDraft, toggleAccess, toggleGroup, toggleModel,
  type AccessResolution, type KeyDraft, type ProtoAccess, type ProtoGroup, type ProtoModel,
} from "@/experiments/key-composer-prototype/state";

const models = fixtureModels;
const groups = fixtureGroups;
const selectedDraft: KeyDraft = {
  ...emptyDraft(), name: "Demo · selected", client: "Gallery",
  groups: ["code"],
  added: [{ modelId: "kimi-k2", accesses: ["moonshot/kimi-k2"] }, { modelId: "gpt-5", accesses: ["openai/gpt-5"] }],
  excludedModels: ["gpt-5-mini"],
  excludedAccesses: ["azure/gpt-5"],
};
const offDraft: KeyDraft = { ...emptyDraft(), added: [{ modelId: "gpt-5", accesses: ["openai/gpt-5"] }] };
const cloneDraft = () => structuredClone(selectedDraft);
const model = models[0];
const prototypePath = "ui/src/experiments/key-composer-prototype/";
const version = "Prototype récent · 27 septembre";
const origin = "Registry/Bifrost";
const fullDisplay = { description: true, id: true, providers: true, capabilities: true, modalities: true };

function useSelection(initial: KeyDraft = selectedDraft) {
  const [draft, setDraft] = useState<KeyDraft>(() => structuredClone(initial));
  const [detail, setDetail] = useState<{ model: ProtoModel; access: ProtoAccess } | null>(null);
  const resolved = new Map(resolveDraft(draft, groups, models).map(item => [item.model.id, item]));
  const selected = models.filter(item => isSelected(item.id, draft, groups)).map(item => item.id);
  const callbacks = {
    onToggleModel: (item: ProtoModel) => setDraft(previous => toggleModel(previous, item, groups)),
    onToggleAccess: (item: AccessResolution) => setDraft(previous => toggleAccess(previous, item)),
    onShowDetail: (item: ProtoModel, access: ProtoAccess) => setDetail({ model: item, access }),
  };
  return { draft, setDraft, resolved, selected, callbacks, detail, setDetail };
}

function DetailDialog({ detail, onClose }: { detail: { model: ProtoModel; access: ProtoAccess } | null; onClose: () => void }) {
  return <AccessDetailDialog model={detail?.model ?? null} access={detail?.access ?? null} onClose={onClose} />;
}

function CatalogCardSample({ format }: { format: "compact" | "square" }) {
  return <CatalogGrid format={format}><CatalogCard format={format} selected header={<><BrandIcon model={model} mode="creator" /><CardTitle className="min-w-0 truncate text-sm">{model.name}</CardTitle></>} footer={<ProviderSummary ids={model.accesses.map(access => access.provider)} />}>
    <p className="text-xs text-muted-foreground">{model.summary}</p>
  </CatalogCard></CatalogGrid>;
}

function ResultsSample({ format, mode, initial = selectedDraft }: { format: DisplayFormat; mode: "catalog" | "composer"; initial?: KeyDraft }) {
  const state = useSelection(initial);
  const [opened, setOpened] = useState<ProtoModel | null>(null);
  const view = { ...defaultViewOptions, layout: format === "table" ? "table" as const : "grid" as const, size: format === "compact" ? "small" as const : "medium" as const };
  return <div className="min-w-0 space-y-3">
    {mode === "catalog" ? <ComposerModelResults mode="catalog" filtered={models.slice(0, 5)} view={view} display={fullDisplay} groupBy="none" onOpenModel={id => setOpened(models.find(item => item.id === id) ?? null)} /> : <ComposerModelResults filtered={models.slice(0, 5)} view={view} display={fullDisplay} groupBy="none" draft={state.draft} groups={groups} resolved={state.resolved} callbacks={state.callbacks} />}
    {opened && <div className="rounded-sm border p-3"><ModelDetail model={opened} onBack={() => setOpened(null)} /></div>}
    <DetailDialog detail={state.detail} onClose={() => state.setDetail(null)} />
  </div>;
}

function BrowserSample({ mode }: { mode: "catalog" | "composer" }) {
  const state = useSelection();
  const [opened, setOpened] = useState<ProtoModel | null>(null);
  return <div className="min-w-0 space-y-3">
    {mode === "catalog" ? <ComposerBrowser mode="catalog" models={models} onOpenModel={id => setOpened(models.find(item => item.id === id) ?? null)} /> : <ComposerBrowser models={models} selected={state.selected} onSetSelected={ids => state.setDraft(previous => reconcileSelection(previous, ids, groups, models))} draft={state.draft} groups={groups} resolved={state.resolved} callbacks={state.callbacks} />}
    {opened && <div className="rounded-sm border p-3"><ModelDetail model={opened} onBack={() => setOpened(null)} /></div>}
    <DetailDialog detail={state.detail} onClose={() => state.setDetail(null)} />
  </div>;
}

function AccessStates() {
  const state = useSelection();
  const resolution = state.resolved.get("gpt-5")!;
  const unavailable = resolveDraft({ ...emptyDraft(), added: [{ modelId: "claude-sonnet-4.6", accesses: ["anthropic/claude-sonnet-4.6"] }] }, groups, models)[0].accesses[1];
  const off = resolveDraft(offDraft, groups, models)[0].accesses[1];
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2"><StateBadge state="active" /><StateBadge state="off" /><StateBadge state="excluded" /><StateBadge state="unavailable" /></div>
    {[resolution.accesses[0], resolution.accesses[1], off, unavailable].map((item, index) => <AccessRow key={`${index}:${item.access.id}`} resolution={item} locked={false} onToggleAccess={state.callbacks.onToggleAccess} onShowDetail={access => state.setDetail({ model: models.find(m => m.accesses.some(a => a.id === access.id)) ?? model, access })} />)}
    <DetailDialog detail={state.detail} onClose={() => state.setDetail(null)} />
  </div>;
}

function AccessMenuSample() {
  const state = useSelection();
  return <div className="flex flex-wrap gap-3"><AccessMenu resolution={state.resolved.get("gpt-5")!} locked={false} onToggleAccess={state.callbacks.onToggleAccess} onShowDetail={state.callbacks.onShowDetail} /><AccessMenu resolution={state.resolved.get("gpt-5-mini")!} locked onToggleAccess={state.callbacks.onToggleAccess} onShowDetail={state.callbacks.onShowDetail} compact /><DetailDialog detail={state.detail} onClose={() => state.setDetail(null)} /></div>;
}

function AccessDetailSample() {
  const [open, setOpen] = useState(false);
  return <><Button variant="outline" onClick={() => setOpen(true)}>Ouvrir le détail de l’accès</Button><AccessDetailDialog model={open ? model : null} access={open ? model.accesses[0] : null} onClose={() => setOpen(false)} /></>;
}

function GroupsPanelSample() {
  const state = useSelection();
  return <GroupsPanel draft={state.draft} groups={groups} models={models} onToggleGroup={id => state.setDraft(previous => toggleGroup(previous, id))} />;
}

function SummarySample({ kind }: { kind: "draft" | "planned" }) {
  const state = useSelection();
  return <div className="space-y-3">{kind === "draft" ? <DraftSummary draft={state.draft} groups={groups} models={models} onToggleModel={state.callbacks.onToggleModel} onToggleAccess={state.callbacks.onToggleAccess} onShowDetail={state.callbacks.onShowDetail} /> : <PlannedExposures draft={state.draft} groups={groups} models={models} onNaming={naming => state.setDraft(previous => ({ ...previous, naming }))} />}<DetailDialog detail={state.detail} onClose={() => state.setDetail(null)} /></div>;
}

function ViewMenuSample() {
  const [format, setFormat] = useState<DisplayFormat>("compact");
  return <div className="flex items-center gap-3"><ViewMenu format={format} onFormatChange={setFormat} /><span className="text-sm text-muted-foreground">{format}</span></div>;
}

function CatalogPageSample() {
  const [opened, setOpened] = useState<ProtoModel | null>(null);
  return opened ? <ModelDetail model={opened} onBack={() => setOpened(null)} /> : <CatalogPage models={models} onOpenModel={id => setOpened(models.find(item => item.id === id) ?? null)} />;
}

function GroupWorkspaceSample() {
  const [localGroups, setLocalGroups] = useState(() => structuredClone(groups));
  return <GroupWorkspace groups={localGroups} models={models} keys={initialKeys} onGroupsChange={setLocalGroups} onPageChange={() => {}} />;
}

function KeyLibrarySample() {
  const [message, setMessage] = useState("");
  return <><KeyLibrary keys={initialKeys} groups={groups} models={models} onCreate={() => setMessage("Création : voir les variantes A et B.")} onEdit={key => setMessage(`Édition locale : ${key.draft.name}`)} />{message && <p role="status" className="mt-2 text-xs text-muted-foreground">{message}</p>}</>;
}

function VariantSample({ mode }: { mode: "basic" | "expert" }) {
  const [draft, setDraft] = useState<KeyDraft>(cloneDraft);
  const [localModels, setLocalModels] = useState<ProtoModel[]>(models);
  const [lateSimulated, setLateSimulated] = useState(false);
  const [message, setMessage] = useState("");
  const common = {
    draft, baseline: selectedDraft, editing: false, setDraft, models: localModels, groups,
    lateSimulated,
    onSimulateLate: () => { if (!lateSimulated) { setLocalModels(previous => previous.map(item => item.id === "kimi-k2" ? { ...item, accesses: [...item.accesses, lateAccess["kimi-k2"]()] } : item)); setLateSimulated(true); } },
    onResetDemo: () => { setDraft(cloneDraft()); setLocalModels(models); setLateSimulated(false); setMessage(""); },
    onCancel: () => { setDraft(cloneDraft()); setMessage("Brouillon local réinitialisé."); },
    onCreate: () => setMessage("Aperçu local uniquement : aucune clé publiée."),
  };
  return <div className="min-w-0 space-y-3"><div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => window.open(`/key-composer-prototype.html?variant=${mode === "basic" ? "a" : "b"}`, "_blank", "noopener,noreferrer")}>Ouvrir le prototype complet ↗</Button></div>{mode === "basic" ? <VariantA {...common} /> : <VariantB {...common} />}{message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}</div>;
}

function entry(id: string, title: string, family: string, level: GalleryEntry["level"], file: string, description: string, Component: GalleryEntry["Component"]): GalleryEntry {
  return { id, title, family, level, origin, version, source: `${prototypePath}${file}`, description, Component };
}

export const latestEntries: GalleryEntry[] = [
  entry("latest-card-compact", "Carte modèle · compact", "Cartes", "Organismes", "CatalogCard.tsx", "Carte réelle avec logo, texte et accès.", () => <CatalogCardSample format="compact" />),
  entry("latest-card-square", "Carte modèle · carré", "Cartes", "Organismes", "CatalogCard.tsx", "Même carte en format carré.", () => <CatalogCardSample format="square" />),
  ...(["compact", "square", "table"] as const).flatMap(format => (["catalog", "composer"] as const).map(mode => entry(`latest-results-${mode}-${format}`, `Résultats ${mode === "catalog" ? "parcours catalogue" : "sélection clé"} · ${{ compact: "compact", square: "carré", table: "tableau" }[format]}`, "Cartes", "Organismes", "cards.tsx", mode === "catalog" ? "Ouverture de la fiche dans le catalogue." : "Choix directs, héritage, exclusions et états des accès sur les mêmes modèles.", () => <ResultsSample format={format} mode={mode} />))),
  entry("latest-browser-catalog", "Explorateur · recherche et filtres", "Recherche et filtres", "Organismes", "browser.tsx", "Recherche, catégories, filtres, tri, regroupement et formats du catalogue.", () => <BrowserSample mode="catalog" />),
  entry("latest-browser-select", "Explorateur · sélection", "Recherche et filtres", "Organismes", "browser.tsx", "Filtres et sélection locale des modèles, y compris résultats masqués.", () => <BrowserSample mode="composer" />),
  entry("latest-provider-0", "Fournisseurs · aucun", "Identités et logos", "Molécules", "CompactCollection.tsx", "État vide.", () => <ProviderSummary ids={[]} />),
  entry("latest-provider-1", "Fournisseurs · un", "Identités et logos", "Molécules", "CompactCollection.tsx", "Un fournisseur actif.", () => <ProviderSummary ids={["openai"]} activeIds={new Set(["openai"])} />),
  entry("latest-provider-many", "Fournisseurs · débordement", "Identités et logos", "Molécules", "CompactCollection.tsx", "Plusieurs fournisseurs et accès inactifs ; ouvrir +N.", () => <ProviderSummary ids={["openai", "azure", "anthropic", "bedrock", "moonshot"]} activeIds={new Set(["openai", "anthropic"])} />),
  entry("latest-group-0", "Groupes · aucun", "Groupes", "Molécules", "CompactCollection.tsx", "État vide.", () => <GroupSummary names={[]} />),
  entry("latest-group-1", "Groupes · un", "Groupes", "Molécules", "CompactCollection.tsx", "Un groupe hérité.", () => <GroupSummary names={["Code"]} />),
  entry("latest-group-many", "Groupes · débordement", "Groupes", "Molécules", "CompactCollection.tsx", "Plusieurs groupes ; ouvrir +N.", () => <GroupSummary names={["Code", "Reasoning", "Vision"]} />),
  entry("latest-view-menu", "Menu de vue", "Navigation", "Molécules", "ViewMenu.tsx", "Formats compact, carré et tableau.", ViewMenuSample),
  entry("latest-state-badge", "Étiquettes d’état", "États et feedback", "Atomes", "shared.tsx", "Actif, inactif, exclu et non configuré.", () => <div className="flex flex-wrap gap-2"><StateBadge state="active" /><StateBadge state="off" /><StateBadge state="excluded" /><StateBadge state="unavailable" /></div>),
  entry("latest-access-row", "Lignes d’accès · quatre états", "Accès fournisseurs", "Molécules", "shared.tsx", "Accès actif, exclu, inactif et indisponible, avec actions locales.", AccessStates),
  entry("latest-access-menu", "Menu d’accès · libre et verrouillé", "Accès fournisseurs", "Molécules", "shared.tsx", "Contrôle standard et compact sur deux états de modèle.", AccessMenuSample),
  entry("latest-access-detail", "Détail d’un accès", "Propriétés et sources", "Organismes", "shared.tsx", "Dialogue avec identifiants, configuration et provenance des données fictives.", AccessDetailSample),
  entry("latest-groups-panel", "Choix de groupes", "Groupes", "Organismes", "cards.tsx", "Recherche et héritage de groupes.", GroupsPanelSample),
  entry("latest-draft-summary", "Résumé du brouillon", "Clés virtuelles", "Organismes", "summary.tsx", "Choix directs, héritage, exclusions et accès.", () => <SummarySample kind="draft" />),
  entry("latest-planned", "Identifiants prévus", "Clés virtuelles", "Molécules", "summary.tsx", "Prévisualisation des formats d’identifiants exposés.", () => <SummarySample kind="planned" />),
  entry("latest-catalog-page", "Page catalogue", "Parcours complets", "Templates et pages", "CatalogPage.tsx", "Catalogue complet et ouverture de fiche.", CatalogPageSample),
  entry("latest-model-detail", "Fiche modèle", "Parcours complets", "Templates et pages", "ModelDetail.tsx", "Fiche réelle du modèle et de ses accès.", () => <ModelDetail model={model} onBack={() => {}} />),
  entry("latest-group-workspace", "Espace groupes", "Groupes", "Templates et pages", "GroupWorkspace.tsx", "Gestion des groupes sur copies locales des données fictives.", GroupWorkspaceSample),
  entry("latest-key-library", "Bibliothèque de clés", "Clés virtuelles", "Templates et pages", "KeyLibrary.tsx", "Clés de démonstration sans jetons utilisables.", KeyLibrarySample),
  entry("latest-variant-a", "Variante A · guidée", "Parcours complets", "Templates et pages", "VariantA.tsx", "Étapes modèles, groupes et vérification ; brouillon local.", () => <VariantSample mode="basic" />),
  entry("latest-variant-b", "Variante B · expert", "Parcours complets", "Templates et pages", "VariantB.tsx", "Composition libre et panneau de brouillon ; données locales.", () => <VariantSample mode="expert" />),
];
