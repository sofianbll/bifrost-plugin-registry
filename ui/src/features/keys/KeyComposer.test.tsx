import { renderToStaticMarkup } from "react-dom/server";
import { defaultViewOptions } from "../../components/registry/ViewOptions";
import { fixture } from "../../dev/fixtures/registry";
import type { Key, Model } from "../../domain/registry";
import { LanguageContext } from "../../lib/locale";
import KeyComposer, { PublicationCard } from "./KeyComposer";
import { KeySummary } from "./KeySummary";

// ADR 0001 in the editor: the publication card reads the same check as the key page ("Verified · 1 difference",
// never a plain "Verified"), the button asks the same question, and "N models selected" says why it can sit below
// the page total when the key keeps a provider in Bifrost.
const text = (html: string) => html.split(/<[^>]*>/).join("");
const must = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const wrap = (language: "en" | "fr", node: React.ReactNode) =>
  renderToStaticMarkup(<LanguageContext.Provider value={language}>{node}</LanguageContext.Provider>);

// The kept-native fixture key (vk-qa-kept): Registry routes one model through Claude; Google stays in Bifrost and
// allows qa-gemini and qa-ghost, but Google does not list qa-ghost, so the check reads "Verified · 1 difference".
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
const models = [
  card("qa-haiku", "QA Haiku", [access("Claude", "qa-haiku")]),
  card("qa-gemini", "QA Gemini", [access("Google", "qa-gemini")]),
];
const kept: Key = {
  ...fixture.keys[0],
  id: "vk-qa-kept",
  name: "QA Kept Key",
  managed: true,
  policy: { groups: [], added: ["qa-haiku"], excluded: [], naming: "provider/model", keptNative: ["Google"] },
  permissions: {
    allProviders: false,
    providers: [
      { provider: "Claude", allModels: false, models: ["qa-haiku"] },
      { provider: "Google", allModels: false, models: ["qa-gemini", "qa-ghost"] },
    ],
  },
  observed: ["Claude/qa-haiku", "Google/qa-gemini"],
  publication: {
    state: "verified",
    revision: "abcdef0123456789",
    checkedAt: "2026-10-12T12:30:45Z",
    expected: [],
    actual: ["Claude/qa-haiku", "Google/qa-gemini"],
    missing: [],
    unexpected: [],
  },
};
const plain: Key = { ...kept, policy: { ...kept.policy, keptNative: [] }, permissions: undefined };

const publicationText = (virtualKey: Key, differences: number, language: "en" | "fr" = "en") =>
  text(
    wrap(
      language,
      <PublicationCard
        virtualKey={virtualKey}
        differences={differences}
        savedIds={[]}
        busy={false}
        snapshotMode={false}
        onReread={() => {}}
      />,
    ),
  );
const editor = (virtualKey: Key, expert: boolean, language: "en" | "fr" = "en") =>
  text(
    wrap(
      language,
      <KeyComposer
        virtualKey={virtualKey}
        draft={virtualKey.policy}
        onDraftChange={() => {}}
        models={models}
        groups={fixture.groups}
        preferences={defaultViewOptions}
        busy={false}
        snapshotMode={false}
        expert={expert}
        onPublish={() => {}}
        onDiscard={() => {}}
        onReread={() => {}}
      />,
    ),
  );

// The publication card carries the count of differences it is given, in both languages.
must(
  publicationText(kept, 1).includes("Verified · 1 difference") &&
    publicationText(kept, 1, "fr").includes("Vérifiée · 1 écart"),
  `the card counts the difference, got ${publicationText(kept, 1)}`,
);
must(
  /Verified(?! ·)/.test(publicationText(kept, 0)) && !publicationText(kept, 0).includes("difference"),
  "no difference, a plain Verified",
);

// The card explains the difference, as the key page and the cards do (tooltip and hidden sentence); a plain Verified does not.
for (const [language, sentence] of [
  ["en", "Bifrost confirmed this key. 1 permission kept in Bifrost is not listed by Bifrost."],
  ["fr", "Bifrost a confirmé cette clé. 1 permission conservée dans Bifrost n’est pas listée par Bifrost."],
] as const) {
  const html = wrap(
    language,
    <PublicationCard
      virtualKey={kept}
      differences={1}
      savedIds={[]}
      busy={false}
      snapshotMode={false}
      onReread={() => {}}
    />,
  );
  const id = html.match(/<span id="([^"]+)" class="sr-only">/)?.[1];
  must(
    !!id &&
      html.includes(`title="${sentence}"`) &&
      html.includes(`aria-describedby="${id}"`) &&
      text(html).includes(sentence),
    `${language}: the card explains the difference, got ${html}`,
  );
  must(
    !publicationText(kept, 0, language).includes(sentence.slice(0, 20)),
    `${language}: no difference, no explanation`,
  );
}

// The editor computes that count the way the key page does, from the same ledger: Google/qa-ghost is not listed.
const page = text(
  wrap(
    "en",
    <KeySummary
      virtualKey={kept}
      models={models}
      groups={fixture.groups}
      busy={false}
      snapshotMode={false}
      onReread={() => {}}
    />,
  ),
);
must(page.includes("Verified Oct 12, 2026 · 1 difference"), `the key page reads one difference, got ${page}`);
for (const expert of [true, false]) {
  // Basic shows the card on its Review step only (the editor opens on Models); Expert shows it below the list.
  const open = editor(kept, expert);
  must(
    !expert || (open.includes("Verified · 1 difference") && !/Verified(?! ·)/.test(open)),
    `the Expert editor reads the key page's check, got ${open}`,
  );
}

// "N models selected" says why it differs from the page total, once, only when a provider is kept in Bifrost.
const note =
  "Kept in Bifrost: Google. Registry does not change these permissions; Edit selection counts only the models you choose there.";
for (const expert of [true, false]) {
  must(
    editor(kept, expert).includes(note) && editor(kept, expert).split(note).length === 2,
    `the ${expert ? "Expert" : "Basic"} editor explains the count once`,
  );
  must(!editor(plain, expert).includes("Registry does not change these permissions"), "no kept provider, no note");
  must(
    editor(kept, expert, "fr").includes("Conservé dans Bifrost : Google. Registry ne modifie pas ces permissions"),
    `the ${expert ? "Expert" : "Basic"} editor explains the count in French`,
  );
}

// The button asks the first question until Bifrost was read, even for a verified key that lists no ID.
const button = (html: string) => html.match(/Check (?:again|with Bifrost)/)?.[0];
const verifiedNoIds: Key = {
  ...kept,
  observed: null,
  publication: { ...kept.publication!, actual: [] },
};
const neverRead: Key = { ...kept, observed: null, publication: undefined };
must(
  button(publicationText(kept, 1)) === "Check again" &&
    button(publicationText(verifiedNoIds, 0)) === "Check again" &&
    button(publicationText(neverRead, 0)) === "Check with Bifrost",
  "the editor's check button reads like the key page's",
);

console.log("Key composer checks passed");
