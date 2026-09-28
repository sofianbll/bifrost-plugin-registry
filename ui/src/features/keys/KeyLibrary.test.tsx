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
