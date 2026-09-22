# Configurations

- `registry.json` — registre vide initial (amorce à copier vers `registry_path` avant le premier boot du plugin).
- `registry.demo.json` — fixtures synthétiques pour explorer le panneau. **Jamais en production.**
- `registry.prod.json` — registre généré pour l'homelab de Sofian (Pulsar) le 2026-09-23 par
  `scripts/import-prod-registry.py` depuis `vk-groups.json` + dumps SQLite de la prod.

`registry.prod.json` contient les **SHA-256 des jetons des clés virtuelles** (`token_sha256`),
exactement comme la base Bifrost les stocke (`governance_virtual_keys.value_hash`). Ce sont des
jetons aléatoires de haute entropie (`sk-bf-…`) : la publication de leur empreinte ne permet pas
de les reconstituer, au même titre que leur stockage en clair-rehashé dans la base. Aucune autre
secret n'est présent. Régénérer après toute rotation de clé virtuelle.
