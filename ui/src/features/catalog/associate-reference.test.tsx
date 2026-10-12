import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import type { Model } from "../../domain/registry";
import type { CatalogRecord } from "./catalog-api";
import { associateReference, referenceMatches } from "./AssociateReference";
import { FactsUnknown, InferredMark, factsUnknown, hasReference } from "./card-identity";

const model = (patch: Partial<Model> = {}): Model => ({
  id: "qa-flash",
  name: "qa-flash",
  creator: "Google",
  family: "Unknown",
  inputModalities: [],
  outputModalities: [],
  tasks: [],
  kind: "Unknown",
  summary: "",
  context: "Unknown",
  capabilities: {},
  accesses: [
    {
      provider: "Google",
      id: "Google/qa-flash",
      nativeModel: "qa-flash",
      route: "Direct provider",
      status: "Configured",
      endpoints: ["chat/completions"],
    },
    {
      provider: "Other",
      id: "Other/qa-flash",
      nativeModel: "qa-flash",
      route: "Direct provider",
      status: "Configured",
    },
  ],
  ...patch,
});
const reference = (id: string, name: string, creator: string): CatalogRecord => ({
  id,
  overrides: {},
  fields: {
    name: { value: name, source: "models.dev", updatedAt: null, kind: "declared" },
    creator: { value: creator, source: "models.dev", updatedAt: null, kind: "declared" },
  },
});
const references = [
  reference("openai/gpt-6", "GPT 6", "OpenAI"),
  reference("google/qa-gemini", "QA Gemini", "Google"),
  reference("anthropic/claude-sonnet-5-5", "Claude Sonnet 5.5", "Anthropic"),
  { id: "fixture/nameless", fields: {}, overrides: {} },
];

// Search reads the ID, name and creator; every word must match; results sort by name.
const ids = (query: string) =>
  referenceMatches(references, query)
    .map(row => row.id)
    .join();
if (ids("gemini") !== "google/qa-gemini") throw new Error("name and ID are searched");
if (ids("sonnet 5") !== "anthropic/claude-sonnet-5-5") throw new Error("every word must match, in any order");
if (ids("ANTHROPIC") !== "anthropic/claude-sonnet-5-5") throw new Error("creator is searched, case-insensitively");
if (ids("") !== "anthropic/claude-sonnet-5-5,fixture/nameless,openai/gpt-6,google/qa-gemini")
  throw new Error("an empty query lists everything by name, a nameless reference by ID");
if (ids("nothing like it") !== "") throw new Error("no match, no result");

// Associating links every access of the card, on a copy, and changes nothing else.
const card = model();
const linked = associateReference(card, "google/qa-gemini");
if (
  linked.accesses.some(access => access.referenceId !== "google/qa-gemini") ||
  linked.accesses[0].endpoints?.join() !== "chat/completions" ||
  linked.creator !== "Google" ||
  card.accesses[0].referenceId
)
  throw new Error("association must set referenceId on each access, on a copy");
if (hasReference(card) || !hasReference(linked)) throw new Error("hasReference reads the accesses");

// Facts are unknown without any modality or known capability.
if (!factsUnknown(card) || !factsUnknown(model({ capabilities: { Reasoning: "Unknown" } })))
  throw new Error("an empty card has unknown facts");
if (
  factsUnknown(model({ inputModalities: ["Text"] })) ||
  factsUnknown(model({ capabilities: { Reasoning: "Declared" } }))
)
  throw new Error("a modality or a declared capability is a known fact");

const html = (node: React.ReactNode, language: "en" | "fr" = "en") =>
  renderToStaticMarkup(<LanguageContext.Provider value={language}>{node}</LanguageContext.Provider>);
if (
  !html(<FactsUnknown associate />).includes("Facts unknown — associate a reference") ||
  !html(<FactsUnknown associate />, "fr").includes("Données inconnues — associer une fiche documentaire")
)
  throw new Error("unknown facts say what to do, in both languages");
if (html(<FactsUnknown associate={false} />).includes("associate"))
  throw new Error("a card with a reference is not told to associate one");
if (
  !html(<InferredMark model={{ creatorSource: "inferred" }} />).includes(">inferred<") ||
  !html(<InferredMark model={{ creatorSource: "inferred" }} />, "fr").includes(">déduit<")
)
  throw new Error("an inferred creator is marked");
for (const creatorSource of ["manual", "reference", undefined] as const)
  if (html(<InferredMark model={{ creatorSource }} />)) throw new Error(`${creatorSource} creators carry no mark`);
