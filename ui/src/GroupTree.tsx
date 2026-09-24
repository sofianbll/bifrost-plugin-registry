import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tree, type TreeNode } from "@/components/ui/treeView";
import { displayProvider } from "./BrandIcon";
import type { Model } from "./demo";

type Node = { id: string; name: string; kind: "creator" | "model" | "access"; modelId?: string };
export function GroupTree({ models, selected, onToggle }: { models: Model[]; selected: string[]; onToggle: (id: string) => void }) {
  const creators = [...new Set(models.map(m => m.creator))].sort();
  const nodes: TreeNode<Node>[] = creators.map(creator => ({
    data: { id: `creator:${creator}`, name: creator, kind: "creator" },
    children: models.filter(model => model.creator === creator).map(model => ({
      data: { id: `model:${model.id}`, name: model.name, kind: "model", modelId: model.id },
      children: model.accesses.map(access => ({ data: { id: `access:${access.id}`, name: `${displayProvider(access.provider)} · ${access.id}`, kind: "access" } })),
    })),
  }));
  return <div className="rounded-sm border bg-card p-2 shadow-sm"><p className="mb-2 border-b px-2 pb-3 text-xs text-muted-foreground">Choose models. Serving accesses below each model are shown for context and cannot be selected separately.</p><Tree data={nodes} fitContainer levelsToExpandByDefault={1} renderItem={({ item, isExpanded, hasChildren, onToggle: expand }) => item.kind === "creator" ? <Button variant="ghost" size="sm" className="w-full justify-start gap-2 bg-muted/40 text-sm" aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.name} models`} aria-expanded={isExpanded} onClick={expand}>{hasChildren && (isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />)}<span className="font-semibold">{item.name}</span></Button> : item.kind === "model" ? <div className={`flex min-w-0 items-center gap-2 rounded-sm px-2 py-2 hover:bg-muted/40 ${selected.includes(item.modelId!) ? "bg-primary/10 ring-1 ring-chart-success/20" : ""}`}>{hasChildren && <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.name} accesses`} aria-expanded={isExpanded} onClick={expand}>{isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}</Button>}<label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm"><Checkbox checked={selected.includes(item.modelId!)} onCheckedChange={() => onToggle(item.modelId!)} /><span className="truncate font-medium">{item.name}</span></label></div> : <div className="flex min-w-0 items-center gap-2 px-2 py-1 text-xs text-muted-foreground"><Badge variant="outline">Access</Badge><span className="truncate" title={item.name}>{item.name}</span></div>} /></div>;
}
