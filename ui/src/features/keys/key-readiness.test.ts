import { fixture } from "../../dev/fixtures/registry";
import type { Key, Readiness, ReadinessBlocker } from "../../domain/registry";
import type { Copy } from "../../lib/locale";
import {
  adoptionProgress,
  blockerLine,
  decidedLabel,
  decisionsHeading,
  disabledProviders,
  prerequisiteLine,
  readinessLabel,
  readinessReason,
  readinessState,
  unsavedRoutes,
} from "./key-readiness";

const english: Copy = en => en;
const french: Copy = (_en, fr) => fr;
const equal = (actual: unknown, expected: unknown, what: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`${what}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

const block = (
  provider: string,
  kind: ReadinessBlocker["kind"],
  models: string[],
  reasons?: string[],
): ReadinessBlocker => ({
  provider,
  kind,
  count: reasons?.length ?? models.length,
  models,
  ...(reasons && { reasons }),
});
const mistral = block("mistral", "undiscovered", ["large", "small", "code"]);
const unsaved = block("synthetic-provider", "unsaved", ["qa-unregistered"]);
const everyProvider = block(
  "",
  "all-providers",
  [],
  ["allow_all_providers grants future providers and cannot be represented safely"],
);
const unmanaged = (readiness?: Readiness): Key => ({ ...fixture.keys[0], managed: false, readiness });

// The state a key card and the Keys filter read: managed keys are past adoption, unread ones have no verdict.
equal(readinessState({ ...fixture.keys[0], managed: true }), "managed", "managed key");
equal(readinessState(fixture.keys[0]), "managed", "key without the managed flag is a managed key");
equal(readinessState(unmanaged()), "unknown", "unmanaged key whose permissions were not read");
equal(readinessState(unmanaged({ state: "ready", blockers: [] })), "ready", "ready");
equal(readinessState(unmanaged({ state: "blocked", blockers: [mistral] })), "blocked", "blocked");
equal(readinessState(unmanaged({ state: "empty", blockers: [] })), "empty", "empty");

// One line per blocker: provider, count, and what is wrong, in both languages.
equal(blockerLine(mistral, english), "Mistral: Bifrost doesn’t show 3 models", "undiscovered");
equal(
  blockerLine({ ...mistral, count: 1, models: ["large"] }, english),
  "Mistral: Bifrost doesn’t show 1 model",
  "one undiscovered",
);
equal(blockerLine(mistral, french), "Mistral : Bifrost ne montre pas 3 modèles", "undiscovered in French");
equal(blockerLine(unsaved, english), "Synthetic Provider · 1 model to add", "unsaved");
equal(blockerLine(unsaved, french), "Synthetic Provider · 1 modèle à ajouter", "unsaved in French");
equal(blockerLine(everyProvider, english), "Every provider allowed", "all providers");
equal(
  blockerLine(block("Claude", "other", [], ["No enabled native provider key for Claude/x"]), english),
  "Claude · cannot be adopted as is",
  "other, with provider",
);
equal(
  blockerLine(block("Claude", "dynamic", [], ["Dynamic native model allowlist is unsupported for Claude"]), english),
  "Claude · all models allowed",
  "every model of a provider",
);
equal(
  blockerLine(block("Claude", "dynamic", [], ["Dynamic native model allowlist is unsupported for Claude"]), french),
  "Claude · tous les modèles autorisés",
  "every model of a provider, in French",
);
equal(
  blockerLine(block("", "other", [], ["Native key is inactive or expired"]), english),
  "Cannot be adopted as is",
  "other, whole key",
);
// Spec #85: a provider Bifrost has disabled says so, and a model allowed through two providers names the other one.
equal(
  blockerLine({ ...mistral, providerDisabled: true }, english),
  "Mistral · disabled in Bifrost · 3 models",
  "disabled provider",
);
equal(
  blockerLine({ ...mistral, providerDisabled: true }, french),
  "Mistral · désactivé dans Bifrost · 3 modèles",
  "disabled provider, in French",
);
const collision: ReadinessBlocker = {
  provider: "Codex",
  kind: "collision",
  count: 1,
  models: ["qa-shared"],
  reasons: ["x"],
  with: ["Claude"],
};
equal(blockerLine(collision, english), "Codex · 1 model also allowed through Claude", "collision");
equal(
  blockerLine({ ...collision, count: 2, models: ["a", "b"] }, french),
  "Codex · 2 modèles aussi autorisés via Claude",
  "collision, in French",
);

// The card's short reason: the first two blockers, then how many more; nothing when there is nothing to explain.
equal(
  readinessReason({ state: "blocked", blockers: [mistral] }, english),
  "Mistral: Bifrost doesn’t show 3 models",
  "one blocker",
);
equal(
  readinessReason({ state: "blocked", blockers: [mistral, unsaved] }, english),
  "Mistral: Bifrost doesn’t show 3 models; Synthetic Provider · 1 model to add",
  "two blockers",
);
equal(
  readinessReason({ state: "blocked", blockers: [mistral, unsaved, everyProvider] }, english),
  "Mistral: Bifrost doesn’t show 3 models; Synthetic Provider · 1 model to add; +1 more",
  "three blockers",
);
equal(
  readinessReason({ state: "blocked", blockers: [mistral, unsaved, everyProvider] }, french),
  "Mistral : Bifrost ne montre pas 3 modèles ; Synthetic Provider · 1 modèle à ajouter ; +1",
  "three blockers in French, French spacing",
);
equal(readinessReason({ state: "ready", blockers: [] }, english), "", "ready needs no reason");
equal(readinessReason({ state: "empty", blockers: [] }, english), "", "empty needs no reason");
equal(readinessReason(undefined, english), "", "no verdict");

equal(
  [
    readinessLabel("ready", english),
    readinessLabel("blocked", english),
    readinessLabel("empty", english),
    readinessLabel("unknown", english),
    readinessLabel("managed", english),
  ],
  ["Ready to adopt", "Blocked", "Empty", "Adoption needed", "Managed"],
  "labels",
);
equal(
  [readinessLabel("ready", french), readinessLabel("blocked", french), readinessLabel("empty", french)],
  ["Prête à adopter", "Bloquée", "Vide"],
  "French labels",
);

// Discovered-but-unsaved models are the only ones the models page can add: their routes feed the To add filter.
equal(
  unsavedRoutes({
    state: "blocked",
    blockers: [
      mistral,
      unsaved,
      block("synthetic-provider", "unsaved", ["qa-other"]),
      block("synthetic-provider", "other", ["qa-off"], ["x"]),
    ],
  }),
  ["synthetic-provider/qa-unregistered", "synthetic-provider/qa-other"],
  "unsaved routes",
);
equal(unsavedRoutes(undefined), [], "no routes without a verdict");
// Spec #85, critique round 2: the dialog counts decisions made. Models to add are not decisions (only the models
// page settles them); a kept provider, or one chosen to settle a collision, is decided; so is a native edit made here.
const codex = { ...block("Codex", "collision", ["qa-shared"]), with: ["Claude"] };
const disabledMistral = { ...mistral, providerDisabled: true };
equal(
  adoptionProgress({ state: "blocked", blockers: [mistral, unsaved, everyProvider, codex] }, [], []),
  { decided: 0, total: 3 },
  "three decisions, models to add left out",
);
equal(
  adoptionProgress({ state: "blocked", blockers: [{ ...mistral, kept: true }, codex] }, ["mistral"], []),
  { decided: 1, total: 2 },
  "a kept provider is decided",
);
equal(
  adoptionProgress({ state: "ready", blockers: [{ ...mistral, kept: true }] }, ["mistral", "Claude"], []),
  { decided: 2, total: 2 },
  "a provider kept to settle a collision is decided",
);
equal(
  adoptionProgress({ state: "ready", blockers: [] }, [], ["mistral"]),
  { decided: 1, total: 1 },
  "a native edit made in the dialog is decided",
);
equal(
  adoptionProgress({ state: "blocked", blockers: [mistral] }, [], ["mistral"]),
  { decided: 0, total: 1 },
  "an edit that did not settle the row is not",
);
equal(adoptionProgress(undefined, [], []), { decided: 0, total: 0 }, "no verdict, nothing to decide");
// #101: the heading and the footer say the same count, rows decided from the start (a provider disabled in Bifrost) included.
const autoKept = adoptionProgress(
  {
    state: "blocked",
    blockers: [{ ...disabledMistral, kept: true }, block("deepseek", "undiscovered", ["v4"]), codex],
  },
  ["mistral"],
  [],
);
equal(autoKept, { decided: 1, total: 3 }, "one row decided from the start, two to decide");
equal(decisionsHeading(autoKept, english), "3 decisions before adopting · 1 already made", "heading, English");
equal(decidedLabel(autoKept, english), "1 of 3 decided", "footer, English");
equal(decisionsHeading(autoKept, french), "3 décisions avant d’adopter · 1 déjà prise", "heading, French");
equal(decidedLabel(autoKept, french), "1 sur 3 décidées", "footer, French");
equal(decisionsHeading({ decided: 0, total: 1 }, english), "1 decision before adopting", "none made, singular");
equal(decisionsHeading({ decided: 0, total: 1 }, french), "1 décision avant d’adopter", "none made, singular, French");
equal(decisionsHeading({ decided: 2, total: 4 }, english), "4 decisions before adopting · 2 already made", "plural");
equal(
  decisionsHeading({ decided: 2, total: 4 }, french),
  "4 décisions avant d’adopter · 2 déjà prises",
  "plural, French",
);
// Critique round 5: models to register are no decision (the counts above leave them out), so the footer states them
// beside the count: one provider is named, several are summed, none says nothing.
const vertex = { ...unsaved, provider: "vertex", count: 8 };
equal(
  prerequisiteLine({ state: "blocked", blockers: [vertex, mistral] }, english),
  "Register 8 Vertex AI models first",
  "one provider's models to register, English",
);
equal(
  prerequisiteLine({ state: "blocked", blockers: [vertex, mistral] }, french),
  "Enregistrez d’abord 8 modèles Vertex AI",
  "one provider's models to register, French",
);
equal(
  prerequisiteLine({ state: "blocked", blockers: [{ ...vertex, count: 1 }] }, english),
  "Register 1 Vertex AI model first",
  "singular",
);
equal(
  prerequisiteLine(
    { state: "blocked", blockers: [vertex, { ...unsaved, provider: "synthetic-provider", count: 2 }] },
    english,
  ),
  "Register 10 models first",
  "several providers are summed, without a name",
);
equal(
  prerequisiteLine({ state: "blocked", blockers: [mistral, codex] }, english),
  "",
  "decisions only: no prerequisite",
);
equal(
  prerequisiteLine({ state: "blocked", blockers: [{ ...vertex, kept: true }] }, english),
  "",
  "a kept row waits for nothing",
);
equal(prerequisiteLine(undefined, english), "", "no verdict, no prerequisite");
equal(
  adoptionProgress({ state: "blocked", blockers: [vertex] }, [], []),
  { decided: 0, total: 0 },
  "the prerequisite is not counted as a decision",
);
// A provider Bifrost reports as disabled is kept in Bifrost from the start (still undoable).
equal(
  disabledProviders({
    state: "blocked",
    blockers: [disabledMistral, mistral, codex, { ...disabledMistral, provider: "cohere", kept: true }],
  }),
  ["mistral"],
  "disabled providers not kept yet",
);
equal(disabledProviders(undefined), [], "none without a verdict");
console.log("Key readiness checks passed");
