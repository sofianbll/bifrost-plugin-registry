import { displayProvider } from "../../components/registry/BrandIcon";
import type { Key, Readiness, ReadinessBlocker } from "../../domain/registry";
import type { Copy } from "../../lib/locale";

// What the Keys page filters on: managed keys are past adoption, "unknown" keys have no verdict yet.
export type ReadinessState = Readiness["state"] | "managed" | "unknown";
export const readinessState = (key: Key): ReadinessState =>
  key.managed !== false ? "managed" : (key.readiness?.state ?? "unknown");

export const readinessVariant = {
  ready: "success",
  blocked: "warning",
  empty: "secondary",
  unknown: "warning",
  managed: "success",
} as const;

export const readinessLabel = (state: ReadinessState, copy: Copy) =>
  ({
    ready: copy("Ready to adopt", "Prête à adopter"),
    blocked: copy("Blocked", "Bloquée"),
    empty: copy("Empty", "Vide"),
    unknown: copy("Adoption needed", "À adopter"),
    managed: copy("Managed", "Gérée"),
  })[state];

// One line per blocker: the provider, how many models, and what stops them.
export function blockerLine(blocker: ReadinessBlocker, copy: Copy) {
  const provider = blocker.provider ? displayProvider(blocker.provider) : "";
  const models = `${blocker.count} ${copy(blocker.count === 1 ? "model" : "models", blocker.count === 1 ? "modèle" : "modèles")}`;
  const what =
    blocker.kind === "undiscovered" && blocker.providerDisabled
      ? `${copy("disabled in Bifrost", "désactivé dans Bifrost")} · ${models}`
      : blocker.kind === "collision"
        ? `${models} ${copy("also allowed through", blocker.count === 1 ? "aussi autorisé via" : "aussi autorisés via")} ${(blocker.with ?? []).map(displayProvider).join(", ")}`
        : blocker.kind === "unsaved"
          ? `${models} ${copy("to add", "à ajouter")}`
          : blocker.kind === "all-providers"
            ? copy("Every provider allowed", "Tous les fournisseurs autorisés")
            : blocker.kind === "dynamic"
              ? copy("all models allowed", "tous les modèles autorisés")
              : copy(
                  provider ? "cannot be adopted as is" : "Cannot be adopted as is",
                  provider ? "adoption impossible en l’état" : "Adoption impossible en l’état",
                );
  // Plain words, as in the adoption dialog (#100): "Mistral: Bifrost doesn’t show 3 models".
  if (blocker.kind === "undiscovered" && !blocker.providerDisabled)
    return `${provider}${copy(": ", " : ")}${copy(`Bifrost doesn’t show ${models}`, `Bifrost ne montre pas ${models}`)}`;
  return blocker.kind === "all-providers" || (!provider && blocker.kind === "other") ? what : `${provider} · ${what}`;
}

// The card's short reason: the first two blockers, then how many more.
export function readinessReason(readiness: Readiness | undefined, copy: Copy) {
  if (readiness?.state !== "blocked") return "";
  const lines = readiness.blockers.slice(0, 2).map(blocker => blockerLine(blocker, copy));
  if (readiness.blockers.length > 2)
    lines.push(copy(`+${readiness.blockers.length - 2} more`, `+${readiness.blockers.length - 2}`));
  return lines.join(copy("; ", " ; "));
}

// The models the models page can add: discovered by Bifrost, no Registry card yet.
export const unsavedRoutes = (readiness: Readiness | undefined) =>
  (readiness?.blockers ?? [])
    .filter(blocker => blocker.kind === "unsaved")
    .flatMap(blocker => blocker.models.map(model => `${blocker.provider}/${model}`));

// What the adoption dialog can settle by a choice: keep a provider in Bifrost (models Bifrost does not show, every model
// allowed, a model allowed through two providers) or edit the key's "every provider" permission. Every other blocker
// (a key disabled or expired in Bifrost, an external profile) needs a change in Bifrost itself: it is a prerequisite, no
// decision, since no button of the dialog settles it. Models to add are the models page's, apart from both.
// nativeEdit is false in snapshot mode (#110): the dialog has no native-edit button there, so an "every provider"
// permission is a prerequisite, not a decision that could never be settled.
const keepable = ["undiscovered", "dynamic", "collision"];
export function splitBlockers(readiness: Readiness | undefined, nativeEdit = true) {
  const open = (readiness?.blockers ?? []).filter(blocker => !blocker.kept && blocker.kind !== "unsaved");
  const keeps = new Set(
    open.filter(blocker => blocker.provider && keepable.includes(blocker.kind)).map(b => b.provider),
  );
  const decisions = new Map<string, ReadinessBlocker[]>();
  const prerequisites: ReadinessBlocker[] = [];
  for (const blocker of open)
    if ((blocker.kind === "all-providers" && nativeEdit) || keeps.has(blocker.provider))
      decisions.set(blocker.provider, [...(decisions.get(blocker.provider) ?? []), blocker]);
    else prerequisites.push(blocker);
  return { decisions, prerequisites };
}

// The decisions of the adoption dialog (spec #85): one per row of splitBlockers (a provider, or the key itself, ""),
// models to add and blockers no choice settles left out. Decided: a provider kept in Bifrost (also one chosen to settle
// a collision), or a native edit made in the dialog that removed its row.
export function adoptionProgress(readiness: Readiness | undefined, kept: string[], edited: string[], nativeEdit = true) {
  const blockers = readiness?.blockers ?? [];
  const pending = new Set(splitBlockers(readiness, nativeEdit).decisions.keys());
  const decided = new Set(
    [...blockers.filter(blocker => blocker.kept).map(blocker => blocker.provider), ...kept, ...edited].filter(
      provider => !pending.has(provider),
    ),
  );
  return { decided: decided.size, total: decided.size + pending.size };
}

// The one count, said twice: the heading of the decisions and the footer next to Adopt. Both are written from the same
// adoptionProgress, rows decided from the start (a provider disabled in Bifrost) included, so they cannot disagree (#101).
// With nothing to decide the heading says so, not "0 decisions".
type Progress = ReturnType<typeof adoptionProgress>;
export const decisionsHeading = ({ decided, total }: Progress, copy: Copy) =>
  total === 0
    ? copy("Nothing to decide yet", "Rien à décider pour l’instant")
    : copy(
        `${total} ${total === 1 ? "decision" : "decisions"} before adopting${decided ? ` · ${decided} already made` : ""}`,
        `${total} ${total === 1 ? "décision" : "décisions"} avant d’adopter${decided ? ` · ${decided} ${decided === 1 ? "déjà prise" : "déjà prises"}` : ""}`,
      );
export const decidedLabel = ({ decided, total }: Progress, copy: Copy) =>
  copy(`${decided} of ${total} decided`, `${decided} sur ${total} ${total > 1 ? "décidées" : "décidée"}`);

// The reasons only a change in Bifrost settles (splitBlockers' prerequisites), as sent by the server, one per reason.
export const fixReasons = (readiness: Readiness | undefined, nativeEdit = true) =>
  splitBlockers(readiness, nativeEdit).prerequisites.flatMap(blocker => blocker.reasons ?? []);
const inactiveKey = (reason: string) => reason === "Native key is inactive or expired";
// The next step for such a reason, in the dialog, and the same as one clause for the footer beside Adopt.
export const fixStep = (reason: string, copy: Copy) =>
  inactiveKey(reason)
    ? copy(
        "Enable or renew this key in Bifrost, then press Refresh preview.",
        "Activez ou renouvelez cette clé dans Bifrost, puis appuyez sur Actualiser l’aperçu.",
      )
    : copy(
        "Fix this in Bifrost, then press Refresh preview.",
        "Corrigez cela dans Bifrost, puis appuyez sur Actualiser l’aperçu.",
      );
const fixClause = (reason: string, copy: Copy) =>
  inactiveKey(reason)
    ? copy("Enable or renew the key in Bifrost first", "Activez ou renouvelez d’abord la clé dans Bifrost")
    : copy("Fix the key in Bifrost first", "Corrigez d’abord la clé dans Bifrost");

// What has to happen outside the dialog before Adopt can work: models to register first, or the key to fix in Bifrost.
// Neither is a numbered decision (adoptionProgress leaves them out); the footer states them beside the decided count.
// One provider is named; several are summed ("Register 10 models first"), their names being in the section above.
export function prerequisiteLine(readiness: Readiness | undefined, copy: Copy, nativeEdit = true) {
  const unsaved = (readiness?.blockers ?? []).filter(blocker => blocker.kind === "unsaved" && !blocker.kept);
  const count = unsaved.reduce((sum, blocker) => sum + blocker.count, 0);
  const name = unsaved.length === 1 ? displayProvider(unsaved[0].provider) : "";
  const register = count
    ? copy(
        `Register ${count}${name && ` ${name}`} ${count === 1 ? "model" : "models"} first`,
        `Enregistrez d’abord ${count} ${count === 1 ? "modèle" : "modèles"}${name && ` ${name}`}`,
      )
    : "";
  const fixes = new Set(fixReasons(readiness, nativeEdit).map(reason => fixClause(reason, copy)));
  return [register, ...fixes].filter(Boolean).join(" · ");
}

// Providers Bifrost reports as disabled, not kept yet: the dialog keeps them in Bifrost from the start.
export const disabledProviders = (readiness: Readiness | undefined) => [
  ...new Set(
    (readiness?.blockers ?? [])
      .filter(blocker => blocker.providerDisabled && !blocker.kept)
      .map(blocker => blocker.provider),
  ),
];
