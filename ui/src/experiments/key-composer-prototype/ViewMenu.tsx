import type { ReactNode } from "react";
import { LayoutGrid, List, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { useCopy } from "../../lib/locale";

export type DisplayFormat = "compact" | "square" | "table";

export function ViewMenu({ format, onFormatChange, children }: { format: DisplayFormat; onFormatChange: (format: DisplayFormat) => void; children?: ReactNode }) {
  const copy = useCopy();
  const choices = [
    { value: "compact", label: copy("Grid", "Grille"), icon: LayoutGrid },
    { value: "square", label: copy("Square", "Carré"), icon: Square },
    { value: "table", label: copy("Table", "Tableau"), icon: List },
  ] as const;
  const selected = choices.findIndex(choice => choice.value === format);
  const ActiveIcon = choices[selected].icon;
  return <Popover>
    <PopoverTrigger asChild><Button variant="outline" size="sm" aria-label={copy(`View: ${choices[selected].label}`, `Vue : ${choices[selected].label}`)}><ActiveIcon data-icon="inline-start" />{copy("View", "Vue")} : {choices[selected].label}</Button></PopoverTrigger>
    <PopoverContent align="end" className="max-h-[58dvh] w-60 overflow-y-auto p-2">
      <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">{copy("Display format", "Format d’affichage")}</p>
      <ToggleGroup type="single" orientation="vertical" spacing={1} value={format} onValueChange={value => { if (value) onFormatChange(value as DisplayFormat); }} aria-label={copy("Display format", "Format d’affichage")} className="relative flex w-full flex-col gap-1 rounded-sm p-1">
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-1 top-1 h-9 rounded-sm bg-secondary transition-transform duration-200 ease-out motion-reduce:transition-none" style={{ transform: `translateY(${selected * 40}px)` }} />
        {choices.map(({ value, label, icon: Icon }) => <ToggleGroupItem key={value} value={value} aria-label={label} className="relative z-10 h-9 w-full justify-start gap-2 px-2 text-sm data-[state=on]:bg-transparent"><Icon data-icon="inline-start" />{label}</ToggleGroupItem>)}
      </ToggleGroup>
      {children && <><Separator className="my-2" /><div className="px-1 pb-1">{children}</div></>}
    </PopoverContent>
  </Popover>;
}
