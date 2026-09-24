# Configurations

- `registry.json` — registre vide initial (amorce à copier vers `registry_path` avant le premier boot du plugin).
- `registry.demo.json` — fixtures synthétiques pour explorer le panneau. **Jamais en production.**

Les exports d'une installation réelle restent privés, y compris les identifiants et
empreintes de clés. Le fichier local `registry.prod.json` est ignoré par Git ; seuls le
registre vide et les exemples synthétiques sont distribués.
