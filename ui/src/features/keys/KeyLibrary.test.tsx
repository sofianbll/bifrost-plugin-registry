import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import { cardFormat, defaultViewOptions, gridColumns } from "../../components/registry/ViewOptions";
import { fixture } from "../../dev/fixtures/registry";
import { KeyLibrary } from "./KeyLibrary";

const native = { ...fixture.keys[0], managed: false, policy: { ...fixture.keys[0].policy, groups: [], added: [], excluded: [] } };
for (const layout of ["grid", "table"] as const) {
  const html = renderToStaticMarkup(<LanguageContext.Provider value="en"><KeyLibrary keys={[native]} groups={fixture.groups} models={fixture.models} search="" onSearch={() => {}} view={{ ...defaultViewOptions, layout }} onViewChange={() => {}} onResetView={() => {}} busy={false} snapshotMode onCreate={() => {}} onOpen={() => {}} /></LanguageContext.Provider>);
  if (!html.includes("Bifrost permissions") || !html.includes("Registry selection to prepare")) throw new Error(`${layout}: native scope must be explicit`);
  if (html.includes("0 models") || html.includes("No active provider") || html.includes("0 IDs")) throw new Error(`${layout}: Registry emptiness must not describe native permissions`);
}
for (const shape of ["rectangle", "square"] as const) {
  const view = { ...defaultViewOptions, layout: "grid" as const, shape: shape as "rectangle" | "square", size: "medium" as const };
  const html = renderToStaticMarkup(<LanguageContext.Provider value="en"><KeyLibrary keys={[native]} groups={fixture.groups} models={fixture.models} search="" onSearch={() => {}} view={view} onViewChange={() => {}} onResetView={() => {}} busy={false} snapshotMode onCreate={() => {}} onOpen={() => {}} /></LanguageContext.Provider>);
  const expectedFormat = cardFormat(view);
  if (!html.includes(`data-format="${expectedFormat}"`)) throw new Error(`shape ${shape}: expected format ${expectedFormat}`);
  if (!html.includes(`xl:grid-cols-${gridColumns(view.size)}`)) throw new Error(`shape ${shape}: expected ${gridColumns(view.size)} columns`);
}

// The keys list keeps the density control in grid and hides it in table, like the catalog and groups.
for (const layout of ["grid", "table"] as const) {
  const html = renderToStaticMarkup(<LanguageContext.Provider value="fr"><KeyLibrary keys={[native]} groups={fixture.groups} models={fixture.models} search="" onSearch={() => {}} view={{ ...defaultViewOptions, layout }} onViewChange={() => {}} onResetView={() => {}} busy={false} snapshotMode onCreate={() => {}} onOpen={() => {}} /></LanguageContext.Provider>);
  const density = html.includes('aria-label="Densité de la grille"');
  if (layout === "grid" && !density) throw new Error("grid layout must keep the density control");
  if (layout === "table" && density) throw new Error("table layout must hide the density control");
  if (!html.includes('aria-label="Grille"') || !html.includes('aria-label="Tableau"')) throw new Error(`${layout}: icon-only view toggles must keep explicit names`);
}

// #53: a key whose model awaits an access choice says so in grid and table, in both languages.
const pending = { ...fixture.keys[0], managed: true, pendingAccessSelection: { "deepseek-v4.1-flash": ["openrouter/deepseek-v4.1-flash", "deepseek/deepseek-v4.1-flash"] } };
for (const [language, label] of [["en", "Access choice needed"], ["fr", "Choix d’accès requis"]] as const) {
  for (const layout of ["grid", "table"] as const) {
    const html = renderToStaticMarkup(<LanguageContext.Provider value={language}><KeyLibrary keys={[pending]} groups={fixture.groups} models={fixture.models} search="" onSearch={() => {}} view={{ ...defaultViewOptions, layout }} onViewChange={() => {}} onResetView={() => {}} busy={false} snapshotMode onCreate={() => {}} onOpen={() => {}} /></LanguageContext.Provider>);
    if (!html.includes(label)) throw new Error(`${language} ${layout}: pending access choice must be visible`);
    if (layout === "grid" && !html.includes("deepseek-v4.1-flash")) throw new Error(`${language}: the card must name the withheld model`);
  }
}
