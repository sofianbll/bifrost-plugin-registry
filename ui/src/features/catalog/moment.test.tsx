import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext, useFormat, type Language } from "../../lib/locale";
import { moment } from "./moment";

const value = "2026-10-12T14:30:45Z";
const dates = (language: Language) => {
  const Dates = () => {
    const format = useFormat();
    return <>{`${moment(format, value)}|${format.date(value)}`}</>;
  };
  const [shown, plain] = renderToStaticMarkup(
    <LanguageContext.Provider value={language}>
      <Dates />
    </LanguageContext.Provider>,
  ).split("|");
  return { shown, plain };
};
const check = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

for (const language of ["en", "fr"] as const) {
  const { shown, plain } = dates(language);
  check(/\d{1,2}:30/.test(shown), `${language}: the time is there to the minute, got "${shown}"`);
  check(!/\d{1,2}:\d{2}:\d{2}/.test(shown), `${language}: no seconds, got "${shown}"`);
  // The plain format.date is what the screens showed: with seconds.
  check(/\d{1,2}:\d{2}:45/.test(plain), `${language}: format.date alone shows seconds, got "${plain}"`);
}
console.log("moment checks passed");
