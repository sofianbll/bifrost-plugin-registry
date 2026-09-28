import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../../lib/locale";
import { KeyCreateForm } from "./KeyCreateForm";
import { keyFormState } from "./key-form";

const render = (error: string, language: "en" | "fr") => renderToStaticMarkup(<LanguageContext.Provider value={language}><KeyCreateForm draft={{ name: "", client: "" }} error={error} onChange={() => {}} /></LanguageContext.Provider>);

// The key creation form follows the group form contract: required marker, inline message, aria-invalid.
const required = keyFormState({ name: "", client: "" }, [], { required: "Saisissez un nom de clé.", duplicate: "Une clé portant ce nom existe déjà." }).error;
const invalid = render(required, "fr");
if (!invalid.includes("Nom *")) throw new Error("the required key name must keep its marker");
if (!invalid.includes("Saisissez un nom de clé.")) throw new Error("the empty key name must show its message under the field");
if (!invalid.includes('aria-invalid="true"') || !invalid.includes('aria-required="true"')) throw new Error("the invalid key name must expose aria-invalid and aria-required");
if (!invalid.includes('data-invalid="true"')) throw new Error("the invalid field must be marked for the shared field styling");

const duplicate = render("Une clé portant ce nom existe déjà.", "fr");
if (!duplicate.includes("Une clé portant ce nom existe déjà.")) throw new Error("a duplicate key name must show its message under the field");

const valid = render("", "fr");
if (!valid.includes("Obligatoire") || valid.includes('aria-invalid="true"') || valid.includes('data-invalid="true"')) throw new Error("a valid key name must not stay marked invalid");
if (!valid.includes("Client")) throw new Error("the optional client field must stay available");

console.log("Key form rendering checks passed");
