import { displayProvider } from "../../components/registry/BrandIcon";
import type { Key, Readiness, ReadinessBlocker } from "../../domain/registry";
import type { Copy } from "../../lib/locale";

// What the Keys page filters on: managed keys are past adoption, "unknown" keys have no verdict yet.
export type ReadinessState = Readiness["state"] | "managed" | "unknown";
export const readinessState = (key: Key): ReadinessState => key.managed !== false ? "managed" : key.readiness?.state ?? "unknown";

export const readinessVariant = { ready: "success", blocked: "warning", empty: "secondary", unknown: "warning", managed: "success" } as const;

export const readinessLabel =(state: ReadinessState, copy: Copy) => ({
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
  const what = blocker.kind === "undiscovered" ? `${models} ${copy("not discovered", blocker.count === 1 ? "non découvert" : "non découverts")}`
    : blocker.kind === "unsaved" ? `${models} ${copy("to add", "à ajouter")}`
    : blocker.kind === "all-providers" ? copy("Every provider allowed", "Tous les fournisseurs autorisés")
    : blocker.kind === "dynamic" ? copy("all models allowed", "tous les modèles autorisés")
    : copy(provider ? "cannot be adopted as is" : "Cannot be adopted as is", provider ? "adoption impossible en l’état" : "Adoption impossible en l’état");
  return blocker.kind === "all-providers" || !provider && blocker.kind === "other" ? what : `${provider} · ${what}`;
}

// The card's short reason: the first two blockers, then how many more.
export function readinessReason(readiness: Readiness | undefined, copy: Copy) {
  if (readiness?.state !== "blocked") return "";
  const lines = readiness.blockers.slice(0, 2).map(blocker => blockerLine(blocker, copy));
  if (readiness.blockers.length > 2) lines.push(copy(`+${readiness.blockers.length - 2} more`, `+${readiness.blockers.length - 2}`));
  return lines.join(copy("; ", " ; "));
}

// The models the models page can add: discovered by Bifrost, no Registry card yet.
export const unsavedRoutes = (readiness: Readiness | undefined) => (readiness?.blockers ?? []).filter(blocker => blocker.kind === "unsaved").flatMap(blocker => blocker.models.map(model => `${blocker.provider}/${model}`));
