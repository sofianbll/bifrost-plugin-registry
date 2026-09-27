import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { displayProvider, ProviderMark } from "./BrandIcon";
import { useCopy } from "../../lib/locale";

type Item = { id: string; label: string; icon?: ReactNode; active?: boolean };
function CompactCollection({ items, title, empty, limit = 3 }: { items: Item[]; title: string; empty: string; limit?: number }) {
  if (!items.length) return <span className="text-xs text-muted-foreground">{empty}</span>;
  return <span className="flex min-w-0 max-w-full items-center gap-1" aria-label={title}>
    {items.slice(0, limit).map(item => <Tooltip key={item.id}><TooltipTrigger asChild><span tabIndex={0} aria-label={item.label} className={`inline-flex max-w-full shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${item.active === true ? "bg-chart-success/15 ring-2 ring-chart-success" : item.active === false ? "border border-dashed border-muted-foreground bg-background grayscale" : ""}`}>{item.icon ?? <Badge variant="outline" className="max-w-25 text-xs"><span className="min-w-0 truncate">{item.label}</span></Badge>}</span></TooltipTrigger><TooltipContent>{item.label}</TooltipContent></Tooltip>)}
    {items.length > limit && <Popover><PopoverTrigger asChild><Button type="button" size="sm" variant="outline" className="h-6 shrink-0 px-1.5 text-xs" aria-label={`${title}: +${items.length - limit}`}>+{items.length - limit}</Button></PopoverTrigger><PopoverContent align="start" aria-label={title} className="w-56 max-w-[calc(100vw-2rem)] p-2"><p className="mb-2 text-xs font-semibold">{title} ({items.length})</p><ul tabIndex={0} aria-label={title} className="max-h-52 overflow-y-auto text-xs">{items.map(item => <li key={item.id} className="flex min-w-0 items-center gap-2 border-b py-1 last:border-0"><span className={item.active === true ? "rounded-sm bg-chart-success/15 ring-2 ring-chart-success" : item.active === false ? "rounded-sm border border-dashed border-muted-foreground bg-background grayscale" : ""}>{item.icon}</span><span className="min-w-0 break-words">{item.label}</span></li>)}</ul></PopoverContent></Popover>}
  </span>;
}

export function ProviderSummary({ ids, activeIds, scope = "key" }: { ids: string[]; activeIds?: ReadonlySet<string>; scope?: "key" | "group" }) {
  const copy = useCopy();
  const unique = [...new Set(ids)];
  const target = scope === "group" ? copy("this group", "ce groupe") : copy("this key", "cette clé");
  return <CompactCollection items={unique.map(id => ({ id, label: activeIds ? `${displayProvider(id)} · ${activeIds.has(id) ? copy("Active", "Actif") : copy("Inactive", "Inactif")} ${copy("for", "pour")} ${target}` : displayProvider(id), icon: <ProviderMark id={id} />, active: activeIds?.has(id) }))} title={copy("Access providers", "Fournisseurs d’accès")} empty={copy("No active provider", "Aucun fournisseur actif")} />;
}

export function GroupSummary({ names }: { names: string[] }) {
  const copy = useCopy();
  return <CompactCollection items={names.map((name, index) => ({ id: `${index}:${name}`, label: name }))} title={copy("Inherited groups", "Groupes hérités")} empty={copy("No groups", "Aucun groupe")} limit={1} />;
}
