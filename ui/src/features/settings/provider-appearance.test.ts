import { providerImageFileError } from "./ProviderAppearance";
import { displayProvider, markFor, providerMark } from "@/components/registry/BrandIcon";

const equal = (actual: unknown, expected: unknown) => {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
};

equal(providerImageFileError({ type: "image/png", size: 256 * 1024 }), undefined);
equal(providerImageFileError({ type: "image/jpeg", size: 1 }), undefined);
equal(providerImageFileError({ type: "image/webp", size: 1 }), undefined);
equal(providerImageFileError({ type: "image/svg+xml", size: 1 }), "unsupported-type");
equal(providerImageFileError({ type: "image/png", size: 256 * 1024 + 1 }), "file-too-large");

// One identity lookup: normalized names reach the full icon set; nothing found means initials.
equal(markFor("DeepSeek")?.icon, "deepseek");
equal(markFor("x-ai")?.icon, "xai");
equal(markFor("Sarvam AI")?.icon, "sarvam");
equal(markFor("moonshotai")?.image, markFor("Moonshot AI")?.image);
equal(markFor("Meta"), undefined);
equal(markFor("constructor"), undefined);
// Providers: the Settings override first, then a custom provider's base type, then its own name.
equal(providerMark("Claude", undefined, "anthropic")?.icon, "anthropic");
equal(providerMark("Google", undefined, "gemini")?.icon, "gemini");
equal(providerMark("Claude", { icon: "mistral" }, "anthropic")?.icon, "mistral");
equal(providerMark("openrouter")?.icon, "openrouter");
equal(providerMark("typesafe"), undefined);
equal(displayProvider("openrouter"), "OpenRouter");
equal(displayProvider("Claude"), "Claude");
console.log("provider appearance checks passed");
