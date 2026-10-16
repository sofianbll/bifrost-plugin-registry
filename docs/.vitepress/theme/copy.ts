import enCatalogue from '../../images/en/catalogue-grid.png'
import enKey from '../../images/en/key-composer.png'
import frCatalogue from '../../images/fr/catalogue-grid.png'
import frKey from '../../images/fr/key-composer.png'

export const copy = {
  en: {
    title: 'A model catalogue. A selection for each Bifrost key.',
    intro: 'Registry brings your model cards together, lets you compose reusable selections, and compares each key’s published list with what Bifrost actually lists.',
    independent: 'Independent project. Not an official Maxim/Bifrost product.',
    install: 'Install', docs: 'Documentation',
    featuresTitle: 'From model cards to virtual keys',
    features: [
      { title: 'Organize your models', text: 'Browse a central catalogue enriched from Bifrost and Models.dev. Keep provider accesses together and retain your metadata corrections.' },
      { title: 'Compose each key’s selection', text: 'Reuse groups, add individual models and choose provider accesses. Review the changes before publishing.' },
      { title: 'Check the list with Bifrost', text: 'Compare the published selection with the models Bifrost lists for that key at that moment. Missing models remain visible as differences.' },
    ],
    catalogue: { title: 'See the catalogue in context', text: 'Browse model cards, their providers and documented capabilities in one place. A card is not proof of an available or authorized access.', image: enCatalogue, alt: 'Registry model catalogue in grid view, synthetic fixture' },
    key: { title: 'Review a key before publishing', text: 'Build the selection from shared groups and individual choices, then review what changes for this key.', image: enKey, alt: 'Registry virtual-key selection editor, synthetic fixture' },
    caption: 'Historical synthetic fixture. Names and counts are not real users or results. Screenshot, not a live gateway connection.',
    full: 'Open full-size screenshot',
    limitsTitle: 'What Registry does not prove',
    limits: [
      'Verification observes a model list at a point in time. It does not call models, test inference or guarantee that every model call will succeed.',
      'Bifrost owns keys, secrets and native permissions. Registry stores no secret and relays no inference.',
      'Installation requires a compatible dynamic-loading gateway and a separately installed plugin. The official prebuilt Bifrost image is not qualified by Registry’s release.',
    ],
    linksTitle: 'Read before installing',
    links: ['Installation and rollback', 'User guide', 'Security and trust boundaries', 'Release status and evidence'],
    prototype: 'Throwaway prototype / not published', previous: 'Previous variant', next: 'Next variant',
    variants: { A: ['Understand', 'Editorial reading first'], B: ['See the product', 'Catalogue screenshot first'], C: ['Decide', 'Limits alongside the overview'] },
  },
  fr: {
    title: 'Un catalogue de modèles. Une sélection pour chaque clé Bifrost.',
    intro: 'Registry rassemble vos fiches modèles, permet de composer des sélections réutilisables et compare la liste publiée de chaque clé avec ce que Bifrost liste réellement.',
    independent: 'Projet indépendant. Pas un produit officiel Maxim/Bifrost.',
    install: 'Installer', docs: 'Documentation',
    featuresTitle: 'Des fiches modèles aux clés virtuelles',
    features: [
      { title: 'Organiser vos modèles', text: 'Parcourez un catalogue central enrichi depuis Bifrost et Models.dev. Rassemblez les accès fournisseurs et conservez vos corrections de métadonnées.' },
      { title: 'Composer la sélection de chaque clé', text: 'Réutilisez des groupes, ajoutez des modèles individuels et choisissez les accès fournisseurs. Examinez les changements avant publication.' },
      { title: 'Vérifier la liste avec Bifrost', text: 'Comparez la sélection publiée avec les modèles que Bifrost liste pour cette clé à cet instant. Les modèles absents restent signalés comme écarts.' },
    ],
    catalogue: { title: 'Voir le catalogue en contexte', text: 'Retrouvez les fiches modèles, leurs fournisseurs et les capacités documentées. Une fiche ne prouve pas qu’un accès est disponible ou autorisé.', image: frCatalogue, alt: 'Catalogue de modèles Registry en grille, fixture synthétique' },
    key: { title: 'Examiner une clé avant publication', text: 'Composez sa sélection avec des groupes partagés et des choix individuels, puis examinez ce qui change pour cette clé.', image: frKey, alt: 'Éditeur de sélection d’une clé virtuelle Registry, fixture synthétique' },
    caption: 'Fixture synthétique historique. Les noms et nombres ne sont ni des utilisateurs ni des résultats réels. Capture, sans connexion directe au gateway.',
    full: 'Ouvrir la capture en grand',
    limitsTitle: 'Ce que Registry ne prouve pas',
    limits: [
      'La vérification observe une liste de modèles à un instant. Elle n’appelle pas les modèles, ne teste pas l’inférence et ne garantit pas que chaque appel réussira.',
      'Bifrost garde les clés, les secrets et les permissions natives. Registry ne stocke aucun secret et ne relaie aucune inférence.',
      'L’installation exige un gateway compatible avec le chargement dynamique et un plugin installé séparément. L’image précompilée officielle Bifrost n’est pas qualifiée par la release Registry.',
    ],
    linksTitle: 'À lire avant d’installer',
    links: ['Installation et retour arrière', 'Guide utilisateur', 'Sécurité et frontière de confiance', 'État de la release et preuves'],
    prototype: 'Prototype jetable / non publié', previous: 'Variante précédente', next: 'Variante suivante',
    variants: { A: ['Comprendre', 'Lecture éditoriale d’abord'], B: ['Voir le produit', 'Capture du catalogue d’abord'], C: ['Décider', 'Limites à côté de la présentation'] },
  },
}

export type Copy = typeof copy.en
export type Variant = 'A' | 'B' | 'C'
