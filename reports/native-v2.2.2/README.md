# Catalogue par clé — Bifrost 2.2.2

Le 23 septembre 2026, **42 contrôles HTTP passent** dans [isolated-models-report.json](isolated-models-report.json). Le serveur Bifrost et le plugin sont réels ; seul le fournisseur est un serveur local aux réponses contrôlées. Aucun appel d’inférence, accès production ou client Hermes.

## Résultat observé

Les trois VK natives ont exactement les mêmes permissions Bifrost : `openai/alpha`, `openai/beta`, `openai/shared`. Le Registry change ensuite le catalogue de chaque clé sans élargir ces permissions.

| Étape | Clé Hermes | Clé témoin |
| --- | --- | --- |
| Registry activé | `alpha`, `shared` | `openai/beta`, `openai/shared` |
| Ajout de `alpha` au groupe partagé | `alpha`, `shared` | `openai/alpha`, `openai/beta`, `openai/shared` |
| Format `both` sur Hermes | `alpha`, `openai/alpha`, `openai/shared`, `shared` | Inchangée |

Le test mesure `/v1/models`, puis son alias `/openai/v1/models`. Il vérifie les IDs exacts, une lecture A → B → A, les sauvegardes via l’API Registry et leurs révisions, les refus sans clé/clé inconnue/identité incohérente. Un modèle interdit par les permissions natives et un modèle inexistant restent absents. La troisième VK, valide nativement mais sans politique Registry, reçoit `403 registry_policy_missing` après activation.

## Défaut trouvé et corrigé

[Avant correction](before-fix.json), les clés gérées recevaient `403 registry_identity_mismatch`. L’identité validée par Governance restait dans le contexte enfant du fournisseur ; le post-hook HTTP lisait le contexte transport initial.

Le correctif conserve le résultat de cette validation dans la session propre à la requête de listing. Une confirmation native permet la projection ; un désaccord reste bloquant même si un autre fournisseur confirme ensuite. Aucun secret brut n’est transformé en identité de confiance. Les contrôles d’inférence et de streaming sont inchangés.

La [sonde ABI](abi-smoke.json) vérifie aussi les contextes enfants, l’identité absente, le parent contradictoire, le refus persistant et l’absence de réutilisation entre requêtes. Elle ne remplace pas le rapport HTTP. Deux revues indépendantes du correctif (standards et spec) n’ont relevé aucun défaut bloquant. La suite Go portable complète, avec `-race -count=1`, passe également ; elle n’inclut pas l’adaptateur natif sous build tag.

## Versions et provenance

- Bifrost : [`transports/v2.2.2`](https://github.com/maximhq/bifrost/tree/fdeef8e3f31a3b18a61666ba49247d07bae3600a), commit `fdeef8e3f31a3b18a61666ba49247d07bae3600a`.
- Gateway et plugin compilés ensemble : Go 1.27.1, Linux ARM64, musl, vrai frontend du même checkout. Voir [manifest.json](manifest.json), [build-environment.txt](build-environment.txt) et [SHA256SUMS](SHA256SUMS).
- Sources Registry : commit `2fccc0d2c0a512869b91bb10ba36b78d3687a470` plus [registry-source.patch](registry-source.patch), dont l’empreinte est dans le manifeste. L’[ancien manifeste](before-fix-manifest.json) identifie la paire ayant reproduit le défaut.
- Runtime de test : image officielle Python 3.13.15, Alpine 3.24.2, digest épinglé dans la commande ci-dessous.

## Rejouer

Depuis la racine du dépôt, avec les artefacts locaux ignorés par Git dans `dist/native-v2.2.2` :

```sh
mkdir -p /private/tmp/bifrost-vk-proof-222
docker run --rm --name bifrost-registry-vk-proof \
  --platform linux/arm64 --network none --read-only \
  --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,size=128m \
  -v "$PWD/dist/native-v2.2.2:/artifacts:ro" \
  -v "$PWD/integration:/integration:ro" \
  -v /private/tmp/bifrost-vk-proof-222:/results \
  python@sha256:79e7a9b9ff1cbceff819f856fb374477792a5967759d94df266de7b7b4120e6f \
  python /integration/isolated_models.py \
    --gateway /artifacts/bifrost-http \
    --plugin /artifacts/bifrost-registry.so \
    --manifest /artifacts/manifest.json --out /results
```

Le script refuse les empreintes incorrectes et un namespace réseau contenant autre chose que `lo`. Aucun port hôte n’est publié. Configurations, SQLite, logs et credentials jetables sont supprimés à la fin ; seul le rapport assaini demeure. Le conteneur a été supprimé après l’essai. Pour reconstruire la paire, suivre [BUILD.md](../../docs/BUILD.md) et créer un nouveau manifeste avec les empreintes obtenues.

## Limites restantes

- Ce test ne branche pas le prototype à l’API et ne réalise pas le parcours Publish → relecture dans l’UI. Les VK sont créées par configuration native jetable ; leur gestion via l’API Bifrost reste à intégrer.
- Ajouts et exclusions propres à une clé, inférence, routage multi-fournisseur, Hermes et laboratoire ne sont pas qualifiés par cet essai.
- L’activation actuelle du Registry refuse les VK sans politique. Si les permissions natives ne laissent aucun fournisseur appeler les hooks, l’identité n’est pas confirmée et le listing reste refusé en 403 ; ce cas est déduit du code, pas exécuté ici. Ces comportements doivent être traités dans le parcours d’adoption avant activation globale.
- La preuve porte sur cette paire Linux ARM64/musl. Elle n’atteste ni un chargement sur l’instance de Sofian, ni la compatibilité d’une image officielle statique avec le plugin Go.
