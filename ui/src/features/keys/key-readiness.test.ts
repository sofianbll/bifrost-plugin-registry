import { fixture } from "../../dev/fixtures/registry";
import type { Key, Readiness, ReadinessBlocker } from "../../domain/registry";
import type { Copy } from "../../lib/locale";
import { blockerLine, readinessLabel, readinessReason, readinessState, unsavedRoutes } from "./key-readiness";

const english: Copy = (en) => en;
const french: Copy = (_en, fr) => fr;
const equal = (actual: unknown, expected: unknown, what: string) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${what}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); };

const block = (provider: string, kind: ReadinessBlocker["kind"], models: string[], reasons?: string[]): ReadinessBlocker => ({ provider, kind, count: reasons?.length ?? models.length, models, ...(reasons && { reasons }) });
const mistral = block("mistral", "undiscovered", ["large", "small", "code"]);
const unsaved = block("synthetic-provider", "unsaved", ["qa-unregistered"]);
const everyProvider = block("", "all-providers", [], ["allow_all_providers grants future providers and cannot be represented safely"]);
const unmanaged = (readiness?: Readiness): Key => ({ ...fixture.keys[0], managed: false, readiness });

// The state a key card and the Keys filter read: managed keys are past adoption, unread ones have no verdict.
equal(readinessState({ ...fixture.keys[0], managed: true }), "managed", "managed key");
equal(readinessState(fixture.keys[0]), "managed", "key without the managed flag is a managed key");
equal(readinessState(unmanaged()), "unknown", "unmanaged key whose permissions were not read");
equal(readinessState(unmanaged({ state: "ready", blockers: [] })), "ready", "ready");
equal(readinessState(unmanaged({ state: "blocked", blockers: [mistral] })), "blocked", "blocked");
equal(readinessState(unmanaged({ state: "empty", blockers: [] })), "empty", "empty");

// One line per blocker: provider, count, and what is wrong, in both languages.
equal(blockerLine(mistral, english), "Mistral · 3 models not discovered", "undiscovered");
equal(blockerLine({ ...mistral, count: 1, models: ["large"] }, english), "Mistral · 1 model not discovered", "one undiscovered");
equal(blockerLine(mistral, french), "Mistral · 3 modèles non découverts", "undiscovered in French");
equal(blockerLine(unsaved, english), "Synthetic Provider · 1 model to add", "unsaved");
equal(blockerLine(unsaved, french), "Synthetic Provider · 1 modèle à ajouter", "unsaved in French");
equal(blockerLine(everyProvider, english), "Every provider allowed", "all providers");
equal(blockerLine(block("Claude", "other", [], ["Dynamic native model allowlist is unsupported for Claude"]), english), "Claude · cannot be adopted as is", "other, with provider");
equal(blockerLine(block("", "other", [], ["Native key is inactive or expired"]), english), "Cannot be adopted as is", "other, whole key");

// The card's short reason: the first two blockers, then how many more; nothing when there is nothing to explain.
equal(readinessReason({ state: "blocked", blockers: [mistral] }, english), "Mistral · 3 models not discovered", "one blocker");
equal(readinessReason({ state: "blocked", blockers: [mistral, unsaved] }, english), "Mistral · 3 models not discovered; Synthetic Provider · 1 model to add", "two blockers");
equal(readinessReason({ state: "blocked", blockers: [mistral, unsaved, everyProvider] }, english), "Mistral · 3 models not discovered; Synthetic Provider · 1 model to add; +1 more", "three blockers");
equal(readinessReason({ state: "blocked", blockers: [mistral, unsaved, everyProvider] }, french), "Mistral · 3 modèles non découverts; Synthetic Provider · 1 modèle à ajouter; +1 de plus", "three blockers in French");
equal(readinessReason({ state: "ready", blockers: [] }, english), "", "ready needs no reason");
equal(readinessReason({ state: "empty", blockers: [] }, english), "", "empty needs no reason");
equal(readinessReason(undefined, english), "", "no verdict");

equal([readinessLabel("ready", english), readinessLabel("blocked", english), readinessLabel("empty", english), readinessLabel("unknown", english), readinessLabel("managed", english)], ["Ready to adopt", "Blocked", "Empty", "Adoption needed", "Managed"], "labels");
equal([readinessLabel("ready", french), readinessLabel("blocked", french), readinessLabel("empty", french)], ["Prête à adopter", "Bloquée", "Vide"], "French labels");

// Discovered-but-unsaved models are the only ones the models page can add: their routes feed the To add filter.
equal(unsavedRoutes({ state: "blocked", blockers: [mistral, unsaved, block("synthetic-provider", "unsaved", ["qa-other"]), block("synthetic-provider", "other", ["qa-off"], ["x"])] }), ["synthetic-provider/qa-unregistered", "synthetic-provider/qa-other"], "unsaved routes");
equal(unsavedRoutes(undefined), [], "no routes without a verdict");
console.log("Key readiness checks passed");
