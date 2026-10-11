import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import { cardFormat, defaultViewOptions, gridColumns } from "../../components/registry/ViewOptions";
import { fixture } from "../../dev/fixtures/registry";
import type { Key } from "../../domain/registry";
import { KeyLibrary } from "./KeyLibrary";

const native = { ...fixture.keys[0], managed: false, policy: { ...fixture.keys[0].policy, groups: [], added: [], excluded: [] } };
// #69: an unmanaged key says what Bifrost allows today, or that its permissions were not read.
const summaries: [Key["permissions"], string][] = [
  [undefined, "Not read yet"],
  [{ allProviders: true, providers: [] }, "All providers"],
  [{ allProviders: false, providers: [] }, "No provider"],
  [{ allProviders: false, providers: [{ provider: "Codex", allModels: false, models: ["qa-codex", "qa-codex-mini"] }] }, "1 provider · 2 models"],
  [{ allProviders: false, providers: [{ provider: "Claude", allModels: true, models: [] }, { provider: "Codex", allModels: false, models: ["qa-codex"] }] }, "2 providers · 1 model · all models of Claude"],
  // An empty native list means all or none depending on the Bifrost version: never "0 models".
  [{ allProviders: false, providers: [{ provider: "Google", allModels: false, models: [], versionDependent: true }] }, "1 provider · models depend on the Bifrost version for Google"],
];
for (const layout of ["grid", "table"] as const) {
  for (const [permissions, summary] of summaries) {
    const html = renderToStaticMarkup(<LanguageContext.Provider value="en"><KeyLibrary keys={[{ ...native, permissions }]} groups={fixture.groups} models={fixture.models} view={{ ...defaultViewOptions, layout }} onViewChange={() => {}} onResetView={() => {}} busy={false} snapshotMode onCreate={() => {}} onOpen={() => {}} /></LanguageContext.Provider>);
    if (!html.includes(summary)) throw new Error(`${layout}: native permissions must read "${summary}"`);
    if (html.includes("0 models") || html.includes("No active provider") || html.includes("0 IDs")) throw new Error(`${layout}: Registry emptiness must not describe native permissions`);
  }
}
const frenchSummary = renderToStaticMarkup(<LanguageContext.Provider value="fr"><KeyLibrary keys={[{ ...native, permissions: summaries[3][0] }]} groups={fixture.groups} models={fixture.models} view={defaultViewOptions} onViewChange={() => {}} onResetView={() => {}} busy={false} snapshotMode onCreate={() => {}} onOpen={() => {}} /></LanguageContext.Provider>);
if (!frenchSummary.includes("1 fournisseur · 2 modèles")) throw new Error("French native permissions summary is missing");
const managedSummary = renderToStaticMarkup(<LanguageContext.Provider value="en"><KeyLibrary keys={[{ ...fixture.keys[0], managed: true, permissions: summaries[3][0] }]} groups={fixture.groups} models={fixture.models} view={defaultViewOptions} onViewChange={() => {}} onResetView={() => {}} busy={false} snapshotMode onCreate={() => {}} onOpen={() => {}} /></LanguageContext.Provider>);
if (!managedSummary.includes("Bifrost allows · 1 provider · 2 models")) throw new Error("A managed key card must also say what Bifrost allows today");
// #87: every unmanaged key says ready, blocked (and why) or empty, in grid and table, in both languages.
const verdicts: [string, Key, string, string, string][] = [
  ["ready", { ...native, name: "Ready Key", readiness: { state: "ready", blockers: [] } }, "Ready to adopt", "Prête à adopter", ""],
  ["blocked", { ...native, name: "Blocked Key", readiness: { state: "blocked", blockers: [{ provider: "mistral", kind: "undiscovered", count: 3, models: ["a", "b", "c"] }] } }, "Blocked", "Bloquée", "Mistral · 3 models not discovered"],
  ["empty", { ...native, name: "Empty Key", readiness: { state: "empty", blockers: [] } }, "Empty", "Vide", ""],
  ["not read", { ...native, name: "Unread Key" }, "Adoption needed", "À adopter", ""],
];
for (const [language, index] of [["en", 2], ["fr", 3]] as const) {
  for (const layout of ["grid", "table"] as const) {
    for (const verdict of verdicts) {
      const [, key, , , reason] = verdict;
      const html = renderToStaticMarkup(<LanguageContext.Provider value={language}><KeyLibrary keys={[key]} groups={fixture.groups} models={fixture.models} view={{ ...defaultViewOptions, layout }} onViewChange={() => {}} onResetView={() => {}} busy={false} snapshotMode onCreate={() => {}} onOpen={() => {}} /></LanguageContext.Provider>);
      const text = html.split(/<[^>]*>/).join("");
      if (!text.includes(verdict[index])) throw new Error(`${language} ${layout}: ${verdict[0]} key must read "${verdict[index]}"`);
      if (language === "en" && reason && !text.includes(reason)) throw new Error(`${layout}: a blocked key must say why ("${reason}")`);
      if (text.includes("adoption needed") && verdict[0] !== "not read") throw new Error(`${language} ${layout}: ${verdict[0]} key still shows the uniform adoption badge`);
    }
  }
}
// The Keys page filters by readiness.
const filterName = (language: "en" | "fr") => renderToStaticMarkup(<LanguageContext.Provider value={language}><KeyLibrary keys={[native]} groups={fixture.groups} models={fixture.models} view={defaultViewOptions} onViewChange={() => {}} onResetView={() => {}} busy={false} snapshotMode onCreate={() => {}} onOpen={() => {}} /></LanguageContext.Provider>);
if (!filterName("en").includes('aria-label="Filter by readiness"') || !filterName("fr").includes('aria-label="Filtrer par état d’adoption"')) throw new Error("The Keys page must offer a readiness filter in both languages");
for (const shape of ["rectangle", "square"] as const) {
  const view = { ...defaultViewOptions, layout: "grid" as const, shape: shape as "rectangle" | "square", size: "medium" as const };
  const html = renderToStaticMarkup(<LanguageContext.Provider value="en"><KeyLibrary keys={[native]} groups={fixture.groups} models={fixture.models} view={view} onViewChange={() => {}} onResetView={() => {}} busy={false} snapshotMode onCreate={() => {}} onOpen={() => {}} /></LanguageContext.Provider>);
  const expectedFormat = cardFormat(view);
  if (!html.includes(`data-format="${expectedFormat}"`)) throw new Error(`shape ${shape}: expected format ${expectedFormat}`);
  if (!html.includes(`xl:grid-cols-${gridColumns(view.size)}`)) throw new Error(`shape ${shape}: expected ${gridColumns(view.size)} columns`);
}

// The keys list keeps the density control in grid and hides it in table, like the catalog and groups.
for (const layout of ["grid", "table"] as const) {
  const html = renderToStaticMarkup(<LanguageContext.Provider value="fr"><KeyLibrary keys={[native]} groups={fixture.groups} models={fixture.models} view={{ ...defaultViewOptions, layout }} onViewChange={() => {}} onResetView={() => {}} busy={false} snapshotMode onCreate={() => {}} onOpen={() => {}} /></LanguageContext.Provider>);
  const density = html.includes('aria-label="Densité de la grille"');
  if (layout === "grid" && !density) throw new Error("grid layout must keep the density control");
  if (layout === "table" && density) throw new Error("table layout must hide the density control");
  if (!html.includes('aria-label="Grille"') || !html.includes('aria-label="Tableau"')) throw new Error(`${layout}: icon-only view toggles must keep explicit names`);
}

// #53: a key whose model awaits an access choice says so in grid and table, in both languages.
const pending = { ...fixture.keys[0], managed: true, pendingAccessSelection: { "deepseek-v4.1-flash": ["openrouter/deepseek-v4.1-flash", "deepseek/deepseek-v4.1-flash"] } };
for (const [language, label] of [["en", "Access choice needed"], ["fr", "Choix d’accès requis"]] as const) {
  for (const layout of ["grid", "table"] as const) {
    const html = renderToStaticMarkup(<LanguageContext.Provider value={language}><KeyLibrary keys={[pending]} groups={fixture.groups} models={fixture.models} view={{ ...defaultViewOptions, layout }} onViewChange={() => {}} onResetView={() => {}} busy={false} snapshotMode onCreate={() => {}} onOpen={() => {}} /></LanguageContext.Provider>);
    if (!html.includes(label)) throw new Error(`${language} ${layout}: pending access choice must be visible`);
    if (layout === "grid" && !html.includes("deepseek-v4.1-flash")) throw new Error(`${language}: the card must name the withheld model`);
  }
}

// Story 39: every key action is named after its key, in grid and table, in both languages.
const named = [{ ...native, id: "a", name: "Key A" }, { ...native, id: "b", name: "Key B" }, { ...fixture.keys[0], id: "c", name: "Key C", managed: true }, { ...fixture.keys[0], id: "d", name: "Key D", managed: true }];
for (const language of ["en", "fr"] as const) {
  for (const layout of ["grid", "table"] as const) {
    const html = renderToStaticMarkup(<LanguageContext.Provider value={language}><KeyLibrary keys={named} groups={fixture.groups} models={fixture.models} view={{ ...defaultViewOptions, layout }} onViewChange={() => {}} onResetView={() => {}} busy={false} snapshotMode onCreate={() => {}} onOpen={() => {}} /></LanguageContext.Provider>);
    const actions = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(match => match[1].split(/<[^>]*>/).join("")).filter(name => /^(Review|Open|Examiner|Ouvrir)\b/.test(name));
    const expected = language === "en" ? ["Review · Key A", "Review · Key B", "Open · Key C", "Open · Key D"] : ["Examiner · Key A", "Examiner · Key B", "Ouvrir · Key C", "Ouvrir · Key D"];
    if (JSON.stringify(actions) !== JSON.stringify(expected)) throw new Error(`${language} ${layout}: key actions must name their key, got ${JSON.stringify(actions)}`);
  }
}
