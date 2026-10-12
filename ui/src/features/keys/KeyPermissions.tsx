import { displayProvider } from "../../components/registry/BrandIcon";
import type { NativePermissions } from "../../domain/registry";
import { useCopy } from "../../lib/locale";

// What Bifrost allows a key today, one line per provider with a count; the model IDs (up to
// dozens) wait behind a disclosure instead of printing as a wall of text.
export function KeyPermissions({ permissions }: { permissions?: NativePermissions }) {
  const copy = useCopy();
  if (!permissions?.providers.length) return null;
  return (
    <ul
      aria-label={copy("Bifrost allows today", "Bifrost autorise aujourd’hui")}
      className="mt-1 space-y-1 text-xs text-muted-foreground"
    >
      {permissions.providers.map(({ provider, allModels, versionDependent, models }) => {
        const name = displayProvider(provider);
        if (allModels)
          return (
            <li key={provider}>
              {name} · {copy("all models", "tous les modèles")}
            </li>
          );
        if (versionDependent)
          return (
            <li key={provider}>
              {name} · {copy("depends on the Bifrost version", "selon la version de Bifrost")}
            </li>
          );
        if (!models.length)
          return (
            <li key={provider}>
              {name} · {copy("no model", "aucun modèle")}
            </li>
          );
        return (
          <li key={provider}>
            <details>
              <summary className="cursor-pointer">
                {name} · {models.length}{" "}
                {copy(models.length === 1 ? "model" : "models", models.length === 1 ? "modèle" : "modèles")}
              </summary>
              <p className="mt-1 break-all font-mono">{models.join(", ")}</p>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
