import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import type { Readiness } from "../../domain/registry";
import { AdoptionBlockers } from "./AdoptionBlockers";

// #87: the adoption dialog lists blockers per provider, with counts, model names and the way forward.
const render = (language: "en" | "fr", readiness: Readiness | undefined, reasons: string[], onShowToAdd?: (routes: string[]) => void) =>
  renderToStaticMarkup(<LanguageContext.Provider value={language}><AdoptionBlockers readiness={readiness} reasons={reasons} onShowToAdd={onShowToAdd} /></LanguageContext.Provider>);
const text = (html: string) => html.split(/<[^>]*>/).join("");
const must = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

const hermes: Readiness = { state: "blocked", blockers: [
  { provider: "mistral", kind: "undiscovered", count: 3, models: ["qa-mistral-large", "qa-mistral-small", "qa-mistral-code"] },
  { provider: "synthetic-provider", kind: "unsaved", count: 1, models: ["qa-unregistered"] },
  { provider: "", kind: "all-providers", count: 1, models: [], reasons: ["allow_all_providers grants future providers and cannot be represented safely"] },
] };
const hermesReasons = ["Native route mistral/qa-mistral-large needs a configured direct Registry access with the same native name"];

const english = render("en", hermes, hermesReasons, () => {});
const plain = text(english);
for (const line of ["Mistral · 3 models not discovered", "Synthetic Provider · 1 model to add"]) must(plain.includes(line), `the dialog must list "${line}"`);
must(plain.includes("Bifrost does not list these models") && plain.includes("Registry has no card for them yet"), "each kind explains itself");
must(plain.includes("allow_all_providers"), "the reason as sent stays visible for all-providers");
// Names sit behind a disclosure; only models the models page can add get a way there.
must(english.split(/<details[\s\S]*?<\/details>/).join("").includes("qa-mistral-large") === false, "model names stay behind their disclosure");
must(english.includes("qa-mistral-large, qa-mistral-small, qa-mistral-code") && english.includes("qa-unregistered"), "model names are listed");
must((english.match(/Show in To add/g) || []).length === 1, "only the unsaved models link to To add");
must(!render("en", hermes, hermesReasons).includes("Show in To add"), "no link without a destination");
must(!plain.includes("needs a configured direct Registry access"), "the plain per-model reasons are replaced by the grouped list");

const french = text(render("fr", hermes, hermesReasons, () => {}));
for (const line of ["Mistral · 3 modèles non découverts", "Synthetic Provider · 1 modèle à ajouter", "Voir dans À ajouter", "Bifrost ne liste pas ces modèles"]) must(french.includes(line), `French dialog must read "${line}"`);

// An empty key has nothing to adopt yet; say so instead of listing blockers.
const empty = text(render("en", { state: "empty", blockers: [] }, ["Native key has no representable configured model access"]));
must(empty.includes("allows no model in Bifrost yet"), "empty key explanation");
must(text(render("fr", { state: "empty", blockers: [] }, [])).includes("n’autorise encore aucun modèle"), "empty key explanation in French");

// Without a verdict (rebinding, older server) the plain reasons still read as UI copy.
const plainReasons = text(render("en", undefined, ["Native key is inactive or expired", "No enabled native provider key for Codex/x"]));
must(plainReasons.includes("Native key is inactive or expired") && plainReasons.includes("No enabled native provider key for Codex/x"), "plain reasons are shown");
must(text(render("fr", undefined, ["Native key is inactive or expired"])).includes("La clé native est inactive ou expirée."), "plain reasons are translated");
console.log("Adoption blockers checks passed");
