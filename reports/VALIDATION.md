# Rapport historique — tests du 20 septembre 2026

> Ce rapport conserve l'état de la première campagne. Pour les builds et essais ultérieurs, consulter [l'état audité](../STATUS.md) et [BUILD_STATUS.json](native-build-v1/BUILD_STATUS.json). Les [empreintes de la livraison initiale](initial-source-SHA256SUMS) utilisent des chemins relatifs à la racine du dépôt et ne décrivent pas le checkout actuel.

Exécution locale de cette livraison, 20 septembre 2026. Données synthétiques uniquement. Aucun compte utilisateur, provider réel ou gateway Bifrost distant n’a été appelé.

## Tests Go

- `go vet ./...` : réussi.
- `go test -race -count=1 -coverprofile=reports/coverage.out -json ./...` : réussi.
- 156 cas feuilles, incluant les sous-tests et 5 seeds de fuzz, sans échec. Les fonctions parentes ne sont pas recomptées.
- Détecteur de courses activé ; aucun signalement pendant cette exécution.
- Couverture des instructions des packages testés : **87,8 %**, pas 100 %.
- `node --check internal/admin/web/app.js` : réussi.

Les détails sont dans `go-tests.jsonl`, `local-tests-summary.json`, `coverage.out` et `coverage.txt`. Les packages natifs protégés par le tag `bifrost` ne sont **pas inclus** dans ces chiffres.

## Fuzzing ciblé

`go test ./internal/registry -run='^$' -fuzz=FuzzStrictJSONDoesNotPanic -fuzztime=3s -parallel=2` : réussi ; **75 014 exécutions** dans cette campagne courte, sans panic découvert. Ce résultat couvre seulement le parseur JSON ; ce n’est ni un audit de sécurité ni une preuve d’absence de défaut.

## Interface

Dix parcours contrôlés dans Chromium : refus du mauvais jeton, connexion/catalogue, recherche/filtres, édition/validation/sauvegarde, groupes/aperçu VK, aperçu du plan, réglage global, thèmes/responsive, absence d’erreur JavaScript ou de requête externe durant les parcours, puis nettoyage à la déconnexion.

**Méthode utilisée ici :** rendu du DOM et des assets locaux, avec un pont de test vers la vraie API HTTP locale du binaire. La navigation Chromium est interdite par la configuration de cet environnement ; elle n’a pas été contournée. Le backend n’est pas simulé, mais le `fetch` du navigateur est remplacé par ce pont pour ces essais.

**Non vérifiés dans cette méthode :** navigation réseau réelle du navigateur, application effective de la CSP dans ce contexte, WebCrypto sur une origine sécurisée, autorisation de téléchargement du navigateur et stockage navigateur. Le script conserve un mode de navigation normale pour une exécution sur votre machine. Les captures sont celles du rendu de test, avec fixtures explicites `demo-*`.

Rapport : `browser-tests.json`. Captures : `ui-models-dark.png`, `ui-models-light.png`, `ui-mobile.png`.

## Compilation

Le CLI d’administration a été compilé en Linux amd64, `CGO_ENABLED=0`, avec Go 1.23.2 et `-trimpath -ldflags='-s -w'`. Il contient le moteur, l’API locale et les assets du panneau. **Il ne contient pas un gateway Bifrost ni un `.so` natif prêt à charger.**

## Non exécuté / non livré

| Étape | État |
| --- | --- |
| Compilation de `native/main.go` contre les dépendances réelles de Bifrost | Non exécutée. |
| Build du gateway Bifrost exact et de son frontend | Non exécuté. |
| `plugin.Open` et sonde ABI | Code fourni, non exécuté contre un `.so` Bifrost. |
| Gouvernance, séquencement, fallback, auth et `/models` dans le vrai gateway | Non validés. |
| Application des aliases / allowlists à votre configuration | Non effectuée. |
| Injection de l’interface dans le dashboard natif | Non implémentée ; panneau séparé. |
| Synchronisation/application native automatique | Non implémentée ; export/fusion manuels. |
| Déploiement sur Pulsar | Non effectué. |

La prochaine validation obligatoire est le build commun sur le checkout exact, puis la checklist `docs/ACCEPTANCE.md`. Les limites sont également signalées dans le README et le panneau.
