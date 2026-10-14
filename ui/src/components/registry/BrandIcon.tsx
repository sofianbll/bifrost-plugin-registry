import { ProviderIcons, type ProviderIconType } from "@/lib/constants/icons";
import { cn } from "@/lib/utils";
import type { Model } from "../../domain/registry";
import type { ViewOptions } from "./ViewOptions";

const providerName: Record<string, string> = { openai: "OpenAI", azure: "Azure", anthropic: "Anthropic", bedrock: "AWS Bedrock", google: "Google AI Studio", moonshot: "Moonshot AI", openrouter: "OpenRouter" };
const creatorLogo: Record<string, ProviderIconType> = { OpenAI: "openai", Anthropic: "anthropic" };
const providerLogo: Record<string, ProviderIconType> = { openai: "openai", azure: "azure", anthropic: "anthropic", bedrock: "bedrock", google: "gemini", openrouter: "openrouter" };
export const displayProvider = (id: string) => providerName[id] || id;
function Logo({ icon, label, image, compact = false }: { icon?: ProviderIconType; label: string; image?: string; compact?: boolean }) {
  const Icon = icon && ProviderIcons[icon] as ((props: { size: number; className?: string; theme?: string }) => React.ReactNode) | undefined;
  return <span title={label} aria-label={label} className={cn("flex shrink-0 items-center justify-center rounded-sm text-[10px] font-semibold", compact ? "size-6" : "size-8 border bg-background")}>{image ? <img src={image} alt="" className={cn("size-5 object-contain", label === "Moonshot AI" && "dark:invert")} /> : Icon ? <span aria-hidden="true"><Icon size={20} theme="light" className={cn("size-5 object-contain", (icon === "anthropic" || icon === "openai") && "dark:invert")} /></span> : label.slice(0, 2).toUpperCase()}</span>;
}
export function ProviderMark({ id }: { id: string }) {
  return <Logo compact icon={providerLogo[id]} image={id === "moonshot" ? `${import.meta.env.BASE_URL}images/moonshot.svg` : undefined} label={displayProvider(id)} />;
}
export function BrandIcon({ model, mode, className }: { model: Model; mode: ViewOptions["logo"]; className?: string }) {
  return <span className={cn("flex shrink-0 items-center", className)}>{mode === "creator" ? <Logo icon={creatorLogo[model.creator]} image={model.creator === "Google" ? `${import.meta.env.BASE_URL}images/google.svg` : model.creator === "Moonshot AI" ? `${import.meta.env.BASE_URL}images/moonshot.svg` : undefined} label={model.creator} /> : <span className="flex flex-wrap items-center gap-1">{[...new Set(model.accesses.map(a => a.provider))].map(id => <ProviderMark key={id} id={id} />)}</span>}</span>;
}
