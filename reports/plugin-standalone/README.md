# Plugin avec son propre serveur — preuve locale

Le 24 septembre 2026, **38/38 contrôles HTTP passent** sur Bifrost 2.2.2 compilé en dynamique depuis ses sources officielles, sans patch du code Bifrost. Le plugin est installé par URL et sert sa propre UI React embarquée sur un port distinct. Travail suivi dans [#8](https://github.com/sofianbll/bifrost-plugin-registry/issues/8).

## Paire vérifiée

- Tag `transports/v2.2.2`, commit `fdeef8e3f31a3b18a61666ba49247d07bae3600a`.
- Go 1.27.1, Linux ARM64, Alpine/musl ; `CGO_ENABLED=1`, `GOWORK=off`, tag `bifrost` uniquement. Modules publiés `core v1.10.1` et `framework v1.7.3`, sans remplacement local.
- Les 2 744 fichiers sources sélectionnés ont été comparés aux objets Git du commit officiel avant compilation, puis revérifiés après compilation : aucun fichier source upstream modifié. Frontend Bifrost compilé depuis ces mêmes sources.
- Binaires locaux ignorés par Git : `dist/standalone-v1/bifrost-http` et `dist/standalone-v1/bifrost-registry.so`. Le panneau React est inclus dans le `.so` ; aucun `ui_dir` monté.
- [Provenance](source-verification.json), [environnement](build-environment.txt), [SHA-256](SHA256SUMS), [sonde ABI](abi-smoke.json), métadonnées [gateway](gateway-build-info.txt) et [plugin](plugin-build-info.txt).

Le répertoire source isolé n'a pas ses propres métadonnées Git : le fichier d'environnement indique donc `unknown`. La référence vérifiée est consignée séparément dans `source-verification.json` ; le script ne prend pas par erreur le commit du dépôt Registry parent.

## Ce qui passe

Le [rapport complet](final/report.json) couvre téléchargement du `.so` par URL, état réellement chargé, création du registre, HTML/JS/CSS embarqués, refus sans jeton et avec mauvais jeton, origine étrangère et traversée de chemin. Il vérifie aussi découverte de modèles, sauvegarde modèle/groupe, conflit de révision, création d'une clé native, publication et relecture réelle de `/v1/models`, absence du secret dans le workspace, persistance après redémarrage et fermeture du panneau à la désactivation.

**Limite confirmée : la réactivation à chaud par URL échoue.** Le chargeur Bifrost officiel renvoie HTTP 500 `plugin already loaded` après désactivation/réactivation du même fichier. La configuration reste activée en base, mais le serveur Registry reste fermé. Redémarrer le gateway recharge le plugin et rétablit le panneau, les données et la relecture de la clé : ce rétablissement est vérifié. Ce résultat ne doit pas être annoncé comme une réussite de réactivation à chaud ou de mise à jour sans redémarrage.

Le test automatique utilise Docker `--network none`, un fournisseur HTTP sur loopback et des identifiants synthétiques. Aucune inférence fournisseur. Le gateway, les données temporaires et les identifiants de test sont nettoyés.

## Contrôle navigateur

Sur une seconde instance jetable publiée uniquement sur `127.0.0.1`, l'interface a été vérifiée avec le vrai `.so` :

- Mauvais jeton refusé, connexion par formulaire et touche Entrée, déconnexion vers un formulaire vide.
- Catalogue découvert dans Bifrost ; modification d'une description de groupe par l'UI et relecture indépendante par l'API.
- Après rechargement : le jeton doit être ressaisi, le groupe sauvegardé est toujours présent.
- La nouvelle révision demande une relecture ; « Read again » produit « Verified » pour le catalogue réel de la clé.
- Inspection desktop (1 163 px CSS) et mobile (320 px CSS ; catalogue également vu à 291 px). Aucun débordement horizontal sur ces parcours, aucune erreur console remontée.

Captures : [catalogue desktop](desktop-catalog.png), [catalogue mobile](mobile-catalog.png), [relecture de clé à 320 px](mobile-key.png), [connexion à 320 px](mobile-login.png). Ces parcours ciblés ne constituent pas une revue exhaustive des écrans.

## Reproduction

Compiler la paire avec la [recette standard](../../docs/BUILD.md), puis utiliser des chemins absolus. Le répertoire `/out/nouvel-essai` doit être absent :

```bash
docker run --pull never --rm --network none --cap-drop ALL --security-opt no-new-privileges \
  -v "$PWD/integration:/proof:ro" \
  -v "$PWD/dist/standalone-v1:/artifacts:ro" \
  -v "$PWD/reports/plugin-standalone:/out" \
  python:3.13-alpine python /proof/standalone_plugin_probe.py \
  --gateway /artifacts/bifrost-http --plugin /artifacts/bifrost-registry.so \
  --out /out/nouvel-essai
```

`--keep-alive` réserve une instance au contrôle navigateur, avec des ports hôte publiés uniquement sur loopback. Les identifiants jetables sont écrits en `0600` dans `browser-auth.json`, ignoré par Git et supprimé à l'arrêt.

## Portée

Cette preuve qualifie la paire locale ARM64 indiquée, avec une URL HTTP de fixture. Elle ne livre pas une URL publique, une image Docker publiée, une autre architecture ni une mise à jour entre deux versions du plugin. L'image officielle précompilée 2.2.2 ARM64 testée précédemment reste incompatible avec le chargement dynamique. Le pilote utilisateur `127.0.0.1:8082` et la production n'ont pas été remplacés. La paire intégrée archivée est conservée localement dans `dist/archive/native-ui-2.2.2-2026-09-24/`, ignoré par Git.
