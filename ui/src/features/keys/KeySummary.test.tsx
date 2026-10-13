import { renderToStaticMarkup } from "react-dom/server";
import { fixture } from "../../dev/fixtures/registry";
import type { Key, Model } from "../../domain/registry";
import { LanguageContext } from "../../lib/locale";
import { checkState, formatDay, keyLedger, KeySummary } from "./KeySummary";

// Spec #85 round 2 and #99: a managed key opens on one ledger, "This key can call N models" (the h1 names the key, #69), one row
// per model with the subscriptions that serve it; the technical check waits in one fold.
const text = (html: string) => html.split(/<[^>]*>/).join("");
const must = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const wrap = (language: "en" | "fr", node: React.ReactNode) =>
  renderToStaticMarkup(<LanguageContext.Provider value={language}>{node}</LanguageContext.Provider>);
const summary = (virtualKey: Key, language: "en" | "fr" = "en", models: Model[] = fixture.models) =>
  text(
    wrap(
      language,
      <KeySummary
        virtualKey={virtualKey}
        models={models}
        groups={fixture.groups}
        busy={false}
        snapshotMode={false}
        onReread={() => {}}
      />,
    ),
  );

// The live Hermes case (#99): Registry routes two models through OpenCode Go; DeepSeek stays in Bifrost and allows
// deepseek-flash, deepseek-v4-pro and deepseek-v4.1-flash, but DeepSeek does not list deepseek-v4.1-flash, so
// Bifrost's /v1/models for the key lists 4 IDs. The key can call 3 models, one row each, counted once whatever
// the subscriptions; the kept route Bifrost does not list is flagged and is a difference, not drift.
const access = (provider: string, model: string) => ({
  provider,
  id: `${provider}/${model}`,
  route: "Direct provider",
  status: "Configured" as const,
});
const card = (id: string, name: string, accesses: Model["accesses"]): Model => ({
  ...fixture.models[0],
  id,
  name,
  accesses,
});
const hermesModels = [
  card("deepseek-v4-pro", "DeepSeek V4 Pro", [
    access("deepseek", "deepseek-v4-pro"),
    access("opencode-go", "deepseek-v4-pro"),
  ]),
  card("deepseek-v4.1-flash", "DeepSeek V4.1 Flash", [access("opencode-go", "deepseek-v4.1-flash")]),
];
const hermes: Key = {
  ...fixture.keys[0],
  name: "Hermes",
  managed: true,
  policy: {
    groups: [],
    added: ["deepseek-v4-pro", "deepseek-v4.1-flash"],
    excluded: [],
    naming: "provider/model",
    accessSelection: { "deepseek-v4-pro": { added: [], excluded: ["deepseek/deepseek-v4-pro"] } },
    keptNative: ["deepseek"],
  },
  permissions: {
    allProviders: false,
    providers: [
      { provider: "opencode-go", allModels: false, models: ["deepseek-v4-pro", "deepseek-v4.1-flash"] },
      { provider: "deepseek", allModels: false, models: ["deepseek-flash", "deepseek-v4-pro", "deepseek-v4.1-flash"] },
    ],
  },
  publication: {
    state: "verified",
    revision: "abcdef0123456789",
    checkedAt: "2026-10-12T09:30:00Z",
    expected: [],
    actual: [
      "deepseek/deepseek-flash",
      "deepseek/deepseek-v4-pro",
      "opencode-go/deepseek-v4-pro",
      "opencode-go/deepseek-v4.1-flash",
    ],
    missing: [],
    unexpected: [],
  },
};
const rows = (ledger: ReturnType<typeof keyLedger>) =>
  JSON.stringify(ledger.rows.map(row => `${row.name}|${row.via.join(",")}|${row.unlisted.join(",")}`));

const ledger = keyLedger(hermes, hermesModels, fixture.groups);
must(
  ledger.total === 3 && !ledger.open && ledger.differences === 1,
  `Hermes can call 3 models with 1 difference, got ${JSON.stringify(ledger)}`,
);
must(
  rows(ledger) ===
    JSON.stringify([
      "DeepSeek V4 Pro|deepseek,opencode-go|",
      "DeepSeek V4.1 Flash|opencode-go|deepseek",
      "deepseek-flash|deepseek|",
    ]),
  `one row per model with its subscriptions, the unlisted kept route flagged, got ${rows(ledger)}`,
);

// A Registry route named like a kept provider is Registry's, and counts once when Bifrost allows it too.
const overlap = keyLedger(
  { ...hermes, policy: { ...hermes.policy, accessSelection: undefined } },
  hermesModels,
  fixture.groups,
);
must(overlap.total === 3 && rows(overlap) === rows(ledger), `the same route counts once, got ${rows(overlap)}`);
// Before any readback nothing can be confirmed or flagged: the kept route counts as Bifrost allows it.
const unread = keyLedger({ ...hermes, publication: undefined }, hermesModels, fixture.groups);
must(
  unread.total === 3 && unread.differences === 0 && rows(unread).includes("DeepSeek V4.1 Flash|deepseek,opencode-go|"),
  `no readback, no difference, got ${rows(unread)}`,
);
// A model waiting for an access choice is not published; left with only an unlisted kept route, it is not counted.
const withheld = keyLedger(
  { ...hermes, pendingAccessSelection: { "deepseek-v4.1-flash": ["a", "b"] } },
  hermesModels,
  fixture.groups,
);
must(
  withheld.total === 2 && rows(withheld).includes("DeepSeek V4.1 Flash||deepseek"),
  `a withheld model is not counted, got ${rows(withheld)}`,
);
// A kept provider allowing every model, or not read yet, leaves the total open.
const open = keyLedger(
  {
    ...hermes,
    permissions: { allProviders: false, providers: [{ provider: "deepseek", allModels: true, models: [] }] },
  },
  hermesModels,
  fixture.groups,
);
must(
  open.total === 2 && open.open && open.rows.find(row => row.open)?.open === "all",
  `all models kept: open total, got ${JSON.stringify(open)}`,
);
must(
  keyLedger({ ...hermes, permissions: undefined }, hermesModels, fixture.groups).rows.find(row => row.open)?.open ===
    "unread",
  "permissions not read yet",
);

must(
  checkState(hermes, (en: string) => en, 1) === "Verified · 1 difference" &&
    checkState(hermes, (_en: string, fr: string) => fr, 2) === "Vérifiée · 2 écarts",
  "a verified key with differences says so",
);
const english = summary(hermes, "en", hermesModels);
for (const line of [
  "This key can call 3 models",
  "DeepSeek V4 Pro",
  "via DeepSeek, OpenCode Go",
  "DeepSeek: Bifrost does not list this one",
  "Kept in Bifrost: DeepSeek",
  "Edit selection counts only",
  "Technical check · Verified Oct 12, 2026 · 1 difference",
  "Checked with Bifrost",
  "Read again",
  "Bifrost allows today",
])
  must(english.includes(line), `English ledger must read "${line}", got ${english}`);
for (const jargon of ["Readback", "chosen in Registry", "IDs ·", "call 5"])
  must(!english.includes(jargon), `no "${jargon}" on the read page, got ${english}`);
must(
  english.indexOf("This key can call") < english.indexOf("Technical check") &&
    english.indexOf("Technical check") < english.indexOf("Bifrost allows today"),
  "story 36 and the readback IDs wait inside the technical fold",
);
const french = summary(hermes, "fr", hermesModels);
for (const line of [
  "Cette clé peut appeler 3 modèles",
  "via DeepSeek, OpenCode Go",
  "DeepSeek : Bifrost ne liste pas celui-ci",
  "Conservé dans Bifrost : DeepSeek",
  "Vérification technique · Vérifiée le 12/10/2026 · 1 écart",
  "Vérifié avec Bifrost",
  "Relire",
  "Bifrost autorise aujourd’hui",
])
  must(french.includes(line), `French ledger must read "${line}", got ${french}`);
must(english.includes("abcdef012345"), "the revision is in the technical fold");
const openText = summary(
  {
    ...hermes,
    permissions: { allProviders: false, providers: [{ provider: "deepseek", allModels: true, models: [] }] },
  },
  "en",
  hermesModels,
);
must(
  openText.includes("This key can call at least 2 models") && openText.includes("All models Bifrost allows"),
  `an open total says at least, got ${openText}`,
);
must(
  summary(
    {
      ...hermes,
      permissions: {
        allProviders: false,
        providers: [{ provider: "deepseek", allModels: false, models: [], versionDependent: true }],
      },
    },
    "en",
    hermesModels,
  ).includes("Depends on the Bifrost version"),
  "a version-dependent kept provider says so",
);

const empty = summary({ ...hermes, policy: { groups: [], added: [], excluded: [], naming: "model" } });
must(empty.includes("No model selected yet"), `an empty key says so, got ${empty}`);

// Dates read in the active language: never the ambiguous 10/12/2026 in English.
must(
  formatDay("en", "2026-10-12T09:30:00Z") === "Oct 12, 2026" &&
    formatDay("fr", "2026-10-12T09:30:00Z") === "12/10/2026",
  "locale dates",
);

console.log("Key summary checks passed");
