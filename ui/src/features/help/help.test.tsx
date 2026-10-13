import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import { HelpContent } from "./HelpContent";
import { stepCopy } from "./Tour";
import { markTourSeen, pickAnchor, tourKey, tourSeen, tourSteps } from "./tourSteps";

// #96: the tour is offered once per browser (and never nags when the browser keeps nothing), its
// steps fall back to a page anchor, and the help text describes what the panel does today.
const must = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const text = (html: string) => html.split(/<[^>]*>/).join("");
const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

const store = memory();
must(!tourSeen(store), "a first visit has not seen the tour");
markTourSeen(store);
must(tourSeen(store) && store.getItem(tourKey) !== null, "the tour is remembered once offered");
must(tourKey.startsWith("bifrost-registry."), "the key is namespaced like the other Registry keys");
const blocked = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};
must(tourSeen(blocked), "unreadable storage is not offered the tour on every load");
markTourSeen(blocked); // must not throw
must(tourSeen(null), "no storage at all: not offered");

must(tourSteps.map(step => step.page).join() === "models,groups,keys,keys", "Models, Groups, Keys, then adoption");
must(pickAnchor(tourSteps[0], name => name === "filters") === "filters", "a step falls back to its next anchor");
must(pickAnchor(tourSteps[0], name => name === "first-model") === "first-model", "the first anchor present wins");
must(pickAnchor(tourSteps[0], () => false) === undefined, "no anchor on the page: the step is skipped");

const help = (language: "en" | "fr", expert = false) =>
  text(
    renderToStaticMarkup(
      <LanguageContext.Provider value={language}>
        <HelpContent expert={expert} />
      </LanguageContext.Provider>,
    ),
  );
const english = help("en");
for (const phrase of [
  "Keep [provider] in Bifrost",
  "Remove these models from the key in Bifrost",
  "Replace “all providers” by the explicit list",
  "Replace “all models” by the models saved in Registry",
  "preview",
  "kept in Bifrost",
  "Ready to adopt",
  "inferred creator",
  "Associate a reference",
  "Add to card",
  "no reference",
])
  must(english.includes(phrase), `English help mentions ${phrase}`);
const french = help("fr");
for (const phrase of [
  "Garder [fournisseur] dans Bifrost",
  "Retirer ces modèles de la clé dans Bifrost",
  "Remplacer « tous les fournisseurs » par la liste explicite",
  "Remplacer « tous les modèles » par les modèles enregistrés dans Registry",
  "aperçu",
  "conservé dans Bifrost",
  "Prête à adopter",
  "créateur déduit",
  "Associer une fiche documentaire",
  "Ajouter à la fiche",
  "sans référence",
])
  must(french.includes(phrase), `French help mentions ${phrase}`);
// The numbered path has as many steps as the tour, and a short glossary follows.
must(
  (
    renderToStaticMarkup(
      <LanguageContext.Provider value="en">
        <HelpContent />
      </LanguageContext.Provider>,
    ).match(/<li class="flex gap-3">/g) ?? []
  ).length === tourSteps.length,
  "help lists the tour's steps",
);
for (const phrase of [
  "Access",
  "Subscription, provider",
  "Reference",
  "Inferred creator",
  "Kept in Bifrost",
  "Checked with Bifrost",
  "Adopt",
])
  must(english.includes(phrase), `English glossary explains ${phrase}`);
for (const phrase of [
  "Accès",
  "Abonnement, fournisseur",
  "Fiche documentaire",
  "Créateur déduit",
  "Conservé dans Bifrost",
  "Vérifiée avec Bifrost",
  "Adopter",
])
  must(french.includes(phrase), `French glossary explains ${phrase}`);
// Final critique: "Verified · 1 difference" is explained once in the glossary, with the sentence the key's tooltip reads.
must(
  english.includes("Verified · 1 difference") &&
    english.includes("Bifrost confirmed this key. 1 permission kept in Bifrost is not listed by Bifrost."),
  "English glossary explains Verified with a difference",
);
must(
  french.includes("Vérifiée · 1 écart") &&
    french.includes("Bifrost a confirmé cette clé. 1 permission conservée dans Bifrost n’est pas listée par Bifrost."),
  "French glossary explains Verified with a difference",
);
// The check has one name: the glossary says "Checked with Bifrost", never "Readback"; the example is no real provider.
for (const [language, words] of [
  ["en", english],
  ["fr", french],
] as const)
  for (const jargon of ["Readback", "Relecture", "Mistral"])
    must(!words.includes(jargon), `${language} help does not say ${jargon}`);
// #101: the common model ID is a word only Expert meets, so only Expert's glossary explains it.
must(
  !english.includes("Common model ID") &&
    help("en", true).includes("Common model ID") &&
    !french.includes("Identifiant commun du modèle") &&
    help("fr", true).includes("Identifiant commun du modèle"),
  "the common model ID is in Expert's glossary only",
);
// The tour and the help name the editor's steps as the editor does (Models, Groups, Review), registered cards
// as the Register button does, and keep the same verb for the same thing.
for (const [language, copy] of [
  ["en", (en: string) => en],
  ["fr", (_en: string, fr: string) => fr],
] as const) {
  const keys = stepCopy("keys", copy).text;
  const steps =
    language === "en" ? ["Models", "Groups", "Review", "publish"] : ["Modèles", "Groupes", "Vérifier", "publiez"];
  for (const step of steps) must(keys.includes(step), `${language} keys step names ${step}, got ${keys}`);
}
must(
  stepCopy("models", (en: string) => en).text.includes("registered model cards") &&
    english.includes("read your registered cards") &&
    !english.includes("saved cards"),
  "English models step and help say registered cards",
);
// "Add to card" opens the card with the access offered; nothing is added until the person adds it and saves.
must(
  english.includes("opens that registered card") &&
    english.includes("“Also available”") &&
    !english.includes("puts an available access"),
  "English help says Add to card only opens the card",
);
must(
  french.includes("ouvre cette fiche enregistrée") &&
    french.includes("« Également disponibles »") &&
    !french.includes("met un accès disponible"),
  "French help says Add to card only opens the card",
);
// The browser wraps <q> in its own quotes, which doubles the ones a quoted label already carries.
must(
  !renderToStaticMarkup(
    <LanguageContext.Provider value="en">
      <HelpContent />
    </LanguageContext.Provider>,
  ).includes("<q"),
  "labels are not <q> elements",
);
// #85 round 2: terms and their definitions are a list layout (and a colon), not em-dash separators.
must(!english.includes("—") && !french.includes("—"), "no em dash between a term and its definition");
must(french.includes("Modèles :") && english.includes("Models:"), "a step names its page with the language's colon");
console.log("Help and tour checks passed");
