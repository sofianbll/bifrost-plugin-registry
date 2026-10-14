import { useState } from "react";
import { Button } from "@/components/ui/button";
import { displayProvider } from "../../components/registry/BrandIcon";
import type { Readiness, ReadinessBlocker } from "../../domain/registry";
import { useCopy, useFormat, type Copy } from "../../lib/locale";
import { adoptionProgress, blockerLine, decisionsHeading, fixReasons, fixStep, splitBlockers } from "./key-readiness";
import { NativeEditButton, nativeEditFor, type NativeEditRequest } from "./NativePermissionEdit";

// The server writes its adoption reasons as English text in about twenty places
// (internal/admin/adoption.go), so they are mapped to UI copy here, in one table:
// [pattern, English, French], with $1 for a capture and $& for the reason as sent.
// A reason missing from the table shows as sent.
const reasons: [RegExp, string, string][] = [
  [
    /^Dynamic native model allowlist is unsupported for (.+)$/,
    "$1: this key allows every model, including future ones, so Registry can’t copy it as is.",
    "$1 : cette clé autorise tous les modèles, y compris les futurs : Registry ne peut pas la reprendre telle quelle.",
  ],
  [
    /^Native key has no representable configured model access$/,
    "None of this key’s models can be copied into Registry as they are.",
    "Aucun modèle de cette clé ne peut être repris tel quel dans Registry.",
  ],
  [/^Native key identity changed$/, "This key changed in Bifrost.", "Cette clé a changé dans Bifrost."],
  [
    /^Native key is inactive or expired$/,
    "This key is disabled or expired in Bifrost.",
    "Cette clé est désactivée ou expirée dans Bifrost.",
  ],
  [
    /^Native key is controlled by an external access profile$/,
    "This key’s permissions come from an external profile.",
    "Les permissions de cette clé viennent d’un profil externe.",
  ],
  [
    /^Full native key credential is unavailable$/,
    "Registry can’t read this key’s full secret.",
    "Registry ne peut pas lire le secret complet de cette clé.",
  ],
  [/^Registry policy is disabled$/, "This key is turned off in Registry.", "Cette clé est désactivée dans Registry."],
  [
    /^Registry binding already matches the native key$/,
    "This key is already linked to Registry.",
    "Cette clé est déjà liée à Registry.",
  ],
  [
    /^Native model readback is unavailable$/,
    "Registry couldn’t read this key’s models from Bifrost.",
    "Registry n’a pas pu lire les modèles de cette clé dans Bifrost.",
  ],
  [
    /^Native model list differs from configured access; import or reconcile the missing routes first$/,
    "The models this key allows don’t match what Bifrost shows; register or fix the missing models first.",
    "Les modèles autorisés par cette clé ne correspondent pas à ce que montre Bifrost ; enregistrez ou corrigez d’abord les modèles manquants.",
  ],
  [
    /^allow_all_providers grants future providers and cannot be represented safely$/,
    "This key allows every provider, including ones added later, so Registry can’t copy it safely.",
    "Cette clé autorise tous les fournisseurs, y compris ceux ajoutés plus tard : Registry ne peut pas la reprendre fidèlement.",
  ],
  [/^Duplicate native model discovery for (.+)$/, "Bifrost shows $1 twice.", "Bifrost montre $1 deux fois."],
  [
    /^Native provider configuration is missing or duplicated$/,
    "A provider of this key is missing or set up twice in Bifrost.",
    "Un fournisseur de cette clé est absent ou configuré deux fois dans Bifrost.",
  ],
  [
    /^Empty native allowed_models has version-dependent meaning for (.+)$/,
    "$1: this key lists no model, and Bifrost versions read that differently.",
    "$1 : cette clé ne liste aucun modèle, ce que les versions de Bifrost lisent différemment.",
  ],
  [
    /^Empty native provider key list has version-dependent meaning for (.+)$/,
    "$1: no provider key is listed, and Bifrost versions read that differently.",
    "$1 : aucune clé fournisseur n’est listée, ce que les versions de Bifrost lisent différemment.",
  ],
  [
    /^Dynamic native blacklist is unsupported for (.+)$/,
    "$1: this key blocks models by a rule Registry can’t copy.",
    "$1 : cette clé exclut des modèles par une règle que Registry ne sait pas reprendre.",
  ],
  [/^Duplicate native model route (.+)$/, "$1 appears twice in this key.", "$1 apparaît deux fois dans cette clé."],
  [
    /^Native route (.+) is absent from provider discovery$/,
    "Bifrost doesn’t show $1, so Registry can’t manage it.",
    "Bifrost ne montre pas $1 : Registry ne peut donc pas le gérer.",
  ],
  [
    /^No enabled native provider key for (.+)$/,
    "No provider key is turned on for $1 in Bifrost.",
    "Aucune clé fournisseur n’est active pour $1 dans Bifrost.",
  ],
  [
    /^Model (\S+) is allowed through (.+?) and (.+): Registry adopts one access per model$/,
    "$1 is allowed through $2 and $3, and Registry uses one subscription per model.",
    "$1 est autorisé via $2 et $3 : Registry n’utilise qu’un abonnement par modèle.",
  ],
  [
    /^Native route (.+) needs a configured direct Registry access with the same native name$/,
    "$1 has no Registry card with the same model name yet.",
    "$1 n’a pas encore de fiche Registry au même nom de modèle.",
  ],
];
export function adoptionReason(reason: string, copyText: Copy) {
  const known = reasons.find(([pattern]) => pattern.test(reason));
  return known ? reason.replace(known[0], copyText(known[1], known[2])) : reason;
}

// What stops a key from being adopted, as a short numbered list of decisions (spec #85): one row per provider
// (the key as a whole when it has its own blockers), each blocker with its count, the models it concerns named in
// the line (three, then "+N"), and the choices that resolve the row. Every row is required: the key cannot be adopted before.
// Unsaved models are no decision (only the models page settles them): they follow, unnumbered, under "Before
// adopting", with onShowToAdd. Neither is a blocker no choice settles (a key disabled or expired in Bifrost): it is
// listed there too, with the next step in plain words, and the heading reads "Nothing to decide yet" when no
// decision is left. Choices: onKeep (#92) for undiscovered models, a provider
// that allows every model (dynamic) or a model allowed through two providers (collision, where either provider
// can be kept), and #93's native edits (NativeEditButton: remove models, replace "all models"/"all providers").
// A provider the preview keeps native comes back flagged `kept` and is shown by KeptProviders, not here.
// The heading counts every decision of the dialog, the ones already made included (a provider disabled in Bifrost is
// kept from the start), from the same `progress` as the dialog's footer ("n of N decided"), so the two always agree.
// A choice button in `kept` is shown pressed (aria-pressed), like a selected Toggle segment.
export function AdoptionBlockers({
  readiness,
  reasons: plain,
  kept = [],
  progress,
  onShowToAdd,
  onKeep,
  onEditNative,
}: {
  readiness?: Readiness;
  reasons: string[];
  kept?: string[];
  progress?: { decided: number; total: number };
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
  const { decisions: rows } = splitBlockers(readiness, !!onEditNative);
  // Models to add are settled on the models page, not here: listed apart, unnumbered (spec #85, critique round 2).
  const toAdd = (readiness?.blockers ?? []).filter(blocker => !blocker.kept && blocker.kind === "unsaved");
  // Without a verdict (rebinding, older server) the plain reasons are prerequisites, never "N decisions" (#110).
  const fixes = readiness ? fixReasons(readiness, !!onEditNative) : plain;
  const left = readiness ? rows.size : 0;
  const counts = readiness ? (progress ?? adoptionProgress(readiness, kept, [], !!onEditNative)) : { decided: 0, total: 0 };
  const title = decisionsHeading(counts, copyText);
  const before = copyText("Before adopting", "Avant d’adopter");
  return (
    <>
      {left > 0 && (
        <section aria-label={title} className="rounded-sm border border-chart-warning/50 bg-chart-warning/10 p-3">
          <h3 className="font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {counts.total === 1
              ? copyText("It is required to adopt the key.", "Elle est nécessaire pour adopter la clé.")
              : copyText("Each one is required to adopt the key.", "Chacune est nécessaire pour adopter la clé.")}
          </p>
          <ol className="mt-2 list-decimal space-y-3 pl-5">
            {[...rows].map(([provider, blockers]) => (
              <DecisionRow
                key={provider || "key"}
                provider={provider}
                blockers={blockers}
                readiness={readiness!}
                kept={kept}
                onKeep={onKeep}
                onEditNative={onEditNative}
              />
            ))}
          </ol>
        </section>
      )}
      {(toAdd.length > 0 || fixes.length > 0) && (
        <section aria-label={before} className="space-y-3 rounded-sm border p-3">
          {fixes.length > 0 && <h3 className="font-medium">{counts.total === 0 ? title : before}</h3>}
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
                    className="mt-2 max-sm:h-9"
                    onClick={() => onShowToAdd(blocker.models.map(model => `${blocker.provider}/${model}`))}
                  >
                    {copyText("Show in To add", "Voir dans À ajouter")}
                    <span className="sr-only"> · {name}</span>
                  </Button>
                )}
              </div>
            );
          })}
          {fixes.map((reason, index) => (
            <div key={`${index}/${reason}`}>
              <p className="break-words font-medium">{adoptionReason(reason, copyText)}</p>
              <p className="text-xs">{fixStep(reason, copyText)}</p>
            </div>
          ))}
          {!readiness && fixes.some(reason => reason.startsWith("Dynamic native model allowlist")) && (
            <p className="text-xs">
              {copyText(
                "Keep this key as it is in Bifrost, or review a key that lists its models one by one. Registry cannot safely copy an “every model” permission.",
                "Gardez cette clé telle quelle dans Bifrost, ou examinez une clé qui liste ses modèles un par un. Registry ne sait pas reprendre fidèlement une permission « tous les modèles ».",
              )}
            </p>
          )}
        </section>
      )}
    </>
  );
}

// The models a decision is about, named where the decision is read (critique round 5): the first three, then "+N" to
// see the rest. Names are identifiers, so they are set in mono.
const namedModels = 3;
function ModelNames({ models }: { models: string[] }) {
  const copyText = useCopy();
  const { colon } = useFormat();
  const [all, setAll] = useState(false);
  if (!models.length) return null;
  const more = models.length - namedModels;
  return (
    <p className="mt-1 break-words text-xs">
      {copyText(models.length === 1 ? "Model" : "Models", models.length === 1 ? "Modèle" : "Modèles")}
      {colon} <span className="font-mono">{(all ? models : models.slice(0, namedModels)).join(", ")}</span>
      {more > 0 && (
        <>
          {" "}
          <button
            type="button"
            aria-expanded={all}
            className="-my-1 inline-flex min-h-6 min-w-6 items-center justify-center rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:-my-2 max-sm:min-h-9 max-sm:min-w-9"
            onClick={() => setAll(!all)}
          >
            {all ? (
              copyText("Show fewer", "Afficher moins")
            ) : (
              <>
                +{more}
                <span className="sr-only">
                  {" "}
                  {copyText(more === 1 ? "more model" : "more models", more === 1 ? "autre modèle" : "autres modèles")}
                </span>
              </>
            )}
          </button>
        </>
      )}
    </p>
  );
}

// One provider's blockers, then its choices: keep a provider in Bifrost, a native edit, or the models page.
// #100: each blocker reads as one plain sentence; a model allowed through two subscriptions offers its choices
// by outcome ("Use Claude for this model" keeps Codex in Bifrost, and the reverse).
function DecisionRow({
  provider,
  blockers,
  readiness,
  kept,
  onKeep,
  onEditNative,
}: {
  provider: string;
  blockers: ReadinessBlocker[];
  readiness: Readiness;
  kept: string[];
  onKeep?: (provider: string, keep: boolean) => void;
  onEditNative?: (request: NativeEditRequest) => void;
}) {
  const copyText = useCopy();
  const name = displayProvider(provider);
  const keepableKinds = blockers.filter(blocker => ["undiscovered", "dynamic", "collision"].includes(blocker.kind));
  const keepable = !!onKeep && !!provider && keepableKinds.length > 0;
  // A collision is resolved by keeping either provider: the other ones follow this row's own offer.
  const sharers = [
    ...new Set([provider, ...blockers.flatMap(blocker => (blocker.kind === "collision" ? (blocker.with ?? []) : []))]),
  ];
  const others = onKeep ? sharers.filter(other => other !== provider) : [];
  const byOutcome = keepableKinds.length > 0 && keepableKinds.every(blocker => blocker.kind === "collision");
  const shared = blockers.find(blocker => blocker.kind === "collision")?.count ?? 1;
  const edits = onEditNative ? blockers.filter(blocker => nativeEditFor(blocker, readiness)) : [];
  const choices = Number(keepable) + others.length + edits.length;
  const and = (names: string[]) =>
    names.length > 1 ? `${names.slice(0, -1).join(", ")} ${copyText("and", "et")} ${names.at(-1)}` : (names[0] ?? "");
  const keepLabel = (who: string) => {
    if (!byOutcome)
      return copyText(`Keep ${displayProvider(who)} in Bifrost`, `Garder ${displayProvider(who)} dans Bifrost`);
    const used = and(sharers.filter(other => other !== who).map(displayProvider));
    return copyText(
      `Use ${used} for ${shared === 1 ? "this model" : "these models"}`,
      `Utiliser ${used} pour ${shared === 1 ? "ce modèle" : "ces modèles"}`,
    );
  };
  const keepButton = (who: string) => (
    <Button
      key={who}
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={kept.includes(who)}
      // The selected style of a Toggle segment (toggle.tsx): accent background, 1px muted-foreground outline.
      className="h-auto min-h-8 whitespace-normal text-left max-sm:min-h-9 aria-pressed:bg-accent aria-pressed:text-foreground aria-pressed:outline-solid aria-pressed:outline-1 aria-pressed:-outline-offset-1 aria-pressed:outline-muted-foreground dark:aria-pressed:bg-accent"
      onClick={() => onKeep!(who, true)}
    >
      {keepLabel(who)}
    </Button>
  );
  // What the person can do about models Bifrost does not show, from the choices this row actually offers.
  const undiscoveredChoices = (blocker: ReadinessBlocker) => {
    const one = blocker.count === 1;
    const parts = [
      keepable &&
        copyText(
          `let Bifrost keep handling ${name} for this key`,
          `laissez Bifrost continuer à gérer ${name} pour cette clé`,
        ),
      edits.includes(blocker) &&
        copyText(
          `remove ${one ? "that model" : "those models"} from the key`,
          `retirez ${one ? "ce modèle" : "ces modèles"} de la clé`,
        ),
    ].filter((part): part is string => !!part);
    const sentence = parts.join(copyText(", or ", ", ou "));
    return sentence && <p className="text-xs">{sentence.charAt(0).toUpperCase() + sentence.slice(1)}.</p>;
  };
  const models = (count: number) => copyText(count === 1 ? "model" : "models", count === 1 ? "modèle" : "modèles");
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
                  `So Bifrost shows none of its models, and Registry can’t manage ${blocker.count === 1 ? "the model" : `the ${blocker.count} models`} this key allows.`,
                  `Bifrost ne montre donc aucun de ses modèles : Registry ne peut pas gérer ${blocker.count === 1 ? "le modèle" : `les ${blocker.count} modèles`} que cette clé autorise.`,
                )}
              </p>
              <ModelNames models={blocker.models} />
              {undiscoveredChoices(blocker)}
            </>
          ) : blocker.kind === "undiscovered" ? (
            <>
              <p className="font-medium">
                {copyText(
                  `Bifrost doesn’t show ${blocker.count} ${name} ${models(blocker.count)}, so Registry can’t manage ${blocker.count === 1 ? "it" : "them"}.`,
                  `Bifrost ne montre pas ${blocker.count} ${models(blocker.count)} ${name} : Registry ne peut donc pas ${blocker.count === 1 ? "le" : "les"} gérer.`,
                )}
              </p>
              <ModelNames models={blocker.models} />
              {undiscoveredChoices(blocker)}
            </>
          ) : blocker.kind === "collision" ? (
            <>
              <p className="font-medium">
                {copyText(
                  `${blocker.count} ${blocker.count === 1 ? "model is" : "models are"} allowed through ${and(sharers.map(displayProvider))}.`,
                  `${blocker.count} ${blocker.count === 1 ? "modèle est autorisé" : "modèles sont autorisés"} via ${and(sharers.map(displayProvider))}.`,
                )}
              </p>
              <ModelNames models={blocker.models} />
              <p className="mt-1 text-xs">
                {keepable
                  ? copyText(
                      "Registry uses one subscription per model: choose the one to use, and Bifrost keeps handling the other for this key.",
                      "Registry n’utilise qu’un abonnement par modèle : choisissez celui à utiliser, Bifrost continue de gérer l’autre pour cette clé.",
                    )
                  : copyText(
                      "Registry uses one subscription per model.",
                      "Registry n’utilise qu’un abonnement par modèle.",
                    )}
              </p>
            </>
          ) : blocker.kind === "dynamic" && provider ? (
            <>
              <p className="font-medium">
                {copyText(
                  `This key allows every ${name} model, including future ones, so Registry can’t copy it as is.`,
                  `Cette clé autorise tous les modèles ${name}, y compris les futurs : Registry ne peut pas la reprendre telle quelle.`,
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
              <ModelNames models={blocker.models} />
            </>
          )}
        </div>
      ))}
      {choices > 0 && (
        <div className="mt-2 space-y-2">
          {choices > 1 && <p className="text-xs font-medium">{copyText("Choose one:", "Choisissez une option :")}</p>}
          {keepable && !byOutcome && (
            <div>
              {keepButton(provider)}
              <p className="mt-1 text-xs">
                {copyText(
                  `Bifrost keeps handling ${name} for this key; Registry takes over the rest.`,
                  `Bifrost continue de gérer ${name} pour cette clé ; Registry prend en charge le reste.`,
                )}
              </p>
            </div>
          )}
          {((byOutcome && keepable) || others.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {byOutcome && keepable && keepButton(provider)}
              {others.map(keepButton)}
            </div>
          )}
          {edits.map(blocker => (
            <NativeEditButton key={blocker.kind} blocker={blocker} readiness={readiness} onEdit={onEditNative} />
          ))}
        </div>
      )}
    </li>
  );
}
