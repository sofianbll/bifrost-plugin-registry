import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import type { Model } from "../../domain/registry";
import { ModelAccessMenu } from "./ModelAccessMenu";

const model = {
  id: "qa-opus",
  name: "QA Opus",
  accesses: [
    {
      provider: "Claude",
      id: "Claude/qa-opus",
      nativeModel: "qa-opus",
      route: "Direct provider",
      status: "Configured",
    },
  ],
} as unknown as Model;
const html = (language: "en" | "fr") =>
  renderToStaticMarkup(
    <LanguageContext.Provider value={language}>
      <ModelAccessMenu model={model} count={3} />
    </LanguageContext.Provider>,
  );

// The Accesses button counts the accesses; "+N available" is the card badge's to say, so it is not repeated here.
if (!html("en").includes("Accesses · 3") || !html("fr").includes("Accès · 3"))
  throw new Error("the Accesses button counts the card's accesses");
for (const language of ["en", "fr"] as const)
  if (/\+\d|available|disponible/.test(html(language)))
    throw new Error(`the Accesses button must not repeat the available accesses (${language})`);
console.log("The Accesses button counts accesses and does not repeat +N available: OK");
