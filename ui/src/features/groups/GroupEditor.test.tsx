import { renderToStaticMarkup } from "react-dom/server";
import { defaultViewOptions } from "../../components/registry/ViewOptions";
import { fixture } from "../../dev/fixtures/registry";
import type { Group, Model } from "../../domain/registry";
import { LanguageContext } from "../../lib/locale";
import { GroupEditor } from "./GroupEditor";

// One verb per concept, and a field that is not shouted at before it is touched (critique round 5): the group
// sheet publishes what it previewed, "Required" is a neutral hint until the name was left empty, and an empty
// list of models points at Register, the verb that creates a card.
const must = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const text = (html: string) => html.split(/<[^>]*>/).join("");
const render = (
  language: "en" | "fr",
  group: Group,
  options: { models?: Model[]; groups?: Group[]; snapshotMode?: boolean } = {},
) =>
  renderToStaticMarkup(
    <LanguageContext.Provider value={language}>
      <GroupEditor
        group={group}
        groups={options.groups ?? []}
        models={options.models ?? fixture.models}
        keys={fixture.keys}
        snapshotMode={options.snapshotMode ?? false}
        busy={false}
        preferences={defaultViewOptions}
        expert
        onChange={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
        onDelete={() => {}}
      />
    </LanguageContext.Provider>,
  );

const blank: Group = { id: "new", name: "", description: "", members: [] };
for (const [language, required, publish] of [
  ["en", "Required", "Publish group"],
  ["fr", "Obligatoire", "Publier le groupe"],
] as const) {
  const html = render(language, blank);
  must(
    text(html).includes(required) && !html.includes('aria-invalid="true"') && !html.includes('data-invalid="true"'),
    `${language}: an untouched empty name is a neutral hint, not an error`,
  );
  must(text(html).includes(publish), `${language}: the button publishes, as the sheet says`);
}
must(
  text(render("en", blank, { snapshotMode: true })).includes("Save locally") &&
    !text(render("en", blank, { snapshotMode: true })).includes("Publish group"),
  "a local copy saves locally",
);

// An empty library sends the person to Register, never to "Add a model".
for (const [language, line] of [
  ["en", "Register a model in Models first."],
  ["fr", "Enregistrez d’abord un modèle dans Modèles."],
] as const) {
  const words = text(render(language, blank, { models: [] }));
  must(words.includes(line), `${language}: no model to choose, got ${words}`);
  must(!/Add a model|Ajoutez d’abord un modèle/.test(words), `${language}: Add attaches, it does not create a card`);
}

// The impact of a change is said in the verb of the button: it changes keys when published.
const used = fixture.groups.find(group => fixture.keys.some(key => key.policy.groups.includes(group.id)))!;
const changed: Group = { ...used, members: [] };
for (const [language, badge] of [
  ["en", "Will change on publish"],
  ["fr", "Changera à la publication"],
] as const) {
  const words = text(render(language, changed, { groups: fixture.groups }));
  must(words.includes(badge) && !/on save|à l’enregistrement/.test(words), `${language}: impact badge, got ${words}`);
}
for (const [language, explanation] of [
  ["en", "Saved filters, exclusions or access choices are preserved. Member editing is unavailable in this panel."],
  [
    "fr",
    "Les filtres, exclusions ou choix d’accès enregistrés sont conservés. La modification des membres est indisponible dans ce panneau.",
  ],
] as const) {
  const locked = { ...used, members: [], membersLocked: true };
  const html = render(language, locked, { groups: [locked] });
  must(text(html).includes(explanation), `${language}: hidden rules are explained`);
  must(
    !html.includes('aria-label="Group models"') && !html.includes('aria-label="Modèles du groupe"'),
    `${language}: no ambiguous member selector`,
  );
  must(
    !/<button[^>]*disabled=""[^>]*>[^<]*(?:Publish group|Publier le groupe)/.test(html),
    `${language}: filter-only groups can save details`,
  );
}
console.log("Group editor checks passed");
