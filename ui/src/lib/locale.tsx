import { createContext, useContext } from "react";
import { creatorKey } from "../domain/registry";

export type Language = "en" | "fr";
export const LanguageContext = createContext<Language>("en");
export function useLanguage() { return useContext(LanguageContext); }
export function useCopy() {
  const language = useLanguage();
  return (english: string, french: string) => language === "fr" ? french : english;
}
export type Copy = ReturnType<typeof useCopy>;

// Values as the UI language writes them: yes/no, unknown, grouped numbers without float noise
// (0.2, not 0.19999999999999998), prices in USD per million tokens, dates.
const locales: Record<Language, string> = { en: "en-US", fr: "fr-FR" };
export function formatValue(language: Language, value: unknown, unit = ""): string {
  const copy = (english: string, french: string) => language === "fr" ? french : english;
  if (value == null || value === "" || value === "Unknown" || (Array.isArray(value) && !value.length)) return copy("Unknown", "Inconnu");
  if (typeof value === "boolean") return value ? copy("Yes", "Oui") : copy("No", "Non");
  if (typeof value === "number") return `${new Intl.NumberFormat(locales[language], { maximumFractionDigits: 6 }).format(value)}${unit ? ` ${unit}` : ""}`;
  if (Array.isArray(value)) return value.map(item => formatValue(language, item)).join(", ");
  if (typeof value === "object") return Object.entries(value).map(([key, item]) => `${key.replaceAll("_", " ")}: ${formatValue(language, item)}`).join(" · ");
  return String(value);
}
export function formatPrice(language: Language, value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat(locales[language], { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", minimumFractionDigits: 0, maximumFractionDigits: 6 }).format(value)}/M`
    : formatValue(language, undefined);
}
export function useFormat() {
  const language = useLanguage();
  return {
    value: (value: unknown, unit?: string) => formatValue(language, value, unit),
    price: (value: unknown) => formatPrice(language, value),
    date: (value: string, options?: Intl.DateTimeFormatOptions) => new Date(value).toLocaleString(locales[language], options),
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
  Text: "Texte", Image: "Image", Audio: "Audio", Video: "Vidéo", Vector: "Vecteur",
  Chat: "Conversation", Code: "Code", Reasoning: "Raisonnement", Vision: "Vision",
  "Tool calling": "Appels d’outils", Tools: "Outils", Streaming: "Diffusion continue",
  "Structured output": "Sortie structurée", "Image generation": "Génération d’images",
  Embeddings: "Vecteurs", Editing: "Édition", Dimensions: "Dimensions",
};
export function useTerm() {
  const language = useLanguage();
  return (term: string) => language === "fr" ? terms[term] || term : term;
}
