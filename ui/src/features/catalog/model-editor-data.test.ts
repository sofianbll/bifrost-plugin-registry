import { alsoAvailable, applyModelId, canonicalCapabilities, changeAccessProvider, declaredEndpoints, firstRegistrationIssue, matchingAccesses, modelEditorOptions, omitUnchangedReferenceIds, prefillFromReference, reviewSentence } from "./model-editor-data";
import type { Catalog } from "./catalog-api";
import type { Model } from "../../domain/registry";

const reference = { id: "creator/new-model", fields: {
  name: { value: "New Model", source: "models.dev", updatedAt: "2026-09-24", kind: "declared" as const },
  creator: { value: "Creator", source: "models.dev", updatedAt: "2026-09-24", kind: "declared" as const },
  family: { value: "Series", source: "models.dev", updatedAt: "2026-09-24", kind: "declared" as const },
  context_length: { value: 64000, source: "models.dev", updatedAt: "2026-09-24", kind: "declared" as const },
  tool_call: { value: true, source: "models.dev", updatedAt: "2026-09-24", kind: "declared" as const },
}, overrides: {} };
const catalog: Catalog = { revision: "1", references: [reference], accesses: [], sources: [] };
const draft: Model = { id: "", name: "", creator: "Unknown", family: "My correction", inputModalities: [], outputModalities: [], tasks: [], kind: "Unknown", summary: "Manual summary", context: "Unknown", capabilities: {}, accesses: [{ provider: "", id: "", nativeModel: "", route: "Direct provider", status: "Unknown" }] };
const equal = (actual: unknown, expected: unknown) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); };

equal(firstRegistrationIssue(draft), "id");
const validDraft: Model = { ...draft, id: "new-model", name: "New Model", kind: "Unknown", accesses: [{ provider: "provider", id: "provider/new-model", nativeModel: "native/path", route: "Direct provider", status: "Configured", endpoints: ["responses"] }] };
equal(firstRegistrationIssue(validDraft), undefined);
equal(firstRegistrationIssue({ ...validDraft, name: "  " }), "name");
equal(firstRegistrationIssue({ ...validDraft, accesses: [{ ...validDraft.accesses[0], endpoints: [] }] }), "operations");
equal(firstRegistrationIssue({ ...validDraft, accesses: [validDraft.accesses[0], { ...validDraft.accesses[0], provider: "second", id: "second/new-model", endpoints: [] }] }), "operations");
equal(firstRegistrationIssue({ ...validDraft, accesses: [{ ...validDraft.accesses[0], id: "wrong" }] }), "access");

const english = (text: string) => text;
equal(modelEditorOptions(catalog, [], english).modelIds, [{ value: "new-model", label: "New Model", detail: "Reference creator/new-model", referenceId: "creator/new-model" }]);
const catalogWithNativePath: Catalog = { ...catalog, accesses: [
  { id: "provider/native/path", provider: "provider", model: "native/path", configured: true, referenceId: reference.id, fields: {}, overrides: {} },
  { id: "provider/other/path", provider: "provider", model: "other/path", configured: false, fields: {}, overrides: {} },
] };
equal(modelEditorOptions(catalogWithNativePath, [], (_, french) => french).modelIds, [{ value: "new-model", label: "New Model", detail: "Fiche documentaire creator/new-model", referenceId: "creator/new-model" }]);
equal(modelEditorOptions(catalogWithNativePath, [], english).providers, [{ value: "provider" }]);
const next = prefillFromReference(draft, reference);
equal(next.name, "New Model");
equal(next.creator, "Creator");
equal(next.family, "My correction");
equal(next.context, "64000");
equal(next.summary, "Manual summary");
equal(next.accesses, draft.accesses);
equal(next.kind, "Unknown");
equal(next.capabilities["Tool calling"], "Declared");
equal(canonicalCapabilities({ Tools: "Declared", "Tool calling": "Unknown" }), { "Tool calling": "Unknown" });
equal(canonicalCapabilities({ Tools: "Declared" }), { "Tool calling": "Declared" });
const selected = applyModelId(draft, "new-model", { provider: "provider", nativeModel: "native/path", status: "Configured", source: "provider/native/path" });
equal(selected.accesses[0], { ...draft.accesses[0], provider: "provider", id: "provider/new-model", nativeModel: "native/path", status: "Configured" });
equal(applyModelId(selected, "new-alias").accesses[0].id, "provider/new-alias");
equal(changeAccessProvider(selected.accesses[0], "new-model", "custom-provider"), { ...selected.accesses[0], provider: "custom-provider", id: "custom-provider/new-model" });
equal(applyModelId({ ...selected, accesses: [{ ...selected.accesses[0], id: "provider/custom" }] }, "new-alias").accesses[0].id, "provider/new-alias");
equal(applyModelId({ ...selected, accesses: [{ ...selected.accesses[0], nativeModel: "manual/native" }] }, "new-alias").accesses[0].nativeModel, "manual/native");
const twoAccesses = { ...selected, accesses: [selected.accesses[0], { ...selected.accesses[0], provider: "second", id: "second/new-model", nativeModel: "other/native", referenceId: "ref/exact" }] };
equal(applyModelId(twoAccesses, "new-alias").accesses.map(access => [access.id, access.nativeModel, access.referenceId]), [["provider/new-alias", "native/path", undefined], ["second/new-alias", "other/native", "ref/exact"]]);
equal(modelEditorOptions(catalog, [twoAccesses], english).providers, [{ value: "provider" }, { value: "second" }]);
const existing: Model = { ...draft, id: "alias", accesses: [{ provider: "p", id: "p/alias", nativeModel: "native", route: "Direct provider", status: "Configured", referenceId: "ref/automatic" }] };
equal(omitUnchangedReferenceIds(existing, [existing]).accesses[0].referenceId, undefined);
equal(omitUnchangedReferenceIds({ ...existing, accesses: [{ ...existing.accesses[0], referenceId: "ref/changed" }] }, [existing]).accesses[0].referenceId, "ref/changed");
equal(omitUnchangedReferenceIds({ ...existing, accesses: [{ ...existing.accesses[0], referenceId: "" }] }, [existing]).accesses[0].referenceId, "");
// A new access preselects the operations its native mode implies (Bifrost's parameters datasheet).
const withMode = (mode: unknown) => ({ id: "p/m", fields: { parameters: { value: { model: "m", provider: "p", mode }, source: "bifrost", updatedAt: null, kind: "declared" as const } }, overrides: {} });
// A chat model answers both text request types Registry offers: Chat Completions and Responses.
equal(declaredEndpoints(withMode("chat")), ["chat/completions", "responses"]);
equal(declaredEndpoints(withMode("image_generation")), ["images/generations"]);
equal(declaredEndpoints(withMode("embedding")), ["embeddings"]);
equal(declaredEndpoints(withMode("decisions")), ["decisions"]); // Jev: decisions only, no manual tick
equal(declaredEndpoints(withMode("something-new")), []);
equal(declaredEndpoints(withMode(undefined)), []);
equal(declaredEndpoints(undefined), []);
// No declared mode: what the model outputs decides (the access's own facts, else its reference's).
const outputs = (value: unknown) => ({ id: "x", fields: { output_modalities: { value, source: "models.dev", updatedAt: null, kind: "declared" as const } }, overrides: {} });
equal(declaredEndpoints(outputs(["text"])), ["chat/completions", "responses"]);
equal(declaredEndpoints(withMode(undefined), outputs(["text"])), ["chat/completions", "responses"]);
equal(declaredEndpoints(outputs(["image"])), ["images/generations"]);
equal(declaredEndpoints(outputs(["audio"])), ["audio/speech"]);
equal(declaredEndpoints(outputs(["text", "image"])), ["chat/completions", "responses", "images/generations"]);
equal(declaredEndpoints(withMode("embedding"), outputs(["text"])), ["embeddings"]); // a declared mode wins
equal(declaredEndpoints(withMode("something-new"), outputs(["text"])), []); // an unknown declared mode is not guessed
equal(declaredEndpoints(outputs(["video"])), []);

// "Also available": accesses that are the card's model. An aggregator links "-pro", "-latest" or ":batch"
// variants to the base reference; only an access under the card's own name is the same model.
const offer = (provider: string, model: string, referenceId?: string, configured = true) => ({ id: `${provider}/${model}`, provider, model, configured, referenceId, fields: {}, overrides: {} });
const luna = { provider: "Codex", id: "Codex/gpt-5.6-luna", route: "Direct provider", status: "Configured" as const, nativeModel: "gpt-5.6-luna", referenceId: "openai/gpt-5.6-luna" };
const offers = [
  offer("openrouter", "openai/gpt-5.6-luna", "openai/gpt-5.6-luna"),
  offer("openrouter", "openai/gpt-5.6-luna-pro", "openai/gpt-5.6-luna"),
  offer("openrouter", "~openai/gpt-luna-latest", "openai/gpt-5.6-luna"),
  offer("openrouter", "openai/gpt-5.6-luna:batch", "openai/gpt-5.6-luna"),
  offer("bedrock", "us.openai.gpt-5-6-luna-v1:0", "openai/gpt-5.6-luna"), // plain native name: the reference decides
  offer("other", "gpt-5.6-luna"), // no reference, the card's own name
  offer("other", "gpt-5.6-luna-pro"), // no reference, another name
  offer("gone", "gpt-5.6-luna", "openai/gpt-5.6-luna", false),
  offer("taken", "gpt-5.6-luna", "openai/gpt-5.6-luna"),
];
const taken = { ...existing, id: "other-card", accesses: [{ ...luna, provider: "taken", id: "taken/other-card", nativeModel: "gpt-5.6-luna" }] };
const matches = (id: string, known: typeof luna[]) => matchingAccesses(offers, id, known, [taken]).map(access => access.id);
equal(matches("gpt-5.6-luna", [luna]), ["openrouter/openai/gpt-5.6-luna", "bedrock/us.openai.gpt-5-6-luna-v1:0", "other/gpt-5.6-luna"]);
// The "-pro" card takes the "-pro" access and not the base model's aggregator access.
equal(matches("gpt-5.6-luna-pro", [{ ...luna, nativeModel: "gpt-5.6-luna-pro" }]), ["openrouter/openai/gpt-5.6-luna-pro", "bedrock/us.openai.gpt-5-6-luna-v1:0", "other/gpt-5.6-luna-pro"]);
// #85 round 2: the "+N available" badge and the sheet's "Also available · N" are one definition. A card that
// already holds the Codex access is offered the others once each; "other/gpt-5.6-luna" matches by name only
// (no reference), so a count over the card's reference groups alone missed it (+3 on the tile, 4 in the sheet).
const card = { ...existing, id: "gpt-5.6-luna", accesses: [luna] };
const twice = [...offers, offer("openrouter", "openai/gpt-5.6-luna", "openai/gpt-5.6-luna")];
equal(alsoAvailable(twice, card, [card, taken]).map(access => access.id), ["openrouter/openai/gpt-5.6-luna", "bedrock/us.openai.gpt-5-6-luna-v1:0", "other/gpt-5.6-luna"]);
// An access held by the card is not "also" available; one the editor removed comes back as an offer.
const withOther = { ...card, accesses: [luna, { ...luna, provider: "other", id: "other/gpt-5.6-luna" }] };
equal(alsoAvailable(offers, withOther, [withOther, taken]).map(access => access.id), ["openrouter/openai/gpt-5.6-luna", "bedrock/us.openai.gpt-5-6-luna-v1:0"]);
equal(alsoAvailable(offers, card, [withOther, taken], withOther.accesses).map(access => access.id), ["openrouter/openai/gpt-5.6-luna", "bedrock/us.openai.gpt-5-6-luna-v1:0", "other/gpt-5.6-luna"]);
// #100: the Review step opens on one plain sentence of consequence, built from the draft.
const fr = (_: string, french: string) => french;
equal(reviewSentence({ name: "glm-5.1", providers: ["OpenCode Go"], creating: true }, english), "You’re registering glm-5.1 from your OpenCode Go subscription. It appears in My models; no key can use it until you add it to one.");
equal(reviewSentence({ name: "glm-5.1", providers: ["OpenCode Go"], creating: true }, fr), "Vous enregistrez glm-5.1 depuis votre abonnement OpenCode Go. Il apparaîtra dans Mes modèles ; aucune clé ne pourra l’utiliser tant que vous ne l’aurez pas ajouté à une clé.");
equal(reviewSentence({ name: "DeepSeek V4", providers: ["OpenCode Go", "DeepSeek", "OpenRouter"], creating: true }, english), "You’re registering DeepSeek V4 from your OpenCode Go, DeepSeek and OpenRouter subscriptions. It appears in My models; no key can use it until you add it to one.");
equal(reviewSentence({ name: "DeepSeek V4", providers: ["OpenCode Go", "DeepSeek"], creating: true }, fr), "Vous enregistrez DeepSeek V4 depuis vos abonnements OpenCode Go et DeepSeek. Il apparaîtra dans Mes modèles ; aucune clé ne pourra l’utiliser tant que vous ne l’aurez pas ajouté à une clé.");
equal(reviewSentence({ name: "", providers: [], creating: true }, english), "You’re registering this model. It appears in My models; no key can use it until you add it to one.");
equal(reviewSentence({ name: "glm-5.1", providers: ["OpenCode Go"], creating: false }, english), "You’re saving changes to glm-5.1. Keys that already use it get these changes.");
equal(reviewSentence({ name: "glm-5.1", providers: ["OpenCode Go"], creating: false }, fr), "Vous enregistrez des modifications de glm-5.1. Les clés qui l’utilisent déjà reçoivent ces modifications.");
console.log("model editor data checks passed");
