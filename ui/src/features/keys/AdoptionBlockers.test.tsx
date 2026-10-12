import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import type { Readiness } from "../../domain/registry";
import { AdoptionBlockers } from "./AdoptionBlockers";

// #87, spec #85: the adoption dialog opens on a short numbered list of decisions, one per provider, each with its choices.
const render = (
  language: "en" | "fr",
  readiness: Readiness | undefined,
  reasons: string[],
  onShowToAdd?: (routes: string[]) => void,
  onKeep?: (provider: string, keep: boolean) => void,
  onEditNative?: () => void,
) =>
  renderToStaticMarkup(
    <LanguageContext.Provider value={language}>
      <AdoptionBlockers
        readiness={readiness}
        reasons={reasons}
        onShowToAdd={onShowToAdd}
        onKeep={onKeep}
        onEditNative={onEditNative}
      />
    </LanguageContext.Provider>,
  );
const text = (html: string) => html.split(/<[^>]*>/).join("");
const must = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const count = (html: string, pattern: RegExp) => (html.match(pattern) || []).length;

const hermes: Readiness = {
  state: "blocked",
  blockers: [
    {
      provider: "mistral",
      kind: "undiscovered",
      count: 3,
      models: ["qa-mistral-large", "qa-mistral-small", "qa-mistral-code"],
    },
    { provider: "synthetic-provider", kind: "unsaved", count: 1, models: ["qa-unregistered"] },
    {
      provider: "",
      kind: "all-providers",
      count: 1,
      models: [],
      reasons: ["allow_all_providers grants future providers and cannot be represented safely"],
    },
  ],
};
const hermesReasons = [
  "Native route mistral/qa-mistral-large needs a configured direct Registry access with the same native name",
];

const english = render("en", hermes, hermesReasons, () => {});
const plain = text(english);
must(plain.includes("2 decisions before adopting"), `the list says how many decisions are left, got ${plain}`);
must(count(english.split("<ol")[1].split("</ol>")[0], /<li/g) === 2, "one numbered row per provider");
// Spec #85, critique round 2: models to add are not a decision the dialog can make: they are listed apart, unnumbered.
must(
  plain.includes("Before adopting: register 1 Synthetic Provider model") &&
    !english.split("</ol>")[0].includes("Synthetic Provider"),
  "models to add sit outside the numbered decisions",
);
must(plain.includes("Each one is required to adopt the key."), "required decisions are said to be required");
for (const line of ["Mistral · 3 models not discovered"]) must(plain.includes(line), `the dialog must list "${line}"`);
must(
  plain.includes("Bifrost does not list these models") && plain.includes("Registry has no card for them yet"),
  "each kind explains itself",
);
must(
  plain.includes("allows every provider, including ones added later") && !plain.includes("allow_all_providers"),
  "the all-providers reason reads in plain words",
);
// Names sit behind a disclosure; only models the models page can add get a way there.
must(
  english
    .split(/<details[\s\S]*?<\/details>/)
    .join("")
    .includes("qa-mistral-large") === false,
  "model names stay behind their disclosure",
);
must(
  english.includes("qa-mistral-large, qa-mistral-small, qa-mistral-code") && english.includes("qa-unregistered"),
  "model names are listed",
);
must(count(english, /Show in To add/g) === 1, "only the unsaved models link to To add");
must(!render("en", hermes, hermesReasons).includes("Show in To add"), "no link without a destination");
must(
  !plain.includes("needs a configured direct Registry access"),
  "the plain per-model reasons are replaced by the grouped list",
);

const french = text(render("fr", hermes, hermesReasons, () => {}));
for (const line of [
  "2 décisions avant d’adopter",
  "Mistral · 3 modèles non découverts",
  "Avant d’adopter : enregistrer 1 modèle Synthetic Provider",
  "Voir dans À ajouter",
  "Bifrost ne liste pas ces modèles",
])
  must(french.includes(line), `French dialog must read "${line}"`);
must(
  text(render("en", { state: "blocked", blockers: [hermes.blockers[0]] }, [], () => {})).includes(
    "1 decision before adopting",
  ),
  "one decision, singular",
);
const toAddOnly = text(
  render("en", { state: "blocked", blockers: [{ ...hermes.blockers[1], provider: "vertex", count: 8 }] }, [], () => {}),
);
must(
  !toAddOnly.includes("decision") && toAddOnly.includes("Before adopting: register 8 Vertex AI models"),
  `only models to add: no decision, got ${toAddOnly}`,
);

// A provider Bifrost has disabled says so in plain words.
const disabled: Readiness = { state: "blocked", blockers: [{ ...hermes.blockers[0], providerDisabled: true }] };
must(
  text(render("en", disabled, [], undefined, () => {})).includes("Mistral is disabled in Bifrost"),
  "disabled provider, in English",
);
must(
  text(render("fr", disabled, [], undefined, () => {})).includes("Mistral est désactivé dans Bifrost"),
  "disabled provider, in French",
);

// One model reached through two providers is a choice: keep either provider in Bifrost.
const shared =
  "Model qa-shared is allowed through Claude/qa-shared and Codex/qa-shared: Registry adopts one access per model";
const twice: Readiness = {
  state: "blocked",
  blockers: [
    { provider: "Codex", kind: "collision", count: 1, models: ["qa-shared"], reasons: [shared], with: ["Claude"] },
  ],
};
const kept: string[] = [];
const collision = render("en", twice, [shared], undefined, provider => kept.push(provider));
must(
  text(collision).includes("Codex · 1 model also allowed through Claude"),
  `the collision names both providers, got ${text(collision)}`,
);
must(
  collision.includes("Keep Codex in Bifrost") && collision.includes("Keep Claude in Bifrost"),
  "both providers can be kept",
);
must(text(collision).includes("Registry adopts one access per model"), "the collision explains itself");
const collisionFrench = text(render("fr", twice, [shared], undefined, () => {}));
for (const line of [
  "Codex · 1 modèle aussi autorisé via Claude",
  "Garder Codex dans Bifrost",
  "Garder Claude dans Bifrost",
  "Registry n’adopte qu’un accès par modèle",
])
  must(collisionFrench.includes(line), `French collision must read "${line}"`);
must(!text(render("en", twice, [shared])).includes("Keep Claude in Bifrost"), "no keep offer without a handler");

// An empty key has nothing to adopt yet; say so instead of listing blockers.
const empty = text(
  render("en", { state: "empty", blockers: [] }, ["Native key has no representable configured model access"]),
);
must(empty.includes("allows no model in Bifrost yet"), "empty key explanation");
must(
  text(render("fr", { state: "empty", blockers: [] }, [])).includes("n’autorise encore aucun modèle"),
  "empty key explanation in French",
);

// Without a verdict (rebinding, older server) the plain reasons still read as UI copy.
const plainReasons = text(
  render("en", undefined, ["Native key is inactive or expired", "No enabled native provider key for Codex/x"]),
);
must(
  plainReasons.includes("Native key is inactive or expired") &&
    plainReasons.includes("No enabled native provider key for Codex/x"),
  "plain reasons are shown",
);
must(
  text(render("fr", undefined, ["Native key is inactive or expired"])).includes(
    "La clé native est inactive ou expirée.",
  ),
  "plain reasons are translated",
);
// #92: models Bifrost does not list can stay native. The offer sits beside that blocker only, with its consequence.
const offer = render(
  "en",
  hermes,
  hermesReasons,
  () => {},
  () => {},
);
must(count(offer, /Keep Mistral in Bifrost/g) === 1, "one offer, for the undiscovered models only");
must(
  text(offer).includes("Registry will not manage or change Mistral’s permissions"),
  "the consequence is stated beside the offer",
);
must(!render("en", hermes, hermesReasons, () => {}).includes("Keep Mistral in Bifrost"), "no offer without a handler");
must(
  text(
    render(
      "fr",
      hermes,
      hermesReasons,
      () => {},
      () => {},
    ),
  ).includes("Garder Mistral dans Bifrost"),
  "offer in French",
);
// A kept provider is no longer a decision: the list shows what remains.
const rest = text(
  render(
    "en",
    { state: "blocked", blockers: [{ ...hermes.blockers[0], kept: true }, hermes.blockers[2]] },
    ["allow_all_providers grants future providers and cannot be represented safely"],
    () => {},
    () => {},
  ),
);
must(
  !rest.includes("Mistral") && rest.includes("allows every provider") && rest.includes("1 decision before adopting"),
  "kept providers leave the decision list",
);
// A key that allows every model of a provider says so, in both languages, without the word "dynamic".
const dynamic = ["Dynamic native model allowlist is unsupported for Claude"];
const dynamicEn = text(render("en", undefined, dynamic, () => {}));
must(
  dynamicEn.includes("Claude: this key allows every model, including future ones") && !dynamicEn.includes("dynamic"),
  "a dynamic allowlist reads in plain words",
);
must(
  text(render("fr", undefined, dynamic, () => {})).includes(
    "Claude : cette clé autorise tous les modèles, y compris les futurs",
  ),
  "and in French",
);
// Both ways forward sit beside that blocker, like for models Bifrost does not list: keep the provider in Bifrost,
// or replace "all models" by the models saved in Registry (a native edit, previewed and confirmed).
const star: Readiness = {
  state: "blocked",
  blockers: [{ provider: "Claude", kind: "dynamic", count: 1, models: [], reasons: dynamic }],
};
const starOffer = render(
  "en",
  star,
  dynamic,
  () => {},
  () => {},
  () => {},
);
const starText = text(starOffer);
must(
  starText.includes("Claude · all models allowed") &&
    starText.includes("Claude: this key allows every model, including future ones"),
  `the blocker line and its reason, got ${starText}`,
);
must(
  count(starOffer, /Keep Claude in Bifrost/g) === 1 &&
    starText.includes("Registry will not manage or change Claude’s permissions"),
  "the keep offer and its consequence",
);
must(
  starText.includes("Replace “all models” by the models saved in Registry") && starText.includes("Choose one"),
  "the replace offer, as one of the choices",
);
must(
  !starText.includes("review a key that lists its models one by one"),
  "no dead-end advice once actions are offered",
);
must(
  !text(render("en", star, dynamic, () => {})).includes("Keep Claude in Bifrost"),
  "no keep offer without a handler",
);
const starFrench = text(
  render(
    "fr",
    star,
    dynamic,
    () => {},
    () => {},
    () => {},
  ),
);
for (const line of [
  "Claude · tous les modèles autorisés",
  "Garder Claude dans Bifrost",
  "Remplacer « tous les modèles » par les modèles enregistrés dans Registry",
  "Choisissez une option :",
])
  must(starFrench.includes(line), `French dialog must read "${line}"`);
// What changes Bifrost looks different from what keeps it as is: a "Changes Bifrost" tag on native edits only.
must(
  count(starOffer, /Changes Bifrost/g) === 1 && !text(offer).includes("Changes Bifrost"),
  "native edits are tagged, keep offers are not",
);
must(
  text(
    render(
      "fr",
      star,
      dynamic,
      () => {},
      () => {},
      () => {},
    ),
  ).includes("Modifie Bifrost"),
  "the tag in French",
);
console.log("Adoption blockers checks passed");
