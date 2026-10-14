import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext, type Copy } from "../../lib/locale";
import type { Readiness } from "../../domain/registry";
import { AdoptionBlockers } from "./AdoptionBlockers";
import { adoptionProgress, decidedLabel, decisionsHeading } from "./key-readiness";

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

const english = render("en", hermes, hermesReasons, () => {}, () => {}, () => {});
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
for (const line of ["Bifrost doesn’t show 3 Mistral models, so Registry can’t manage them."])
  must(plain.includes(line), `the dialog must list "${line}"`);
must(plain.includes("Registry has no card for them yet"), "each kind explains itself");
must(
  plain.includes("allows every provider, including ones added later") && !plain.includes("allow_all_providers"),
  "the all-providers reason reads in plain words",
);
// Critique round 5: a decision names the models it concerns where it is read, not behind "Show model names".
must(!english.includes("Show model names") && !english.includes("<details"), "no model names behind a disclosure");
must(
  plain.includes("Models: qa-mistral-large, qa-mistral-small, qa-mistral-code") &&
    plain.includes("Model: qa-unregistered"),
  `each decision names its models inline, got ${plain}`,
);
// Only models the models page can add get a way there.
must(count(english, /Show in To add/g) === 1, "only the unsaved models link to To add");
must(!render("en", hermes, hermesReasons).includes("Show in To add"), "no link without a destination");
must(
  !plain.includes("needs a configured direct Registry access"),
  "the plain per-model reasons are replaced by the grouped list",
);

// At most three names, then "+N" (a button that shows the others): the fifth model is not printed until asked.
const many: Readiness = {
  state: "blocked",
  blockers: [
    {
      provider: "mistral",
      kind: "undiscovered",
      count: 5,
      models: ["qa-a", "qa-b", "qa-c", "qa-d", "qa-e"],
    },
  ],
};
const manyEnglish = render("en", many, [], undefined, () => {});
must(
  text(manyEnglish).includes("Models: qa-a, qa-b, qa-c +2 more models") &&
    !manyEnglish.includes("qa-d") &&
    /<button[^>]*aria-expanded="false"[^>]*>\+2<span class="sr-only"> more models<\/span><\/button>/.test(manyEnglish),
  `three names then +2, got ${text(manyEnglish)}`,
);
must(
  text(render("fr", many, [], undefined, () => {})).includes("Modèles : qa-a, qa-b, qa-c +2 autres modèles"),
  "and in French",
);
must(
  text(
    render("en", { state: "blocked", blockers: [{ ...many.blockers[0], models: ["qa-a", "qa-b", "qa-c"] }] }, []),
  ).includes("Models: qa-a, qa-b, qa-c") &&
    !text(
      render("en", { state: "blocked", blockers: [{ ...many.blockers[0], models: ["qa-a", "qa-b", "qa-c"] }] }, []),
    ).includes("+"),
  "three names need no +N",
);

const french = text(render("fr", hermes, hermesReasons, () => {}, () => {}, () => {}));
for (const line of [
  "2 décisions avant d’adopter",
  "Modèles : qa-mistral-large, qa-mistral-small, qa-mistral-code",
  "Modèle : qa-unregistered",
  "Bifrost ne montre pas 3 modèles Mistral : Registry ne peut donc pas les gérer.",
  "Avant d’adopter : enregistrer 1 modèle Synthetic Provider",
  "Voir dans À ajouter",
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

// Final critique, P1: a blocker no choice settles (here a key disabled or expired in Bifrost, no provider, no button) is
// no decision. It is listed under "Before adopting" with its next step; with nothing else to decide the heading says so
// instead of "0 decisions", and the footer beside Adopt (prerequisiteLine) gives the same reason in one clause.
const inactiveReason = "Native key is inactive or expired";
const inactive: Readiness = {
  state: "blocked",
  blockers: [{ provider: "", kind: "other", count: 1, models: [], reasons: [inactiveReason] }],
};
const inactiveProgress = adoptionProgress(inactive, [], []);
must(inactiveProgress.total === 0 && inactiveProgress.decided === 0, "a key-level blocker is no decision");
const inactiveEnglish = render(
  "en",
  inactive,
  [inactiveReason],
  () => {},
  () => {},
  () => {},
);
const inactivePlain = text(inactiveEnglish);
must(
  inactivePlain.includes("Nothing to decide yet") &&
    decisionsHeading(inactiveProgress, (en: string) => en) === "Nothing to decide yet",
  `no decision: the heading says so, got ${inactivePlain}`,
);
must(
  !/decision|0 of 0|Each one is required/.test(inactivePlain) && !inactiveEnglish.includes("<ol"),
  `no decision count, no numbered list, got ${inactivePlain}`,
);
must(
  inactivePlain.includes("This key is disabled or expired in Bifrost.") &&
    inactivePlain.includes("Enable or renew this key in Bifrost, then press Refresh preview."),
  `the reason and the next step are shown, got ${inactivePlain}`,
);
must(
  /<section aria-label="Before adopting"/.test(inactiveEnglish) && !inactiveEnglish.includes("<button"),
  "a separate Before adopting block, with no button to press",
);
const inactiveFrench = render(
  "fr",
  inactive,
  [inactiveReason],
  () => {},
  () => {},
  () => {},
);
for (const line of [
  "Rien à décider pour l’instant",
  "Cette clé est désactivée ou expirée dans Bifrost.",
  "Activez ou renouvelez cette clé dans Bifrost, puis appuyez sur Actualiser l’aperçu.",
])
  must(text(inactiveFrench).includes(line), `French dialog must read "${line}", got ${text(inactiveFrench)}`);
must(!/décision|0 sur 0/.test(text(inactiveFrench)), "no decision count in French either");
// Beside one provider decision the total is 1: the key-level blocker is listed apart, under "Before adopting".
const inactiveAndMistral: Readiness = { state: "blocked", blockers: [...inactive.blockers, hermes.blockers[0]] };
const beside = render(
  "en",
  inactiveAndMistral,
  [inactiveReason],
  undefined,
  () => {},
  () => {},
);
const besideProgress = adoptionProgress(inactiveAndMistral, [], []);
must(
  besideProgress.total === 1 && text(beside).includes("1 decision before adopting"),
  `one decision beside the key-level blocker, got ${text(beside)}`,
);
must(
  count(beside.split("<ol")[1].split("</ol>")[0], /<li/g) === 1 &&
    !beside.split("</ol>")[0].includes("disabled or expired") &&
    beside.split("</ol>")[1].includes("This key is disabled or expired in Bifrost.") &&
    !beside.includes("Nothing to decide yet"),
  "one numbered row for the provider; the key-level blocker follows, unnumbered",
);
must(
  text(beside).includes("Before adopting") && text(beside).includes("press Refresh preview"),
  "the block is named and gives the next step",
);
// A reason with no choice that is not about the key's state reads the generic next step.
const profile = render(
  "en",
  {
    state: "blocked",
    blockers: [
      {
        provider: "",
        kind: "other",
        count: 1,
        models: [],
        reasons: ["Native key is controlled by an external access profile"],
      },
    ],
  },
  [],
);
must(
  text(profile).includes("This key’s permissions come from an external profile.") &&
    text(profile).includes("Fix this in Bifrost, then press Refresh preview."),
  `any other reason: the generic next step, got ${text(profile)}`,
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
  text(collision).includes("1 model is allowed through Codex and Claude."),
  `the collision names both providers, got ${text(collision)}`,
);
// #100, #101: the two choices are labelled by outcome; using Claude keeps Codex in Bifrost, and the reverse.
must(
  collision.includes("Use Claude for this model") &&
    collision.includes("Use Codex for this model") &&
    !collision.includes("Keep Codex in Bifrost"),
  "both outcomes are offered",
);
must(text(collision).includes("Registry uses one subscription per model"), "the collision explains itself");
must(text(collision).includes("Model: qa-shared"), "the choice names the model it settles");
const collisionFrench = text(render("fr", twice, [shared], undefined, () => {}));
for (const line of [
  "1 modèle est autorisé via Codex et Claude.",
  "Utiliser Claude pour ce modèle",
  "Utiliser Codex pour ce modèle",
  "Registry n’utilise qu’un abonnement par modèle",
])
  must(collisionFrench.includes(line), `French collision must read "${line}"`);
must(!text(render("en", twice, [shared])).includes("Use Codex for this model"), "no keep offer without a handler");

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
  plainReasons.includes("This key is disabled or expired in Bifrost.") &&
    plainReasons.includes("No provider key is turned on for Codex/x in Bifrost."),
  `plain reasons are shown, got ${plainReasons}`,
);
// #110: plain reasons (rebinding) are prerequisites, never a decision count.
must(
  plainReasons.includes("Nothing to decide yet") && !/\d+ decisions? before adopting/.test(plainReasons),
  `plain reasons are no decisions, got ${plainReasons}`,
);
must(
  text(render("fr", undefined, ["Native key is inactive or expired"])).includes(
    "Cette clé est désactivée ou expirée dans Bifrost.",
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
  text(offer).includes("Bifrost keeps handling Mistral for this key; Registry takes over the rest."),
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
    () => {},
  ),
);
must(
  !rest.includes("Mistral") &&
    rest.includes("allows every provider") &&
    rest.includes("2 decisions before adopting · 1 already made"),
  `kept providers leave the decision list but stay in the count, got ${rest}`,
);
// #101: Mistral is disabled in Bifrost, so the dialog keeps it from the start: a decision already made. The heading
// counts it like the footer does, both written from one adoptionProgress ("3 decisions · 1 already made" = "1 of 3 decided").
const auto: Readiness = {
  state: "blocked",
  blockers: [
    { ...hermes.blockers[0], providerDisabled: true, kept: true },
    { provider: "deepseek", kind: "undiscovered", count: 1, models: ["deepseek-v4"] },
    { provider: "Codex", kind: "collision", count: 1, models: ["qa-shared"], reasons: [shared], with: ["Claude"] },
  ],
};
const autoProgress = adoptionProgress(auto, ["mistral"], []);
must(
  autoProgress.decided === 1 && autoProgress.total === 3,
  `one of three is decided, got ${JSON.stringify(autoProgress)}`,
);
const autoOnce = (language: "en" | "fr", props: { kept?: string[]; progress?: typeof autoProgress }) =>
  renderToStaticMarkup(
    <LanguageContext.Provider value={language}>
      <AdoptionBlockers readiness={auto} reasons={[]} onKeep={() => {}} {...props} />
    </LanguageContext.Provider>,
  );
for (const props of [{ kept: ["mistral"], progress: autoProgress }, { kept: ["mistral"] }, {}]) {
  const heading = text(autoOnce("en", props));
  must(
    heading.includes("3 decisions before adopting · 1 already made"),
    `heading counts the row decided from the start, got ${heading}`,
  );
}
for (const [language, heading, footer] of [
  ["en", "3 decisions before adopting · 1 already made", "1 of 3 decided"],
  ["fr", "3 décisions avant d’adopter · 1 déjà prise", "1 sur 3 décidées"],
] as const) {
  const copy: Copy = (en, fr) => (language === "fr" ? fr : en);
  must(
    decisionsHeading(autoProgress, copy) === heading,
    `${language} heading, got ${decisionsHeading(autoProgress, copy)}`,
  );
  must(decidedLabel(autoProgress, copy) === footer, `${language} footer, got ${decidedLabel(autoProgress, copy)}`);
  const shown = autoOnce(language, { kept: ["mistral"], progress: autoProgress });
  must(
    shown.includes(`aria-label="${heading}"`) && text(shown).includes(heading),
    `${language}: the dialog shows the heading, got ${text(shown)}`,
  );
  must(
    !text(shown).includes("Mistral") && !text(shown).includes("1 sur 4") && !text(shown).includes("1 of 4"),
    "no other count",
  );
}
// A choice made is a pressed button, and the other choices of that decision are not.
const pressedOf = (html: string) =>
  Object.fromEntries(
    [...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([^<]*)</g)].map(m => [m[2], m[1]]),
  );
const unchosen = pressedOf(collision);
must(
  JSON.stringify(unchosen) ===
    JSON.stringify({ "Use Claude for this model": "false", "Use Codex for this model": "false" }),
  `no choice yet: both unpressed, got ${JSON.stringify(unchosen)}`,
);
// Codex kept in Bifrost is the choice labelled "Use Claude for this model".
const chosen = pressedOf(
  renderToStaticMarkup(
    <LanguageContext.Provider value="en">
      <AdoptionBlockers readiness={twice} reasons={[shared]} kept={["Codex"]} onKeep={() => {}} />
    </LanguageContext.Provider>,
  ),
);
must(
  JSON.stringify(chosen) ===
    JSON.stringify({ "Use Claude for this model": "true", "Use Codex for this model": "false" }),
  `Codex kept: its option is pressed, the other is not, got ${JSON.stringify(chosen)}`,
);
must(
  JSON.stringify(pressedOf(offer)) === JSON.stringify({ "Keep Mistral in Bifrost": "false" }),
  "the keep offer of a single provider is a pressed-state button too, unpressed until chosen",
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
  starText.includes("This key allows every Claude model, including future ones, so Registry can’t copy it as is."),
  `the blocker in one plain sentence, got ${starText}`,
);
must(
  count(starOffer, /Keep Claude in Bifrost/g) === 1 &&
    starText.includes("Bifrost keeps handling Claude for this key; Registry takes over the rest."),
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
  "Cette clé autorise tous les modèles Claude, y compris les futurs : Registry ne peut pas la reprendre telle quelle.",
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
// #100: every blocker and choice reads in plain words: the undiscovered models say what the person can do.
const undiscovered: Readiness = {
  state: "blocked",
  blockers: [{ provider: "deepseek", kind: "undiscovered", count: 1, models: ["deepseek-v4"] }],
};
const both = text(
  render(
    "en",
    undiscovered,
    [],
    undefined,
    () => {},
    () => {},
  ),
);
must(
  both.includes("Bifrost doesn’t show 1 DeepSeek model, so Registry can’t manage it.") &&
    both.includes("Let Bifrost keep handling DeepSeek for this key, or remove that model from the key."),
  `undiscovered, in plain words, got ${both}`,
);
must(
  text(
    render(
      "fr",
      undiscovered,
      [],
      undefined,
      () => {},
      () => {},
    ),
  ).includes(
    "Bifrost ne montre pas 1 modèle DeepSeek : Registry ne peut donc pas le gérer.Modèle : deepseek-v4Laissez Bifrost continuer à gérer DeepSeek pour cette clé, ou retirez ce modèle de la clé.",
  ),
  "and in French",
);
must(
  text(render("en", undiscovered, [], undefined, () => {})).includes(
    "Let Bifrost keep handling DeepSeek for this key.",
  ),
  "only the choices offered are named",
);
// A disabled provider: the French sentence agrees ("aucun de ses modèles", not "n’en montre aucun modèle").
const disabledFrench = text(
  render(
    "fr",
    disabled,
    [],
    undefined,
    () => {},
    () => {},
  ),
);
must(
  disabledFrench.includes("Bifrost ne montre donc aucun de ses modèles : Registry ne peut pas gérer les 3 modèles") &&
    !disabledFrench.includes("n’en montre"),
  `the disabled-provider sentence reads correctly in French, got ${disabledFrench}`,
);
// No jargon in any rendered blocker, in either language.
const reasonsSent = [
  "Native key identity changed",
  "Native key is controlled by an external access profile",
  "Full native key credential is unavailable",
  "Registry policy is disabled",
  "Registry binding already matches the native key",
  "Native model readback is unavailable",
  "Native model list differs from configured access; import or reconcile the missing routes first",
  "Duplicate native model discovery for x",
  "Native provider configuration is missing or duplicated",
  "Empty native allowed_models has version-dependent meaning for x",
  "Empty native provider key list has version-dependent meaning for x",
  "Dynamic native blacklist is unsupported for x",
  "Duplicate native model route x",
  "Native route x is absent from provider discovery",
  "Native route x needs a configured direct Registry access with the same native name",
  "Native key has no representable configured model access",
  shared,
  ...dynamic,
];
for (const language of ["en", "fr"] as const)
  for (const html of [
    english,
    offer,
    collision,
    starOffer,
    render(
      language,
      hermes,
      hermesReasons,
      () => {},
      () => {},
      () => {},
    ),
    render(language, twice, [shared], undefined, () => {}),
    render(language, inactive, [inactiveReason], undefined, () => {}),
    render(language, undefined, reasonsSent),
    render(
      language,
      disabled,
      [],
      undefined,
      () => {},
      () => {},
    ),
  ]) {
    const words = text(html);
    must(
      !/native|readback|read back|cannot hold|allowed_models|natif|relecture/i.test(words),
      `no jargon in ${language}, got ${words}`,
    );
  }
console.log("Adoption blockers checks passed");
