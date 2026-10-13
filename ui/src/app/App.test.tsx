import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../lib/locale";
import { SnapshotSource } from "./App";

// The snapshot banner names when the copy was captured in the UI's one time format: the day in the language's
// own form plus hours and minutes, never seconds, as Settings and the key page write theirs.
const must = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const banner = (language: "en" | "fr", capturedAt?: string, source?: string) =>
  renderToStaticMarkup(
    <LanguageContext.Provider value={language}>
      <SnapshotSource source={source} capturedAt={capturedAt} />
    </LanguageContext.Provider>,
  )
    .split(/<[^>]*>/)
    .join("");

const english = banner("en", "2026-10-12T12:30:45Z", "Pulsar");
const french = banner("fr", "2026-10-12T12:30:45Z", "Pulsar");
must(
  /^Snapshot copy · Pulsar · captured Oct 12, 2026, \d{1,2}:\d{2}\s(?:AM|PM)$/.test(english),
  `English capture time, got ${english}`,
);
must(
  /^Copie d’instantané · Pulsar · capturée 12\/10\/2026 \d{2}:\d{2}$/.test(french),
  `French capture time, got ${french}`,
);
must(!/\d{1,2}:\d{2}:\d{2}/.test(english + french), "no seconds in either language");
must(banner("en") === "Snapshot copy · Registry", "no capture time, no sentence about it");
console.log("App banner checks passed");
