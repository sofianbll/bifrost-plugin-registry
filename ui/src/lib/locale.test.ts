import { formatAge, syncIsStale } from "./locale";

// Settings shows how old the last sync is, and a sync older than a day is not shown as fresh.
const must = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const now = Date.parse("2026-10-11T12:00:00Z");
must(formatAge("en", "2026-10-09T12:00:00Z", now) === "2 days ago", `English age: ${formatAge("en", "2026-10-09T12:00:00Z", now)}`);
must(formatAge("fr", "2026-10-09T12:00:00Z", now) === "il y a 2 jours", `French age: ${formatAge("fr", "2026-10-09T12:00:00Z", now)}`);
must(formatAge("en", "2026-10-11T09:00:00Z", now) === "3 hours ago", `hours: ${formatAge("en", "2026-10-11T09:00:00Z", now)}`);
must(formatAge("en", "2026-10-11T11:55:00Z", now) === "5 minutes ago", `minutes: ${formatAge("en", "2026-10-11T11:55:00Z", now)}`);
must(!syncIsStale("2026-10-10T13:00:00Z", now), "23 hours is fresh");
must(syncIsStale("2026-10-10T11:00:00Z", now), "25 hours is stale");
must(syncIsStale(undefined, now), "no sync is not fresh");
console.log("Sync age checks passed");
