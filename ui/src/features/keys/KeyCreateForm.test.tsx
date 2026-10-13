import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import { KeyCreateForm } from "./KeyCreateForm";
import { keyFormState } from "./key-form";

const render = (error: string, language: "en" | "fr", name = "") =>
  renderToStaticMarkup(
    <LanguageContext.Provider value={language}>
      <KeyCreateForm draft={{ name, client: "" }} error={error} onChange={() => {}} />
    </LanguageContext.Provider>,
  );

// The key creation form follows the group form contract: required marker, inline message, aria-invalid, and a field
// that is not shouted at before it is touched (the red message waits for a blur or for typing).
const messages = {
  required: "Saisissez un nom de clé.",
  duplicate: "Une clé portant ce nom existe déjà.",
};
const required = keyFormState({ name: "", client: "" }, [], messages).error;
const pristine = render(required, "fr");
if (!pristine.includes("Nom *")) throw new Error("the required key name must keep its marker");
if (!pristine.includes("Obligatoire") || pristine.includes(messages.required))
  throw new Error("an untouched empty key name must show the neutral hint, not its error");
if (pristine.includes('aria-invalid="true"') || pristine.includes('data-invalid="true"'))
  throw new Error("an untouched empty key name must not be marked invalid");
if (!pristine.includes('aria-required="true"')) throw new Error("the key name must stay aria-required");

const duplicateError = keyFormState({ name: "Hermes", client: "" }, [{ name: "hermes" }], messages).error;
const duplicate = render(duplicateError, "fr", "Hermes");
if (!duplicate.includes(messages.duplicate))
  throw new Error("a duplicate key name must show its message under the field");
if (!duplicate.includes('aria-invalid="true"') || !duplicate.includes('data-invalid="true"'))
  throw new Error("a duplicate key name must be marked invalid for assistive technology and the field styling");

const valid = render("", "fr", "Hermes staging");
if (!valid.includes("Obligatoire") || valid.includes('aria-invalid="true"') || valid.includes('data-invalid="true"'))
  throw new Error("a valid key name must not stay marked invalid");
if (!valid.includes("Client")) throw new Error("the optional client field must stay available");

console.log("Key form rendering checks passed");
