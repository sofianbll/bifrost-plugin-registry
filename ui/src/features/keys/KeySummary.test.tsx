import { renderToStaticMarkup } from "react-dom/server";
import { fixture } from "../../dev/fixtures/registry";
import type { Key, Model } from "../../domain/registry";
import { LanguageContext } from "../../lib/locale";
import {
  checkDifferenceNote,
  checkFailed,
  checkLabel,
  checkState,
  differenceCount,
  differenceNote,
  keptNote,
  keyLedger,
  KeySummary,
  verifiedToast,
} from "./KeySummary";

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
// The toasts say the same: "Verified with Bifrost" is never plain while Bifrost does not list a kept route.
const en = (text: string) => text;
const fr = (_text: string, french: string) => french;
must(
  verifiedToast(en, 0) === "Verified with Bifrost." &&
    verifiedToast(en, 1) === "Verified with Bifrost · 1 difference." &&
    verifiedToast(en, 2, true) === "Published and verified with Bifrost · 2 differences." &&
    verifiedToast(fr, 0) === "Vérifiée avec Bifrost." &&
    verifiedToast(fr, 1) === "Vérifiée avec Bifrost · 1 écart." &&
    verifiedToast(fr, 2, true) === "Publié et vérifié avec Bifrost · 2 écarts.",
  `the verified toasts count the differences, got ${verifiedToast(en, 1)} / ${verifiedToast(fr, 2, true)}`,
);
// One sentence for a check that gave no answer.
must(
  checkFailed(en) === "Could not check with Bifrost." && checkFailed(fr) === "Vérification avec Bifrost impossible.",
  "one sentence for a check that could not be made",
);
// The kept-provider sentence the key page and the editor share.
must(
  keptNote(["deepseek"], en, ":") ===
    "Kept in Bifrost: DeepSeek. Registry does not change these permissions; Edit selection counts only the models you choose there." &&
    keptNote(["deepseek", "mistral"], fr, " :").startsWith(
      "Conservé dans Bifrost : DeepSeek, Mistral. Registry ne modifie pas",
    ),
  "the kept note names the providers in both languages",
);
must(ledger.shared === 1, `one model is served by two providers, got ${ledger.shared}`);

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
  "Check again",
  "Bifrost allows today",
])
  must(english.includes(line), `English ledger must read "${line}", got ${english}`);
for (const jargon of ["Readback", "Read again", "chosen in Registry", "IDs ·", "call 5", "not checked yet"])
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
  "Vérifier à nouveau",
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

// Two different cards can share a display name (the live Hermes "DeepSeek V4.1 Flash" twice): their common IDs, in
// Basic too, tell the rows apart; a row with a unique name stays unchanged.
const rowIds = (html: string) =>
  [...html.matchAll(/<span class="ml-2[^"]*font-mono[^"]*">([^<]*)<\/span>/g)].map(match => match[1]);
const twins = [
  card("deepseek-v4.1-flash", "DeepSeek V4.1 Flash", [access("opencode-go", "deepseek-v4.1-flash")]),
  card("deepseek-v4.1-flash-direct", "DeepSeek V4.1 Flash", [access("deepseek", "deepseek-v4.1-flash")]),
  card("deepseek-v4-pro", "DeepSeek V4 Pro", [access("opencode-go", "deepseek-v4-pro")]),
];
const twinKey: Key = {
  ...hermes,
  policy: {
    groups: [],
    added: twins.map(model => model.id),
    excluded: [],
    naming: "provider/model",
    keptNative: [],
  },
  permissions: undefined,
  publication: undefined,
};
const twinHtml = wrap(
  "en",
  <KeySummary
    virtualKey={twinKey}
    models={twins}
    groups={fixture.groups}
    busy={false}
    snapshotMode={false}
    onReread={() => {}}
  />,
);
must(
  JSON.stringify(rowIds(twinHtml)) === JSON.stringify(["deepseek-v4.1-flash", "deepseek-v4.1-flash-direct"]) &&
    text(twinHtml).includes("This key can call 3 models") &&
    text(twinHtml).includes("DeepSeek V4 Pro"),
  `same-named rows show their IDs and the unique-name row does not, got ${JSON.stringify(rowIds(twinHtml))}`,
);
must(
  rowIds(
    wrap(
      "en",
      <KeySummary
        virtualKey={hermes}
        models={hermesModels}
        groups={fixture.groups}
        busy={false}
        snapshotMode={false}
        onReread={() => {}}
      />,
    ),
  ).length === 0,
  "rows with unique names stay without an ID",
);

// "Bifrost allows today · 2 providers · 5 models" differs from the total above (3): one muted sentence says why, and
// only when the numbers differ.
const perProvider = "Counted per provider; a model served by several providers counts once above.";
must(
  english.includes(perProvider) && french.includes("Compté par fournisseur ; un modèle servi par plusieurs"),
  "the provider count (5) differs from the total (3): the page explains it in both languages",
);
const agreeing = summary(
  {
    ...hermes,
    policy: { ...hermes.policy, keptNative: [] },
    permissions: {
      allProviders: false,
      providers: [{ provider: "opencode-go", allModels: false, models: ["deepseek-v4-pro", "deepseek-v4.1-flash"] }],
    },
  },
  "en",
  hermesModels,
);
must(
  agreeing.includes("This key can call 2 models") &&
    agreeing.includes("1 provider · 2 models") &&
    !agreeing.includes("Counted per provider"),
  `no explanation when the counts agree, got ${agreeing}`,
);
must(
  !openText.includes("Counted per provider") &&
    !summary({ ...hermes, permissions: undefined }).includes("Counted per provider"),
  "no explanation when Bifrost lists no per-provider count",
);
// The count differs from the total (3 against 2) only because Bifrost allows a kept model it does not list: the
// flagged row explains itself, and no sentence about models served by several providers is added.
const flaggedOnly = summary(
  {
    ...hermes,
    permissions: {
      allProviders: false,
      providers: [
        { provider: "opencode-go", allModels: false, models: ["deepseek-v4-pro", "deepseek-v4.1-flash"] },
        { provider: "deepseek", allModels: false, models: ["deepseek-v4.1-flash"] },
      ],
    },
  },
  "en",
  hermesModels,
);
must(
  flaggedOnly.includes("This key can call 2 models") &&
    flaggedOnly.includes("DeepSeek: Bifrost does not list this one") &&
    flaggedOnly.includes("2 providers · 3 models") &&
    !flaggedOnly.includes("Counted per provider"),
  `a flagged row is not explained by the provider count, got ${flaggedOnly}`,
);
// Several providers serve one model and nothing is flagged: the sentence stays.
const sharedOnly = summary(
  {
    ...hermes,
    permissions: {
      allProviders: false,
      providers: [
        { provider: "opencode-go", allModels: false, models: ["deepseek-v4-pro", "deepseek-v4.1-flash"] },
        { provider: "deepseek", allModels: false, models: ["deepseek-flash", "deepseek-v4-pro"] },
      ],
    },
    policy: { ...hermes.policy, accessSelection: undefined },
  },
  "en",
  hermesModels,
);
must(
  sharedOnly.includes("4 models") &&
    !sharedOnly.includes("Bifrost does not list this one") &&
    sharedOnly.includes("Counted per provider"),
  `a shared model explains the provider count, got ${sharedOnly}`,
);

// The button names the first check until Bifrost has listed IDs for the key (the body then stops saying it was
// not checked), then checks again; an edit that stales the check keeps the IDs last read.
const buttonLabel = (html: string) => html.match(/<button[^>]*>(?:<svg.*?<\/svg>)?([^<]*)<\/button>/)?.[1];
const label = (virtualKey: Key, language: "en" | "fr" = "en") =>
  buttonLabel(
    wrap(
      language,
      <KeySummary
        virtualKey={virtualKey}
        models={hermesModels}
        groups={fixture.groups}
        busy={false}
        snapshotMode={false}
        onReread={() => {}}
      />,
    ),
  );
const neverRead: Key = { ...hermes, observed: null, publication: undefined };
const staleAfterEdit: Key = {
  ...hermes,
  observed: hermes.publication!.actual,
  publication: { ...hermes.publication!, state: "not_verified", checkedAt: "" },
};
// A verified key can list no ID (nothing published, or a Bifrost that lists none): it was still read.
const verifiedNoIds: Key = { ...hermes, observed: null, publication: { ...hermes.publication!, actual: [] } };
must(
  label(neverRead) === "Check with Bifrost" &&
    label(neverRead, "fr") === "Vérifier avec Bifrost" &&
    label(hermes) === "Check again" &&
    label(hermes, "fr") === "Vérifier à nouveau" &&
    label(staleAfterEdit) === "Check again" &&
    label(verifiedNoIds) === "Check again",
  `the first check is named until the key was read once, got ${label(neverRead)} / ${label(hermes)} / ${label(staleAfterEdit)} / ${label(verifiedNoIds)}`,
);
// The one helper the key page and the editor share, on the four states of a key.
const attempted: Key = {
  ...neverRead,
  publication: { ...hermes.publication!, state: "not_verified", actual: null, error: "Native key read failed" },
};
const noTime: Key = { ...neverRead, publication: { ...attempted.publication!, checkedAt: "" } };
const listed = hermes.publication!.actual!;
must(
  checkLabel(neverRead, [], en) === "Check with Bifrost" &&
    checkLabel(noTime, [], en) === "Check with Bifrost" &&
    checkLabel(hermes, listed, en) === "Check again" &&
    checkLabel(verifiedNoIds, [], en) === "Check again" &&
    checkLabel(staleAfterEdit, listed, en) === "Check again" &&
    checkLabel(attempted, [], en) === "Check again" &&
    checkLabel(neverRead, [], fr) === "Vérifier avec Bifrost" &&
    checkLabel(verifiedNoIds, [], fr) === "Vérifier à nouveau",
  "never read, read with IDs, verified with no ID, edited after a read and a failed attempt",
);

// Critique round 5: a key Bifrost has not been asked about is provisional. The headline says so and the check sits
// beside it, outside the closed fold; once checked, the headline is plain and the button moves into the fold.
const buttons = (html: string) => (html.match(/<button/g) ?? []).length;
const page = (virtualKey: Key, language: "en" | "fr" = "en") =>
  wrap(
    language,
    <KeySummary
      virtualKey={virtualKey}
      models={hermesModels}
      groups={fixture.groups}
      busy={false}
      snapshotMode={false}
      onReread={() => {}}
    />,
  );
const unchecked = page(neverRead);
const headingOf = (html: string) => text(html.match(/<h2[^>]*>[\s\S]*?<\/h2>/)?.[0] ?? "");
must(
  headingOf(unchecked).startsWith("This key can call 3 models · not checked yet") &&
    headingOf(page(neverRead, "fr")) === "Cette clé peut appeler 3 modèles · pas encore vérifiée",
  `an unchecked headline is provisional, got ${headingOf(unchecked)}`,
);
// Polish: the headline already says "not checked yet", so the closed fold only names itself; a checked key's fold
// keeps its verdict, and so does a key that can call nothing (no headline claim to repeat).
const foldOf = (html: string) => text(html.match(/<summary[^>]*>[\s\S]*?<\/summary>/)?.[0] ?? "");
must(
  foldOf(unchecked) === "Technical check" && foldOf(page(neverRead, "fr")) === "Vérification technique",
  `an unchecked key's fold does not repeat the verdict, got ${foldOf(unchecked)}`,
);
must(
  foldOf(page(hermes)).startsWith("Technical check · Verified") &&
    foldOf(page({ ...neverRead, policy: { ...neverRead.policy, added: [], groups: [], keptNative: [] } }, "en")) ===
      "Technical check · Not checked yet",
  "a checked key and a key with no model keep the verdict in the fold",
);
must(
  unchecked.indexOf("Check with Bifrost") < unchecked.indexOf("<details") && buttons(unchecked) === 1,
  "the first check is beside the headline, not only inside the fold, and only once",
);
must(
  headingOf(page(hermes)) === "This key can call 3 models" &&
    headingOf(page({ ...hermes, publication: { ...hermes.publication!, state: "drift" } })) ===
      "This key can call 3 models" &&
    page(hermes).indexOf("Check again") > page(hermes).indexOf("<details"),
  "a checked key has a plain headline and checks again inside the fold",
);
must(
  headingOf(
    wrap(
      "en",
      <KeySummary
        virtualKey={neverRead}
        models={hermesModels}
        groups={fixture.groups}
        busy={false}
        snapshotMode
        onReread={() => {}}
      />,
    ),
  ) === "This key can call 3 models",
  "a local copy cannot be checked, so its headline is not provisional",
);
must(text(unchecked).includes("Not checked with Bifrost yet."), "an unchecked key says so in the fold too");

must(
  headingOf(page({ ...neverRead, policy: { groups: [], added: [], excluded: [], naming: "model" } })) ===
    "This key cannot call any model yet",
  "a key with no model claims no list that would be provisional",
);

const empty = summary({ ...hermes, policy: { groups: [], added: [], excluded: [], naming: "model" } });
must(empty.includes("No model selected yet"), `an empty key says so, got ${empty}`);

// Final critique: "Verified · 1 difference" explains itself (ADR 0001, #99), from the helper that counts the difference.
const sentence = {
  en: [
    "Bifrost confirmed this key. 1 permission kept in Bifrost is not listed by Bifrost.",
    "Bifrost confirmed this key. 2 permissions kept in Bifrost are not listed by Bifrost.",
  ],
  fr: [
    "Bifrost a confirmé cette clé. 1 permission conservée dans Bifrost n’est pas listée par Bifrost.",
    "Bifrost a confirmé cette clé. 2 permissions conservées dans Bifrost ne sont pas listées par Bifrost.",
  ],
};
must(
  differenceNote(1, en) === sentence.en[0] &&
    differenceNote(2, en) === sentence.en[1] &&
    differenceNote(1, fr) === sentence.fr[0] &&
    differenceNote(2, fr) === sentence.fr[1] &&
    differenceNote(0, en) === "" &&
    differenceNote(0, fr) === "",
  "the explanation counts the permissions in both languages and is empty without a difference",
);
// The note comes with the count, whatever the state or the number: it is written exactly when checkState counts differences.
for (const state of ["verified", "drift", "not_verified"] as const)
  for (const count of [0, 1, 3]) {
    const key: Key = { ...hermes, publication: { ...hermes.publication!, state } };
    must(
      (checkDifferenceNote(key, en, count) !== "") ===
        checkState(key, en, count).includes(differenceCount(count, en)) &&
        (checkDifferenceNote(key, fr, count) !== "") ===
          checkState(key, fr, count).includes(differenceCount(count, fr)),
      `${state} with ${count}: the note and the counted differences go together`,
    );
  }
must(checkDifferenceNote({ ...hermes, publication: undefined }, en, 1) === "", "no verdict, no note");
// On the key page the fold's summary carries it as a tooltip and as a hidden sentence it is described by.
const page_ = (virtualKey: Key, language: "en" | "fr" = "en") =>
  wrap(
    language,
    <KeySummary
      virtualKey={virtualKey}
      models={hermesModels}
      groups={fixture.groups}
      busy={false}
      snapshotMode={false}
      onReread={() => {}}
    />,
  );
for (const language of ["en", "fr"] as const) {
  const html = page_(hermes, language);
  const describedby = html.match(/<summary[^>]*aria-describedby="([^"]+)"/)?.[1];
  must(
    !!describedby &&
      html.includes(`<span id="${describedby}" class="sr-only">${sentence[language][0]}</span>`) &&
      html.includes(`<summary class="cursor-pointer font-medium" title="${sentence[language][0]}"`),
    `${language}: the summary reads "Verified … 1 difference" with its explanation, got ${html}`,
  );
}
const noExplanation: [string, Key][] = [
  [
    "a verified key without difference",
    { ...hermes, policy: { ...hermes.policy, keptNative: [] }, permissions: undefined },
  ],
  ["a key whose check found differences", { ...hermes, publication: { ...hermes.publication!, state: "drift" } }],
  ["a key not checked yet", { ...hermes, publication: undefined }],
];
for (const [what, virtualKey] of noExplanation) {
  const html = page_(virtualKey);
  must(
    !html.includes("Bifrost confirmed this key") && !html.includes("aria-describedby"),
    `${what}: no explanation, got ${text(html)}`,
  );
}

console.log("Key summary checks passed");
