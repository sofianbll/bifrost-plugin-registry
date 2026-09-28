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

console.log("GroupLibrary view checks passed");
