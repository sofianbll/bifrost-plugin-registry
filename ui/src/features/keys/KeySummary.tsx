import { displayProvider, ProviderMark } from "../../components/registry/BrandIcon";
import { members, retainedAccesses, type Group, type Key, type Model } from "../../domain/registry";
import { useCopy } from "../../lib/locale";
import { KeptNative } from "./KeptNative";
import { permissionSummary } from "./KeyComposer.state";
import { KeyPermissions } from "./KeyPermissions";

// The managed key page opens read-first: what the published selection lets the key call, one line per
// subscription (a model served by two appears under both), then the providers kept in Bifrost.
export function KeySummary({ virtualKey, models, groups }: { virtualKey: Key; models: Model[]; groups: Group[] }) {
  const copy = useCopy();
  const byProvider = new Map<string, string[]>();
  for (const id of members(virtualKey.policy, groups)) {
    const model = models.find(item => item.id === id);
    if (!model) continue;
    const { known } = retainedAccesses(model, virtualKey.policy);
    for (const provider of new Set(model.accesses.filter(access => known.includes(access.id)).map(access => access.provider))) byProvider.set(provider, [...(byProvider.get(provider) ?? []), model.name || model.id]);
  }
  const rows = [...byProvider].sort(([a], [b]) => displayProvider(a).localeCompare(displayProvider(b)));
  const title = copy("What this key can call today", "Ce que cette clé peut appeler aujourd’hui");
  return <section aria-label={title} className="space-y-3 rounded-sm border bg-card p-4">
    <h2 className="text-base font-semibold">{title}</h2>
    {rows.length ? <ul aria-label={copy("Through Registry", "Par Registry")} className="space-y-2 text-sm">{rows.map(([provider, names]) => <li key={provider} className="flex min-w-0 items-start gap-2"><ProviderMark id={provider} /><span className="min-w-0"><span className="font-medium">{displayProvider(provider)} · {names.length} {copy(names.length === 1 ? "model" : "models", names.length === 1 ? "modèle" : "modèles")}</span><span className="block text-xs text-muted-foreground">{names.join(", ")}</span></span></li>)}</ul>
      : <p className="text-sm text-muted-foreground">{copy("No model selected yet. Use Edit selection to choose some.", "Aucun modèle choisi pour l’instant. Utilisez Modifier la sélection pour en choisir.")}</p>}
    <KeptNative virtualKey={virtualKey} />
    <div className="border-t pt-3"><p className="text-sm font-medium">{copy("Bifrost allows today", "Bifrost autorise aujourd’hui")} · {permissionSummary(virtualKey.permissions, copy)}</p><KeyPermissions permissions={virtualKey.permissions} /></div>
  </section>;
}
