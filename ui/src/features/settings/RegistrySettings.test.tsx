import { renderToStaticMarkup } from "react-dom/server";
import { defaultViewOptions } from "../../components/registry/ViewOptions";
import type { Catalog } from "../catalog/catalog-api";
import { LanguageContext } from "../../lib/locale";
import RegistrySettings from "./RegistrySettings";

// The sync dates of Settings use the UI's one time format: the day in the language's own form plus hours and
// minutes, never seconds, the same as the key page and the snapshot banner.
const must = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const text = (html: string) => html.split(/<[^>]*>/).join("");
const catalog: Catalog = {
  revision: "r1",
  references: [],
  accesses: [],
  sources: [
    {
      id: "models.dev",
      lastSuccess: "2026-10-12T12:30:45Z",
      lastAttempt: "2026-10-12T12:31:50Z",
      sourceAt: "2026-10-11T08:15:30Z",
    },
    { id: "bifrost" },
  ],
};
const sources = (language: "en" | "fr") =>
  text(
    renderToStaticMarkup(
      <LanguageContext.Provider value={language}>
        <RegistrySettings
          preferences={defaultViewOptions}
          onPreferencesChange={() => {}}
          snapshotMode={false}
          onNavigate={() => {}}
          onUnauthorized={() => {}}
          catalog={catalog}
          catalogError=""
          initialSection="sources"
        />
      </LanguageContext.Provider>,
    ),
  );

const english = sources("en");
const french = sources("fr");
const time = String.raw`\d{1,2}:\d{2}\s(?:AM|PM)`;
must(
  new RegExp(`Source date: Oct 11, 2026, ${time}`).test(english) &&
    new RegExp(`Last success: Oct 12, 2026, ${time} · Last attempt: Oct 12, 2026, ${time}`).test(english),
  `English sync dates: day, hours and minutes, got ${english}`,
);
must(
  /Date de la source : 11\/10\/2026 \d{2}:\d{2}/.test(french) &&
    /Dernière réussite : 12\/10\/2026 \d{2}:\d{2} · Dernière tentative : 12\/10\/2026 \d{2}:\d{2}/.test(french),
  `French sync dates: day, hours and minutes, got ${french}`,
);
must(!/\d{1,2}:\d{2}:\d{2}/.test(english + french), "no seconds in either language");
must(
  english.includes("Last success: Not recorded") && french.includes("Dernière réussite : Non renseigné"),
  "a source never synced reads Not recorded",
);
console.log("Registry settings checks passed");
