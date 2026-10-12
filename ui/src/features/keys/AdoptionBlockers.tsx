import { Button } from "@/components/ui/button";
import { displayProvider } from "../../components/registry/BrandIcon";
import type { Readiness, ReadinessBlocker } from "../../domain/registry";
import { useCopy, type Copy } from "../../lib/locale";
import { blockerLine } from "./key-readiness";
import { NativeEditButton, nativeEditFor, type NativeEditRequest } from "./NativePermissionEdit";

// The server writes its adoption reasons as English text in about twenty places
// (internal/admin/adoption.go), so they are mapped to UI copy here, in one table:
// [pattern, English, French], with $1 for a capture and $& for the reason as sent.
// A reason missing from the table shows as sent.
const reasons: [RegExp, string, string][] = [
  [
    /^Dynamic native model allowlist is unsupported for (.+)$/,
    "$1: this key allows every model, including future ones, so it cannot be adopted as is.",
    "$1 : cette clé autorise tous les modèles, y compris les futurs, elle ne peut donc pas être adoptée telle quelle.",
  ],
  [
    /^Native key has no representable configured model access$/,
    "No configured access can be safely transferred to a Registry selection from this key.",
    "Aucun accès configuré de cette clé ne peut être repris fidèlement dans une sélection Registry.",
  ],
  [/^Native key identity changed$/, "$&", "L’identité de la clé native a changé."],
  [/^Native key is inactive or expired$/, "$&", "La clé native est inactive ou expirée."],
  [
    /^Native key is controlled by an external access profile$/,
    "$&",
    "La clé native dépend d’un profil d’accès externe.",
  ],
  [/^Full native key credential is unavailable$/, "$&", "Le secret complet de la clé native est indisponible."],
  [/^Registry policy is disabled$/, "$&", "La politique Registry est désactivée."],
  [
    /^Registry binding already matches the native key$/,
    "$&",
    "L’association Registry correspond déjà à la clé native.",
  ],
  [/^Native model readback is unavailable$/, "$&", "La relecture des modèles natifs est indisponible."],
  [
    /^Native model list differs from configured access; import or reconcile the missing routes first$/,
    "$&",
    "La liste des modèles natifs diffère des accès configurés ; importez ou réconciliez d’abord les routes manquantes.",
  ],
  [
    /^allow_all_providers grants future providers and cannot be represented safely$/,
    "This key allows every provider, including ones added later, and Registry cannot carry that over safely.",
    "Cette clé autorise tous les fournisseurs, y compris ceux ajoutés plus tard : Registry ne peut pas le reprendre fidèlement.",
  ],
  [/^Duplicate native model discovery for (.+)$/, "$&", "Modèle natif découvert en double pour $1."],
  [
    /^Native provider configuration is missing or duplicated$/,
    "$&",
    "Configuration native du fournisseur absente ou en double.",
  ],
  [
    /^Empty native allowed_models has version-dependent meaning for (.+)$/,
    "$&",
    "allowed_models vide pour $1 : sens variable selon la version de Bifrost.",
  ],
  [
    /^Empty native provider key list has version-dependent meaning for (.+)$/,
    "$&",
    "Liste de clés fournisseur vide pour $1 : sens variable selon la version de Bifrost.",
  ],
  [/^Dynamic native blacklist is unsupported for (.+)$/, "$&", "$1 : liste d’exclusion dynamique non prise en charge."],
  [/^Duplicate native model route (.+)$/, "$&", "Route de modèle native en double : $1."],
  [
    /^Native route (.+) is absent from provider discovery$/,
    "$&",
    "La route native $1 est absente de la découverte du fournisseur.",
  ],
  [/^No enabled native provider key for (.+)$/, "$&", "Aucune clé fournisseur native active pour $1."],
  [
    /^Model (\S+) is allowed through (.+?) and (.+): Registry adopts one access per model$/,
    "$&",
    "Le modèle $1 est autorisé via $2 et $3 : Registry n’adopte qu’un accès par modèle.",
  ],
  [
    /^Native route (.+) needs a configured direct Registry access with the same native name$/,
    "Native route $1 needs a configured direct Registry access with the same native name",
    "La route native $1 nécessite un accès Registry direct configuré, au même nom natif.",
  ],
];
export function adoptionReason(reason: string, copyText: Copy) {
  const known = reasons.find(([pattern]) => pattern.test(reason));
  return known ? reason.replace(known[0], copyText(known[1], known[2])) : reason;
}

// What stops a key from being adopted, as a short numbered list of decisions (spec #85): one row per provider
// (the key as a whole when it has its own blockers), each blocker with its count, its model names behind a
// disclosure, and the choices that resolve the row. Every row is required: the key cannot be adopted before.
// Unsaved models are no decision (only the models page settles them): they follow, unnumbered, under "Before
// adopting", with onShowToAdd. Choices: onKeep (#92) for undiscovered models, a provider
// that allows every model (dynamic) or a model allowed through two providers (collision, where either provider
// can be kept), and #93's native edits (NativeEditButton: remove models, replace "all models"/"all providers").
// A provider the preview keeps native comes back flagged `kept` and is shown by KeptProviders, not here.
export function AdoptionBlockers({
  readiness,
  reasons: plain,
  onShowToAdd,
  onKeep,
  onEditNative,
}: {
  readiness?: Readiness;
  reasons: string[];
  onShowToAdd?: (routes: string[]) => void;
  onKeep?: (provider: string, keep: boolean) => void;
  onEditNative?: (request: NativeEditRequest) => void;
}) {
  const copyText = useCopy();
  if (readiness?.state === "empty")
    return (
      <section className="rounded-sm border border-chart-warning/50 bg-chart-warning/10 p-3">
        <p>
          {copyText(
            "This key allows no model in Bifrost yet, so there is nothing to adopt. Add models to the key in Bifrost first.",
            "Cette clé n’autorise encore aucun modèle dans Bifrost : rien à adopter. Ajoutez d’abord des modèles à la clé dans Bifrost.",
          )}
        </p>
      </section>
    );
  const rows = new Map<string, ReadinessBlocker[]>();
  for (const blocker of readiness?.blockers ?? [])
    if (!blocker.kept && blocker.kind !== "unsaved")
      rows.set(blocker.provider, [...(rows.get(blocker.provider) ?? []), blocker]);
  // Models to add are settled on the models page, not here: listed apart, unnumbered (spec #85, critique round 2).
  const toAdd = (readiness?.blockers ?? []).filter(blocker => !blocker.kept && blocker.kind === "unsaved");
  const count = readiness ? rows.size : plain.length;
  const title = copyText(
    `${count} ${count === 1 ? "decision" : "decisions"} before adopting`,
    `${count} ${count === 1 ? "décision" : "décisions"} avant d’adopter`,
  );
  const before = copyText("Before adopting", "Avant d’adopter");
  return (
    <>
      {count > 0 && (
        <section aria-label={title} className="rounded-sm border border-chart-warning/50 bg-chart-warning/10 p-3">
          <h3 className="font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {count === 1
              ? copyText("It is required to adopt the key.", "Elle est nécessaire pour adopter la clé.")
              : copyText("Each one is required to adopt the key.", "Chacune est nécessaire pour adopter la clé.")}
          </p>
          <ol className="mt-2 list-decimal space-y-3 pl-5">
            {readiness
              ? [...rows].map(([provider, blockers]) => (
                  <DecisionRow
                    key={provider || "key"}
                    provider={provider}
                    blockers={blockers}
                    readiness={readiness}
                    onKeep={onKeep}
                    onEditNative={onEditNative}
                  />
                ))
              : plain.map((reason, index) => (
                  <li key={`${index}/${reason}`} className="break-words pl-1">
                    {adoptionReason(reason, copyText)}
                  </li>
                ))}
          </ol>
          {!readiness && plain.some(reason => reason.startsWith("Dynamic native model allowlist")) && (
            <p className="mt-3 text-xs">
              {copyText(
                "Keep this key as it is in Bifrost, or review a key that lists its models one by one. Registry cannot safely copy an “every model” permission.",
                "Gardez cette clé telle quelle dans Bifrost, ou examinez une clé qui liste ses modèles un par un. Registry ne sait pas reprendre fidèlement une permission « tous les modèles ».",
              )}
            </p>
          )}
        </section>
      )}
      {toAdd.length > 0 && (
        <section aria-label={before} className="space-y-3 rounded-sm border p-3">
          {toAdd.map(blocker => {
            const name = displayProvider(blocker.provider);
            return (
              <div key={blocker.provider}>
                <p className="font-medium">
                  {copyText(
                    `Before adopting: register ${blocker.count} ${name} ${blocker.count === 1 ? "model" : "models"}`,
                    `Avant d’adopter : enregistrer ${blocker.count} ${blocker.count === 1 ? "modèle" : "modèles"} ${name}`,
                  )}
                </p>
                <p className="text-xs">
                  {copyText(
                    "Bifrost lists these models, but Registry has no card for them yet.",
                    "Bifrost liste ces modèles, mais Registry n’a pas encore de fiche pour eux.",
                  )}
                </p>
                <ModelNames models={blocker.models} />
                {onShowToAdd && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => onShowToAdd(blocker.models.map(model => `${blocker.provider}/${model}`))}
                  >
                    {copyText("Show in To add", "Voir dans À ajouter")}
                    <span className="sr-only"> · {name}</span>
                  </Button>
                )}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

function ModelNames({ models }: { models: string[] }) {
  const copyText = useCopy();
  return (
    models.length > 0 && (
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer">{copyText("Show model names", "Afficher les noms des modèles")}</summary>
        <p className="mt-1 break-words font-mono">{models.join(", ")}</p>
      </details>
    )
  );
}

// One provider's blockers, then its choices: keep a provider in Bifrost, a native edit, or the models page.
function DecisionRow({
  provider,
  blockers,
  readiness,
  onKeep,
  onEditNative,
}: {
  provider: string;
  blockers: ReadinessBlocker[];
  readiness: Readiness;
  onKeep?: (provider: string, keep: boolean) => void;
  onEditNative?: (request: NativeEditRequest) => void;
}) {
  const copyText = useCopy();
  const name = displayProvider(provider);
  const keepable =
    !!onKeep && !!provider && blockers.some(blocker => ["undiscovered", "dynamic", "collision"].includes(blocker.kind));
  // A collision is resolved by keeping either provider: the other ones follow this row's own offer.
  const others = onKeep
    ? [...new Set(blockers.flatMap(blocker => (blocker.kind === "collision" ? (blocker.with ?? []) : [])))].filter(
        other => other !== provider,
      )
    : [];
  const edits = onEditNative ? blockers.filter(blocker => nativeEditFor(blocker, readiness)) : [];
  const choices = Number(keepable) + others.length + edits.length;
  const keepButton = (who: string) => (
    <Button
      key={who}
      type="button"
      variant="outline"
      size="sm"
      className="h-auto min-h-8 whitespace-normal text-left"
      onClick={() => onKeep!(who, true)}
    >
      {copyText(`Keep ${displayProvider(who)} in Bifrost`, `Garder ${displayProvider(who)} dans Bifrost`)}
    </Button>
  );
  return (
    <li className="pl-1">
      {blockers.map(blocker => (
        <div key={blocker.kind} className="mb-2 last:mb-0">
          {blocker.kind === "undiscovered" && blocker.providerDisabled ? (
            <>
              <p className="font-medium">
                {copyText(`${name} is disabled in Bifrost`, `${name} est désactivé dans Bifrost`)}
              </p>
              <p className="text-xs">
                {copyText(
                  `Bifrost lists none of its models, so Registry cannot hold the ${blocker.count === 1 ? "model" : `${blocker.count} models`} this key allows.`,
                  `Bifrost ne liste aucun de ses modèles : Registry ne peut pas reprendre ${blocker.count === 1 ? "le modèle" : `les ${blocker.count} modèles`} que cette clé autorise.`,
                )}
              </p>
            </>
          ) : blocker.kind === "undiscovered" || blocker.kind === "collision" ? (
            <>
              <p className="font-medium">{blockerLine(blocker, copyText)}</p>
              <p className="text-xs">
                {blocker.kind === "undiscovered"
                  ? copyText(
                      "Bifrost does not list these models, so Registry cannot hold an access for them.",
                      "Bifrost ne liste pas ces modèles : Registry ne peut pas leur associer d’accès.",
                    )
                  : copyText(
                      "Registry adopts one access per model: keep one of the providers in Bifrost, and Registry adopts the model through the other.",
                      "Registry n’adopte qu’un accès par modèle : gardez l’un des fournisseurs dans Bifrost, et Registry adopte le modèle via l’autre.",
                    )}
              </p>
            </>
          ) : (
            <>
              {blocker.kind !== "other" && <p className="font-medium">{blockerLine(blocker, copyText)}</p>}
              {(blocker.reasons ?? []).map((reason, index) => (
                <p key={`${index}/${reason}`} className="break-words">
                  {adoptionReason(reason, copyText)}
                </p>
              ))}
            </>
          )}
          <ModelNames models={blocker.models} />
        </div>
      ))}
      {choices > 0 && (
        <div className="mt-2 space-y-2">
          {choices > 1 && <p className="text-xs font-medium">{copyText("Choose one:", "Choisissez une option :")}</p>}
          {keepable && (
            <div>
              {keepButton(provider)}
              <p className="mt-1 text-xs">
                {copyText(
                  `Registry will not manage or change ${name}’s permissions, and the rest of the key is adopted.`,
                  `Registry ne gérera ni ne modifiera les permissions du fournisseur ${name}, et le reste de la clé est adopté.`,
                )}
              </p>
            </div>
          )}
          {others.length > 0 && <div className="flex flex-wrap gap-2">{others.map(keepButton)}</div>}
          {edits.map(blocker => (
            <NativeEditButton key={blocker.kind} blocker={blocker} readiness={readiness} onEdit={onEditNative} />
          ))}
        </div>
      )}
    </li>
  );
}
