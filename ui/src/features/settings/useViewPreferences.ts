import { useEffect, useState } from "react";
import { defaultViewOptions, updateViewOverride, type ViewOptions } from "../../components/registry/ViewOptions";

export function useViewPreferences() {
  const [preferences, setPreferences] = useState<ViewOptions>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("registry-prototype-view") || "{}");
      return { ...defaultViewOptions, ...saved, shape: saved.shape || defaultViewOptions.shape };
    } catch {
      return defaultViewOptions;
    }
  });
  const [listOverrides, setListOverrides] = useState<Record<string, Partial<ViewOptions>>>({});
  useEffect(() => {
    localStorage.setItem("registry-prototype-view", JSON.stringify(preferences));
  }, [preferences]);

  const viewFor = (scope: string) => ({ ...preferences, ...listOverrides[scope] });
  const setView = (scope: string, value: ViewOptions) =>
    setListOverrides(old => ({ ...old, [scope]: updateViewOverride(preferences, old[scope] || {}, value) }));
  const resetView = (scope: string) =>
    setListOverrides(old => {
      const next = { ...old };
      delete next[scope];
      return next;
    });

  return { preferences, setPreferences, setListOverrides, viewFor, setView, resetView };
}
