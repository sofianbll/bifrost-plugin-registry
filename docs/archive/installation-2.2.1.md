> Archived Bifrost 2.2.1 installation notes. Use the [current installation guide](../INSTALL.md).

# Installation historique du plugin dans Bifrost

La procédure active V1 RC est dans [RELEASE.md](../RELEASE.md) : image Bifrost compilée avec liaison dynamique, puis installation du `.so` séparé par URL. Le montage ci-dessous conserve la preuve historique du 23 septembre ; le placement indiqué a été actualisé pour la coexistence des clés natives.

Date : 2026-09-23. Validée de bout en bout sur un staging Pulsar (Alpine/musl, x86_64, Bifrost v2.2.1 dynamique).

## Pourquoi on ne « déclare pas juste le .so » dans le gateway existant

Le binaire officiel des images `maximhq/bifrost` est **statiquement lié** (`ldd /app/main` → « Not a valid dynamic program »). Un binaire statique **ne peut pas charger de plugin Go** : `plugin.Open` exige un binaire dynamique. Vérifié sur la prod le 2026-09-23.

L'installation = **remplacer le binaire du gateway par le binaire dynamique buildé en même temps que le `.so`**, monter le `.so`, déclarer le plugin dans la config. Rien d'autre ne change (même image de base, mêmes libs, entrypoint officiel conservé).

## Procédure (3 mounts + 1 section de config)

À partir des artefacts `/srv/bifrost-build/out/native-v1/` (Pulsar) — produits par `build-registry-plugin.sh` :

```yaml
volumes:
  # 1. binaire dynamique par-dessus le binaire statique officiel
  - /srv/bifrost-build/out/native-v1/bifrost-http:/app/main:ro
  # 2. le plugin
  - /srv/bifrost-build/out/native-v1/bifrost-registry.so:/app/plugins/bifrost-registry.so:ro
  # 3. le RÉPERTOIRE du registre (jamais le seul fichier : sauvegarde atomique par rename)
  - /chemin/vers/registry:/app/registry
```

Section `plugins` **fusionnée** dans `config.json` (jamais substituée — voir `configs/plugin.fragment.json`) :

```json
"plugins": [
  {
    "name": "bifrost-registry",
    "enabled": true,
    "path": "/app/plugins/bifrost-registry.so",
    "placement": "post_builtin",
    "order": 0,
    "config": {
      "registry_path": "/app/registry/registry.json",
      "admin_listen": "0.0.0.0:8099",
      "admin_token_env": "REGISTRY_ADMIN_TOKEN"
    }
  }
]
```

Puis `REGISTRY_ADMIN_TOKEN=<secret long>` dans l'env du conteneur.

## Pièges rencontrés et résolus (staging 2026-09-23)

1. **`registry.json` doit exister** avant le premier boot du plugin, sinon `Init failed: open /app/registry/registry.json: no such file or directory` et le plugin passe en statut `error`. Amorcer avec `configs/registry.json` (schéma vide).
2. **`admin_listen` à `0.0.0.0:8099` dans le conteneur** si le port est publié : une écoute `127.0.0.1` interne n'est joignable que depuis l'intérieur du conteneur (docker-proxy forward vers l'eth0). Côté hôte, publier **uniquement** `127.0.0.1:8099:8099`.
3. **Pas de restart automatique du plugin en erreur** : après correction du fichier, un `docker restart` suffit — le statut repasse à `active`.
4. En mode DB (défaut), la config du plugin est stockée en base au premier boot ; le message `no config file change for plugin bifrost-registry, keeping stored config` est normal.

## Vérifications (résultats obtenus sur le staging)

| Contrôle | Résultat |
|---|---|
| `docker logs … \| grep "plugin status: bifrost-registry"` | `active` |
| Panneau `GET :8099/model-registry` (Bearer token) | HTTP 200 |
| `GET :8099/api/status` | `{"mode":"local-control-plane","version":"0.1.0",…}` |
| Garde inférence : `POST /v1/chat/completions` sans VK | HTTP 401 `registry_virtual_key_required` (le hook `pre_builtin` intercepte bien dans le vrai pipeline) |
| Health gateway | `/health` → 200 |

## Rollback

Retirer les 3 mounts et la section `plugins` (ou repasser sur l'image officielle sans mount de `/app/main`), recréer le conteneur. La base de données du gateway n'est pas modifiée par le plugin hors de ses propres tables.

## Référence staging

Stack complète : `/srv/bifrost-build/bifrost-staging/` sur Pulsar (compose, config, staging.env en 0600, `registry/`). Port gateway `<private-host>:9210`, panneau `127.0.0.1:8099`. Les ports dépendent de votre installation.

## Reste avant production (checklist `docs/ACCEPTANCE.md`)

- Tests de la garde et de la projection `/v1/models` **avec les providers et VK réels** (copie de la prod ou fenêtre de maintenance)
- Décision propriété des alias (décision 3 de `DECISIONS.md`) si le plugin devient l'étage de nommage canonique
- Seul writer : ne pas faire écrire le CLI standalone et le panneau embarqué sur le même `registry.json`
