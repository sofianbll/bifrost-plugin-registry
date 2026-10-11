import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import { HelpContent } from "./HelpContent";
import { markTourSeen, pickAnchor, tourKey, tourSeen, tourSteps } from "./tourSteps";

// #96: the tour is offered once per browser (and never nags when the browser keeps nothing), its
// steps fall back to a page anchor, and the help text describes what the panel does today.
const must = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const text = (html: string) => html.split(/<[^>]*>/).join("");
const memory = () => { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) }; };

const store = memory();
must(!tourSeen(store), "a first visit has not seen the tour");
markTourSeen(store);
must(tourSeen(store) && store.getItem(tourKey) !== null, "the tour is remembered once offered");
must(tourKey.startsWith("bifrost-registry."), "the key is namespaced like the other Registry keys");
const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
must(tourSeen(blocked), "unreadable storage is not offered the tour on every load");
markTourSeen(blocked); // must not throw
must(tourSeen(null), "no storage at all: not offered");

must(tourSteps.map(step => step.page).join() === "models,groups,keys,keys", "Models, Groups, Keys, then adoption");
must(pickAnchor(tourSteps[0], name => name === "filters") === "filters", "a step falls back to its next anchor");
must(pickAnchor(tourSteps[0], name => name === "first-model") === "first-model", "the first anchor present wins");
must(pickAnchor(tourSteps[0], () => false) === undefined, "no anchor on the page: the step is skipped");

const help = (language: "en" | "fr") => text(renderToStaticMarkup(<LanguageContext.Provider value={language}><HelpContent /></LanguageContext.Provider>));
const english = help("en");
for (const phrase of ["Keep Mistral in Bifrost", "Remove these models from the key in Bifrost", "Replace “all providers” by the explicit list", "Replace “all models” by the models saved in Registry", "preview", "kept in Bifrost", "Ready to adopt", "inferred creator", "Associate a reference", "Add to card", "no reference"]) must(english.includes(phrase), `English help mentions ${phrase}`);
const french = help("fr");
for (const phrase of ["Garder Mistral dans Bifrost", "Retirer ces modèles de la clé dans Bifrost", "Remplacer « tous les fournisseurs » par la liste explicite", "Remplacer « tous les modèles » par les modèles enregistrés dans Registry", "aperçu", "conservé dans Bifrost", "Prête à adopter", "créateur déduit", "Associer une fiche documentaire", "Ajouter à la fiche", "sans référence"]) must(french.includes(phrase), `French help mentions ${phrase}`);
// The numbered path has as many steps as the tour, and a short glossary follows.
must((renderToStaticMarkup(<LanguageContext.Provider value="en"><HelpContent /></LanguageContext.Provider>).match(/<li class="flex gap-3">/g) ?? []).length === tourSteps.length, "help lists the tour's steps");
for (const phrase of ["Reference", "Inferred creator", "Kept in Bifrost", "Readback", "Adopt"]) must(english.includes(phrase), `English glossary explains ${phrase}`);
for (const phrase of ["Fiche documentaire", "Créateur déduit", "Conservé dans Bifrost", "Relecture", "Adopter"]) must(french.includes(phrase), `French glossary explains ${phrase}`);
// "Add to card" opens the card with the access offered; nothing is added until the person adds it and saves.
must(english.includes("opens that saved card") && english.includes("“Also available”") && !english.includes("puts an available access"), "English help says Add to card only opens the card");
must(french.includes("ouvre cette fiche enregistrée") && french.includes("« Également disponibles »") && !french.includes("met un accès disponible"), "French help says Add to card only opens the card");
// The browser wraps <q> in its own quotes, which doubles the ones a quoted label already carries.
must(!renderToStaticMarkup(<LanguageContext.Provider value="en"><HelpContent /></LanguageContext.Provider>).includes("<q"), "labels are not <q> elements");
// #85 round 2: terms and their definitions are a list layout (and a colon), not em-dash separators.
must(!english.includes("—") && !french.includes("—"), "no em dash between a term and its definition");
must(french.includes("Modèles :") && english.includes("Models:"), "a step names its page with the language's colon");
console.log("Help and tour checks passed");
