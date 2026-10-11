import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import type { NativePermissions } from "../../domain/registry";
import { KeyPermissions } from "./KeyPermissions";

// #81/#87: a key page prints what Bifrost allows as counts per provider; the model IDs wait behind a disclosure.
const ids = Array.from({ length: 53 }, (_, index) => `mistral-model-${String(index).padStart(2, "0")}`);
const permissions: NativePermissions = { allProviders: false, providers: [
  { provider: "mistral", allModels: false, models: ids },
  { provider: "deepseek", allModels: false, models: ["deepseek-chat"] },
  { provider: "Claude", allModels: true, models: [] },
  { provider: "Google", allModels: false, models: [], versionDependent: true },
  { provider: "Codex", allModels: false, models: [] },
] };
const render = (language: "en" | "fr", value: NativePermissions | null = permissions) => renderToStaticMarkup(<LanguageContext.Provider value={language}><KeyPermissions permissions={value ?? undefined} /></LanguageContext.Provider>);
const text = (html: string) => html.split(/<[^>]*>/).join("");
const must = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

const english = render("en");
must(english.includes('aria-label="Bifrost allows today"'), "the list keeps its accessible name");
for (const line of ["Mistral · 53 models", "DeepSeek · 1 model", "Claude · all models", "Google · depends on the Bifrost version", "Codex · no model"]) must(text(english).includes(line), `English list must read "${line}"`);
// The 53 IDs are inside closed disclosures, never in the visible summary line.
must(!english.includes(" open"), "disclosures start closed");
must(english.includes(ids[52]) && english.includes("deepseek-chat"), "every ID stays reachable");
must(!english.split(/<details[\s\S]*?<\/details>/).join("").includes("mistral-model"), "IDs must not appear outside a disclosure");
must(!/<summary[^>]*>[^<]*mistral-model/.test(english), "a summary shows counts, not IDs");

const french = text(render("fr"));
for (const line of ["Mistral · 53 modèles", "DeepSeek · 1 modèle", "Claude · tous les modèles", "Google · selon la version de Bifrost", "Codex · aucun modèle"]) must(french.includes(line), `French list must read "${line}"`);
must(render("fr").includes('aria-label="Bifrost autorise aujourd’hui"'), "French accessible name");

// Nothing to list: no empty list element.
must(render("en", null) === "" && render("en", { allProviders: true, providers: [] }) === "" && render("en", { allProviders: false, providers: [] }) === "", "no providers, no list");
console.log("Key permissions checks passed");
