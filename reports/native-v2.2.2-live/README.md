# Build local Bifrost 2.2.2 + Registry live

Paire recompilée le 24 septembre 2026 dans `dist/native-v2.2.2-live-v5/` (dossier local ignoré par Git). Les paires précédentes, dont `dist/native-v2.2.2-live-v4/`, sont obsolètes. L'ancienne paire `dist/native-v2.2.2/` n'a pas été modifiée. Une modification directe de `/api/config` invalide maintenant le statut de relecture vérifiée à la prochaine lecture du workspace, tout en gardant la dernière observation. Dans la sidebar native, le sous-menu « Model Registry » ouvre désormais `/bifrost-registry/` par un lien HTML dans les états déployé et replié.

| Élément | Résultat |
| --- | --- |
| Source Bifrost | `fdeef8e3f31a3b18a61666ba49247d07bae3600a` |
| Toolchain | Go 1.27.1, Linux ARM64, musl, CGO activé |
| Patch UI | `e1ecd45b2239aa8ee7d69624cf501c1dacb70a4ebfb79237f78af2a93006c6b8` (SHA-256) ; `scripts/patch-bifrost-ui.py` confirme l'idempotence |
| Source Registry corrigée | `internal/admin/live.go` : `33f2c8efdb163367b2d065541d94cbb04e11f8a43c40470ec55d5a27f02f007e` (SHA-256) ; extraction de `key_id` et invalidation des preuves après changement direct de configuration |
| Tests Registry | Suite Go complète avec `-race -count=1 ./...` réussie ; régression `PUT /api/config` après readback vérifié couverte |
| Proxy UI | `TestRegistryUIProxy` réussi, dont `If-Match` et l'option locale explicite |
| Sonde ABI | Réussie ; voir [`abi-smoke.json`](abi-smoke.json) |
| Empreintes | [`SHA256SUMS`](SHA256SUMS) vérifié avec `shasum -a 256 -c` |

Empreintes SHA-256 finales :

```text
eab3e220096e2d32cdb6efd1a1a8f081606da3a22dbf23004f7d677525563a97  bifrost-http
f96515e159a986fb745502f77e73dea1591bae6590c6b01c69284ce22ff151ce  bifrost-registry.so
22ba668b44a83e73e5d108bc62c4d6c5830688e20d17b40e9bf9101ed4852ace  native-probe
```

Commande de reproduction depuis la racine du dépôt, avec le checkout Bifrost exact déjà patché et son UI construite. Choisir un **nouveau** dossier de sortie à chaque exécution :

```sh
docker run --rm --platform linux/arm64 \
  -v "$PWD:/repo:ro" \
  -v /private/tmp/bifrost-222-build:/bifrost:rw \
  -v "$PWD/dist:/out:rw" \
  -v /private/tmp/bifrost-222-gomodcache:/gomodcache:rw \
  -v /private/tmp/bifrost-222-gocache:/gocache:rw \
  -e GOMODCACHE=/gomodcache -e GOCACHE=/gocache -e GOFLAGS= \
  golang:1.27.1-alpine sh -ec '
    apk add --no-cache bash gcc musl-dev python3 git >/dev/null
    cd /bifrost/transports
    GOWORK=off CGO_ENABLED=1 go test -mod=readonly -tags=bifrost ./bifrost-http/server -run ^TestRegistryUIProxy$ -count=1
    /repo/scripts/build-with-bifrost.sh /bifrost /out/native-v2.2.2-live-v5
  '
```

Le build enregistre aussi dans ce dossier local ignoré par Git `build-environment.txt`, `gateway-build-info.txt` et `plugin-build-info.txt`. La sonde vérifie le chargement du plugin et son ABI. La paire v5 est installée sur le pilote local `127.0.0.1:8082`, avec les données provider existantes conservées. Le [rapport final](workspace-final-report.json) passe **44/44 contrôles HTTP**, dont l'invalidation d'une preuve après écriture de configuration brute et sa nouvelle vérification. Ce dernier passage ne refait pas d'inférence ; les [deux conversations réelles réussies](workspace-live-report.json) appartiennent au précédent passage de 39 contrôles. Les parcours navigateur et limites sont détaillés dans [VALIDATION.md](VALIDATION.md).
