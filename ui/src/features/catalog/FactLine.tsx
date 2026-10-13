import { fieldLabel, sourceLabel, type CatalogField } from "./catalog-api";
import { useCopy, useFormat } from "../../lib/locale";
import { moment } from "./moment";

// One catalogue fact on one line: "Label: value · source · declared · date".
export function FactLine({ field, fact }: { field: string; fact: CatalogField }) {
  const copy = useCopy();
  const format = useFormat();
  return (
    <p className="break-words">
      <strong>
        {fieldLabel(field, copy)}
        {format.colon}
      </strong>{" "}
      {format.value(fact.value)}{" "}
      <span className="text-muted-foreground">
        · {sourceLabel(fact.source, copy)} ·{" "}
        {fact.kind === "observed" ? copy("observed", "observé") : copy("declared", "déclaré")} ·{" "}
        {fact.updatedAt ? moment(format, fact.updatedAt) : copy("date unknown", "date inconnue")}
      </span>
    </p>
  );
}
