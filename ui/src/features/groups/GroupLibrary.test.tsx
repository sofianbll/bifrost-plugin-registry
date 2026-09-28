import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import { cardFormat, defaultViewOptions, gridColumns } from "../../components/registry/ViewOptions";
import { fixture } from "../../dev/fixtures/registry";
import { GroupLibrary } from "./GroupLibrary";

for (const layout of ["grid", "table"] as const) {
  const html = renderToStaticMarkup(<LanguageContext.Provider value="en"><GroupLibrary groups={fixture.groups} models={fixture.models} keys={fixture.keys} search="" onSearch={() => {}} view={{ ...defaultViewOptions, layout }} onViewChange={() => {}} onResetView={() => {}} onCreate={() => {}} onEdit={() => {}} /></LanguageContext.Provider>);
  if (!html.includes(fixture.groups[0].name)) throw new Error(`${layout}: group name must be rendered`);
}
for (const shape of ["rectangle", "square"] as const) {
  const view = { ...defaultViewOptions, layout: "grid" as const, shape: shape as "rectangle" | "square", size: "small" as const };
  const html = renderToStaticMarkup(<LanguageContext.Provider value="en"><GroupLibrary groups={fixture.groups} models={fixture.models} keys={fixture.keys} search="" onSearch={() => {}} view={view} onViewChange={() => {}} onResetView={() => {}} onCreate={() => {}} onEdit={() => {}} /></LanguageContext.Provider>);
  const expectedFormat = cardFormat(view);
  if (!html.includes(`data-format="${expectedFormat}"`)) throw new Error(`shape ${shape}: expected format ${expectedFormat}`);
  if (!html.includes(`xl:grid-cols-${gridColumns(view.size)}`)) throw new Error(`shape ${shape}: expected ${gridColumns(view.size)} columns`);
}

const render = (view = defaultViewOptions, language: "en" | "fr" = "en", keys = fixture.keys) => renderToStaticMarkup(<LanguageContext.Provider value={language}><GroupLibrary groups={fixture.groups} models={fixture.models} keys={keys} search="" onSearch={() => {}} view={view} onViewChange={() => {}} onResetView={() => {}} onCreate={() => {}} onEdit={() => {}} /></LanguageContext.Provider>);

// Density belongs to the grid view only: the table hides it and its column counts, like Shape.
for (const layout of ["grid", "table"] as const) {
  const html = render({ ...defaultViewOptions, layout }, "fr");
  const group = (label: string) => html.includes(`aria-label="${label}"`);
  if (layout === "grid" && (!group("Densité de la grille") || !group("Forme des cartes"))) throw new Error("grid layout must keep the density and shape controls");
  if (layout === "table" && group("Densité de la grille")) throw new Error("table layout must hide the density control");
  if (layout === "table" && (html.includes(">Petit<") || html.includes(">Moyen<") || html.includes(">Grand<"))) throw new Error("table layout must hide the density column counts");
  if (layout === "table" && group("Forme des cartes")) throw new Error("table layout must keep hiding the shape control");
}

// One key or several keys must read as "1 clé" and "3 clés", in cards and in the table.
const singleKey = [{ ...fixture.keys[0], policy: { ...fixture.keys[0].policy, groups: [fixture.groups[0].id] } }];
for (const layout of ["grid", "table"] as const) {
  const singular = render({ ...defaultViewOptions, layout }, "fr", singleKey);
  if (!singular.includes("1 clé") || singular.includes("1 clés")) throw new Error(`${layout}: a single key must read "1 clé"`);
  const plural = render({ ...defaultViewOptions, layout }, "fr", [...singleKey, { ...singleKey[0], id: "second-key" }, { ...singleKey[0], id: "third-key" }]);
  if (!plural.includes("3 clés")) throw new Error(`${layout}: several keys must read "3 clés"`);
}

console.log("GroupLibrary view checks passed");
