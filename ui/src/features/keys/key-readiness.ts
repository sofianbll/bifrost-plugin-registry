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
      : blocker.kind === "undiscovered"
        ? `${models} ${copy("not discovered", blocker.count === 1 ? "non découvert" : "non découverts")}`
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

// The decisions of the adoption dialog (spec #85): one per provider row (the key itself is ""), models to add
// left out since only the models page settles them. Decided: a provider kept in Bifrost (also one chosen to settle
// a collision), or a native edit made in the dialog that removed its row.
export function adoptionProgress(readiness: Readiness | undefined, kept: string[], edited: string[]) {
  const blockers = readiness?.blockers ?? [];
  const pending = new Set(
    blockers.filter(blocker => !blocker.kept && blocker.kind !== "unsaved").map(blocker => blocker.provider),
  );
  const decided = new Set(
    [...blockers.filter(blocker => blocker.kept).map(blocker => blocker.provider), ...kept, ...edited].filter(
      provider => !pending.has(provider),
    ),
  );
  return { decided: decided.size, total: decided.size + pending.size };
}

// Providers Bifrost reports as disabled, not kept yet: the dialog keeps them in Bifrost from the start.
export const disabledProviders = (readiness: Readiness | undefined) => [
  ...new Set(
    (readiness?.blockers ?? [])
      .filter(blocker => blocker.providerDisabled && !blocker.kept)
      .map(blocker => blocker.provider),
  ),
];
