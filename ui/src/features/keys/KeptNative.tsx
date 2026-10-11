import { Button } from "@/components/ui/button";
import { displayProvider, ProviderMark } from "../../components/registry/BrandIcon";
import type { Key, Readiness } from "../../domain/registry";
import { useCopy } from "../../lib/locale";

// Providers an adopted key keeps in Bifrost (adoption option b): Registry neither manages nor changes
// their permissions, and the readback expects their routes as Bifrost allows them. The count comes from
// the key's native permissions (absent until they are read; `all` = a "*" allowlist).
export const keptNativeOf = (key: Key) => (key.policy.keptNative ?? []).map(provider => {
  const permission = key.permissions?.providers.find(item => item.provider === provider);
  return { provider, count: permission && !permission.allModels ? permission.models.length : undefined, all: !!permission?.allModels };
});

// The key card and the composer: "Mistral · kept in Bifrost · 3 models", with the provider's mark.
export function KeptNative({ virtualKey }: { virtualKey: Key }) {
  const copy = useCopy();
  const kept = keptNativeOf(virtualKey);
  if (!kept.length) return null;
  return <ul aria-label={copy("Kept in Bifrost", "Conservés dans Bifrost")} className="space-y-1 text-xs text-muted-foreground">{kept.map(({ provider, count, all }) => <li key={provider} className="flex min-w-0 items-center gap-1.5"><ProviderMark id={provider} /><span className="min-w-0 break-words">{displayProvider(provider)} · {copy("kept in Bifrost", "conservé dans Bifrost")}{all ? ` · ${copy("all models", "tous les modèles")}` : count !== undefined ? ` · ${count} ${copy(count === 1 ? "model" : "models", count === 1 ? "modèle" : "modèles")}` : ""}</span></li>)}</ul>;
}

// In the adoption dialog: what the preview keeps native, the consequence, and the way back.
// Extension point for #93: the sibling action (remove the models from the key) sits beside the blocker line in AdoptionBlockers.
export function KeptProviders({ readiness, onKeep }: { readiness?: Readiness; onKeep?: (provider: string, keep: boolean) => void }) {
  const copy = useCopy();
  // A provider that allows every model (dynamic) names no model: it counts as "all models" (-1).
  const kept = new Map<string, number>();
  for (const blocker of readiness?.blockers ?? []) if (blocker.kept && blocker.provider) kept.set(blocker.provider, blocker.kind === "dynamic" || kept.get(blocker.provider) === -1 ? -1 : (kept.get(blocker.provider) ?? 0) + blocker.models.length);
  if (!kept.size) return null;
  return <section aria-label={copy("Kept in Bifrost", "Conservés dans Bifrost")} className="rounded-sm border bg-primary/5 p-3"><h3 className="font-medium">{copy("Kept in Bifrost", "Conservés dans Bifrost")}</h3>
    <ul className="mt-2 space-y-3">{[...kept].map(([provider, count]) => {
      const name = displayProvider(provider);
      return <li key={provider}>
        <p className="font-medium">{name} · {count < 0 ? copy("all models", "tous les modèles conservés") : `${count} ${copy(count === 1 ? "model" : "models", count === 1 ? "modèle conservé" : "modèles conservés")}`}{copy(" kept in Bifrost", " dans Bifrost")}</p>
        <p className="text-xs">{copy(`Registry will not manage or change ${name}’s permissions. Bifrost keeps them as they are, outside the catalog; the rest of the key is adopted.`, `Registry ne gérera ni ne modifiera les permissions du fournisseur ${name}. Bifrost les conserve telles quelles, hors du catalogue ; le reste de la clé est adopté.`)}</p>
        {onKeep && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => onKeep(provider, false)}>{copy(`Stop keeping ${name} in Bifrost`, `Ne plus garder ${name} dans Bifrost`)}</Button>}
      </li>;
    })}</ul></section>;
}
