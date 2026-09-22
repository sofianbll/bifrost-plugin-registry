# Origines et niveau de vérification

Date de préparation : 20 septembre 2026. Sources primaires seulement pour le contrat Bifrost. La documentation web consultée peut évoluer ; elle ne remplace pas les sources du checkout compilé.

| Décision / contrat | Origine | Niveau de vérification |
| --- | --- | --- |
| Hooks HTTP sérialisés, Init(config any), GetName/Cleanup, PreLLM/PostLLM | https://docs.getbifrost.ai/plugins/writing-go-plugin | Documentation consultée. Adaptateur non compilé ici. |
| Shapes HTTPRequest/HTTPResponse, PluginConfig et signatures | https://raw.githubusercontent.com/maximhq/bifrost/dev/core/schemas/plugin.go | Code consulté sur `dev`, pas validation du tag de production. |
| PreRequestHook non bloquant, PreLLM par tentative, short-circuit et AllowFallbacks | Même fichier `core/schemas/plugin.go` + guide d’écriture | Contrat du code et documentation recoupés. Comportement réel à tester. |
| Contextes raw VK / ID VK de gouvernance, GetRequestFields, structures d’erreur | https://raw.githubusercontent.com/maximhq/bifrost/dev/core/schemas/bifrost.go | Source consultée, pas preuve runtime. |
| Authentification, restrictions natives et filtrage de modèles | https://raw.githubusercontent.com/maximhq/bifrost/dev/plugins/governance/main.go | Source consultée ; versions et interactions à valider en staging. |
| Aliases par clé provider ; model_id/model_name/model_family ; casse | https://docs.getbifrost.ai/providers/aliasing-models | Documentation consultée. Export testé sur fixtures locales, pas appliqué à une API live. |
| placement pre_builtin et ordre inverse des PostHooks | https://docs.getbifrost.ai/plugins/sequencing + source plugin.go | Documentation et code recoupés. |
| Gateway dynamique, même Go, dépendances et libc | https://docs.getbifrost.ai/plugins/building-dynamic-binary | Documentation consultée. Build commun fourni, non exécuté contre Bifrost ici. |
| Version utilisateur 2.2.1 ; cible de build transports/v2.2.1 | Contexte utilisateur et https://github.com/maximhq/bifrost/releases | Version cible identifiée. Archive exacte non récupérée pour ce build. |

## Ce qui est un choix de ce projet

Le schéma du registre, `token_sha256`, `prefer`, les groupes, le contrôle If-Match, l’administration sur port local et le format du plan sont nos propres contrats. Ce ne sont pas des champs de l’API officielle Bifrost. En particulier, `allowed_models_by_provider` dans le plan ne doit pas être copié tel quel comme corps d’un PUT Bifrost.

Les nombres du rapport de tests viennent d’exécutions dans cet environnement. Les données de `registry.demo.json` sont synthétiques. Les familles affichées en démonstration illustrent le classement demandé, sans prouver la disponibilité d’un modèle via Codex, Antigravity, Copilot ou Mistral.

## Pas de garantie extrapolée

Le code source ne prouve pas le chargement d’un `.so`, un test de compilation ne prouve pas une autorisation native, et un endpoint JSON reconnu ne prouve pas son support chez un provider. Les résultats locaux, la sonde ABI et les tests de pipeline sont volontairement séparés dans ce paquet.
