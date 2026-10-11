import { renderToStaticMarkup } from "react-dom/server";
import { fixture } from "../../dev/fixtures/registry";
import type { Key, Readiness } from "../../domain/registry";
import { LanguageContext } from "../../lib/locale";
import { keptNativeOf, KeptNative, KeptProviders } from "./KeptNative";

// #92: an adopted key that keeps a provider in Bifrost says so on its card and in its composer,
// and the adoption dialog names what is kept and offers the way back.
const text = (html: string) => html.split(/<[^>]*>/).join("");
const must = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const wrap = (language: "en" | "fr", node: React.ReactNode) => renderToStaticMarkup(<LanguageContext.Provider value={language}>{node}</LanguageContext.Provider>);

const base = fixture.keys[0];
const adopted = (keptNative: string[], providers: NonNullable<Key["permissions"]>["providers"]): Key => ({ ...base, managed: true, policy: { ...base.policy, keptNative }, permissions: { allProviders: false, providers } });
const mistral = { provider: "mistral", allModels: false, models: ["large", "small", "code"] };
const key = adopted(["mistral"], [mistral, { provider: "Claude", allModels: false, models: ["qa-haiku"] }]);

must(JSON.stringify(keptNativeOf(key)) === JSON.stringify([{ provider: "mistral", count: 3, all: false }]), "only the kept provider is listed, with its model count");
must(keptNativeOf(adopted(["Claude"], [{ provider: "Claude", allModels: true, models: [] }]))[0].all, "a wildcard allowlist is all models");
must(keptNativeOf(adopted(["mistral"], []))[0].count === undefined, "permissions not read yet: no count");
must(keptNativeOf(base).length === 0, "a key that keeps nothing lists nothing");

const english = wrap("en", <KeptNative virtualKey={key} />);
must(text(english).includes("Mistral · kept in Bifrost · 3 models"), `English line, got ${text(english)}`);
must(english.includes('aria-label="Kept in Bifrost"') && english.includes('role="img"'), "a named list with the provider mark");
must(text(wrap("fr", <KeptNative virtualKey={key} />)).includes("Mistral · conservé dans Bifrost · 3 modèles"), "French line");
must(text(wrap("en", <KeptNative virtualKey={adopted(["Claude"], [{ provider: "Claude", allModels: true, models: [] }])} />)).includes("Claude · kept in Bifrost · all models"), "all models");
must(wrap("en", <KeptNative virtualKey={base} />) === "", "no kept provider, no list");

// The dialog section: what is kept and the consequence, with an undo only when the dialog can act.
const kept: Readiness = { state: "ready", blockers: [
  { provider: "mistral", kind: "undiscovered", count: 3, models: ["large", "small", "code"], kept: true },
  { provider: "mistral", kind: "unsaved", count: 1, models: ["extra"], kept: true },
  { provider: "synthetic-provider", kind: "unsaved", count: 1, models: ["qa-unregistered"] },
] };
const section = wrap("en", <KeptProviders readiness={kept} onKeep={() => {}} />);
const plain = text(section);
must(plain.includes("Mistral · 4 models kept in Bifrost"), `one line per kept provider, got ${plain}`);
must(plain.includes("Registry will not manage or change Mistral’s permissions"), "the consequence is stated");
must(!plain.includes("Synthetic Provider"), "providers that are not kept are not listed");
must(section.includes("Stop keeping Mistral in Bifrost"), "the way back is offered");
must(!wrap("en", <KeptProviders readiness={kept} />).includes("Stop keeping"), "no undo without a handler");
must(wrap("en", <KeptProviders readiness={{ state: "blocked", blockers: [kept.blockers[2]] }} onKeep={() => {}} />) === "", "nothing kept, no section");
const french = text(wrap("fr", <KeptProviders readiness={kept} onKeep={() => {}} />));
for (const line of ["Mistral · 4 modèles conservés dans Bifrost", "Registry ne gérera ni ne modifiera les permissions du fournisseur Mistral", "Ne plus garder Mistral dans Bifrost"]) must(french.includes(line), `French dialog must read "${line}"`);
// A kept provider that allows every model names no model: the dialog says "all models", never "0 models".
const keptStar: Readiness = { state: "ready", blockers: [{ provider: "Claude", kind: "dynamic", count: 1, models: [], reasons: ["Dynamic native model allowlist is unsupported for Claude"], kept: true }] };
must(text(wrap("en", <KeptProviders readiness={keptStar} onKeep={() => {}} />)).includes("Claude · all models kept in Bifrost"), "all models kept");
must(text(wrap("fr", <KeptProviders readiness={keptStar} onKeep={() => {}} />)).includes("Claude · tous les modèles conservés dans Bifrost"), "all models kept, in French");
// A provider kept to resolve a collision leaves no blocker behind: the dialog's own choice still lists it, with its undo.
const collisionKept = wrap("en", <KeptProviders readiness={kept} kept={["mistral", "Codex"]} onKeep={() => {}} />);
must(text(collisionKept).includes("Codex kept in Bifrost") && collisionKept.includes("Stop keeping Codex in Bifrost") && text(collisionKept).includes("Mistral · 4 models kept in Bifrost"), `a kept provider without blockers is listed, got ${text(collisionKept)}`);
must(text(wrap("fr", <KeptProviders readiness={{ state: "ready", blockers: [] }} kept={["Codex"]} onKeep={() => {}} />)).includes("Codex conservé dans Bifrost"), "in French");
console.log("Kept native checks passed");
