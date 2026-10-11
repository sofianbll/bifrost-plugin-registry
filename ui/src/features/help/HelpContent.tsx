import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { useCopy } from "../../lib/locale";

// The short help, shared by the side sheet ("?") and Settings → Help. Labels quote the buttons and
// badges as they read in the same language.
const Q = ({ children }: { children: ReactNode }) => <q className="font-medium">{children}</q>;

export function HelpContent() {
  const copy = useCopy();
  return <div className="space-y-5 text-sm">
    <ol className="space-y-3">
      <li className="flex gap-3"><Badge>1</Badge><span><strong>{copy("Models", "Modèles")}</strong> — {copy("read your saved cards. “To add” lists the models Bifrost found and you have not saved yet.", "lisez vos fiches enregistrées. « À ajouter » liste les modèles trouvés par Bifrost et pas encore enregistrés.")}</span></li>
      <li className="flex gap-3"><Badge>2</Badge><span><strong>{copy("Groups", "Groupes")}</strong> — {copy("save a set of models once, use it on many keys.", "enregistrez une fois un ensemble de modèles, utilisez-le sur plusieurs clés.")}</span></li>
      <li className="flex gap-3"><Badge>3</Badge><span><strong>{copy("Virtual keys", "Clés virtuelles")}</strong> — {copy("choose the models each key can call.", "choisissez les modèles que chaque clé peut appeler.")}</span></li>
      <li className="flex gap-3"><Badge>4</Badge><span><strong>{copy("Adopt a key", "Adopter une clé")}</strong> — {copy("a key made in Bifrost is adopted first. Registry never gives it more access than Bifrost does.", "une clé créée dans Bifrost s’adopte d’abord. Registry ne lui donne jamais plus d’accès que Bifrost.")}</span></li>
      <li className="flex gap-3"><Badge>5</Badge><span><strong>{copy("Preview and publish", "Aperçu et publication")}</strong> — {copy("check the change, publish, then read /v1/models back to verify.", "vérifiez le changement, publiez, puis relisez /v1/models pour contrôler.")}</span></li>
    </ol>
    <section className="space-y-2">
      <h3 className="font-semibold">{copy("Adopting a key", "Adopter une clé")}</h3>
      <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
        <li>{copy("Each key says where it stands: Ready to adopt, Blocked or Empty.", "Chaque clé indique où elle en est : Prête à adopter, Bloquée ou Vide.")}</li>
        <li><Q>{copy("Keep Mistral in Bifrost", "Garder Mistral dans Bifrost")}</Q> {copy("leaves that provider’s permissions in Bifrost. Registry manages the rest and shows the provider on the key as “kept in Bifrost”.", "laisse les permissions de ce fournisseur dans Bifrost. Registry gère le reste et affiche le fournisseur sur la clé : « conservé dans Bifrost ».")}</li>
        <li><Q>{copy("Remove these models from the key in Bifrost", "Retirer ces modèles de la clé dans Bifrost")}</Q> {copy("drops the models Registry cannot take over. You see a preview and confirm before anything is written.", "enlève les modèles que Registry ne sait pas reprendre. Vous voyez un aperçu et vous confirmez avant toute écriture.")}</li>
        <li><Q>{copy("Replace “all providers” by the explicit list", "Remplacer « tous les fournisseurs » par la liste explicite")}</Q> {copy("is for a key that allows every provider: afterwards it allows only the listed ones, after a preview and a confirmation.", "sert pour une clé qui autorise tous les fournisseurs : ensuite elle n’autorise que ceux de la liste, après un aperçu et une confirmation.")}</li>
      </ul>
    </section>
    <section className="space-y-2">
      <h3 className="font-semibold">{copy("On model cards", "Sur les fiches modèles")}</h3>
      <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
        <li>{copy("A badge shows only when something needs attention: “no reference”, “inferred creator”, “+1 available”.", "Un badge n’apparaît que si quelque chose demande votre attention : « sans référence », « créateur déduit », « +1 disponible ».")}</li>
        <li>{copy("An inferred creator is a guess from the provider. ", "Un créateur déduit est une supposition tirée du fournisseur. ")}<Q>{copy("Associate a reference", "Associer une fiche documentaire")}</Q> {copy("links the card to a Models.dev entry, so its facts and creator are real.", "relie la fiche à une entrée Models.dev : ses données et son créateur deviennent fiables.")}</li>
        <li><Q>{copy("Add to card", "Ajouter à la fiche")}</Q> {copy("puts an available access into a card you already saved.", "met un accès disponible dans une fiche déjà enregistrée.")}</li>
      </ul>
    </section>
  </div>;
}
