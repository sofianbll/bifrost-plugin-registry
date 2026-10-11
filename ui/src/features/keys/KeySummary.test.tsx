import { renderToStaticMarkup } from "react-dom/server";
import { fixture } from "../../dev/fixtures/registry";
import type { Key } from "../../domain/registry";
import { LanguageContext } from "../../lib/locale";
import { KeySummary } from "./KeySummary";

// Spec #85 round 1: a managed key opens read-first, on what it can call today, grouped by subscription.
const text = (html: string) => html.split(/<[^>]*>/).join("");
const must = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const wrap = (language: "en" | "fr", node: React.ReactNode) => renderToStaticMarkup(<LanguageContext.Provider value={language}>{node}</LanguageContext.Provider>);

const key: Key = { ...fixture.keys[0], managed: true, policy: { groups: [], added: ["gpt-5", "gpt-5-mini", "claude-opus-4"], excluded: [], naming: "model", accessSelection: { "gpt-5": { added: [], excluded: ["azure/gpt-5"] } }, keptNative: ["mistral"] }, permissions: { allProviders: false, providers: [{ provider: "mistral", allModels: false, models: ["large", "small"] }] } };
const english = text(wrap("en", <KeySummary virtualKey={key} models={fixture.models} groups={fixture.groups} />));
must(english.includes("What this key can call today"), `heading, got ${english}`);
must(english.includes("OpenAI · 2 models") && english.includes("GPT-5, GPT-5 mini"), `models grouped under their subscription, got ${english}`);
must(english.includes("Anthropic · 1 model") && english.includes("Claude Opus 4"), `one line per subscription, got ${english}`);
must(!english.includes("Azure"), `an excluded access is not callable, got ${english}`);
must(english.includes("Mistral · kept in Bifrost · 2 models"), `kept providers are listed beside, got ${english}`);
must(english.includes("Bifrost allows today"), `what Bifrost allows stays on the page (story 36), got ${english}`);

const french = text(wrap("fr", <KeySummary virtualKey={key} models={fixture.models} groups={fixture.groups} />));
must(french.includes("Ce que cette clé peut appeler aujourd’hui") && french.includes("OpenAI · 2 modèles"), `French, got ${french}`);

const empty = text(wrap("en", <KeySummary virtualKey={{ ...key, policy: { groups: [], added: [], excluded: [], naming: "model" } }} models={fixture.models} groups={fixture.groups} />));
must(empty.includes("No model selected yet"), `an empty key says so, got ${empty}`);

console.log("Key summary checks passed");
