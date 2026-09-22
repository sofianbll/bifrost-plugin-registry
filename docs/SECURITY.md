# Sécurité et frontière de confiance

## Ce que le plugin n’est pas

Ce projet n’est pas un fournisseur d’identité, un gestionnaire de secrets, une implémentation de budgets ni un moteur de facturation. Une empreinte SHA-256 relie une politique à une clé virtuelle ; **elle n’authentifie pas la clé auprès de Bifrost**. La gouvernance native doit encore authentifier la clé, vérifier sa validité et ses restrictions, sélectionner une clé provider autorisée et appliquer les quotas/budgets.

Les fichiers `registry.json` et le jeton d’administration sont des éléments de confiance : une personne capable de les modifier peut changer les politiques. Les IDs et empreintes ne sont pas des secrets d’authentification utilisables directement, mais restent des données d’administration sensibles. Les permissions natives doivent être maintenues indépendamment.

## Invariants implémentés et testés localement

Les alias courts ambigus sont rejetés sans préférence. Les modèles non vérifiés ou désactivés ne sont pas publiés. Aucun groupe dans une politique signifie aucun accès. Les noms amont ne sont pas acceptés comme raccourci implicite. Les références inconnues et les clés JSON dupliquées sont rejetées. Une tentative provider doit faire partie des routes explicitement acceptées pour cette requête.

Les snapshots sont immuables. Une validation invalide ne remplace pas l’état en mémoire ; une sauvegarde exige la révision attendue. Les fichiers sont écrits en mode 0600 via fichier temporaire et rename. Le fsync du répertoire parent est best-effort ; ce n’est pas une promesse de durabilité absolue sur tous les systèmes de fichiers.

Le panneau n’utilise pas de cookies ni de stockage navigateur pour ses jetons. Les commandes de clés virtuelles lisent le secret sur stdin, pas dans les arguments. Les requêtes d’administration demandent un Bearer explicite ; les hôtes inattendus et les Origin d’autres sites sont refusés. Aucune CORS permissive n’est activée. Une CSP stricte, `nosniff`, `no-referrer` et `no-store` sont envoyés. Les champs affichés dans les templates sont échappés. Les requêtes JSON d’administration sont limitées à 4 Mio et les requêtes du garde à 32 Mio.

Ces protections ont des tests de code et d’API locale. Les parcours navigateur ont été exécutés en rendu DOM hors navigation, avec un pont vers la vraie API locale, car la navigation du navigateur de cet environnement est bloquée. Ils ne valident pas la CSP dans un vrai navigateur connecté, ni WebCrypto sur HTTPS, ni toutes les protections réseau du déploiement.

## Hypothèses natives à vérifier avant production

Le HTTP PreHook doit recevoir chaque route protégée. Le PreLLMHook doit voir `provider/alias` avant résolution finale de l’alias amont et s’exécuter à chaque tentative. La gouvernance doit publier l’ID VK authentifié dans le contexte attendu. Les réponses ListModels doivent être filtrées par la gouvernance et présenter les IDs natifs préfixés attendus. Aucune de ces hypothèses de pipeline n’a été validée sur un Bifrost réel dans cette livraison.

Le plugin exige cet ID authentifié avant de rendre un contenu réussi. Il ne l’invente pas et ne le déduit pas du simple fingerprint. Les chunks d’erreur natifs sont préservés, même lorsque l’authentification n’a pas produit d’identité. Les refus PreLLM utilisent un `LLMPluginShortCircuit` avec `AllowFallbacks=false` : une erreur Go ordinaire n’est pas un contrôle d’accès suffisant dans Bifrost.

La vérification tardive de l’ID ne doit pas devenir le mécanisme d’authentification principal : si la gouvernance était absente ou mal configurée, une requête pourrait avoir atteint l’amont avant le refus de sa réponse. **Ne pas charger ce plugin sur une installation sans gouvernance native opérationnelle et vérifiée.** Les tests de staging doivent confirmer l’absence de requête provider sur les refus d’authentification.

Les autres plugins natifs et l’hôte Go sont de confiance. Un autre plugin malveillant exécuté dans le même processus a les mêmes possibilités d’accès mémoire/configuration ; ce code n’est pas un sandbox de plugins.

## Limites opérationnelles

Un seul processus doit écrire la configuration. La détection de modification externe n’est pas un verrou interprocessus ni un compare-and-swap distribué : deux writers pourraient franchir simultanément la vérification. Monter un répertoire et utiliser le panneau embarqué du plugin pour une mise à jour runtime. Une session d’inférence conserve son snapshot initial ; la révocation du registre n’interrompt pas les streams déjà engagés. Les révocations natives doivent être traitées par Bifrost.

La projection `/models` refuse les IDs natifs dupliqués, les enveloppes invalides et l’absence d’identité attendue. Un provider qui ne retourne pas les alias attendus peut produire une liste vide : il faut corriger la configuration, pas élargir implicitement les droits.

Les endpoints non pris en charge échouent explicitement. La restriction HTTP peut aussi bloquer des appels internes SDK/probes lorsqu’ils ne passent pas par une session Registry. Une recette d’intégration validée pour votre version reste nécessaire.

Le `.so` possède les privilèges du processus Bifrost. Ne charger que le build que vous avez examiné, conserver ses checksums, protéger les volumes et reconstruire le gateway/plugin ensemble lors des mises à jour. Aucun mécanisme « impossible à contourner » ou compatibilité « 100 % » n’est revendiqué.
