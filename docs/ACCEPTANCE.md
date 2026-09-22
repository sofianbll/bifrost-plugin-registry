# Checklist d’acceptation native — non exécutée dans cette livraison

Les tests locaux ne valident pas ces points. Effectuer les essais sur une instance de staging avec des clés et providers de test, avant toute bascule. Les essais d’inférence peuvent consommer quota et budget.

## Construction et chargement

- [ ] Le checkout correspond exactement à la version Bifrost choisie et son commit est enregistré.
- [ ] Le gateway et le `.so` sont produits dans le même module et environnement ; la sonde ABI passe.
- [ ] Le plugin est chargé par le vrai Bifrost, sans erreur de symbole, de version, de libc ou de configuration.
- [ ] Le placement `pre_builtin` et l’ordre avec les autres plugins sont confirmés.
- [ ] L’administration existante de Bifrost fonctionne, y compris les sondes/listings internes nécessaires. Les restrictions SDK de cette version ne doivent pas provoquer de régression non acceptée.

## Gouvernance et catalogue

- [ ] Sans clé, avec une clé inconnue, invalide, expirée ou révoquée, la demande est refusée **avant tout appel provider**.
- [ ] Un bon fingerprint associé au mauvais ID VK échoue et ne renvoie aucun contenu réussi.
- [ ] La gouvernance fournit le bon ID natif et respecte les restrictions de clé provider, les allowlists et les budgets.
- [ ] La liste native contient bien `provider/alias` pour les aliases déclarés.
- [ ] La liste publique contient uniquement l’intersection autorisée ; aucun modèle brut ni metadata interne ne fuit.
- [ ] Deux clés avec groupes différents obtiennent deux catalogues différents ; une sélection vide reste vide.
- [ ] Les formats `model`, `provider/model`, `both` correspondent aux requêtes effectivement acceptées.
- [ ] Un modèle non vérifié, désactivé, absent de l’allowlist native ou non disponible dans le listing n’est pas présenté comme accessible.

## Routage et compatibilité

- [ ] Les hooks par tentative voient le bon provider et l’alias avant traduction amont.
- [ ] Chaque alias amont pointe vers le modèle réel attendu et uniquement les clés provider choisies.
- [ ] Chaque endpoint activé est testé individuellement ; le support JSON ne suffit pas à prouver le support provider.
- [ ] Un fallback explicite autorisé fonctionne ; un fallback masqué, injecté par une règle ou interdit par la clé échoue sans appel au provider interdit.
- [ ] Les aliases courts partagés utilisent la préférence prévue et n’ouvrent pas d’autre source implicitement.
- [ ] Les extra_params, outils, reasoning, signatures, cache keys et IDs de continuation restent corrects sur le transport réellement utilisé.
- [ ] Les réponses normales, erreurs et streams restent valides ; les champs `model` natifs des réponses sont acceptés par le client.
- [ ] L’accounting, les prix canoniques et le budget restent ceux de Bifrost ; aucun double comptage ni mauvaise famille native.
- [ ] Les caches et autres short-circuits n’effacent pas les vérifications d’authentification ni le binding de clé.

## Administration et exploitation

- [ ] Le panneau est privé, accessible par tunnel/HTTPS si distant, avec un jeton fort et sans exposition publique accidentelle.
- [ ] Le répertoire Registry est monté correctement ; l’écriture atomique fonctionne réellement sur le volume utilisé.
- [ ] Les conflits de révision sont signalés. Il n’existe qu’un writer.
- [ ] La sauvegarde via le panneau embarqué modifie les nouvelles requêtes ; les sessions actives gardent leur snapshot comme documenté.
- [ ] Un redémarrage conserve la configuration. La restauration de l’ancienne configuration et le retrait du plugin ont été testés.

## Smoke automatisé fourni

`integration/live_smoke.py` ne couvre qu’une partie de cette checklist : refus de clé absente/non liée, catalogue exact et minimal, et éventuellement une requête Chat Completions explicitement autorisée.

```bash
export BIFROST_URL='http://127.0.0.1:8080/v1'
read -r -s -p 'Clé de staging : ' BIFROST_VIRTUAL_KEY; printf '\n'
export BIFROST_VIRTUAL_KEY
export EXPECTED_MODEL_IDS_JSON='["votre-provider/votre-alias"]'
python3 integration/live_smoke.py
unset BIFROST_VIRTUAL_KEY
```

L’option `--allow-inference --model 'votre-provider/votre-alias'` ajoute un vrai appel chat susceptible de consommer votre quota. Sans cette option, aucun appel d’inférence n’est initié par le script, mais Bifrost peut contacter ses providers pour lister les modèles.
