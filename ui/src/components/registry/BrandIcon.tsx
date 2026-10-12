import { asset, ProviderIcons, type ProviderIconType } from "@/lib/constants/icons";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { useCreatorName } from "@/lib/locale";
import type { Model } from "../../domain/registry";
import type { ViewOptions } from "./ViewOptions";

// Display names of Bifrost provider types; any other provider (a custom one such as "Claude") keeps its own name.
const providerName: Record<string, string> = {
  anthropic: "Anthropic",
  azure: "Azure",
  bedrock: "AWS Bedrock",
  bedrock_mantle: "Bedrock Mantle",
  cerebras: "Cerebras",
  cohere: "Cohere",
  databricks: "Databricks",
  deepseek: "DeepSeek",
  elevenlabs: "ElevenLabs",
  fireworks: "Fireworks AI",
  gemini: "Gemini",
  "github-copilot": "GitHub Copilot",
  google: "Google AI Studio",
  groq: "Groq",
  huggingface: "Hugging Face",
  mistral: "Mistral",
  moonshot: "Moonshot AI",
  nebius: "Nebius",
  ollama: "Ollama",
  openai: "OpenAI",
  "opencode-go": "OpenCode Go",
  "opencode-zen": "OpenCode Zen",
  openrouter: "OpenRouter",
  parasail: "Parasail",
  perplexity: "Perplexity",
  replicate: "Replicate",
  runware: "Runware",
  runway: "Runway",
  sarvam: "Sarvam AI",
  sgl: "SGLang",
  vertex: "Vertex AI",
  vllm: "vLLM",
  wafer: "Wafer",
  xai: "xAI",
};
export type ProviderAppearance = { icon?: ProviderIconType; image?: string };
const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const marks = new Map<string, ProviderAppearance>([
  ...Object.keys(ProviderIcons).map(icon => [normalize(icon), { icon: icon as ProviderIconType }] as const),
  ["google", { image: asset("google.svg") }],
  ["moonshot", { image: asset("moonshot.svg") }],
  // Names whose mark ships under another key: AWS Bedrock and Amazon, SGLang, Microsoft's Azure.
  ["awsbedrock", { icon: "bedrock" }],
  ["amazon", { icon: "bedrock" }],
  ["sglang", { icon: "sgl" }],
  ["microsoft", { icon: "azure" }],
]);
// The one identity lookup for creators and providers: "Moonshot AI", "moonshotai" and "x-ai" all resolve; a trailing "AI" is optional.
export function markFor(name = ""): ProviderAppearance | undefined {
  const key = normalize(name);
  return marks.get(key) ?? marks.get(key.replace(/ai$/, ""));
}
// A provider's mark: the appearance chosen in Settings, then a custom provider's base type, then its own name.
export const providerMark = (
  id: string,
  custom?: ProviderAppearance,
  baseType?: string,
): ProviderAppearance | undefined =>
  (custom?.icon || custom?.image ? custom : undefined) ?? markFor(baseType) ?? markFor(id);
const storageKey = "bifrost-registry.provider-appearance.v1";
const listeners = new Set<() => void>();
const emptyAppearance: Record<string, ProviderAppearance> = {};
function readAppearance(): Record<string, ProviderAppearance> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([provider, value]) => {
        if (!value || typeof value !== "object") return [];
        const { icon, image } = value as ProviderAppearance;
        return [
          [
            provider,
            {
              ...(typeof icon === "string" && icon in ProviderIcons ? { icon } : {}),
              ...(typeof image === "string" &&
              /^data:image\/(png|jpeg|webp);base64,[\w+/=]+$/.test(image) &&
              image.length <= 350_000
                ? { image }
                : {}),
            },
          ],
        ];
      }),
    );
  } catch {
    return {};
  }
}
let appearance = typeof localStorage === "undefined" ? emptyAppearance : readAppearance();
const notifyAppearance = () => listeners.forEach(listener => listener());
const subscribeAppearance = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function useProviderAppearance(provider: string) {
  const current = useSyncExternalStore(
    subscribeAppearance,
    () => appearance[provider],
    () => undefined,
  );
  return current;
}
export function saveProviderAppearance(provider: string, value?: ProviderAppearance) {
  const next = { ...appearance };
  if (value) next[provider] = value;
  else delete next[provider];
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    throw new Error("provider-appearance-storage");
  }
  appearance = next;
  notifyAppearance();
}
if (typeof window !== "undefined")
  window.addEventListener("storage", event => {
    if (event.key === storageKey) {
      appearance = readAppearance();
      notifyAppearance();
    }
  });
// Base provider types of custom providers, from the workspace (Claude → anthropic).
let baseTypes: Record<string, string> = {};
export function setProviderBaseTypes(providers: { id: string; baseProviderType?: string }[] = []) {
  baseTypes = Object.fromEntries(
    providers.flatMap(provider => (provider.baseProviderType ? [[provider.id, provider.baseProviderType]] : [])),
  );
  notifyAppearance();
}
// Aggregators resell other creators' models; To add collapses them into shelves.
export const isAggregator = (id: string) =>
  [id, baseTypes[id]].some(name => name === "openrouter" || name === "vertex");
// Any other ID reads the way the server names a creator without a Models.dev record (modelsDevCreator):
// words split on "-" and "_", each capitalised ("typesafe" → "Typesafe", "Claude" stays "Claude").
export const displayProvider = (id: string) =>
  Object.hasOwn(providerName, id)
    ? providerName[id]
    : id
        .split(/[-_]/)
        .filter(Boolean)
        .map(word => word[0].toUpperCase() + word.slice(1))
        .join(" ");
// Initials of a name without a mark: its first two letters, else the first with the last, then with each other letter.
const initialCandidates = (label: string) => {
  const [first = "?", ...rest] = [...label.replace(/[^\p{L}\p{N}]/gu, "").toUpperCase()];
  return [...new Set([first + (rest[0] ?? ""), first + (rest.at(-1) ?? ""), ...rest.map(letter => first + letter)])];
};
// Names take their turn in alphabetical order and keep the first candidate no earlier name holds, so
// "Meta" and "Meituan" never both read "ME" and the result does not depend on render order.
export function distinctInitials(labels: Iterable<string>) {
  const taken = new Set<string>();
  return new Map(
    [...new Set(labels)].sort().map(label => {
      const options = initialCandidates(label);
      const pick = options.find(option => !taken.has(option)) ?? options[0];
      taken.add(pick);
      return [label, pick] as const;
    }),
  );
}
// The creator and provider names shown now (App sets them), so their initials stay distinct.
let initials = new Map<string, string>();
export function setMarkLabels(labels: string[]) {
  const next = distinctInitials(labels.filter(label => label && !markFor(label)));
  if (JSON.stringify([...next]) === JSON.stringify([...initials])) return;
  initials = next;
  notifyAppearance();
}
// Black marks turn light on the dark theme.
const invertInDark = (mark: ProviderAppearance) =>
  mark.icon === "anthropic" || mark.icon === "openai" || mark.icon === "ollama" || mark.image === asset("moonshot.svg");
function Logo({
  mark = {},
  label,
  fallback,
  compact = false,
}: {
  mark?: ProviderAppearance;
  label: string;
  fallback?: string;
  compact?: boolean;
}) {
  const Icon =
    mark.icon &&
    (ProviderIcons[mark.icon] as
      ((props: { size: number; className?: string; theme?: string }) => React.ReactNode) | undefined);
  const invert = invertInDark(mark) && "dark:invert";
  const distinct = useSyncExternalStore(
    subscribeAppearance,
    () => initials,
    () => initials,
  );
  return (
    <span
      role="img"
      title={label}
      aria-label={label}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-sm text-xs font-semibold",
        compact ? "size-6" : "size-8 border bg-background",
      )}
    >
      {mark.image ? (
        <img src={mark.image} alt="" className={cn("size-5 object-contain", invert)} />
      ) : Icon ? (
        <span aria-hidden="true">
          <Icon size={20} theme="light" className={cn("size-5 object-contain", invert)} />
        </span>
      ) : (
        (fallback ?? distinct.get(label) ?? initialCandidates(label)[0])
      )}
    </span>
  );
}
export function ProviderMark({ id }: { id: string }) {
  const custom = useProviderAppearance(id);
  const baseType = useSyncExternalStore(
    subscribeAppearance,
    () => baseTypes[id],
    () => undefined,
  );
  return <Logo compact mark={providerMark(id, custom, baseType)} label={displayProvider(id)} />;
}
export function BrandIcon({ model, mode, className }: { model: Model; mode: ViewOptions["logo"]; className?: string }) {
  const creatorName = useCreatorName();
  const creator = creatorName(model.creator);
  return (
    <span className={cn("flex shrink-0 items-center", className)}>
      {mode === "creator" ? (
        <Logo mark={markFor(creator)} label={creator} fallback={creator === creatorName() ? "?" : undefined} />
      ) : (
        <span className="flex flex-wrap items-center gap-1">
          {[...new Set(model.accesses.map(a => a.provider))].map(id => (
            <ProviderMark key={id} id={id} />
          ))}
        </span>
      )}
    </span>
  );
}
