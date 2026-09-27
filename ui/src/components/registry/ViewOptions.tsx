import { useState } from "react";
import { LayoutGrid, List, Settings2, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCopy } from "@/lib/locale";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ViewOptions = {
  layout: "grid" | "table";
  size: "small" | "medium" | "large";
  logo: "creator" | "provider";
  description: boolean;
  metadata: boolean;
  modalities: boolean;
  providers: boolean;
  evidence: boolean;
};
export const defaultViewOptions: ViewOptions = { layout: "grid", size: "small", logo: "creator", description: true, metadata: true, modalities: true, providers: true, evidence: true };
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
export function ViewControls({ value, onChange, onReset, scope, fields = ["description", "metadata", "modalities", "providers", "evidence"], catalogFormats = false }: { value: ViewOptions; onChange: (next: ViewOptions) => void; onReset?: () => void; scope?: string; fields?: ("description" | "metadata" | "modalities" | "providers" | "evidence")[]; catalogFormats?: boolean }) {
  const copy = useCopy();
  const [open, setOpen] = useState(false);
  const format = value.layout === "table" ? "table" : value.size === "small" ? "compact" : "square";
  const chooseFormat = (next: string) => {
    if (next === "table") onChange({ ...value, layout: "table" });
    else if (next === "compact") onChange({ ...value, layout: "grid", size: "small" });
    else if (next === "square") onChange({ ...value, layout: "grid", size: "medium" });
  };
  return <div className="flex flex-wrap items-center gap-1" aria-label={`${scope || "List"} view options`}>
    {catalogFormats ? <ToggleGroup type="single" value={format} onValueChange={chooseFormat} aria-label={copy("Catalog display format", "Format du catalogue")} className="h-9 rounded-sm border p-0.5">
      {([["compact", LayoutGrid, "Grid", "Grille"], ["square", Square, "Square", "Carré"], ["table", List, "Table", "Tableau"]] as const).map(([id, Icon, en, fr]) => <ToggleGroupItem key={id} value={id} aria-label={copy(en, fr)} title={copy(en, fr)} className="size-8 rounded-sm px-0 data-[state=on]:bg-secondary"><Icon className="size-4" /></ToggleGroupItem>)}
    </ToggleGroup> : <><Button size="icon" variant={value.layout === "grid" ? "secondary" : "ghost"} aria-label={copy("Grid view", "Vue grille")} aria-pressed={value.layout === "grid"} onClick={() => onChange({ ...value, layout: "grid" })}><LayoutGrid className="size-4" /></Button>
    <Button size="icon" variant={value.layout === "table" ? "secondary" : "ghost"} aria-label={copy("Table view", "Vue tableau")} aria-pressed={value.layout === "table"} onClick={() => onChange({ ...value, layout: "table" })}><List className="size-4" /></Button></>}
    <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button size="sm" variant="outline"><Settings2 className="size-4" />{copy("View options", "Options d’affichage")}</Button></PopoverTrigger><PopoverContent align="end" className="w-64 space-y-4"><h3 className="border-b pb-3 text-base font-semibold">{scope === "Models" ? copy("Model view options", "Options d’affichage des modèles") : copy(`${scope || "View"} options`, `${scope || "Vue"} · options`)}</h3>
      {catalogFormats && <label className="block text-xs font-medium text-muted-foreground">{copy("Card format", "Format des cartes")}<Select value={format} onValueChange={chooseFormat}><SelectTrigger className="mt-2 w-full text-foreground" aria-label={copy("Card format", "Format des cartes")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">{copy("Grid · wide cards", "Grille · cartes larges")}</SelectItem><SelectItem value="square">{copy("Square · 1:1 cards", "Carré · cartes 1:1")}</SelectItem><SelectItem value="table">{copy("Table", "Tableau")}</SelectItem></SelectContent></Select></label>}
      {!catalogFormats && <label className="block text-xs font-medium text-muted-foreground">{copy("Card size", "Taille des cartes")}<Select value={value.size} onValueChange={size => onChange({ ...value, size: size as ViewOptions["size"] })}><SelectTrigger className="mt-2 w-full text-foreground" aria-label={copy("Card size", "Taille des cartes")}><SelectValue /></SelectTrigger><SelectContent>{["small", "medium", "large"].map(size => <SelectItem value={size} key={size}>{size}</SelectItem>)}</SelectContent></Select></label>}
      <div className="space-y-3 border-t pt-3"><p className="text-xs font-medium text-muted-foreground">{copy("Visible details", "Informations visibles")}</p>{fields.map(field => <label key={field} className="flex items-center gap-2 text-sm"><Checkbox checked={value[field]} onCheckedChange={checked => onChange({ ...value, [field]: checked === true })} />{field === "description" ? copy("Description", "Description") : field === "metadata" ? copy("Model ID / metadata", "Identifiant / métadonnées") : field === "providers" ? copy("Provider accesses", "Accès fournisseurs") : field === "modalities" ? copy("Input / output modalities", "Modalités entrée / sortie") : copy("Capabilities", "Capacités")}</label>)}</div>
      {onReset && <Button variant="ghost" size="sm" className="w-full border-t" onClick={() => { onReset(); setOpen(false); }}><RotateCcw className="size-3.5" />{copy("Reset view override", "Réinitialiser l’affichage")}</Button>}
    </PopoverContent></Popover>
  </div>;
}
