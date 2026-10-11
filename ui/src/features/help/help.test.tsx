import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import { HelpContent } from "./HelpContent";
import { markTourSeen, pickAnchor, tourKey, tourSeen, tourSteps } from "./tour";

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
for (const phrase of ["Keep Mistral in Bifrost", "Remove these models from the key in Bifrost", "Replace “all providers” by the explicit list", "preview", "kept in Bifrost", "Ready to adopt", "inferred creator", "Associate a reference", "Add to card", "no reference"]) must(english.includes(phrase), `English help mentions ${phrase}`);
const french = help("fr");
for (const phrase of ["Garder Mistral dans Bifrost", "Retirer ces modèles de la clé dans Bifrost", "Remplacer « tous les fournisseurs » par la liste explicite", "aperçu", "conservé dans Bifrost", "Prête à adopter", "créateur déduit", "Associer une fiche documentaire", "Ajouter à la fiche", "sans référence"]) must(french.includes(phrase), `French help mentions ${phrase}`);
console.log("Help and tour checks passed");
