# Dépannage

[English](../TROUBLESHOOTING.md) · Français

Problèmes rencontrés à l'installation du plugin. Pour les étapes elles-mêmes, voir le [guide d'installation](INSTALL.md).

## `failed to create temporary file: open /tmp/bifrost-plugin-*.so: permission denied`

Rencontré à l'ajout d'un plugin par URL. Bifrost télécharge le `.so` dans son répertoire temporaire avant de le charger (`os.TempDir()` : `/tmp`, ou `$TMPDIR` s'il est défini ; source : `framework/plugins/utils.go` de l'arbre Bifrost épinglé). Le processus Bifrost doit donc disposer d'un répertoire temporaire **accessible en écriture (et exécutable)**. Cela échoue sur les conteneurs durcis : système de fichiers racine en lecture seule, `/tmp` absent, ou `$TMPDIR` appartenant à un autre utilisateur. Correctifs :

- Docker : monter un tmpfs accessible en écriture, par exemple `--tmpfs /tmp:rw,exec,nosuid,size=128m`, ou pointer le répertoire temporaire vers le volume de données avec `-e TMPDIR=/app/data/tmp` en créant `/app/data/tmp` accessible à l'utilisateur d'exécution du conteneur.
- Kubernetes : ajouter un volume `emptyDir` sur `/tmp` quand `readOnlyRootFilesystem` est activé.
- Service systemd : vérifier `PrivateTmp` et les options de durcissement, et définir `Environment=TMPDIR=…` vers un répertoire accessible en écriture.
- Vérification rapide depuis l'hôte : `docker exec <conteneur> sh -c 'id; touch /tmp/write-test && rm /tmp/write-test'` doit réussir en tant qu'utilisateur Bifrost.

## `Dynamic loading not supported` (image officielle précompilée)

L'image officielle statique télécharge le `.so` puis refuse de le charger. Utiliser l'image dynamique publiée (mode A) ou compiler son propre gateway avec chargement dynamique correspondant à sa chaîne Go, son architecture et sa libc ([compilation native](../BUILD.md)).

## `plugin already loaded` en réactivant sans redémarrage

La réactivation à chaud d'un plugin Go n'est pas prise en charge. Avec v0.3.0 publiée / Bifrost 2.2.6, l'échec conserve `enabled:true` ; redémarrer le gateway, puis vérifier panneau, données et relecture.

Avec le **candidat source Bifrost 2.3.0** ([qualification du checkpoint public exact et limites](https://github.com/sofianbll/bifrost-plugin-registry/issues/109#issuecomment-6203460908)), l'échec d'activation par URL restaure `enabled:false`. Le redémarrage seul le laisse désactivé et réactiver l'URL inchangée après redémarrage échoue encore : la vérification au démarrage désactivé ouvre déjà le module Go, puis l'activation par URL le retélécharge sous un autre nom temporaire. Ce n'est ni une erreur d'authentification ni une raison d'accepter un 500 comme succès.

Suivre la [procédure explicite URL→local](INSTALL.md#recuperer-l-activation-apres-desactivation) : préparer une copie locale persistante, immuable et vérifiée par empreinte des **mêmes octets compatibles**, enregistrer son chemin absolu dans le conteneur **désactivé avant redémarrage**, le relire, arrêter complètement/redémarrer, puis activer ce même chemin local. Le mode d'installation change ; conserver le fichier/montage. Une installation initialement locale garde son chemin stable existant. Aucune réactivation locale à chaud n'est revendiquée. Vérifier les états actif/chargé, le chemin exact sauvegardé, le panneau, les modèles/groupes/politiques conservés et la relecture inchangée de la clé témoin. Une mise à jour de chemin échouée restaure l'ancien chemin ; la récupération n'est ni une mise à jour d'artefact ni une restauration du volume complet. Ne pas éditer la base ni supprimer/recréer le plugin.

## Le plugin se télécharge mais échoue à s'activer

Vérifier l'empreinte contre `SHA256SUMS`, et que l'image et le `.so` partagent architecture, version Go, dépendances et libc. Consulter `GET /api/plugins` et les journaux du gateway pour l'erreur d'activation.
