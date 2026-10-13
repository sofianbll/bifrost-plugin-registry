import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import { cardFormat, defaultViewOptions, gridColumns } from "../../components/registry/ViewOptions";
import { fixture } from "../../dev/fixtures/registry";
import type { Key } from "../../domain/registry";
import { KeyLibrary } from "./KeyLibrary";

const native = {
  ...fixture.keys[0],
  managed: false,
  policy: { ...fixture.keys[0].policy, groups: [], added: [], excluded: [] },
};
// #69: an unmanaged key says what Bifrost allows today, or that its permissions were not read.
const summaries: [Key["permissions"], string][] = [
  [undefined, "Not read yet"],
  [{ allProviders: true, providers: [] }, "All providers"],
  [{ allProviders: false, providers: [] }, "No provider"],
  [
    {
      allProviders: false,
      providers: [{ provider: "Codex", allModels: false, models: ["qa-codex", "qa-codex-mini"] }],
    },
    "1 provider · 2 models",
  ],
  [
    {
      allProviders: false,
      providers: [
        { provider: "Claude", allModels: true, models: [] },
        { provider: "Codex", allModels: false, models: ["qa-codex"] },
      ],
    },
    "2 providers · 1 model · all models of Claude",
  ],
  // An empty native list means all or none depending on the Bifrost version: never "0 models".
  [
    { allProviders: false, providers: [{ provider: "Google", allModels: false, models: [], versionDependent: true }] },
    "1 provider · models depend on the Bifrost version for Google",
  ],
];
for (const layout of ["grid", "table"] as const) {
  for (const [permissions, summary] of summaries) {
    const html = renderToStaticMarkup(
      <LanguageContext.Provider value="en">
        <KeyLibrary
          keys={[{ ...native, permissions }]}
          groups={fixture.groups}
          models={fixture.models}
          view={{ ...defaultViewOptions, layout }}
          onViewChange={() => {}}
          onResetView={() => {}}
          busy={false}
          snapshotMode
          onCreate={() => {}}
          onOpen={() => {}}
        />
      </LanguageContext.Provider>,
    );
    if (!html.includes(summary)) throw new Error(`${layout}: native permissions must read "${summary}"`);
    if (html.includes("0 models") || html.includes("No active provider") || html.includes("0 IDs"))
      throw new Error(`${layout}: Registry emptiness must not describe native permissions`);
  }
}
const frenchSummary = renderToStaticMarkup(
  <LanguageContext.Provider value="fr">
    <KeyLibrary
      keys={[{ ...native, permissions: summaries[3][0] }]}
      groups={fixture.groups}
      models={fixture.models}
      view={defaultViewOptions}
      onViewChange={() => {}}
      onResetView={() => {}}
      busy={false}
      snapshotMode
      onCreate={() => {}}
      onOpen={() => {}}
    />
  </LanguageContext.Provider>,
);
if (!frenchSummary.includes("1 fournisseur · 2 modèles"))
  throw new Error("French native permissions summary is missing");
// Spec #85 round 2: a managed card shows the key page's single total (Registry routes plus kept models) and the check.
const render = (
  language: "en" | "fr",
  keys: Key[],
  options: { expert?: boolean; layout?: "grid" | "table"; snapshotMode?: boolean } = {},
) =>
  renderToStaticMarkup(
    <LanguageContext.Provider value={language}>
      <KeyLibrary
        keys={keys}
        groups={fixture.groups}
        models={fixture.models}
        view={{ ...defaultViewOptions, layout: options.layout ?? "grid" }}
        expert={options.expert}
        onViewChange={() => {}}
        onResetView={() => {}}
        busy={false}
        snapshotMode={options.snapshotMode ?? false}
        onCreate={() => {}}
        onOpen={() => {}}
      />
    </LanguageContext.Provider>,
  );
const plain = (html: string) => html.split(/<[^>]*>/).join("");
const keptKey: Key = {
  ...fixture.keys[0],
  managed: true,
  policy: { groups: [], added: ["gpt-5-mini"], excluded: [], naming: "model", keptNative: ["mistral"] },
  permissions: {
    allProviders: false,
    providers: [
      { provider: "mistral", allModels: false, models: ["a", "b", "c"] },
      { provider: "openai", allModels: false, models: ["gpt-5-mini"] },
    ],
  },
  publication: {
    state: "verified",
    revision: "r",
    checkedAt: "2026-10-12T09:30:00Z",
    expected: [],
    actual: ["gpt-5-mini", "mistral/a", "mistral/b", "mistral/c"],
    missing: [],
    unexpected: [],
  },
};
for (const [language, line] of [
  ["en", "4 models · Verified"],
  ["fr", "4 modèles · Vérifiée"],
] as const) {
  const text = plain(render(language, [keptKey]));
  if (!text.includes(line)) throw new Error(`${language}: the key card must read "${line}", got ${text}`);
  for (const jargon of ["chosen in Registry", "choisis dans Registry", "IDs", "Bifrost allows ·", "kept in Bifrost ·"])
    if (text.includes(jargon)) throw new Error(`${language}: one total, no "${jargon}" on the card`);
}
// #99: a kept model Bifrost does not list is not counted, and the check says there is a difference.
const unlisted: Key = {
  ...keptKey,
  publication: { ...keptKey.publication!, actual: ["gpt-5-mini", "mistral/a", "mistral/b"] },
};
for (const [language, line] of [
  ["en", "3 models · Verified · 1 difference"],
  ["fr", "3 modèles · Vérifiée · 1 écart"],
] as const) {
  const text = plain(render(language, [unlisted]));
  if (!text.includes(line)) throw new Error(`${language}: the key card must read "${line}", got ${text}`);
}
const tableText = (language: "en" | "fr") => plain(render(language, [keptKey], { layout: "table" }));
if (
  !tableText("en").includes("4 models") ||
  !tableText("en").includes("Oct 12, 2026") ||
  !tableText("fr").includes("12/10/2026")
)
  throw new Error(`The table shows the total and a dated check in the active language: ${tableText("en")}`);
// No "—" placeholder for a key without a client: the line is hidden; the client shows when there is one.
const noClient = plain(render("en", [{ ...keptKey, client: "" }]));
if (noClient.includes("—")) throw new Error(`A key without a client shows no placeholder: ${noClient}`);
if (!plain(render("en", [{ ...keptKey, client: "Synthetic Hermes client" }])).includes("Synthetic Hermes client"))
  throw new Error("The client line shows");
// Near-duplicate names are flagged.
const twins = plain(
  render("en", [
    { ...keptKey, id: "p1", name: "Elson - Poc" },
    { ...keptKey, id: "p2", name: "Elson - POC" },
    { ...keptKey, id: "p3", name: "Other" },
  ]),
);
if (twins.split("Another key has almost the same name").length - 1 !== 2)
  throw new Error(`Both near-duplicate keys carry the hint, got ${twins}`);
if (
  !plain(
    render("fr", [
      { ...keptKey, id: "p1", name: "Elson - Poc" },
      { ...keptKey, id: "p2", name: "Elson - POC" },
    ]),
  ).includes("Une autre clé porte presque le même nom")
)
  throw new Error("French duplicate hint");
// Shelves: managed keys first, then "To adopt", then "Empty", collapsed by default.
const shelved = render("en", [
  { ...native, id: "e", name: "Empty Key", readiness: { state: "empty", blockers: [] } },
  { ...native, id: "r", name: "Ready Key", readiness: { state: "ready", blockers: [] } },
  { ...keptKey, id: "m", name: "Managed Key" },
]);
const order = ["Managed by Registry", "To adopt", "Empty"].map(label => plain(shelved).indexOf(label));
if (order.some(index => index < 0) || order[0] > order[1] || order[1] > order[2])
  throw new Error(`Shelves read managed, to adopt, empty: ${plain(shelved)}`);
if (
  plain(shelved).includes("Empty Key") ||
  !plain(shelved).includes("Ready Key") ||
  !shelved.includes('aria-expanded="false"')
)
  throw new Error("The Empty shelf starts collapsed, To adopt open");
if (!plain(shelved).includes("3 of 3 keys shown, 1 in a collapsed shelf"))
  throw new Error(`The count says what a shelf hides: ${plain(shelved)}`);
// Basic folds the filters into "Filters (n)"; Expert keeps them inline.
if (
  render("en", [native]).includes('aria-label="Filter by readiness"') ||
  !plain(render("en", [native])).includes("Filters")
)
  throw new Error("Basic folds the key filters");
if (!render("en", [native], { expert: true }).includes('aria-label="Filter by readiness"'))
  throw new Error("Expert keeps the key filters inline");
// #87: every unmanaged key says ready, blocked (and why) or empty, in grid and table, in both languages.
const verdicts: [string, Key, string, string, string][] = [
  [
    "ready",
    { ...native, name: "Ready Key", readiness: { state: "ready", blockers: [] } },
    "Ready to adopt",
    "Prête à adopter",
    "",
  ],
  [
    "blocked",
    {
      ...native,
      name: "Blocked Key",
      readiness: {
        state: "blocked",
        blockers: [{ provider: "mistral", kind: "undiscovered", count: 3, models: ["a", "b", "c"] }],
      },
    },
    "Blocked",
    "Bloquée",
    "Mistral: Bifrost doesn’t show 3 models",
  ],
  ["empty", { ...native, name: "Empty Key", readiness: { state: "empty", blockers: [] } }, "Empty", "Vide", ""],
  ["not read", { ...native, name: "Unread Key" }, "Adoption needed", "À adopter", ""],
];
for (const [language, index] of [
  ["en", 2],
  ["fr", 3],
] as const) {
  for (const layout of ["grid", "table"] as const) {
    for (const verdict of verdicts) {
      const [, key, , , reason] = verdict;
      const html = renderToStaticMarkup(
        <LanguageContext.Provider value={language}>
          <KeyLibrary
            keys={[key]}
            groups={fixture.groups}
            models={fixture.models}
            view={{ ...defaultViewOptions, layout }}
            onViewChange={() => {}}
            onResetView={() => {}}
            busy={false}
            snapshotMode
            onCreate={() => {}}
            onOpen={() => {}}
          />
        </LanguageContext.Provider>,
      );
      const text = html.split(/<[^>]*>/).join("");
      if (!text.includes(verdict[index]))
        throw new Error(`${language} ${layout}: ${verdict[0]} key must read "${verdict[index]}"`);
      if (language === "en" && reason && !text.includes(reason))
        throw new Error(`${layout}: a blocked key must say why ("${reason}")`);
      if (text.includes("adoption needed") && verdict[0] !== "not read")
        throw new Error(`${language} ${layout}: ${verdict[0]} key still shows the uniform adoption badge`);
    }
  }
}
// The Keys page filters by readiness.
const filterName = (language: "en" | "fr") =>
  renderToStaticMarkup(
    <LanguageContext.Provider value={language}>
      <KeyLibrary
        expert
        keys={[native]}
        groups={fixture.groups}
        models={fixture.models}
        view={defaultViewOptions}
        onViewChange={() => {}}
        onResetView={() => {}}
        busy={false}
        snapshotMode
        onCreate={() => {}}
        onOpen={() => {}}
      />
    </LanguageContext.Provider>,
  );
if (
  !filterName("en").includes('aria-label="Filter by readiness"') ||
  !filterName("fr").includes('aria-label="Filtrer par état d’adoption"')
)
  throw new Error("The Keys page must offer a readiness filter in both languages");
for (const shape of ["rectangle", "square"] as const) {
  const view = {
    ...defaultViewOptions,
    layout: "grid" as const,
    shape: shape as "rectangle" | "square",
    size: "medium" as const,
  };
  const html = renderToStaticMarkup(
    <LanguageContext.Provider value="en">
      <KeyLibrary
        keys={[native]}
        groups={fixture.groups}
        models={fixture.models}
        view={view}
        onViewChange={() => {}}
        onResetView={() => {}}
        busy={false}
        snapshotMode
        onCreate={() => {}}
        onOpen={() => {}}
      />
    </LanguageContext.Provider>,
  );
  const expectedFormat = cardFormat(view);
  if (!html.includes(`data-format="${expectedFormat}"`))
    throw new Error(`shape ${shape}: expected format ${expectedFormat}`);
  if (!html.includes(`xl:grid-cols-${gridColumns(view.size)}`))
    throw new Error(`shape ${shape}: expected ${gridColumns(view.size)} columns`);
}

// In Expert, the keys list keeps the density control in grid and hides it in table, like the catalog and groups.
for (const layout of ["grid", "table"] as const) {
  const html = renderToStaticMarkup(
    <LanguageContext.Provider value="fr">
      <KeyLibrary
        expert
        keys={[native]}
        groups={fixture.groups}
        models={fixture.models}
        view={{ ...defaultViewOptions, layout }}
        onViewChange={() => {}}
        onResetView={() => {}}
        busy={false}
        snapshotMode
        onCreate={() => {}}
        onOpen={() => {}}
      />
    </LanguageContext.Provider>,
  );
  const density = html.includes('aria-label="Densité de la grille"');
  if (layout === "grid" && !density) throw new Error("grid layout must keep the density control");
  if (layout === "table" && density) throw new Error("table layout must hide the density control");
  if (!html.includes('aria-label="Grille"') || !html.includes('aria-label="Tableau"'))
    throw new Error(`${layout}: icon-only view toggles must keep explicit names`);
}

// #53: a key whose model awaits an access choice says so in grid and table, in both languages.
const pending = {
  ...fixture.keys[0],
  managed: true,
  pendingAccessSelection: { "deepseek-v4.1-flash": ["openrouter/deepseek-v4.1-flash", "deepseek/deepseek-v4.1-flash"] },
};
for (const [language, label] of [
  ["en", "Access choice needed"],
  ["fr", "Choix d’accès requis"],
] as const) {
  for (const layout of ["grid", "table"] as const) {
    const html = renderToStaticMarkup(
      <LanguageContext.Provider value={language}>
        <KeyLibrary
          keys={[pending]}
          groups={fixture.groups}
          models={fixture.models}
          view={{ ...defaultViewOptions, layout }}
          onViewChange={() => {}}
          onResetView={() => {}}
          busy={false}
          snapshotMode
          onCreate={() => {}}
          onOpen={() => {}}
        />
      </LanguageContext.Provider>,
    );
    if (!html.includes(label)) throw new Error(`${language} ${layout}: pending access choice must be visible`);
    if (layout === "grid" && !html.includes("deepseek-v4.1-flash"))
      throw new Error(`${language}: the card must name the withheld model`);
  }
}

// Story 39: every key action is named after its key, in grid and table, in both languages.
const named = [
  { ...native, id: "a", name: "Key A" },
  { ...native, id: "b", name: "Key B" },
  { ...fixture.keys[0], id: "c", name: "Key C", managed: true },
  { ...fixture.keys[0], id: "d", name: "Key D", managed: true },
];
for (const language of ["en", "fr"] as const) {
  for (const layout of ["grid", "table"] as const) {
    const html = renderToStaticMarkup(
      <LanguageContext.Provider value={language}>
        <KeyLibrary
          keys={named}
          groups={fixture.groups}
          models={fixture.models}
          view={{ ...defaultViewOptions, layout }}
          onViewChange={() => {}}
          onResetView={() => {}}
          busy={false}
          snapshotMode
          onCreate={() => {}}
          onOpen={() => {}}
        />
      </LanguageContext.Provider>,
    );
    const actions = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)]
      .map(match => match[1].split(/<[^>]*>/).join(""))
      .filter(name => /^(Review|Open|Examiner|Ouvrir)\b/.test(name));
    const expected =
      language === "en"
        ? ["Open · Key C", "Open · Key D", "Review · Key A", "Review · Key B"]
        : ["Ouvrir · Key C", "Ouvrir · Key D", "Examiner · Key A", "Examiner · Key B"];
    if (JSON.stringify(actions) !== JSON.stringify(expected))
      throw new Error(`${language} ${layout}: key actions must name their key, got ${JSON.stringify(actions)}`);
  }
}
