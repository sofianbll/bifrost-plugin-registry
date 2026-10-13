import {
  formatAge,
  formatDay,
  formatMoment,
  initialLanguage,
  languageKey,
  rememberLanguage,
  syncIsStale,
} from "./locale";

// Settings shows how old the last sync is, and a sync older than a day is not shown as fresh.
const must = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const now = Date.parse("2026-10-11T12:00:00Z");
must(
  formatAge("en", "2026-10-09T12:00:00Z", now) === "2 days ago",
  `English age: ${formatAge("en", "2026-10-09T12:00:00Z", now)}`,
);
must(
  formatAge("fr", "2026-10-09T12:00:00Z", now) === "il y a 2 jours",
  `French age: ${formatAge("fr", "2026-10-09T12:00:00Z", now)}`,
);
must(
  formatAge("en", "2026-10-11T09:00:00Z", now) === "3 hours ago",
  `hours: ${formatAge("en", "2026-10-11T09:00:00Z", now)}`,
);
must(
  formatAge("en", "2026-10-11T11:55:00Z", now) === "5 minutes ago",
  `minutes: ${formatAge("en", "2026-10-11T11:55:00Z", now)}`,
);
must(!syncIsStale("2026-10-10T13:00:00Z", now), "23 hours is fresh");
must(syncIsStale("2026-10-10T11:00:00Z", now), "25 hours is stale");
must(syncIsStale(undefined, now), "no sync is not fresh");
console.log("Sync age checks passed");

// #85 round 2: the chosen language survives a bare URL; ?lang= still wins; blocked storage is not an error.
const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};
const kept = memory();
must(initialLanguage("", kept) === "en", "first visit: English");
rememberLanguage(kept, "fr");
must(
  kept.getItem(languageKey) === "fr" && languageKey.startsWith("bifrost-registry."),
  "the choice is kept under a Registry key",
);
must(initialLanguage("", kept) === "fr", "a bare URL keeps French");
must(initialLanguage("?lang=en", kept) === "en", "?lang= wins over the remembered choice");
must(initialLanguage("?lang=fr", memory()) === "fr", "?lang=fr without memory");
kept.setItem(languageKey, "de");
must(initialLanguage("", kept) === "en", "an unknown remembered value falls back to English");
const blocked = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};
must(
  initialLanguage("", blocked) === "en" && initialLanguage("?lang=fr", blocked) === "fr",
  "unreadable storage reads the URL only",
);
rememberLanguage(blocked, "fr"); // must not throw
must(initialLanguage("", null) === "en", "no storage at all");
console.log("Language memory checks passed");

// Dates read in the UI language, never the ambiguous 10/12/2026 in English; a time is the day plus hours and minutes,
// never seconds, in the one format every screen uses (key page, key editor, Settings, snapshot banner).
const stamp = "2026-10-12T12:30:45Z";
must(
  formatDay("en", stamp) === "Oct 12, 2026" && formatDay("fr", stamp) === "12/10/2026",
  `locale days, got ${formatDay("en", stamp)} / ${formatDay("fr", stamp)}`,
);
must(
  /^Oct 12, 2026, \d{1,2}:\d{2}\s(AM|PM)$/.test(formatMoment("en", stamp)) &&
    /^12\/10\/2026 \d{2}:\d{2}$/.test(formatMoment("fr", stamp)),
  `moment, got ${formatMoment("en", stamp)} / ${formatMoment("fr", stamp)}`,
);
must(
  formatMoment("en", stamp).startsWith(formatDay("en", stamp)) &&
    formatMoment("fr", stamp).startsWith(formatDay("fr", stamp)),
  "a time starts with the day as written beside it",
);
console.log("Date format checks passed");
