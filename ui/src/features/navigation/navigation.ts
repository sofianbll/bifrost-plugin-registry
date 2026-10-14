import { Activity, Database, Download, FileJson, KeyRound, Layers3, Settings2 } from "lucide-react";
import type { Language } from "../../lib/locale";

export type Page = "gateway" | "models" | "catalog" | "groups" | "keys" | "settings" | "snapshot";

export const nav: { id: Page; label: Record<Language, string>; icon: typeof Database }[] = [
  { id: "models", label: { en: "My models", fr: "Mes modèles" }, icon: Database },
  { id: "groups", label: { en: "Groups", fr: "Groupes" }, icon: Layers3 },
  { id: "keys", label: { en: "Virtual keys", fr: "Clés virtuelles" }, icon: KeyRound },
  { id: "settings", label: { en: "Settings", fr: "Réglages" }, icon: Settings2 },
  { id: "gateway", label: { en: "Existing gateway", fr: "Gateway existant" }, icon: Activity },
  { id: "catalog", label: { en: "Documentary data", fr: "Données documentaires" }, icon: FileJson },
  { id: "snapshot", label: { en: "Import & export", fr: "Import & export" }, icon: Download },
];
