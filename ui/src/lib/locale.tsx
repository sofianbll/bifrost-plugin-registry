import { createContext, useContext } from "react";
import { creatorKey } from "../domain/registry";

export type Language = "en" | "fr";
export const LanguageContext = createContext<Language>("en");
export function useLanguage() { return useContext(LanguageContext); }
export function useCopy() {
  const language = useLanguage();
  return (english: string, french: string) => language === "fr" ? french : english;
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
