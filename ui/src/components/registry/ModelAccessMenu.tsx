import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { displayProvider } from "./BrandIcon";
import type { Model } from "../../domain/registry";
import { useCopy } from "../../lib/locale";

// label: the card's distinct name (its display name, plus its ID when another card shares it).
export function ModelAccessMenu({ model, note, status, label = model.name }: { model: Model; note?: string; status?: string; label?: string }) {
  const copy = useCopy();
  return <Popover><PopoverTrigger asChild><Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" aria-label={copy(`${model.accesses.length} provider accesses for ${label}`, `${model.accesses.length} accès fournisseurs pour ${label}`)}>{copy("Accesses", "Accès")} · {model.accesses.length}</Button></PopoverTrigger><PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] space-y-2 p-3"><h3 className="text-sm font-semibold">{copy("Provider accesses", "Accès fournisseurs")} · {model.name}</h3>{status && <p className="text-xs text-muted-foreground">{status}</p>}{note && <p className="text-xs text-muted-foreground">{note}</p>}{model.accesses.length ? model.accesses.map(access => <div key={access.id} className="border-t pt-2 text-xs"><p>{displayProvider(access.provider)} · {copy(access.status === "Configured" ? "Configured" : "Configuration unknown", access.status === "Configured" ? "Configuré" : "Configuration inconnue")}</p><p className="break-all font-mono">{copy("Access ID", "ID d’accès")}: {access.id}</p><p className="break-all font-mono">{copy("Native model ID", "ID natif du modèle")}: {access.nativeModel || copy("Unknown", "Inconnu")}</p></div>) : <p className="text-xs text-muted-foreground">{copy("No linked provider access", "Aucun accès fournisseur lié")}</p>}</PopoverContent></Popover>;
}
