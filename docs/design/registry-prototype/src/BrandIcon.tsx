import { ProviderIcons, type ProviderIconType } from "@/lib/constants/icons";
import { cn } from "@/lib/utils";
import type { Model } from "./demo";
import type { ViewOptions } from "./ViewOptions";

const providerName: Record<string, string> = { openai: "OpenAI", azure: "Azure", anthropic: "Anthropic", bedrock: "AWS Bedrock", google: "Google AI Studio", moonshot: "Moonshot AI", openrouter: "OpenRouter" };
const creatorLogo: Record<string, ProviderIconType> = { OpenAI: "openai", Anthropic: "anthropic" };
const providerLogo: Record<string, ProviderIconType> = { openai: "openai", azure: "azure", anthropic: "anthropic", bedrock: "bedrock", google: "gemini", openrouter: "openrouter" };
export const displayProvider = (id: string) => providerName[id] || id;
function Logo({ icon, label, image }: { icon?: ProviderIconType; label: string; image?: string }) {
  const Icon = icon && ProviderIcons[icon] as ((props: { size: number; className?: string; theme?: string }) => React.ReactNode) | undefined;
  return <span title={label} aria-label={label} className="flex size-8 shrink-0 items-center justify-center rounded-sm border bg-background text-[10px] font-semibold">{image ? <img src={image} alt="" className="size-5 object-contain" /> : Icon ? <><span aria-hidden="true" className="dark:hidden"><Icon size={21} theme="light" className="size-5 object-contain" /></span><span aria-hidden="true" className="hidden dark:block"><Icon size={21} theme="dark" className="size-5 object-contain" /></span></> : label.slice(0, 2).toUpperCase()}</span>;
}
export function BrandIcon({ model, mode, className }: { model: Model; mode: ViewOptions["logo"]; className?: string }) {
  return <span className={cn("flex shrink-0 items-center", className)}>{mode === "creator" ? <Logo icon={creatorLogo[model.creator]} image={model.creator === "Google" ? `${import.meta.env.BASE_URL}images/google.svg` : undefined} label={model.creator} /> : <span className="flex items-center -space-x-2">{[...new Set(model.accesses.map(a => a.provider))].map(id => <Logo key={id} icon={providerLogo[id]} label={displayProvider(id)} />)}</span>}</span>;
}
