import { renderToStaticMarkup } from "react-dom/server";
import { ProviderIcons } from "@/lib/constants/icons";
import type { Model } from "../../domain/registry";
import { BrandIcon, displayProvider, distinctInitials, markFor, setMarkLabels } from "./BrandIcon";

const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

// Every creator the icon set covers has its mark, under its own name or its display name.
for (const key of Object.keys(ProviderIcons)) equal([key, markFor(displayProvider(key))?.icon], [key, key]);
equal(markFor("Amazon")?.icon, "bedrock");
equal(markFor("Microsoft")?.icon, "azure");

// Creators of the embedded Models.dev snapshot (as the server names them) plus the fixture's own.
const creators = ["AI21 Labs", "AI Singapore", "Alibaba", "Amazon", "Anthropic", "Arcee AI", "ByteDance Seed", "Cohere", "DeepReinforce", "DeepSeek", "Google", "IBM", "inclusionAI", "Meituan", "Meta", "Microsoft", "MiniMax", "Mistral", "Mixedbread", "Moonshot AI", "Motif Technologies", "Nex AGI", "Nvidia", "OpenAI", "OpenBMB", "Perplexity", "Poolside", "QuiverAI", "Sakana AI", "Sarvam AI", "SDAIA", "StepFun", "Swiss AI", "Tencent", "Thinking Machines", "Trendyol", "Typesafe", "Unbiased", "Upstage", "Vispark", "Vivgrid", "Writer", "xAI", "Xiaomi", "Zhipu AI", "Fixture Labs"];
const markless = creators.filter(creator => !markFor(creator));
const initials = distinctInitials(markless);
equal(initials.size, markless.length);
equal(new Set(initials.values()).size, markless.length); // no two identities read the same
for (const value of initials.values()) equal(value.length, 2);
equal(initials.get("Fixture Labs"), "FI"); // the first two letters stay the default
equal(initials.get("Meituan") !== initials.get("Meta"), true);
// Independent of the order labels arrive in.
equal([...distinctInitials(["Meta", "Meituan"])].sort(), [...distinctInitials(["Meituan", "Meta"])].sort());
equal(distinctInitials(["Zhipu AI"]).get("Zhipu AI"), "ZH");

// What a creator mark reads once the labels on screen are known.
const model = (creator: string) => ({ creator, accesses: [] }) as unknown as Model;
const read = (creator: string) => renderToStaticMarkup(<BrandIcon model={model(creator)} mode="creator" />);
setMarkLabels(["Meta", "Meituan", "Anthropic"]);
const meta = />([A-Z]{2})<\/span>/.exec(read("Meta"))?.[1];
const meituan = />([A-Z]{2})<\/span>/.exec(read("Meituan"))?.[1];
equal(!!meta && !!meituan && meta !== meituan, true);
equal(/<svg/.test(read("Anthropic")), true); // a mark wins over initials
setMarkLabels([]);

// The four bundled images resolve against the page, so the panel works under a sub-path.
for (const [name, file] of [["azure", "azure.webp"], ["sgl", "sgl.webp"], ["nebius", "nebius.webp"], ["databricks", "databricks.svg"]] as const) {
  const Icon = ProviderIcons[name] as (props: { size?: number }) => React.ReactElement;
  const src = /src="([^"]+)"/.exec(renderToStaticMarkup(Icon({})))?.[1] ?? "";
  equal(src.startsWith("/"), false);
  equal(new URL(src, "https://gateway.example/model-registry/").pathname, `/model-registry/images/${file}`);
}
console.log("brand icon checks passed");
