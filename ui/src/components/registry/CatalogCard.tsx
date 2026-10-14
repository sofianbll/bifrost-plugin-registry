import type { ReactNode } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
type CardFormat = "compact" | "square";

export function CatalogGrid({ format, children }: { format: CardFormat; children: ReactNode }) {
  return <div data-format={format} className="grid items-start gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,205px),1fr))]">{children}</div>;
}

export function CatalogCard({ format, selected, warning, header, children, footer, dataTour }: {
  format: CardFormat; selected?: boolean; warning?: boolean; expanded?: boolean;
  header: ReactNode; children: ReactNode; footer: ReactNode; dataTour?: string;
}) {
  return <Card data-tour={dataTour} className={cn("min-w-0 gap-0 py-0 transition-colors duration-150 hover:border-primary/40 motion-reduce:transition-none", format === "square" && "aspect-square min-h-0 overflow-hidden", warning ? "border-chart-warning/50 bg-chart-warning/5" : selected && "border-chart-success bg-chart-success/5")}>
    <CardHeader className="flex min-w-0 shrink-0 flex-row items-start gap-2 px-3 pt-3 pb-2">{header}</CardHeader>
    <CardContent tabIndex={format === "square" ? 0 : undefined} className={cn("flex min-w-0 flex-1 flex-col gap-1 px-3 pb-2", format === "square" ? "min-h-0 justify-start overflow-y-auto [&>*]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : "justify-center")}>{children}</CardContent>
    <Separator />
    <CardFooter className="shrink-0 flex-wrap justify-between gap-1 px-3 py-1.5">{footer}</CardFooter>
  </Card>;
}
