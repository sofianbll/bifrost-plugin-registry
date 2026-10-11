import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { displayProvider } from "./BrandIcon";
import { ActionLabel } from "./CatalogCard";
import type { Model } from "../../domain/registry";
import { useCopy, useFormat } from "../../lib/locale";

// The Accesses popover of a card footer, named after its card (label: its distinct name). It lists
// the model's accesses, unless the page passes its own body (children) and a count of the accesses
// available beside the card.
export function ModelAccessMenu({ model, note, status, label = model.name, count = model.accesses.length, available = 0, children }: { model: Model; note?: string; status?: string; label?: string; count?: number; available?: number; children?: ReactNode }) {
  const copy = useCopy();
  const { colon } = useFormat();
  return <Popover><PopoverTrigger asChild><Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs">{copy("Accesses", "Accès")} · {count}{available > 0 && <span className="ml-1 text-muted-foreground">+{available}<span className="sr-only"> {copy("available", available > 1 ? "disponibles" : "disponible")}</span></span>}<ActionLabel label={label} /></Button></PopoverTrigger><PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] space-y-2 p-3"><h3 className="text-sm font-semibold">{copy("Provider accesses", "Accès fournisseurs")}</h3>{status && <p className="text-xs text-muted-foreground">{status}</p>}{note && <p className="text-xs text-muted-foreground">{note}</p>}{children ?? (model.accesses.length ? model.accesses.map(access => <div key={access.id} className="border-t pt-2 text-xs"><p>{displayProvider(access.provider)} · {copy(access.status === "Configured" ? "Configured" : "Configuration unknown", access.status === "Configured" ? "Configuré" : "Configuration inconnue")}</p><p className="break-all font-mono">{copy("Access ID", "ID d’accès")}{colon} {access.id}</p><p className="break-all font-mono">{copy("Native model ID", "ID natif du modèle")}{colon} {access.nativeModel || copy("Unknown", "Inconnu")}</p></div>) : <p className="text-xs text-muted-foreground">{copy("No linked provider access", "Aucun accès fournisseur lié")}</p>)}</PopoverContent></Popover>;
}
