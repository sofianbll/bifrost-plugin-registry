import type { useFormat } from "../../lib/locale";

// A date and time to the minute, in the UI language: a sync or a fact is never dated to the second.
// TODO: use format.moment once fix/review-keys is merged
export const moment = (format: Pick<ReturnType<typeof useFormat>, "date">, value: string) =>
  format.date(value, { dateStyle: "medium", timeStyle: "short" });
