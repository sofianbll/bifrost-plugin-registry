# Livraison V1 RC — v0.2.0-rc.1

[English](INSTALL.md) · Français

La [prérelease `v0.2.0-rc.1`](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) distribue les fichiers ci-dessous. Vérifier leurs empreintes avec le fichier `SHA256SUMS` joint à la release. L'image contient Bifrost **compilé avec liaison dynamique** pour charger les plugins Go. Le `.so` Registry est un artefact séparé et n'est pas dans l'image. La production et l'ancien pilote sur `8082` n'ont pas été modifiés.

## Télécharger la paire correspondant à l'hôte

Choisir **une seule** architecture, `amd64` ou `arm64`. Pour chacune, la release fournit :

- `bifrost-dynamic-2.2.2-linux-{arch}.tar.gz` : archive Docker de l'image `bifrost-dynamic:2.2.2-go1.27.1-{arch}` ; elle contient uniquement Bifrost dynamique, jamais le plugin ;
- `bifrost-registry-v0.2.0-rc.1-linux-{arch}.so` : plugin installable par URL directe ;
- les empreintes SHA-256 de ces fichiers.

Les fichiers proviennent de Bifrost `transports/v2.2.2` au commit `fdeef8e3f31a3b18a61666ba49247d07bae3600a`, de Go 1.27.1, de `core` 1.10.1 et de `framework` 1.7.3 sur Linux/musl. L'image conserve l'entrypoint Bifrost et le volume `/app/data`. La paire doit rester sur la même architecture et le même environnement Go/libc ; l'image officielle précompilée 2.2.2 ARM64 testée ne charge pas ce `.so`.

Depuis [la release `v0.2.0-rc.1`](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1), télécharger l'archive image et le `.so` de l'architecture retenue. Vérifier les SHA-256 contre les valeurs publiées avec la release, puis charger l'image :

```bash
docker load -i bifrost-dynamic-2.2.2-linux-arm64.tar.gz
# Sur un hôte x86_64, utiliser bifrost-dynamic-2.2.2-linux-amd64.tar.gz.
```

Pour installer le plugin, utiliser l'URL **directe du `.so` versionné** et non la page de release. Exemple ARM64 :

```text
https://github.com/sofianbll/bifrost-plugin-registry/releases/download/v0.2.0-rc.1/bifrost-registry-v0.2.0-rc.1-linux-arm64.so
```

## Configurer une instance de staging

Conserver les providers, clés, budgets et règles Bifrost existants. Sur une instance neuve, démarrer l'image chargée avec son entrypoint normal, un volume **inscriptible et persistant** monté sur `/app/data`, et le port Bifrost habituel. Pour remplacer l'image d'un gateway existant, arrêter d'abord le service et sauvegarder **tout** son volume `/app/data`, y compris SQLite et ses fichiers WAL ; garder la configuration et l'image précédentes pour le retour arrière. Ne pas lancer deux writers sur le même volume.

Publier `8099` uniquement sur le loopback de l'hôte (`127.0.0.1:8099:8099`) et garder `admin_listen: "0.0.0.0:8099"` **dans** le conteneur. Définir deux secrets distincts dans l'environnement du conteneur : `REGISTRY_ADMIN_TOKEN` (au moins 32 caractères, pour le panneau) et `REGISTRY_BIFROST_AUTH` (la valeur complète de l'en-tête `Authorization` permettant au plugin d'appeler l'API admin native Bifrost ; avec Basic, `Basic <base64(utilisateur:mot-de-passe)>`). Les garder hors du JSON et des logs. Le panneau est à `http://127.0.0.1:8099/model-registry` ; Bifrost reste sur `8080` dans l'exemple.

Ajouter le plugin depuis l'interface native Bifrost ou `POST /api/plugins`, en fusionnant le [fragment de configuration](../configs/plugin.fragment.json) avec la configuration existante. Remplacer sa `path` fictive par l'URL directe de l'architecture choisie. Garder `placement: "post_builtin"`, `order: 0`, `registry_path: "/app/data/registry/registry.json"`, `admin_listen: "0.0.0.0:8099"`, `admin_token_env: "REGISTRY_ADMIN_TOKEN"` et `bifrost_auth_env: "REGISTRY_BIFROST_AUTH"`. `bifrost_url: "http://127.0.0.1:8080"` suppose que plugin et gateway partagent le même conteneur. Le démarrage de l'image seule n'installe aucun plugin.

Après installation, vérifier `GET /api/plugins` (`active`), `GET /api/plugins/loaded`, le panneau avec son jeton, puis une clé témoin : publication et relecture réelle de `GET /v1/models`. Les clés natives préexistantes restent non gérées jusqu'à adoption explicite ; l'adoption n'élargit pas leurs droits Bifrost. Le panneau utilise le JSON structuré versionné pour l'import/export et propose aperçu et sauvegarde avant import ; le CSV exporté est seulement une table aplatie.

## Mettre à jour et revenir en arrière

Arrêter le gateway et sauvegarder **tout** `/app/data` avant une mise à jour du `.so`. Changer ensuite l'URL enregistrée vers le nouveau `.so` compatible, puis redémarrer le gateway : Bifrost retélécharge l'URL sauvegardée. La désactivation puis réactivation du plugin sans redémarrage n'est pas qualifiée (`plugin already loaded`). Vérifier le chargement, les données conservées et la relecture avec une clé témoin.

Pour revenir à la version précédente, arrêter le gateway, restaurer **l'intégralité** de la sauvegarde `/app/data` prise à l'arrêt, remettre l'image précédente si elle avait changé, puis redémarrer. Restaurer le volume complet récupère ensemble la base Bifrost, son URL de plugin et le registre ; pointer un ancien `.so` sur un registre déjà migré n'est pas un retour arrière éprouvé. Conserver les octets de l'ancien `.so` à son URL d'origine. [Preuve finale ARM64 : 26/26 contrôles](../reports/v1-final/arm64/upgrade-rollback/report.json).

## État des preuves

Les deux architectures passent les [rapports finaux ARM64](../reports/v1-final/arm64/) et [AMD64](../reports/v1-final/amd64/) : modèles 42/42 et plugin autonome 54/54 chacune. L'[image AMD64](../reports/v1-final/amd64/image/report.json) passe 18/18 ; le [rapport ARM64](../reports/v1-final/arm64/upgrade-rollback/report.json) passe 26/26, avec les contrôles d'image, de mise à jour et de retour arrière. ARM64 ajoute l'[adoption 19/19](../reports/v1-final/arm64/adoption-report.json) et un [parcours Hermes installé 4/4](../reports/v1-final/arm64/hermes/report.json). Le [test Hermes sur fixture](../reports/v1-final/arm64/browser/hermes-fixture-report.json) confirme un seul POST autorisé au fournisseur synthétique et un refus 403 exclu de ce fournisseur. Aucune inférence de fournisseur réel n'est prouvée. La [revue navigateur](../reports/v1-final/README.md#revue-navigateur) est consignée ; les empreintes des fichiers distribués sont dans `SHA256SUMS` sur la release.
