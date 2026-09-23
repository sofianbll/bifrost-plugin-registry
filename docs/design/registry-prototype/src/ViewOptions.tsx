import { useState } from "react";
import { LayoutGrid, List, Settings2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ViewOptions = {
  layout: "grid" | "table";
  size: "small" | "medium" | "large";
  logo: "creator" | "provider";
  description: boolean;
  metadata: boolean;
  providers: boolean;
  evidence: boolean;
};
export const defaultViewOptions: ViewOptions = { layout: "grid", size: "medium", logo: "creator", description: true, metadata: true, providers: true, evidence: true };
export function updateViewOverride(base: ViewOptions, previous: Partial<ViewOptions>, next: ViewOptions): Partial<ViewOptions> {
  const current = { ...base, ...previous };
  const override = { ...previous };
  for (const key of Object.keys(next) as (keyof ViewOptions)[]) {
    if (next[key] === current[key]) continue;
    if (next[key] === base[key]) delete override[key];
    else Object.assign(override, { [key]: next[key] });
  }
  return override;
}
export function ViewControls({ value, onChange, onReset, scope, fields = ["description", "metadata", "providers", "evidence"] }: { value: ViewOptions; onChange: (next: ViewOptions) => void; onReset?: () => void; scope?: string; fields?: ("description" | "metadata" | "providers" | "evidence")[] }) {
  const [open, setOpen] = useState(false);
  return <div className="flex items-center gap-1" aria-label={`${scope || "List"} view options`}>
    <Button size="icon" variant={value.layout === "grid" ? "secondary" : "ghost"} aria-label="Grid view" aria-pressed={value.layout === "grid"} onClick={() => onChange({ ...value, layout: "grid" })}><LayoutGrid className="size-4" /></Button>
    <Button size="icon" variant={value.layout === "table" ? "secondary" : "ghost"} aria-label="Table view" aria-pressed={value.layout === "table"} onClick={() => onChange({ ...value, layout: "table" })}><List className="size-4" /></Button>
    <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button size="sm" variant="outline"><Settings2 className="size-4" />View options</Button></PopoverTrigger><PopoverContent align="end" className="w-64 space-y-3"><h3 className="text-sm font-semibold">{scope || "View"} options</h3>
      <label className="block text-xs">Card size<Select value={value.size} onValueChange={size => onChange({ ...value, size: size as ViewOptions["size"] })}><SelectTrigger className="mt-1 w-full" aria-label="Card size"><SelectValue /></SelectTrigger><SelectContent>{["small", "medium", "large"].map(size => <SelectItem value={size} key={size}>{size}</SelectItem>)}</SelectContent></Select></label>
      <p className="text-xs font-medium">Visible details</p>{fields.map(field => <label key={field} className="flex items-center gap-2 text-xs capitalize"><Checkbox checked={value[field]} onCheckedChange={checked => onChange({ ...value, [field]: checked === true })} />{field}</label>)}
      {onReset && <Button variant="ghost" size="sm" className="w-full" onClick={() => { onReset(); setOpen(false); }}><RotateCcw className="size-3.5" />Reset view override</Button>}
    </PopoverContent></Popover>
  </div>;
}
