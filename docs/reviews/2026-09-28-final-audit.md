# Audit final et qualification native — 28 septembre 2026

Suivi : [GitHub #17](https://github.com/sofianbll/bifrost-plugin-registry/issues/17) · PR [#18](https://github.com/sofianbll/bifrost-plugin-registry/pull/18).

Périmètre : branche `codex/prototype-model-card-modelsdev`, commits `12ea32c` → `2003e3e`. Ce rapport consolide : la qualification native de la paire finale, les audits Standards/Spec/UX rendus de fin de tranche, les bugs produit découverts par la qualification, et les défauts qui restent ouverts. Il ne prétend rien au-delà des rapports cités.

## Qualification native — paire finale

Paire compilée ensemble depuis le checkout Bifrost épinglé `transports/v2.2.3` (= `411d62b28b03b03bd3b4025b2cfab50af45f05f4`, arbre propre) et le plugin au commit `2003e3e`, Linux ARM64/musl, Go 1.27.1, `GOWORK=off`, `CGO_ENABLED=1`, sans patch upstream. Sonde ABI : passée.

| Artefact | SHA-256 |
| --- | --- |
| `bifrost-http` | `80d17483d6b693340b5b6f742710873a0a3ebfa96c1b419dc5352b76cb3bd6d0` (identique aux paires 2.2.3 précédentes : build reproductible) |
| `bifrost-registry.so` | `91ec902f4f0289840acb3bba6dceaf11312e2ee2d1b3ebf7a7e4c2ed83e2f58d` |

| Suite (fournisseurs synthétiques) | Checks | Verdict |
| --- | --- | --- |
| Capacités par accès (prix natifs, VK restreinte, alias partagé) | 34 assertions + 5 observations | 0 échec |
| Modèles isolés `/v1/models` par VK (`--network none`, manifest vérifié par la sonde) | 42 | 42/42 |
| Plugin autonome, redémarrage, désactivation (network none) | 55 | 55/55 |
| Plugin autonome + assistant IA synthétique (network none) | 72 | 72/72 |
| Adoption de clés natives (fixture bridge, ports hôte liés à `127.0.0.1`) | 19 | 19/19 |

Preuves versionnées : [`reports/bifrost-2.2.3-arm64-2003e3e/`](../../reports/bifrost-2.2.3-arm64-2003e3e/README.md). Outillage : `./scripts/test.sh` (vet + `go test -race ./...`) et `make script-check` passent au commit final.

## Bugs produit trouvés par la qualification (corrigés)

La qualification native des nouvelles capacités a mis au jour des défauts qu'aucun test source ne couvrait :

| Défaut | Cause racine (source primaire) | Correctif |
| --- | --- | --- |
| Installation d'alias rejetée HTTP 400 | `updateProviderKey` 2.2.3 remplace la clé par le payload (seuls les secrets masqués sont restaurés) ; envoyer `{"aliases": …}` seul vide la valeur | Re-post de la clé complète lue + alias fusionnés (`f5e5d15`), test unitaire épinglé |
| Faux conflit d'alias à la seconde sauvegarde | Bifrost ré-émet en forme chaîne legacy les alias riches ne portant que `model_id` ; la comparaison octet-à-octet échouait | Comparaison sémantique `model_id/model_name/model_family` des deux formes (`1e31732`) |
| Override de prix rejetée HTTP 400 | La portée `provider_key` n'accepte QUE `provider_key_id` (pas `provider_id`) ; listing par `provider_key_id` | Corps et listing corrigés (`73a8b29`) |
| Override de prix rejetée sur `request_types` manquant | `request_types` de base obligatoires | Mapping endpoints → types de base (`a60a5b9`) |
| « Read-back mismatch » permanent | La réponse native sérialise le patch sous `pricing_patch` (chaîne JSON), pas `patch` | Décodage des deux formes (`81e5ffe`) |
| VK à alias partagé ne voyait aucun modèle | Sous allowlist restreinte, Bifrost publie `provider/alias` ; `Project` d'une route partagée ne cherchait que l'alias nu | `Project` essaie l'alias nu puis chaque `provider/alias`, publication unique (`81e5ffe`), test de régression |

## Audits de fin de tranche

- **Standards** : sonde rendue honnête (les observations `null` ne comptent plus comme échecs ; le check de suppression liste désormais par `provider_key_id` et ne peut plus passer à vide ; docstring alignée ; code mort supprimé — `b4b2909`, `c08e883`). Duplication de helpers entre sondes notée, acceptée (convergences volontaires avec `isolated_models.py`).
- **Spec** : conformité des décisions (b)/(c)/(d) vérifiée contre `docs/design/model-card-bifrost-contract.md` et les sources 2.2.3 (`overrides.go:17-132`, `governance.go:4676`, `schemas/bifrost.go:141-196`). La sonde couvre VK mono-accès vs bi-accès, l'identifiant réellement transmis (`received_model`), le non-appel au provider exclu, et tolère la non-détermination de la répartition native (conforme à d.6). `request_types` désormais exercé par la qualification.
- **UX rendu** (fixture natif jetable, navigateur réel, clavier, 400/800/1280/1440 px ; 72/72 au rapport de fixture) : les trois dimensions d'affichage pilotent réellement les cartes y compris groupes et clés ; Carré 1:1 mesuré ; Tableau masque Forme. Sept défauts corrigés en `2003e3e` : chaînes anglaises du flux clé, validation du nom alignée sur le formulaire de groupe (inline + bloquant), « 1 clé »/« N clés », double sélecteur Expert unifié, densité masquée en Tableau, filtres 400 px lisibles, totaux nommés (« accès natifs Bifrost » vs « fiches modèle Registry »). Décisions consignées dans [le contrat UI](../design/component-library.md).

## Défauts et limites ouverts (honnêtes)

- Chaînes anglaises résiduelles dans le flux modèles/groupes (« Deleting model… », confirmations de suppression) — consignées, hors du flux clé corrigé.
- Création de clé : corrigée et couverte par tests, mais non exercée en rendu sur la paire native finale (le prévisualiseur local désactive la création native) ; re-vérification rendue à refaire à l'occasion.
- Infobulles ajoutées non vérifiées au survol ; choix « élargissement plutôt qu'ellipse » à re-valider visuellement.
- La suite adoption exige un réseau bridge avec ports publiés liés à `127.0.0.1` (pas `--network none`) ; les autres suites restent en `--network none`.
- ARM64 uniquement : AMD64 2.2.3 reste non qualifié, l'image officielle précompilée n'est pas qualifiée, et aucune inférence fournisseur réelle n'est prouvée.
- Aucun déploiement de production n'a été effectué ; le pilote local et la release `v0.2.0-rc.1` restent intacts.
