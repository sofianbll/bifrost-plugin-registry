import { createContext, useContext } from "react";
import { creatorKey } from "../domain/registry";

export type Language = "en" | "fr";
export const LanguageContext = createContext<Language>("en");
export function useLanguage() {
  return useContext(LanguageContext);
}
export function useCopy() {
  const language = useLanguage();
  return (english: string, french: string) => (language === "fr" ? french : english);
}
export type Copy = ReturnType<typeof useCopy>;

// The chosen language is remembered per browser: ?lang= wins, then the remembered choice, then English.
// Storage can be missing or throw (private mode, blocked site data): the URL alone decides then.
type Memory = Pick<Storage, "getItem" | "setItem">;
export const languageKey = "bifrost-registry.language";
const isLanguage = (value: unknown): value is Language => value === "en" || value === "fr";
export function initialLanguage(search: string, storage: Memory | null) {
  const asked = new URLSearchParams(search).get("lang");
  if (isLanguage(asked)) return asked;
  try {
    const kept = storage?.getItem(languageKey);
    return isLanguage(kept) ? kept : "en";
  } catch {
    return "en";
  }
}
export function rememberLanguage(storage: Memory | null, language: Language) {
  try {
    storage?.setItem(languageKey, language);
  } catch {
    /* the URL still carries it for this tab */
  }
}

// Values as the UI language writes them: yes/no, unknown, grouped numbers without float noise
// (0.2, not 0.19999999999999998), prices in USD per million tokens, dates, and the label colon
// ("Label: value", "Libellé : valeur").
const locales: Record<Language, string> = { en: "en-US", fr: "fr-FR" };
const colons: Record<Language, string> = { en: ":", fr: " :" };
export function formatValue(language: Language, value: unknown, unit = ""): string {
  const copy = (english: string, french: string) => (language === "fr" ? french : english);
  if (value == null || value === "" || value === "Unknown" || (Array.isArray(value) && !value.length))
    return copy("Unknown", "Inconnu");
  if (typeof value === "boolean") return value ? copy("Yes", "Oui") : copy("No", "Non");
  if (typeof value === "number")
    return `${new Intl.NumberFormat(locales[language], { maximumFractionDigits: 6 }).format(value)}${unit ? ` ${unit}` : ""}`;
  if (Array.isArray(value)) return value.map(item => formatValue(language, item)).join(", ");
  if (typeof value === "object")
    return Object.entries(value)
      .map(([key, item]) => `${key.replaceAll("_", " ")}${colons[language]} ${formatValue(language, item)}`)
      .join(" · ");
  return String(value);
}
export function formatPrice(language: Language, value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat(locales[language], { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", minimumFractionDigits: 0, maximumFractionDigits: 6 }).format(value)}/M`
    : formatValue(language, undefined);
}
// How long ago, in the UI language: "2 days ago", "il y a 2 jours".
export function formatAge(language: Language, value: string, now = Date.now()) {
  const minutes = (Date.parse(value) - now) / 60_000;
  const [amount, unit]: [number, Intl.RelativeTimeFormatUnit] =
    Math.abs(minutes) < 60
      ? [minutes, "minute"]
      : Math.abs(minutes) < 1440
        ? [minutes / 60, "hour"]
        : [minutes / 1440, "day"];
  return new Intl.RelativeTimeFormat(locales[language], { numeric: "always" }).format(Math.round(amount), unit);
}
// A sync older than a day (or none) is not shown as fresh.
export const syncIsStale = (value: string | undefined, now = Date.now()) =>
  !value || now - Date.parse(value) > 86_400_000;
export function useFormat() {
  const language = useLanguage();
  return {
    age: (value: string) => formatAge(language, value),
    value: (value: unknown, unit?: string) => formatValue(language, value, unit),
    price: (value: unknown) => formatPrice(language, value),
    date: (value: string, options?: Intl.DateTimeFormatOptions) =>
      new Date(value).toLocaleString(locales[language], options),
    colon: colons[language],
  };
}

// The one label for a missing creator, wherever a creator is shown or listed.
export function useCreatorName() {
  const copy = useCopy();
  return (creator?: unknown) => {
    const key = creatorKey(creator);
    return key === "Unknown" ? copy("Creator not identified", "Créateur non identifié") : key;
  };
}

const terms: Record<string, string> = {
  Text: "Texte",
  Image: "Image",
  Audio: "Audio",
  Video: "Vidéo",
  Vector: "Vecteur",
  Chat: "Conversation",
  Code: "Code",
  Reasoning: "Raisonnement",
  Vision: "Vision",
  "Tool calling": "Appels d’outils",
  Tools: "Outils",
  Streaming: "Diffusion continue",
  "Structured output": "Sortie structurée",
  "Image generation": "Génération d’images",
  Embeddings: "Vecteurs",
  Editing: "Édition",
  Dimensions: "Dimensions",
};
export function useTerm() {
  const language = useLanguage();
  return (term: string) => (language === "fr" ? terms[term] || term : term);
}
