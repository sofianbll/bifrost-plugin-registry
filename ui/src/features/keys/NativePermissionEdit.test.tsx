import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import type { NativeEditPreview } from "../../data/api";
import type { Readiness } from "../../domain/registry";
import { NativeEditPreviewBody, nativeEditFor, nativeEditLabel } from "./NativePermissionEdit";

// #93: the dialog shows the exact change, its consequence, and nothing that looks like it was already done.
const text = (html: string) => html.split(/<[^>]*>/).join("");
const must = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const render = (language: "en" | "fr", preview: NativeEditPreview) =>
  renderToStaticMarkup(
    <LanguageContext.Provider value={language}>
      <NativeEditPreviewBody preview={preview} />
    </LanguageContext.Provider>,
  );
const english = (label: string) => (en: string, fr: string) => (label === "fr" ? fr : en);

// Which blocker offers which edit.
const hermes: Readiness = {
  state: "blocked",
  blockers: [
    { provider: "mistral", kind: "undiscovered", count: 3, models: ["m-large", "m-small", "m-code"] },
    { provider: "synth", kind: "unsaved", count: 1, models: ["s-new"] },
    {
      provider: "Claude",
      kind: "other",
      count: 1,
      models: [],
      reasons: ["Dynamic native model allowlist is unsupported for Claude"],
    },
  ],
};
must(
  nativeEditFor(hermes.blockers[0], hermes)?.operation === "remove-models" &&
    nativeEditFor(hermes.blockers[0], hermes)?.provider === "mistral",
  "undiscovered models can be removed from the key",
);
must(
  nativeEditFor(hermes.blockers[1], hermes) === null && nativeEditFor(hermes.blockers[2], hermes) === null,
  "models the models page can add, and other reasons, offer no native edit",
);
const everyProvider: Readiness = {
  state: "blocked",
  blockers: [
    {
      provider: "",
      kind: "all-providers",
      count: 1,
      models: [],
      reasons: ["allow_all_providers grants future providers and cannot be represented safely"],
    },
    { provider: "mistral", kind: "undiscovered", count: 1, models: ["m-large"] },
  ],
};
must(
  nativeEditFor(everyProvider.blockers[0], everyProvider)?.operation === "replace-all-providers",
  "all providers can be replaced by the explicit list",
);
must(
  nativeEditFor(everyProvider.blockers[1], everyProvider) === null,
  "models are removed only once the key no longer allows every provider (removing a row would open that provider)",
);
const star: Readiness = {
  state: "blocked",
  blockers: [
    {
      provider: "Claude",
      kind: "dynamic",
      count: 1,
      models: [],
      reasons: ["Dynamic native model allowlist is unsupported for Claude"],
    },
  ],
};
must(
  nativeEditFor(star.blockers[0], star)?.operation === "replace-all-models" &&
    nativeEditFor(star.blockers[0], star)?.provider === "Claude",
  "all models of a provider can be replaced by the models saved in Registry",
);
must(
  nativeEditFor(star.blockers[0], { ...star, blockers: [...star.blockers, everyProvider.blockers[0]] }) === null,
  "all providers is replaced first",
);
must(
  nativeEditLabel({ operation: "replace-all-models", provider: "Claude" }, english("en")) ===
    "Replace “all models” by the models saved in Registry",
  "replace all models label",
);
must(
  nativeEditLabel({ operation: "remove-models", provider: "mistral" }, english("en")) ===
    "Remove these models from the key in Bifrost",
  "remove label",
);
must(
  nativeEditLabel({ operation: "replace-all-providers", provider: "" }, english("en")) ===
    "Replace “all providers” by the explicit list",
  "replace label",
);

const base = { keyId: "vk", revision: "r1", previewToken: "t", canApply: true, blocked: [] };
const removal: NativeEditPreview = {
  ...base,
  operation: "remove-models",
  provider: "mistral",
  remove: [{ provider: "mistral", models: ["m-large", "m-small", "m-code"] }],
  before: {
    allProviders: false,
    providers: [
      { provider: "mistral", allModels: false, models: ["m-large", "m-small", "m-code"] },
      { provider: "Codex", allModels: false, models: ["gpt-saved"] },
    ],
  },
  after: { allProviders: false, providers: [{ provider: "Codex", allModels: false, models: ["gpt-saved"] }] },
};
const removed = render("en", removal);
const plain = text(removed);
for (const line of [
  "Mistral · 3 models",
  "Codex · 1 model",
  "Allowed today",
  "Allowed afterwards",
  "Removed from the key",
])
  must(plain.includes(line), `the removal preview must read "${line}"`);
must(
  plain.includes("Requests that use these models will be refused") && plain.includes("changes the key in Bifrost"),
  "the consequence says Bifrost is changed and what then happens",
);
must(plain.includes("m-large, m-small, m-code"), "every removed model is named");
must(!plain.includes("allow no model"), "a key that keeps a model does not claim to be empty");
must(!plain.includes("Done"), "a preview never reads as done");

// A key left with nothing says so.
const emptied = text(render("en", { ...removal, after: { allProviders: false, providers: [] } }));
must(emptied.includes("The key will allow no model"), "an emptied key is announced");

const replacement: NativeEditPreview = {
  ...base,
  operation: "replace-all-providers",
  provider: "",
  remove: [{ provider: "openrouter", models: ["a/b", "c/d"] }],
  before: { allProviders: true, providers: [] },
  after: {
    allProviders: false,
    providers: [
      { provider: "Codex", allModels: false, models: ["gpt-saved"] },
      { provider: "synth", allModels: false, models: ["s-saved"] },
    ],
  },
};
const replaced = text(render("en", replacement));
for (const line of ["All providers", "Codex · 1 model", "Synth · 1 model", "OpenRouter · 2 models"])
  must(replaced.includes(line), `the replacement preview must read "${line}"`);
must(
  replaced.includes("Providers added to Bifrost later are not allowed") && replaced.includes("no longer allowed"),
  "the replacement consequence names the loss",
);
must(replaced.includes("a/b, c/d"), "every model that stops being allowed is named");
must(
  replaced.includes("one access per model"),
  "the one-access-per-model rule is stated, since it takes models off the key",
);

// A blocked edit shows why and offers nothing to confirm.
const blocked = text(
  render("en", {
    ...removal,
    canApply: false,
    previewToken: undefined,
    after: undefined,
    blocked: ["Nothing to remove for this provider"],
  }),
);
must(
  blocked.includes("Nothing to remove for this provider") &&
    !blocked.includes("Requests that use these models will be refused"),
  "a blocked edit shows its reason, not a consequence",
);

// A provider row that goes away takes its budgets and rate limit with it (Bifrost), and the confirmation says so.
const limited: NativeEditPreview = {
  ...removal,
  remove: [{ ...removal.remove[0], dropsLimits: true }],
  after: { allProviders: false, providers: [{ provider: "Codex", allModels: false, models: ["gpt-saved"] }] },
};
must(
  text(render("en", limited)).includes("Its budgets and rate limit are deleted with it"),
  "a dropped row with limits says they are deleted",
);
must(!plain.includes("budgets"), "a row without limits claims none");
must(
  text(render("fr", limited)).includes("Ses budgets et sa limite de débit sont supprimés avec lui"),
  "French says the limits are deleted too",
);

// French reads as French (no English sentinel word) and carries the same facts.
const french = text(render("fr", removal));
for (const line of [
  "Mistral · 3 modèles",
  "Codex · 1 modèle",
  "Autorisé aujourd’hui",
  "Autorisé ensuite",
  "Retiré de la clé",
  "Les requêtes qui utilisent ces modèles seront refusées",
])
  must(french.includes(line), `French preview must read "${line}"`);
for (const word of ["the", "and", "of", "with", "Yes", "No", "Other"])
  must(!new RegExp(`\\b${word}\\b`).test(french), `French preview must not contain "${word}"`);
const frenchReplaced = text(render("fr", replacement));
must(
  frenchReplaced.includes("Tous les fournisseurs") &&
    frenchReplaced.includes("Les fournisseurs ajoutés plus tard à Bifrost ne seront pas autorisés"),
  "French replacement preview",
);

// Replacing "all models" of one provider: the provider stops allowing future models; what it loses is named.
const allModels: NativeEditPreview = {
  ...base,
  operation: "replace-all-models",
  provider: "Claude",
  remove: [{ provider: "Claude", models: ["qa-new"] }],
  before: {
    allProviders: false,
    providers: [
      { provider: "Claude", allModels: true, models: [] },
      { provider: "Codex", allModels: false, models: ["gpt-saved"] },
    ],
  },
  after: {
    allProviders: false,
    providers: [
      { provider: "Claude", allModels: false, models: ["qa-haiku", "qa-opus"] },
      { provider: "Codex", allModels: false, models: ["gpt-saved"] },
    ],
  },
};
const narrowed = text(render("en", allModels));
for (const line of ["Claude · all models", "Claude · 2 models", "Claude · 1 model", "qa-new"])
  must(narrowed.includes(line), `the all-models preview must read "${line}"`);
must(
  narrowed.includes("Claude stops allowing every model") &&
    narrowed.includes("Models Claude adds later are not allowed") &&
    narrowed.includes("no longer allowed"),
  `the consequence names the loss, got ${narrowed}`,
);
must(!narrowed.includes("budgets") && !narrowed.includes("is removed from it"), "the row stays, so its limits stay");
const narrowedFrench = text(render("fr", allModels));
must(
  narrowedFrench.includes("Claude n’autorise plus tous ses modèles") &&
    narrowedFrench.includes("Claude · tous les modèles"),
  `French all-models preview, got ${narrowedFrench}`,
);
for (const word of ["the", "and", "of", "with"])
  must(!new RegExp(`\\b${word}\\b`).test(narrowedFrench), `French all-models preview must not contain "${word}"`);
console.log("Native permission edit checks passed");
