import { useId } from "react";
import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayProvider } from "../../components/registry/BrandIcon";
import { exposed, members, retainedAccesses, type Group, type Key, type Model } from "../../domain/registry";
import { useCopy, useFormat, type Copy } from "../../lib/locale";
import { permissionSummary } from "./KeyComposer.state";
import { KeyPermissions } from "./KeyPermissions";

// What a managed key can call (#99): one row per model, counted once whatever the subscriptions that serve it. A
// model is its common ID (a card's alias or ID; a kept name without a card is its own). Registry routes come from
// the selection (a model waiting for an access choice is not published); kept providers add the models Bifrost
// allows them. Once Bifrost has listed the key's IDs, a kept route it does not list (a name its provider does not
// list) is flagged, not counted, and is a difference; it is not drift, which stays Registry's own check. A kept
// provider that allows every model, depends on the Bifrost version, or was not read yet leaves the total open
// ("at least N"). The editor's "N models selected" counts the cards chosen there; kept models are not among them.
export type LedgerRow = {
  id: string;
  name: string;
  via: string[];
  unlisted: string[];
  open?: "all" | "version" | "unread";
};
export function keyLedger(key: Key, models: Model[], groups: Group[]) {
  const rows = new Map<string, LedgerRow>();
  const add = (id: string, name: string, provider: string, listed = true) => {
    const row = rows.get(id) ?? { id, name, via: [], unlisted: [] };
    const list = listed ? row.via : row.unlisted;
    if (!row.via.includes(provider) && !list.includes(provider)) list.push(provider);
    rows.set(id, row);
  };
  const pending = Object.keys(key.pendingAccessSelection ?? {});
  for (const id of members(key.policy, groups)) {
    const model = models.find(item => item.id === id);
    if (!model || pending.includes(model.alias || model.id)) continue;
    const { known } = retainedAccesses(model, key.policy);
    for (const access of model.accesses.filter(item => known.includes(item.id)))
      add(model.alias || model.id, model.name || model.id, access.provider);
  }
  const publication = key.publication;
  const actual = publication && publication.state !== "not_verified" ? publication.actual : null;
  const open: LedgerRow[] = [];
  for (const provider of key.policy.keptNative ?? []) {
    const permission = key.permissions?.providers.find(item => item.provider === provider);
    const row = { id: "", name: "", via: [provider], unlisted: [] };
    if (!key.permissions || (!permission && !key.permissions.allProviders)) {
      open.push({ ...row, open: "unread" });
      continue;
    }
    if (!permission || permission.allModels) {
      open.push({ ...row, open: "all" });
      continue;
    }
    if (permission.versionDependent) {
      open.push({ ...row, open: "version" });
      continue;
    }
    for (const name of permission.models) {
      const card =
        models.find(model => model.accesses.some(access => access.id === `${provider}/${name}`)) ??
        models.find(model => (model.alias || model.id) === name);
      add(
        card ? card.alias || card.id : name,
        card?.name || name,
        provider,
        !actual || actual.includes(`${provider}/${name}`),
      );
    }
  }
  const sorted = [...rows.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  for (const row of sorted)
    for (const list of [row.via, row.unlisted])
      list.sort((a, b) => displayProvider(a).localeCompare(displayProvider(b)));
  return {
    total: sorted.filter(row => row.via.length).length,
    open: open.length > 0,
    differences: sorted.reduce((sum, row) => sum + row.unlisted.length, 0),
    // Provider counts beyond the first, over the models several providers serve: what "Bifrost allows today" counts
    // more than the total.
    shared: sorted.reduce((sum, row) => sum + Math.max(0, row.via.length - 1), 0),
    rows: [...sorted, ...open],
  };
}

// The "M models" of "Bifrost allows today": per provider, so a model several providers serve counts once each. Same
// count as permissionSummary; null when that line shows none (every provider, or only providers read as a whole).
const bifrostModelCount = (permissions: Key["permissions"]) => {
  const listed =
    permissions && !permissions.allProviders
      ? permissions.providers.filter(p => !p.allModels && !p.versionDependent)
      : [];
  return listed.length ? listed.reduce((sum, p) => sum + p.models.length, 0) : null;
};
const modelCount = (count: number, copy: Copy) =>
  `${count} ${copy(count === 1 ? "model" : "models", count === 1 ? "modèle" : "modèles")}`;
// The single total, on the key page and on its card: "5 models", "at least 2 models".
export const ledgerTotal = (ledger: ReturnType<typeof keyLedger>, copy: Copy) =>
  `${ledger.open ? copy("at least ", "au moins ") : ""}${modelCount(ledger.total, copy)}`;
// A kept route Bifrost does not list (#99): "1 difference", never a plain "Verified".
export const differenceCount = (count: number, copy: Copy) =>
  `${count} ${copy(count === 1 ? "difference" : "differences", count === 1 ? "écart" : "écarts")}`;
// Whether Bifrost confirmed the published selection, in plain words.
export const checkState = (key: Key, copy: Copy, differences = 0) =>
  key.publication?.state === "verified"
    ? `${copy("Verified", "Vérifiée")}${differences ? ` · ${differenceCount(differences, copy)}` : ""}`
    : key.publication?.state === "drift"
      ? copy("Differences found", "Écarts trouvés")
      : copy("Not checked yet", "Pas encore vérifiée");
// What "Verified · 1 difference" means (ADR 0001, #99), said once: Bifrost confirmed the key, and the permissions kept in
// Bifrost that its list leaves out are the differences. Empty without difference. checkDifferenceNote gates it like
// checkState does (only a verified key reads differences), so the note and the count always come together.
export const differenceNote = (count: number, copy: Copy) =>
  count
    ? copy(
        `Bifrost confirmed this key. ${count} ${count === 1 ? "permission kept in Bifrost is" : "permissions kept in Bifrost are"} not listed by Bifrost.`,
        `Bifrost a confirmé cette clé. ${count} ${count === 1 ? "permission conservée dans Bifrost n’est pas listée" : "permissions conservées dans Bifrost ne sont pas listées"} par Bifrost.`,
      )
    : "";
export const checkDifferenceNote = (key: Key, copy: Copy, differences = 0) =>
  key.publication?.state === "verified" ? differenceNote(differences, copy) : "";

// The check as a chip (key card, table, publication card): its explanation is the tooltip for the mouse and a hidden
// sentence the chip is described by for assistive technology, next to the chip so its own text stays "Verified · 1 difference".
export function CheckBadge({
  virtualKey,
  differences,
  idle,
}: {
  virtualKey: Key;
  differences: number;
  // The variant before any verdict: the card outlines it, the publication card keeps it secondary.
  idle: "outline" | "secondary";
}) {
  const copy = useCopy();
  const id = useId();
  const state = virtualKey.publication?.state;
  const note = checkDifferenceNote(virtualKey, copy, differences);
  return (
    <>
      <Badge
        variant={
          state === "verified" && !differences
            ? "success"
            : state === "drift" || state === "verified"
              ? "warning"
              : idle
        }
        title={note || undefined}
        aria-describedby={note ? id : undefined}
      >
        {checkState(virtualKey, copy, differences)}
      </Badge>
      {note && (
        <span id={id} className="sr-only">
          {note}
        </span>
      )}
    </>
  );
}

// What a check does, said once for the key page and the editor.
export const checkNote = (copy: Copy) =>
  copy(
    "Checked with Bifrost: Registry asks Bifrost which model IDs this key lists. The models are not called.",
    "Vérifié avec Bifrost : Registry demande à Bifrost quels ID de modèles cette clé liste. Les modèles ne sont pas appelés.",
  );

// The check button: "Check with Bifrost" until Bifrost was asked about the key, then "Check again". A verdict, an
// attempt on record or listed IDs say it was asked; a verified key can list no ID, and an edit clears the time but
// keeps the IDs last read, so the IDs alone are not the test.
export const checkLabel = (key: Key, ids: string[], copy: Copy) => {
  const publication = key.publication;
  const asked = ids.length > 0 || (!!publication && (publication.state !== "not_verified" || !!publication.checkedAt));
  return asked ? copy("Check again", "Vérifier à nouveau") : copy("Check with Bifrost", "Vérifier avec Bifrost");
};

// The one sentence for a check that gave no answer, wherever it is told (a stored error, a toast).
export const checkFailed = (copy: Copy) =>
  copy("Could not check with Bifrost.", "Vérification avec Bifrost impossible.");

// The toast after a check that confirmed the key: never a plain "Verified" while Bifrost does not list a kept route.
export const verifiedToast = (copy: Copy, differences: number, published = false) =>
  `${
    published
      ? copy("Published and verified with Bifrost", "Publié et vérifié avec Bifrost")
      : copy("Verified with Bifrost", "Vérifiée avec Bifrost")
  }${differences ? ` · ${differenceCount(differences, copy)}` : ""}.`;

// Why the editor's "N models selected" can be lower than the key page total (ADR 0001): a kept provider's models
// are Bifrost's, so the editor does not count them.
export const keptNote = (kept: string[], copy: Copy, colon: string) =>
  `${copy("Kept in Bifrost", "Conservé dans Bifrost")}${colon} ${kept.map(displayProvider).join(", ")}. ${copy(
    "Registry does not change these permissions; Edit selection counts only the models you choose there.",
    "Registry ne modifie pas ces permissions ; Modifier la sélection ne compte que les modèles que vous y choisissez.",
  )}`;

type Props = {
  virtualKey: Key;
  models: Model[];
  groups: Group[];
  busy: boolean;
  snapshotMode: boolean;
  onReread: () => void;
};
// The managed key page opens read-first on one ledger; the technical check (Bifrost's own permissions,
// story 36, and the IDs Bifrost lists for the key) waits in one fold.
export function KeySummary({ virtualKey, models, groups, busy, snapshotMode, onReread }: Props) {
  const copy = useCopy();
  const { colon, day, moment } = useFormat();
  const noteId = useId();
  const ledger = keyLedger(virtualKey, models, groups);
  const publication = virtualKey.publication;
  const pending = Object.entries(virtualKey.pendingAccessSelection || {});
  const ids = snapshotMode
    ? exposed(virtualKey.policy, groups, models)
    : virtualKey.observed || publication?.actual || [];
  const total = ledgerTotal(ledger, copy);
  // Until Bifrost has been asked, the list is Registry's plan, not a confirmed fact: the headline says so and the
  // check sits beside it, not only in the fold (critique round 5).
  const unchecked = !snapshotMode && publication?.state !== "verified" && publication?.state !== "drift";
  const headline =
    ledger.total || ledger.open
      ? copy(`This key can call ${total}`, `Cette clé peut appeler ${total}`)
      : copy("This key cannot call any model yet", "Cette clé ne peut encore appeler aucun modèle");
  // A key that can call nothing claims no list to confirm: only the check stays beside it.
  const headlineSaysUnchecked = unchecked && (ledger.total > 0 || ledger.open);
  const title = headlineSaysUnchecked ? `${headline} · ${copy("not checked yet", "pas encore vérifiée")}` : headline;
  const checkButton = (
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onReread}>
      <RotateCcw className="size-3.5" />
      {checkLabel(virtualKey, ids, copy)}
    </Button>
  );
  const openRow = (row: LedgerRow) =>
    row.open === "all"
      ? copy("All models Bifrost allows", "Tous les modèles autorisés par Bifrost")
      : row.open === "version"
        ? copy("Depends on the Bifrost version", "Selon la version de Bifrost")
        : copy("Not read yet", "Pas encore lus");
  const verdict = snapshotMode
    ? copy("saved in this local copy", "enregistrée dans cette copie locale")
    : publication?.state === "verified" && publication.checkedAt
      ? `${copy(`Verified ${day(publication.checkedAt)}`, `Vérifiée le ${day(publication.checkedAt)}`)}${ledger.differences ? ` · ${differenceCount(ledger.differences, copy)}` : ""}`
      : checkState(virtualKey, copy, ledger.differences);
  // The verdict in the fold's summary reads "Verified … · 1 difference": the tooltip and the hidden sentence explain it.
  const verdictNote = snapshotMode ? "" : checkDifferenceNote(virtualKey, copy, ledger.differences);
  const kept = virtualKey.policy.keptNative ?? [];
  // Two models can share a display name (different cards): their common ID, in Basic too, tells them apart.
  const names = ledger.rows.filter(row => !row.open).map(row => row.name);
  const sameName = new Set(names.filter((name, index) => names.indexOf(name) !== index));
  // "Counted per provider" explains a count above the total only when a model several providers serve is the cause:
  // a flagged kept row is in Bifrost's count and not in the total, and explains itself.
  const bifrostModels = bifrostModelCount(virtualKey.permissions);
  const countedPerProvider =
    bifrostModels !== null && ledger.shared > 0 && bifrostModels - ledger.total - ledger.differences > 0;
  const naming =
    virtualKey.policy.naming === "both"
      ? copy("both", "les deux")
      : virtualKey.policy.naming === "model"
        ? copy("model", "modèle")
        : copy("provider/model", "fournisseur/modèle");
  return (
    <section aria-labelledby={`ledger-${virtualKey.id}`} className="space-y-4 rounded-sm border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`ledger-${virtualKey.id}`} className="text-base font-semibold">
          {title}
        </h2>
        {unchecked && checkButton}
      </div>
      {ledger.rows.length ? (
        <ul className="divide-y text-sm">
          {ledger.rows.map(row => (
            <li key={row.open ? `open-${row.via[0]}` : row.id} className="py-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="min-w-0 break-words">
                  {row.open ? openRow(row) : row.name}
                  {sameName.has(row.name) && (
                    <span className="ml-2 break-all font-mono text-xs text-muted-foreground">{row.id}</span>
                  )}
                </span>
                {row.via.length > 0 && (
                  <span className="text-xs text-muted-foreground">via {row.via.map(displayProvider).join(", ")}</span>
                )}
              </div>
              {row.unlisted.map(provider => (
                <p key={provider} className="text-xs text-chart-warning-ink">
                  {displayProvider(provider)}
                  {colon} {copy("Bifrost does not list this one", "Bifrost ne liste pas celui-ci")}
                </p>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {copy(
            "No model selected yet. Use Edit selection to choose some.",
            "Aucun modèle choisi pour l’instant. Utilisez Modifier la sélection pour en choisir.",
          )}
        </p>
      )}
      {kept.length > 0 && <p className="text-xs text-muted-foreground">{keptNote(kept, copy, colon)}</p>}
      {pending.length > 0 && (
        <div role="alert" className="space-y-1 text-xs text-chart-warning-ink">
          <p>
            {copy(
              "Several accesses offer these models and none is chosen, so this key does not publish them. In the model's Accesses list, uncheck the accesses this key must not use.",
              "Plusieurs accès proposent ces modèles et aucun n’est choisi : cette clé ne les publie pas. Dans la liste Accès du modèle, décochez ceux que cette clé ne doit pas utiliser.",
            )}
          </p>
          {pending.map(([alias, accesses]) => (
            <p key={alias} className="break-all font-mono">
              {alias} · {accesses.join(" · ")}
            </p>
          ))}
        </div>
      )}
      {!snapshotMode && publication?.error && (
        <p role="alert" className="text-xs text-chart-warning-ink">
          {publication.error}
        </p>
      )}
      {!snapshotMode && publication?.state === "drift" && (
        <p className="text-xs text-destructive">
          {copy(
            `Bifrost does not match this selection: ${publication.missing.length} missing, ${publication.unexpected.length} unexpected. Details in the technical check.`,
            `Bifrost ne correspond pas à cette sélection : ${publication.missing.length} manquant(s), ${publication.unexpected.length} inattendu(s). Détails dans la vérification technique.`,
          )}
        </p>
      )}
      {verdictNote && (
        <span id={noteId} className="sr-only">
          {verdictNote}
        </span>
      )}
      <details className="border-t pt-3 text-sm">
        <summary
          className="cursor-pointer font-medium"
          title={verdictNote || undefined}
          aria-describedby={verdictNote ? noteId : undefined}
        >
          {copy("Technical check", "Vérification technique")}
          {/* The headline already says "not checked yet": the fold does not repeat it. */}
          {!headlineSaysUnchecked && ` · ${verdict}`}
        </summary>
        <div className="mt-3 space-y-3">
          {snapshotMode ? (
            <p className="text-xs text-muted-foreground">
              {copy(
                "Changes stay in this copy; Bifrost cannot be checked from here.",
                "Les changements restent dans cette copie ; Bifrost ne peut pas être vérifié d’ici.",
              )}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{checkNote(copy)}</p>
              <div className="flex flex-wrap items-center gap-2">
                {/* While the key is unchecked its button sits beside the headline; here it only checks again. */}
                {!unchecked && checkButton}
                {publication?.checkedAt && (
                  <span className="break-all text-xs text-muted-foreground">
                    {moment(publication.checkedAt)} · {copy("revision", "révision")} {publication.revision.slice(0, 12)}
                  </span>
                )}
              </div>
              {publication?.state === "drift" && (
                <p className="break-all text-xs text-destructive">
                  {copy("Missing", "Manquants")}
                  {colon} {publication.missing.join(", ") || "—"} · {copy("Unexpected", "Inattendus")}
                  {colon} {publication.unexpected.join(", ") || "—"}
                </p>
              )}
            </>
          )}
          <div>
            <p className="text-xs font-medium">
              {snapshotMode
                ? copy("Saved model IDs", "ID de modèles enregistrés")
                : copy("Model IDs Bifrost lists for this key", "ID de modèles que Bifrost liste pour cette clé")}{" "}
              · {copy("ID format", "Format des ID")} {naming}
            </p>
            <ul className="mt-1 max-h-36 space-y-1 overflow-auto">
              {ids.map((id, index) => (
                <li key={`${id}-${index}`} className="break-all font-mono text-xs">
                  {id}
                </li>
              ))}
              {!ids.length && (
                <li className="text-xs text-muted-foreground">
                  {snapshotMode
                    ? copy("No saved model IDs.", "Aucun ID de modèle enregistré.")
                    : copy("Not checked with Bifrost yet.", "Pas encore vérifiée avec Bifrost.")}
                </li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium">
              {copy("Bifrost allows today", "Bifrost autorise aujourd’hui")} ·{" "}
              {permissionSummary(virtualKey.permissions, copy)}
            </p>
            {countedPerProvider && (
              <p className="mt-1 text-xs text-muted-foreground">
                {copy(
                  "Counted per provider; a model served by several providers counts once above.",
                  "Compté par fournisseur ; un modèle servi par plusieurs fournisseurs compte une seule fois plus haut.",
                )}
              </p>
            )}
            <KeyPermissions permissions={virtualKey.permissions} />
          </div>
        </div>
      </details>
    </section>
  );
}
