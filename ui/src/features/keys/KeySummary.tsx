import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayProvider, ProviderMark } from "../../components/registry/BrandIcon";
import { exposed, members, retainedAccesses, type Group, type Key, type Model } from "../../domain/registry";
import { useCopy, useFormat, useLanguage, type Copy, type Language } from "../../lib/locale";
import { permissionSummary } from "./KeyComposer.state";
import { KeyPermissions } from "./KeyPermissions";

// A day in the active language: "12/10/2026" in French, "Oct 12, 2026" in English (never the ambiguous 10/12/2026).
export const formatDay = (language: Language, value: string) => new Date(value).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", language === "fr" ? { day: "2-digit", month: "2-digit", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
export function useDay() { const language = useLanguage(); return (value: string) => formatDay(language, value); }

// What a managed key can call: one row per distinct route, grouped by subscription. Registry routes come
// from the selection (a model waiting for an access choice is not published); kept providers add the models
// Bifrost allows them, unless a Registry route already covers it. A kept provider that allows every model,
// depends on the Bifrost version, or was not read yet leaves the total open ("at least N").
export type LedgerRow = { name: string; via: string; kept: boolean };
export type LedgerGroup = { provider: string; rows: LedgerRow[]; open?: "all" | "version" | "unread" };
export function keyLedger(key: Key, models: Model[], groups: Group[]) {
  const routes = new Map<string, LedgerRow & { provider: string }>();
  const pending = Object.keys(key.pendingAccessSelection ?? {});
  for (const id of members(key.policy, groups)) {
    const model = models.find(item => item.id === id);
    if (!model || pending.includes(model.alias || model.id)) continue;
    const { known } = retainedAccesses(model, key.policy);
    for (const access of model.accesses.filter(item => known.includes(item.id))) routes.set(access.id, { provider: access.provider, name: model.name || model.id, via: access.provider, kept: false });
  }
  const open: LedgerGroup[] = [];
  for (const provider of key.policy.keptNative ?? []) {
    const permission = key.permissions?.providers.find(item => item.provider === provider);
    if (!key.permissions || (!permission && !key.permissions.allProviders)) { open.push({ provider, rows: [], open: "unread" }); continue; }
    if (!permission || permission.allModels) { open.push({ provider, rows: [], open: "all" }); continue; }
    if (permission.versionDependent) { open.push({ provider, rows: [], open: "version" }); continue; }
    for (const name of permission.models) {
      const id = `${provider}/${name}`;
      if (!routes.has(id)) routes.set(id, { provider, name: models.find(model => model.accesses.some(access => access.id === id))?.name || name, via: provider, kept: true });
    }
  }
  const byProvider = new Map<string, LedgerGroup>(open.map(group => [group.provider, group]));
  for (const { provider, ...row } of routes.values()) {
    const group = byProvider.get(provider) ?? { provider, rows: [] };
    group.rows.push(row);
    byProvider.set(provider, group);
  }
  for (const group of byProvider.values()) group.rows.sort((a, b) => a.name.localeCompare(b.name));
  return { total: routes.size, open: open.length > 0, groups: [...byProvider.values()].sort((a, b) => displayProvider(a.provider).localeCompare(displayProvider(b.provider))) };
}

const modelCount = (count: number, copy: Copy) => `${count} ${copy(count === 1 ? "model" : "models", count === 1 ? "modèle" : "modèles")}`;
// The single total, on the key page and on its card: "5 models", "at least 2 models".
export const ledgerTotal = (ledger: ReturnType<typeof keyLedger>, copy: Copy) => `${ledger.open ? copy("at least ", "au moins ") : ""}${modelCount(ledger.total, copy)}`;
// Whether Bifrost confirmed the published selection, in plain words.
export const checkState = (key: Key, copy: Copy) => key.publication?.state === "verified" ? copy("Verified", "Vérifiée") : key.publication?.state === "drift" ? copy("Differences found", "Écarts trouvés") : copy("Not checked yet", "Pas encore vérifiée");

type Props = { virtualKey: Key; models: Model[]; groups: Group[]; busy: boolean; snapshotMode: boolean; onReread: () => void };
// The managed key page opens read-first on one ledger; the technical check (Bifrost's own permissions,
// story 36, and the IDs Bifrost lists for the key) waits in one fold.
export function KeySummary({ virtualKey, models, groups, busy, snapshotMode, onReread }: Props) {
  const copy = useCopy();
  const day = useDay();
  const localized = useFormat();
  const { colon } = localized;
  const ledger = keyLedger(virtualKey, models, groups);
  const publication = virtualKey.publication;
  const pending = Object.entries(virtualKey.pendingAccessSelection || {});
  const ids = snapshotMode ? exposed(virtualKey.policy, groups, models) : virtualKey.observed || publication?.actual || [];
  const total = ledgerTotal(ledger, copy);
  const title = ledger.total || ledger.open ? copy(`This key can call ${total}`, `Cette clé peut appeler ${total}`) : copy("This key cannot call any model yet", "Cette clé ne peut encore appeler aucun modèle");
  const openRow = (group: LedgerGroup) => group.open === "all" ? copy("All models Bifrost allows", "Tous les modèles autorisés par Bifrost") : group.open === "version" ? copy("Depends on the Bifrost version", "Selon la version de Bifrost") : copy("Not read yet", "Pas encore lus");
  const verdict = snapshotMode ? copy("saved in this local copy", "enregistrée dans cette copie locale") : publication?.state === "verified" && publication.checkedAt ? copy(`Verified ${day(publication.checkedAt)}`, `Vérifiée le ${day(publication.checkedAt)}`) : checkState(virtualKey, copy);
  const naming = virtualKey.policy.naming === "both" ? copy("both", "les deux") : virtualKey.policy.naming === "model" ? copy("model", "modèle") : copy("provider/model", "fournisseur/modèle");
  return <section aria-labelledby={`ledger-${virtualKey.id}`} className="space-y-4 rounded-sm border bg-card p-4">
    <h2 id={`ledger-${virtualKey.id}`} className="text-base font-semibold">{title}</h2>
    {ledger.groups.length ? <div className="space-y-3">{ledger.groups.map(group => <section key={group.provider} aria-label={displayProvider(group.provider)} className="space-y-1">
      <h3 className="flex min-w-0 items-center gap-2 text-sm font-medium"><ProviderMark id={group.provider} />{displayProvider(group.provider)}{group.rows.length > 0 && <span className="font-normal text-muted-foreground"> · {modelCount(group.rows.length, copy)}</span>}</h3>
      <ul className="ml-7 divide-y text-sm">{group.open ? <li className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5"><span>{openRow(group)}</span><span className="text-xs text-muted-foreground">{copy("kept in Bifrost", "conservé dans Bifrost")}</span></li>
        : group.rows.map(row => <li key={`${row.name}-${row.kept}`} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5"><span className="min-w-0 break-words">{row.name}</span><span className="text-xs text-muted-foreground">{row.kept ? copy("kept in Bifrost", "conservé dans Bifrost") : `via ${displayProvider(row.via)}`}</span></li>)}</ul>
    </section>)}</div>
      : <p className="text-sm text-muted-foreground">{copy("No model selected yet. Use Edit selection to choose some.", "Aucun modèle choisi pour l’instant. Utilisez Modifier la sélection pour en choisir.")}</p>}
    {pending.length > 0 && <div role="alert" className="space-y-1 text-xs text-chart-warning-ink">
      <p>{copy("Several accesses offer these models and none is chosen, so this key does not publish them. In the model's Accesses list, uncheck the accesses this key must not use.", "Plusieurs accès proposent ces modèles et aucun n’est choisi : cette clé ne les publie pas. Dans la liste Accès du modèle, décochez ceux que cette clé ne doit pas utiliser.")}</p>
      {pending.map(([alias, accesses]) => <p key={alias} className="break-all font-mono">{alias} · {accesses.join(" · ")}</p>)}
    </div>}
    {!snapshotMode && publication?.error && <p role="alert" className="text-xs text-chart-warning-ink">{publication.error}</p>}
    {!snapshotMode && publication?.state === "drift" && <p className="text-xs text-destructive">{copy(`Bifrost does not match this selection: ${publication.missing.length} missing, ${publication.unexpected.length} unexpected. Details in the technical check.`, `Bifrost ne correspond pas à cette sélection : ${publication.missing.length} manquant(s), ${publication.unexpected.length} inattendu(s). Détails dans la vérification technique.`)}</p>}
    <details className="border-t pt-3 text-sm">
      <summary className="cursor-pointer font-medium">{copy("Technical check", "Vérification technique")} · {verdict}</summary>
      <div className="mt-3 space-y-3">
        {snapshotMode ? <p className="text-xs text-muted-foreground">{copy("Changes stay in this copy; Bifrost cannot be checked from here.", "Les changements restent dans cette copie ; Bifrost ne peut pas être vérifié d’ici.")}</p> : <>
          <p className="text-xs text-muted-foreground">{copy("Checked with Bifrost: Registry asks Bifrost which model IDs this key lists. The models are not called.", "Vérifié avec Bifrost : Registry demande à Bifrost quels ID de modèles cette clé liste. Les modèles ne sont pas appelés.")}</p>
          <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={onReread}><RotateCcw className="size-3.5" />{copy("Read again", "Relire")}</Button>{publication?.checkedAt && <span className="break-all text-xs text-muted-foreground">{localized.date(publication.checkedAt)} · {copy("revision", "révision")} {publication.revision.slice(0, 12)}</span>}</div>
          {publication?.state === "drift" && <p className="break-all text-xs text-destructive">{copy("Missing", "Manquants")}{colon} {publication.missing.join(", ") || "—"} · {copy("Unexpected", "Inattendus")}{colon} {publication.unexpected.join(", ") || "—"}</p>}
        </>}
        <div><p className="text-xs font-medium">{snapshotMode ? copy("Saved model IDs", "ID de modèles enregistrés") : copy("Model IDs Bifrost lists for this key", "ID de modèles que Bifrost liste pour cette clé")} · {copy("ID format", "Format des ID")} {naming}</p>
          <ul className="mt-1 max-h-36 space-y-1 overflow-auto">{ids.map((id, index) => <li key={`${id}-${index}`} className="break-all font-mono text-xs">{id}</li>)}{!ids.length && <li className="text-xs text-muted-foreground">{copy("Nothing read from Bifrost yet.", "Rien n’a encore été lu dans Bifrost.")}</li>}</ul></div>
        <div><p className="text-xs font-medium">{copy("Bifrost allows today", "Bifrost autorise aujourd’hui")} · {permissionSummary(virtualKey.permissions, copy)}</p><KeyPermissions permissions={virtualKey.permissions} /></div>
      </div>
    </details>
  </section>;
}
