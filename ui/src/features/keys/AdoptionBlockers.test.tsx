import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import type { Readiness } from "../../domain/registry";
import { AdoptionBlockers } from "./AdoptionBlockers";

// #87: the adoption dialog lists blockers per provider, with counts, model names and the way forward.
const render = (language: "en" | "fr", readiness: Readiness | undefined, reasons: string[], onShowToAdd?: (routes: string[]) => void, onKeep?: (provider: string, keep: boolean) => void) =>
  renderToStaticMarkup(<LanguageContext.Provider value={language}><AdoptionBlockers readiness={readiness} reasons={reasons} onShowToAdd={onShowToAdd} onKeep={onKeep} /></LanguageContext.Provider>);
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
must(plain.includes("allows every provider, including ones added later") && !plain.includes("allow_all_providers"), "the all-providers reason reads in plain words");
// Names sit behind a disclosure; only models the models page can add get a way there.
must(english.split(/<details[\s\S]*?<\/details>/).join("").includes("qa-mistral-large") === false, "model names stay behind their disclosure");
must(english.includes("qa-mistral-large, qa-mistral-small, qa-mistral-code") && english.includes("qa-unregistered"), "model names are listed");
must((english.match(/Show in To add/g) || []).length === 1, "only the unsaved models link to To add");
must(!render("en", hermes, hermesReasons).includes("Show in To add"), "no link without a destination");
must(!plain.includes("needs a configured direct Registry access"), "the plain per-model reasons are replaced by the grouped list");

const french = text(render("fr", hermes, hermesReasons, () => {}));
for (const line of ["Mistral · 3 modèles non découverts", "Synthetic Provider · 1 modèle à ajouter", "Voir dans À ajouter", "Bifrost ne liste pas ces modèles"]) must(french.includes(line), `French dialog must read "${line}"`);

// One model reached through two subscriptions cannot be adopted: the reason reads as UI copy in both languages.
const shared = "Model qa-shared is allowed through Claude/qa-shared and Codex/qa-shared: Registry adopts one access per model";
const twice: Readiness = { state: "blocked", blockers: [{ provider: "Codex", kind: "other", count: 1, models: ["qa-shared"], reasons: [shared] }] };
must(text(render("en", twice, [shared])).includes("Model qa-shared is allowed through Claude/qa-shared and Codex/qa-shared"), "the shared-alias reason is shown");
must(text(render("fr", twice, [shared])).includes("Le modèle qa-shared est autorisé via Claude/qa-shared et Codex/qa-shared : Registry n’adopte qu’un accès par modèle."), "the shared-alias reason is translated");

// An empty key has nothing to adopt yet; say so instead of listing blockers.
const empty = text(render("en", { state: "empty", blockers: [] }, ["Native key has no representable configured model access"]));
must(empty.includes("allows no model in Bifrost yet"), "empty key explanation");
must(text(render("fr", { state: "empty", blockers: [] }, [])).includes("n’autorise encore aucun modèle"), "empty key explanation in French");

// Without a verdict (rebinding, older server) the plain reasons still read as UI copy.
const plainReasons = text(render("en", undefined, ["Native key is inactive or expired", "No enabled native provider key for Codex/x"]));
must(plainReasons.includes("Native key is inactive or expired") && plainReasons.includes("No enabled native provider key for Codex/x"), "plain reasons are shown");
must(text(render("fr", undefined, ["Native key is inactive or expired"])).includes("La clé native est inactive ou expirée."), "plain reasons are translated");
// #92: models Bifrost does not list can stay native. The offer sits beside that blocker only, with its consequence.
const offer = render("en", hermes, hermesReasons, () => {}, () => {});
must((offer.match(/Keep Mistral in Bifrost/g) || []).length === 1, "one offer, for the undiscovered models only");
must(text(offer).includes("Registry will not manage or change Mistral’s permissions"), "the consequence is stated beside the offer");
must(!render("en", hermes, hermesReasons, () => {}).includes("Keep Mistral in Bifrost"), "no offer without a handler");
must(text(render("fr", hermes, hermesReasons, () => {}, () => {})).includes("Garder Mistral dans Bifrost"), "offer in French");
// A kept provider is no longer a blocker: the list shows what remains.
const rest = text(render("en", { state: "blocked", blockers: [{ ...hermes.blockers[0], kept: true }, hermes.blockers[2]] }, ["allow_all_providers grants future providers and cannot be represented safely"], () => {}, () => {}));
must(!rest.includes("Mistral") && rest.includes("allows every provider"), "kept providers leave the blocker list");
// A key that allows every model of a provider says so, in both languages, without the word "dynamic".
const dynamic = ["Dynamic native model allowlist is unsupported for Claude"];
const dynamicEn = text(render("en", undefined, dynamic, () => {}));
must(dynamicEn.includes("Claude: this key allows every model, including future ones") && !dynamicEn.includes("dynamic"), "a dynamic allowlist reads in plain words");
must(text(render("fr", undefined, dynamic, () => {})).includes("Claude : cette clé autorise tous les modèles, y compris les futurs"), "and in French");
console.log("Adoption blockers checks passed");
