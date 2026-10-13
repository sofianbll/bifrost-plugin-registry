import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { useCopy, useFormat } from "../../lib/locale";
import { differenceCount, differenceNote } from "../keys/KeySummary";

// The short help, shared by the side sheet ("?") and Settings → Help. Labels are set in bold, spelled
// as the buttons and badges read in the same language (not <q>: some labels carry their own quotes).
const Q = ({ children }: { children: ReactNode }) => <span className="font-semibold text-foreground">{children}</span>;

// expert: Expert also shows the words only Expert uses (the common model ID); Basic never meets them.
export function HelpContent({ expert = false }: { expert?: boolean }) {
  const copy = useCopy();
  const { colon } = useFormat();
  return (
    <div className="space-y-5 text-sm">
      <ol className="space-y-3">
        <li className="flex gap-3">
          <Badge>1</Badge>
          <span>
            <strong>{copy("Models", "Modèles")}</strong>
            {colon}{" "}
            {copy(
              "read your registered cards. “To add” lists the models Bifrost found and you have not registered yet.",
              "lisez vos fiches enregistrées. « À ajouter » liste les modèles trouvés par Bifrost et pas encore enregistrés.",
            )}
          </span>
        </li>
        <li className="flex gap-3">
          <Badge>2</Badge>
          <span>
            <strong>{copy("Groups", "Groupes")}</strong>
            {colon}{" "}
            {copy(
              "save a set of models once, use it on many keys.",
              "enregistrez une fois un ensemble de modèles, utilisez-le sur plusieurs clés.",
            )}
          </span>
        </li>
        <li className="flex gap-3">
          <Badge>3</Badge>
          <span>
            <strong>{copy("Virtual keys", "Clés virtuelles")}</strong>
            {colon}{" "}
            {copy(
              "choose the models each key can call: work through Models, Groups and Review, then publish. Registry then checks with Bifrost that the key lists what you chose.",
              "choisissez les modèles que chaque clé peut appeler : passez par Modèles, Groupes et Vérifier, puis publiez. Registry vérifie ensuite avec Bifrost que la clé liste bien ce que vous avez choisi.",
            )}
          </span>
        </li>
        <li className="flex gap-3">
          <Badge>4</Badge>
          <span>
            <strong>{copy("Adopt a key", "Adopter une clé")}</strong>
            {colon}{" "}
            {copy(
              "a key made in Bifrost is adopted first. Registry never gives it more access than Bifrost does.",
              "une clé créée dans Bifrost s’adopte d’abord. Registry ne lui donne jamais plus d’accès que Bifrost.",
            )}
          </span>
        </li>
      </ol>
      <section className="space-y-2">
        <h3 className="font-semibold">{copy("Adopting a key", "Adopter une clé")}</h3>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            {copy(
              "Each key says where it stands: Ready to adopt, Blocked or Empty.",
              "Chaque clé indique où elle en est : Prête à adopter, Bloquée ou Vide.",
            )}
          </li>
          <li>
            <Q>{copy("Keep [provider] in Bifrost", "Garder [fournisseur] dans Bifrost")}</Q>{" "}
            {copy(
              "leaves that provider’s permissions in Bifrost. Registry manages the rest and shows the provider on the key as “kept in Bifrost”.",
              "laisse les permissions de ce fournisseur dans Bifrost. Registry gère le reste et affiche le fournisseur sur la clé : « conservé dans Bifrost ».",
            )}
          </li>
          <li>
            <Q>{copy("Remove these models from the key in Bifrost", "Retirer ces modèles de la clé dans Bifrost")}</Q>{" "}
            {copy(
              "drops the models Registry cannot take over. You see a preview and confirm before anything is written.",
              "enlève les modèles que Registry ne sait pas reprendre. Vous voyez un aperçu et vous confirmez avant toute écriture.",
            )}
          </li>
          <li>
            <Q>
              {copy(
                "Replace “all models” by the models saved in Registry",
                "Remplacer « tous les modèles » par les modèles enregistrés dans Registry",
              )}
            </Q>{" "}
            {copy(
              "is for a key that allows every model of a provider, including future ones: afterwards that provider allows only its models saved in Registry, after a preview and a confirmation. You can also keep that provider in Bifrost.",
              "sert pour une clé qui autorise tous les modèles d’un fournisseur, y compris les futurs : ensuite ce fournisseur n’autorise que ses modèles enregistrés dans Registry, après un aperçu et une confirmation. Vous pouvez aussi garder ce fournisseur dans Bifrost.",
            )}
          </li>
          <li>
            <Q>
              {copy(
                "Replace “all providers” by the explicit list",
                "Remplacer « tous les fournisseurs » par la liste explicite",
              )}
            </Q>{" "}
            {copy(
              "is for a key that allows every provider: afterwards it allows only the listed ones, after a preview and a confirmation.",
              "sert pour une clé qui autorise tous les fournisseurs : ensuite elle n’autorise que ceux de la liste, après un aperçu et une confirmation.",
            )}
          </li>
        </ul>
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold">{copy("On model cards", "Sur les fiches modèles")}</h3>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            {copy(
              "A badge shows only when something needs attention: “no reference”, “inferred creator”, “+1 available”.",
              "Un badge n’apparaît que si quelque chose demande votre attention : « sans référence », « créateur déduit », « +1 disponible ».",
            )}
          </li>
          <li>
            {copy(
              "An inferred creator is guessed from the model name or the provider serving it. ",
              "Un créateur déduit est supposé d’après le nom du modèle ou le fournisseur qui le sert. ",
            )}
            <Q>{copy("Associate a reference", "Associer une fiche documentaire")}</Q>{" "}
            {copy(
              "links the card to a Models.dev entry, so its facts and creator are real.",
              "relie la fiche à une entrée Models.dev : ses données et son créateur deviennent fiables.",
            )}
          </li>
          <li>
            <Q>{copy("Add to card", "Ajouter à la fiche")}</Q>{" "}
            {copy(
              "opens that registered card on its accesses; the available access waits under “Also available” until you add it and save.",
              "ouvre cette fiche enregistrée sur ses accès ; l’accès disponible attend sous « Également disponibles » tant que vous ne l’ajoutez pas et n’enregistrez pas.",
            )}
          </li>
        </ul>
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold">{copy("Words used here", "Vocabulaire")}</h3>
        <dl className="grid gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-[auto_1fr] sm:gap-y-2">
          <div className="contents">
            <dt>
              <Q>{copy("Access", "Accès")}</Q>
            </dt>
            <dd className="mb-2 sm:mb-0">
              {copy(
                "one way to call a model: a subscription with the exact model name it uses. A card can hold several accesses, each with its own price and limits.",
                "une manière d’appeler un modèle : un abonnement avec le nom exact du modèle chez lui. Une fiche peut porter plusieurs accès, chacun avec son prix et ses limites.",
              )}
            </dd>
          </div>
          <div className="contents">
            <dt>
              <Q>{copy("Subscription, provider", "Abonnement, fournisseur")}</Q>
            </dt>
            <dd className="mb-2 sm:mb-0">
              {copy(
                "the service a model is called through, such as Claude, Codex or OpenCode Go. Both words name the same thing; “provider” is Bifrost’s. The creator is the company that made the model, and can be another one.",
                "le service par lequel on appelle un modèle, comme Claude, Codex ou OpenCode Go. Les deux mots désignent la même chose ; « fournisseur » est celui de Bifrost. Le créateur est l’entreprise qui a conçu le modèle, et peut être une autre.",
              )}
            </dd>
          </div>
          {expert && (
            <div className="contents">
              <dt>
                <Q>{copy("Common model ID", "Identifiant commun du modèle")}</Q>
              </dt>
              <dd className="mb-2 sm:mb-0">
                {copy(
                  "the name applications use to call a model, shared by all its accesses. It is not the display name of the card.",
                  "le nom d’appel du modèle, commun à tous ses accès. Ce n’est pas le nom affiché de la fiche.",
                )}
              </dd>
            </div>
          )}
          <div className="contents">
            <dt>
              <Q>{copy("Reference", "Fiche documentaire")}</Q>
            </dt>
            <dd className="mb-2 sm:mb-0">
              {copy(
                "the public description of a model (Models.dev): what it reads and writes, its context, its price. It documents; it gives no access.",
                "la description publique d’un modèle (Models.dev) : ce qu’il lit et produit, son contexte, son prix. Elle documente ; elle ne donne aucun accès.",
              )}
            </dd>
          </div>
          <div className="contents">
            <dt>
              <Q>{copy("Inferred creator", "Créateur déduit")}</Q>
            </dt>
            <dd className="mb-2 sm:mb-0">
              {copy(
                "a creator guessed from the model name or the provider serving it, for a card without a reference. Edit the card to correct it.",
                "un créateur supposé d’après le nom du modèle ou le fournisseur qui le sert, pour une fiche sans fiche documentaire. Modifiez la fiche pour le corriger.",
              )}
            </dd>
          </div>
          <div className="contents">
            <dt>
              <Q>{copy("Kept in Bifrost", "Conservé dans Bifrost")}</Q>
            </dt>
            <dd className="mb-2 sm:mb-0">
              {copy(
                "a provider whose permissions on a key stay managed in Bifrost; Registry leaves them as they are.",
                "un fournisseur dont les permissions sur une clé restent gérées dans Bifrost ; Registry n’y touche pas.",
              )}
            </dd>
          </div>
          <div className="contents">
            <dt>
              <Q>{copy("Checked with Bifrost", "Vérifiée avec Bifrost")}</Q>
            </dt>
            <dd className="mb-2 sm:mb-0">
              {copy(
                "after publishing, Registry asks Bifrost which model IDs the key lists and compares them with what you chose. The models are not called.",
                "après la publication, Registry demande à Bifrost quels ID de modèles la clé liste et les compare à ce que vous avez choisi. Les modèles ne sont pas appelés.",
              )}
            </dd>
          </div>
          <div className="contents">
            <dt>
              {/* The chip's own wording and tooltip, from the helpers that write them on the key (ADR 0001). */}
              <Q>{`${copy("Verified", "Vérifiée")} · ${differenceCount(1, copy)}`}</Q>
            </dt>
            <dd className="mb-2 sm:mb-0">{differenceNote(1, copy)}</dd>
          </div>
          <div className="contents">
            <dt>
              <Q>{copy("Adopt", "Adopter")}</Q>
            </dt>
            <dd className="mb-2 sm:mb-0">
              {copy(
                "let Registry manage a key that was created in Bifrost, without widening its access.",
                "confier à Registry une clé créée dans Bifrost, sans élargir ses accès.",
              )}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
