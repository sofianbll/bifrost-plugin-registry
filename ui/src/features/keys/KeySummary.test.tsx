import { renderToStaticMarkup } from "react-dom/server";
import { fixture } from "../../dev/fixtures/registry";
import type { Key, Model } from "../../domain/registry";
import { LanguageContext } from "../../lib/locale";
import { formatDay, keyLedger, KeySummary } from "./KeySummary";

// Spec #85 round 2: a managed key opens on one ledger, "This key can call N models" (the h1 names the key, #69), one row per model
// grouped by subscription and tagged with its route; the technical check waits in one fold.
const text = (html: string) => html.split(/<[^>]*>/).join("");
const must = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const wrap = (language: "en" | "fr", node: React.ReactNode) => renderToStaticMarkup(<LanguageContext.Provider value={language}>{node}</LanguageContext.Provider>);
const summary = (virtualKey: Key, language: "en" | "fr" = "en", models: Model[] = fixture.models) => text(wrap(language, <KeySummary virtualKey={virtualKey} models={models} groups={fixture.groups} busy={false} snapshotMode={false} onReread={() => {}} />));

// The live Hermes case: Registry routes two models through OpenCode Go, DeepSeek stays in Bifrost with
// three models (one of them also a Registry card). Five distinct routes, not "1 + 2 + 3 + 5 + 4 IDs".
const access = (provider: string, model: string) => ({ provider, id: `${provider}/${model}`, route: "Direct provider", status: "Configured" as const });
const card = (id: string, name: string, accesses: Model["accesses"]): Model => ({ ...fixture.models[0], id, name, accesses });
const hermesModels = [
  card("deepseek-v4-pro", "DeepSeek V4 Pro", [access("deepseek", "deepseek-v4-pro"), access("opencode-go", "deepseek-v4-pro")]),
  card("deepseek-v4.1-flash", "DeepSeek V4.1 Flash", [access("opencode-go", "deepseek-v4.1-flash")]),
];
const hermes: Key = { ...fixture.keys[0], name: "Hermes", managed: true,
  policy: { groups: [], added: ["deepseek-v4-pro", "deepseek-v4.1-flash"], excluded: [], naming: "provider/model", accessSelection: { "deepseek-v4-pro": { added: [], excluded: ["deepseek/deepseek-v4-pro"] } }, keptNative: ["deepseek"] },
  permissions: { allProviders: false, providers: [{ provider: "opencode-go", allModels: false, models: ["deepseek-v4-pro", "deepseek-v4.1-flash"] }, { provider: "deepseek", allModels: false, models: ["deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"] }] },
  publication: { state: "verified", revision: "abcdef0123456789", checkedAt: "2026-10-12T09:30:00Z", expected: [], actual: ["opencode-go/deepseek-v4-pro", "opencode-go/deepseek-v4.1-flash", "deepseek/deepseek-chat", "deepseek/deepseek-v4-pro"], missing: [], unexpected: [] } };

const ledger = keyLedger(hermes, hermesModels, fixture.groups);
must(ledger.total === 5 && !ledger.open, `Hermes can call 5 models, got ${JSON.stringify(ledger)}`);
must(JSON.stringify(ledger.groups.map(group => [group.provider, group.rows.map(row => `${row.name}|${row.kept ? "kept" : row.via}`)])) === JSON.stringify([
  ["deepseek", ["DeepSeek V4 Pro|kept", "deepseek-chat|kept", "deepseek-reasoner|kept"]],
  ["opencode-go", ["DeepSeek V4 Pro|opencode-go", "DeepSeek V4.1 Flash|opencode-go"]],
]), `one row per route, grouped by subscription, kept routes named after their card, got ${JSON.stringify(ledger.groups)}`);

// A Registry route named like a kept provider is Registry's, and counts once when Bifrost allows it too.
const overlap = keyLedger({ ...hermes, policy: { ...hermes.policy, accessSelection: undefined } }, hermesModels, fixture.groups);
must(overlap.total === 5 && overlap.groups[0].rows.find(row => row.name === "DeepSeek V4 Pro")?.via === "deepseek", `the same route counts once, got ${JSON.stringify(overlap)}`);

// A model waiting for an access choice is not published, so it is not callable.
must(keyLedger({ ...hermes, pendingAccessSelection: { "deepseek-v4.1-flash": ["a", "b"] } }, hermesModels, fixture.groups).total === 4, "a withheld model is not counted");
// A kept provider allowing every model, or not read yet, leaves the total open.
const open = keyLedger({ ...hermes, permissions: { allProviders: false, providers: [{ provider: "deepseek", allModels: true, models: [] }] } }, hermesModels, fixture.groups);
must(open.total === 2 && open.open && open.groups.find(group => group.provider === "deepseek")?.open === "all", `all models kept: open total, got ${JSON.stringify(open)}`);
must(keyLedger({ ...hermes, permissions: undefined }, hermesModels, fixture.groups).groups.find(group => group.provider === "deepseek")?.open === "unread", "permissions not read yet");

const english = summary(hermes, "en", hermesModels);
for (const line of ["This key can call 5 models", "OpenCode Go · 2 models", "DeepSeek · 3 models", "via OpenCode Go", "kept in Bifrost", "Technical check · Verified Oct 12, 2026", "Checked with Bifrost", "Read again", "Bifrost allows today"]) must(english.includes(line), `English ledger must read "${line}", got ${english}`);
for (const jargon of ["Readback", "chosen in Registry", "IDs ·"]) must(!english.includes(jargon), `no "${jargon}" on the read page, got ${english}`);
must(english.indexOf("This key can call") < english.indexOf("Technical check") && english.indexOf("Technical check") < english.indexOf("Bifrost allows today"), "story 36 and the readback IDs wait inside the technical fold");
const french = summary(hermes, "fr", hermesModels);
for (const line of ["Cette clé peut appeler 5 modèles", "via OpenCode Go", "conservé dans Bifrost", "Vérification technique · Vérifiée le 12/10/2026", "Vérifié avec Bifrost", "Relire", "Bifrost autorise aujourd’hui"]) must(french.includes(line), `French ledger must read "${line}", got ${french}`);
must(summary(hermes, "en", hermesModels).includes("abcdef012345"), "the revision is in the technical fold");
must(summary({ ...hermes, permissions: { allProviders: false, providers: [{ provider: "deepseek", allModels: true, models: [] }] } }, "en", hermesModels).includes("This key can call at least 2 models"), "an open total says at least");

const empty = summary({ ...hermes, policy: { groups: [], added: [], excluded: [], naming: "model" } });
must(empty.includes("No model selected yet"), `an empty key says so, got ${empty}`);

// Dates read in the active language: never the ambiguous 10/12/2026 in English.
must(formatDay("en", "2026-10-12T09:30:00Z") === "Oct 12, 2026" && formatDay("fr", "2026-10-12T09:30:00Z") === "12/10/2026", "locale dates");

console.log("Key summary checks passed");
