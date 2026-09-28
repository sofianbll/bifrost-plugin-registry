import { LayoutGrid, List, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCopy } from "@/lib/locale";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useId, useState } from "react";

export type ViewOptions = {
  layout: "grid" | "table";
  shape?: "rectangle" | "square";
  size: "small" | "medium" | "large";
  logo: "creator" | "provider";
  description: boolean;
  metadata: boolean;
  modalities: boolean;
  providers: boolean;
  evidence: boolean;
};
export const defaultViewOptions: ViewOptions = { layout: "grid", shape: "rectangle", size: "small", logo: "creator", description: true, metadata: true, modalities: true, providers: true, evidence: true };

export function cardFormat(view: Pick<ViewOptions, "layout" | "shape">): "compact" | "square" {
  if (view.layout === "table") return "compact";
  return view.shape === "square" ? "square" : "compact";
}

export function displayFormat(view: Pick<ViewOptions, "layout" | "shape" | "size">): "compact" | "square" | "table" {
  if (view.layout === "table") return "table";
  if (view.shape === "square") return "square";
  return "compact";
}

export function gridColumns(size: ViewOptions["size"]): 1 | 2 | 3 | 4 {
  if (size === "small") return 4;
  if (size === "medium") return 3;
  return 2;
}

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
  const baseId = useId();
  const [open, setOpen] = useState(false);
  const density = value.size;
  const setDensity = (size: ViewOptions["size"]) => onChange({ ...value, size });

  if (catalogFormats) {
    return <div className="flex flex-wrap items-center gap-3" aria-label={copy(`${scope || "List"} view options`, `Options d’affichage · ${scope || "liste"}`)}>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{copy("View", "Vue")}</p>
        <ToggleGroup type="single" value={value.layout} onValueChange={layout => layout && onChange({ ...value, layout: layout as ViewOptions["layout"] })} aria-label={copy("View", "Vue")}>
          <ToggleGroupItem value="grid" aria-label={copy("Grid", "Grille")}><LayoutGrid className="size-4" /><span className="hidden sm:inline">{copy("Grid", "Grille")}</span></ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label={copy("Table", "Tableau")}><List className="size-4" /><span className="hidden sm:inline">{copy("Table", "Tableau")}</span></ToggleGroupItem>
        </ToggleGroup>
      </div>
      {value.layout === "grid" && <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{copy("Shape", "Forme")}</p>
        <ToggleGroup type="single" value={value.shape || "rectangle"} onValueChange={shape => shape && onChange({ ...value, shape: shape as ViewOptions["shape"] })} aria-label={copy("Card shape", "Forme des cartes")}>
          <ToggleGroupItem value="rectangle" aria-label={copy("Rectangle", "Rectangle")}><LayoutGrid className="size-4" /><span className="hidden sm:inline">{copy("Rectangle", "Rectangle")}</span></ToggleGroupItem>
          <ToggleGroupItem value="square" aria-label={copy("Square", "Carré")}><Square className="size-4" /><span className="hidden sm:inline">{copy("Square", "Carré")}</span></ToggleGroupItem>
        </ToggleGroup>
      </div>}
      {value.layout === "grid" && <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{copy("Density", "Densité")}</p>
        <ToggleGroup type="single" value={density} onValueChange={size => size && setDensity(size as ViewOptions["size"])} aria-label={copy("Grid density", "Densité de la grille")}>
          {(["small", "medium", "large"] as ViewOptions["size"][]).map(size => {
            const columns = gridColumns(size);
            return <ToggleGroupItem key={size} value={size} aria-label={`${copy({ small: "Small", medium: "Medium", large: "Large" }[size], { small: "Petit", medium: "Moyen", large: "Grand" }[size])} · ${columns} ${copy("columns", "colonnes")}`}>
              <span>{copy({ small: "Small", medium: "Medium", large: "Large" }[size], { small: "Petit", medium: "Moyen", large: "Grand" }[size])}</span>
              <span className="text-xs text-muted-foreground">{columns}</span>
            </ToggleGroupItem>;
          })}
        </ToggleGroup>
      </div>}
      <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button size="sm" variant="outline" aria-label={copy("View options", "Options d’affichage")}>{copy("View options", "Options")}</Button></PopoverTrigger><PopoverContent align="end" className="w-64 space-y-4">
        <h3 className="border-b pb-3 text-base font-semibold">{scope === "Models" ? copy("Model view options", "Options d’affichage des modèles") : copy(`${scope || "View"} options`, `${scope || "Vue"} · options`)}</h3>
        <div className="space-y-3"><p className="text-xs font-medium text-muted-foreground">{copy("Visible details", "Informations visibles")}</p>{fields.map(field => { const id = `${baseId}-${field}`; return <label key={field} htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox id={id} checked={value[field]} onCheckedChange={checked => onChange({ ...value, [field]: checked === true })} />{field === "description" ? copy("Description", "Description") : field === "metadata" ? copy("Model ID / metadata", "Identifiant / métadonnées") : field === "providers" ? copy("Provider accesses", "Accès fournisseurs") : field === "modalities" ? copy("Input / output modalities", "Modalités entrée / sortie") : copy("Capabilities", "Capacités")}</label>; })}</div>
        {onReset && <Button variant="ghost" size="sm" className="w-full border-t" onClick={() => { onReset(); setOpen(false); }}>{copy("Reset", "Réinitialiser")}</Button>}
      </PopoverContent></Popover>
    </div>;
  }

  // Legacy compact controls for non-catalog surfaces (laboratory, harness, etc.)
  const format = displayFormat(value);
  const chooseFormat = (next: string) => {
    if (next === "table") onChange({ ...value, layout: "table" });
    else if (next === "compact") onChange({ ...value, layout: "grid", shape: "rectangle", size: "small" });
    else if (next === "square") onChange({ ...value, layout: "grid", shape: "square", size: "medium" });
  };
  return <div className="flex flex-wrap items-center gap-1" aria-label={copy(`${scope || "List"} view options`, `Options d’affichage · ${scope || "liste"}`)}>
    <ToggleGroup type="single" value={format} onValueChange={chooseFormat} aria-label={copy("Catalog display format", "Format du catalogue")} className="h-9 rounded-sm border p-0.5">
      {([["compact", LayoutGrid, "Grid", "Grille"], ["square", Square, "Square", "Carré"], ["table", List, "Table", "Tableau"]] as const).map(([id, Icon, en, fr]) => <ToggleGroupItem key={id} value={id} aria-label={copy(en, fr)} title={copy(en, fr)} className="size-8 rounded-sm px-0 data-[state=on]:bg-secondary"><Icon className="size-4" /></ToggleGroupItem>)}
    </ToggleGroup>
    <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button size="sm" variant="outline">{copy("View options", "Options")}</Button></PopoverTrigger><PopoverContent align="end" className="w-64 space-y-4">
      <h3 className="border-b pb-3 text-base font-semibold">{scope === "Models" ? copy("Model view options", "Options d’affichage des modèles") : copy(`${scope || "View"} options`, `${scope || "Vue"} · options`)}</h3>
      <label className="block text-xs font-medium text-muted-foreground">{copy("Card size", "Taille des cartes")}<Select value={value.size} onValueChange={size => onChange({ ...value, size: size as ViewOptions["size"] })}><SelectTrigger className="mt-2 w-full text-foreground" aria-label={copy("Card size", "Taille des cartes")}><SelectValue /></SelectTrigger><SelectContent>{(["small", "medium", "large"] as const).map(size => <SelectItem value={size} key={size}>{copy({ small: "Small", medium: "Medium", large: "Large" }[size], { small: "Petit", medium: "Moyen", large: "Grand" }[size])}</SelectItem>)}</SelectContent></Select></label>
      <div className="space-y-3 border-t pt-3"><p className="text-xs font-medium text-muted-foreground">{copy("Visible details", "Informations visibles")}</p>{fields.map(field => { const id = `${baseId}-${field}`; return <label key={field} htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox id={id} checked={value[field]} onCheckedChange={checked => onChange({ ...value, [field]: checked === true })} />{field === "description" ? copy("Description", "Description") : field === "metadata" ? copy("Model ID / metadata", "Identifiant / métadonnées") : field === "providers" ? copy("Provider accesses", "Accès fournisseurs") : field === "modalities" ? copy("Input / output modalities", "Modalités entrée / sortie") : copy("Capabilities", "Capacités")}</label>; })}</div>
      {onReset && <Button variant="ghost" size="sm" className="w-full border-t" onClick={() => { onReset(); setOpen(false); }}>{copy("Reset view override", "Réinitialiser l’affichage")}</Button>}
    </PopoverContent></Popover>
  </div>;
}
