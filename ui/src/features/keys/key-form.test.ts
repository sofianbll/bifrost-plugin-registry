import { keyFormState } from "./key-form";

const messages = { required: "Saisissez un nom de clé.", duplicate: "Une clé portant ce nom existe déjà." };
const keys = [{ name: "Hermes staging" }, { name: "Isolated proof key" }];

const empty = keyFormState({ name: "", client: "" }, keys, messages);
if (empty.error !== messages.required || empty.canSubmit) throw new Error("Empty key name must stay blocked with the required message");

const blanks = keyFormState({ name: "   ", client: "Fixture" }, keys, messages);
if (blanks.error !== messages.required || blanks.canSubmit) throw new Error("Whitespace-only key name must stay blocked");

const duplicate = keyFormState({ name: "  hermes STAGING ", client: "" }, keys, messages);
if (duplicate.error !== messages.duplicate || duplicate.canSubmit) throw new Error("Duplicate key name must be reported and blocked");

const valid = keyFormState({ name: "  UX audit key  ", client: "" }, keys, messages);
if (valid.error || !valid.canSubmit || valid.name !== "UX audit key") throw new Error("Valid key name must be trimmed and accepted");

const absent = keyFormState(null, keys, messages);
if (absent.canSubmit || absent.error !== "") throw new Error("A closed form must not submit");

console.log("Key form checks passed");
