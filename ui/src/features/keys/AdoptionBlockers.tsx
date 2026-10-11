import { Button } from "@/components/ui/button";
import { displayProvider } from "../../components/registry/BrandIcon";
import type { Readiness } from "../../domain/registry";
import { useCopy, type Copy } from "../../lib/locale";
import { blockerLine } from "./key-readiness";
import { NativeEditButton, type NativeEditRequest } from "./NativePermissionEdit";

// The server writes its adoption reasons as English text in about twenty places
// (internal/admin/adoption.go), so they are mapped to UI copy here, in one table:
// [pattern, English, French], with $1 for a capture and $& for the reason as sent.
// A reason missing from the table shows as sent.
const reasons: [RegExp, string, string][] = [
  [/^Dynamic native model allowlist is unsupported for (.+)$/, "$1: dynamic model list; adoption is unsupported.", "$1 : liste de modèles dynamique ; adoption non prise en charge."],
  [/^Native key has no representable configured model access$/, "No configured access can be safely transferred to a Registry selection from this key.", "Aucun accès configuré de cette clé ne peut être repris fidèlement dans une sélection Registry."],
  [/^Native key identity changed$/, "$&", "L’identité de la clé native a changé."],
  [/^Native key is inactive or expired$/, "$&", "La clé native est inactive ou expirée."],
  [/^Native key is controlled by an external access profile$/, "$&", "La clé native dépend d’un profil d’accès externe."],
  [/^Full native key credential is unavailable$/, "$&", "Le secret complet de la clé native est indisponible."],
  [/^Registry policy is disabled$/, "$&", "La politique Registry est désactivée."],
  [/^Registry binding already matches the native key$/, "$&", "L’association Registry correspond déjà à la clé native."],
  [/^Native model readback is unavailable$/, "$&", "La relecture des modèles natifs est indisponible."],
  [/^Native model list differs from configured access; import or reconcile the missing routes first$/, "$&", "La liste des modèles natifs diffère des accès configurés ; importez ou réconciliez d’abord les routes manquantes."],
  [/^allow_all_providers grants future providers and cannot be represented safely$/, "$&", "allow_all_providers accorde aussi les futurs fournisseurs : impossible de le reprendre fidèlement."],
  [/^Duplicate native model discovery for (.+)$/, "$&", "Modèle natif découvert en double pour $1."],
  [/^Native provider configuration is missing or duplicated$/, "$&", "Configuration native du fournisseur absente ou en double."],
  [/^Empty native allowed_models has version-dependent meaning for (.+)$/, "$&", "allowed_models vide pour $1 : sens variable selon la version de Bifrost."],
  [/^Empty native provider key list has version-dependent meaning for (.+)$/, "$&", "Liste de clés fournisseur vide pour $1 : sens variable selon la version de Bifrost."],
  [/^Dynamic native blacklist is unsupported for (.+)$/, "$&", "$1 : liste d’exclusion dynamique non prise en charge."],
  [/^Duplicate native model route (.+)$/, "$&", "Route de modèle native en double : $1."],
  [/^Native route (.+) is absent from provider discovery$/, "$&", "La route native $1 est absente de la découverte du fournisseur."],
  [/^No enabled native provider key for (.+)$/, "$&", "Aucune clé fournisseur native active pour $1."],
  [/^Model (\S+) is allowed through (.+?) and (.+): Registry adopts one access per model$/, "$&", "Le modèle $1 est autorisé via $2 et $3 : Registry n’adopte qu’un accès par modèle."],
  [/^Native route (.+) needs a configured direct Registry access with the same native name$/, "Native route $1 needs a configured direct Registry access with the same native name", "La route native $1 nécessite un accès Registry direct configuré, au même nom natif."],
];
export function adoptionReason(reason: string, copyText: Copy) {
  const known = reasons.find(([pattern]) => pattern.test(reason));
  return known ? reason.replace(known[0], copyText(known[1], known[2])) : reason;
}

// What stops a key from being adopted, one entry per provider and kind, with counts and model names.
// Models Bifrost lists but Registry has no card for lead to the models page ("To add").
// Actions sit beside their blocker line: onShowToAdd for unsaved models, onKeep (#92) for undiscovered ones.
// A provider the preview keeps native comes back flagged `kept` and is shown by KeptProviders, not here.
// #93's native edits (remove models from the key, replace "all providers") are NativeEditButton, the last child of each blocker's <li>.
export function AdoptionBlockers({ readiness, reasons: plain, onShowToAdd, onKeep, onEditNative }: { readiness?: Readiness; reasons: string[]; onShowToAdd?: (routes: string[]) => void; onKeep?: (provider: string, keep: boolean) => void; onEditNative?: (request: NativeEditRequest) => void }) {
  const copyText = useCopy();
  return <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-3"><h3 className="font-medium">{copyText("Before continuing", "Avant de continuer")}</h3>
    {readiness?.state === "empty" ? <p className="mt-1">{copyText("This key allows no model in Bifrost yet, so there is nothing to adopt. Add models to the key in Bifrost first.", "Cette clé n’autorise encore aucun modèle dans Bifrost : rien à adopter. Ajoutez d’abord des modèles à la clé dans Bifrost.")}</p>
    : readiness ? <ul className="mt-2 space-y-3">{readiness.blockers.filter(blocker => !blocker.kept).map(blocker => {
      const names = <details className="mt-1 text-xs"><summary className="cursor-pointer">{copyText("Show model names", "Afficher les noms des modèles")}</summary><p className="mt-1 break-words font-mono">{blocker.models.join(", ")}</p></details>;
      return <li key={`${blocker.provider}/${blocker.kind}`}>
        {blocker.kind === "undiscovered" || blocker.kind === "unsaved" ? <>
          <p className="font-medium">{blockerLine(blocker, copyText)}</p>
          <p className="text-xs">{blocker.kind === "undiscovered" ? copyText("Bifrost does not list these models, so Registry cannot hold an access for them. The provider may be disabled in Bifrost.", "Bifrost ne liste pas ces modèles : Registry ne peut pas leur associer d’accès. Le fournisseur est peut-être désactivé dans Bifrost.") : copyText("Bifrost lists these models, but Registry has no card for them yet.", "Bifrost liste ces modèles, mais Registry n’a pas encore de fiche pour eux.")}</p>
          {names}
          {blocker.kind === "undiscovered" && onKeep && blocker.provider && <>
            <p className="mt-2 text-xs">{copyText(`Or keep ${displayProvider(blocker.provider)} in Bifrost: Registry will not manage or change ${displayProvider(blocker.provider)}’s permissions, and the rest of the key is adopted.`, `Ou gardez ${displayProvider(blocker.provider)} dans Bifrost : Registry ne gérera ni ne modifiera les permissions du fournisseur ${displayProvider(blocker.provider)}, et le reste de la clé est adopté.`)}</p>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => onKeep(blocker.provider, true)}>{copyText(`Keep ${displayProvider(blocker.provider)} in Bifrost`, `Garder ${displayProvider(blocker.provider)} dans Bifrost`)}</Button>
          </>}
          {blocker.kind === "unsaved" && onShowToAdd && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => onShowToAdd(blocker.models.map(model => `${blocker.provider}/${model}`))}>{copyText("Show in To add", "Voir dans À ajouter")}<span className="sr-only"> · {displayProvider(blocker.provider)}</span></Button>}
        </> : (blocker.reasons ?? []).map((reason, index) => <p key={`${index}/${reason}`} className="break-words">{adoptionReason(reason, copyText)}</p>)}
        <NativeEditButton blocker={blocker} readiness={readiness} onEdit={onEditNative} />
      </li>;
    })}</ul>
    : plain.map((reason, index) => <p key={`${index}/${reason}`} className="mt-2 break-words">{adoptionReason(reason, copyText)}</p>)}
    {plain.some(reason => reason.startsWith("Dynamic native model allowlist")) && <p className="mt-3 text-xs">{copyText("Keep this native key as it is, or review a key with explicit model permissions. Registry cannot safely reproduce this dynamic selection.", "Gardez cette clé native en l’état, ou examinez une clé aux permissions de modèles explicites. Registry ne sait pas reproduire fidèlement cette sélection dynamique.")}</p>}
  </div>;
}
