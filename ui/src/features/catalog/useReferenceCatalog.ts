import { useState } from "react";
import { ApiError } from "../../data/api";
import type { Copy } from "../../lib/locale";
import { getCatalog, type Catalog } from "./catalog-api";

export function useReferenceCatalog(copyText: Copy, requireLogin: () => void) {
  const [referenceCatalog, setReferenceCatalog] = useState<Catalog | null>(null);
  const [referenceError, setReferenceError] = useState("");
  const loadReferenceCatalog = async () => {
    try {
      setReferenceCatalog(await getCatalog());
      setReferenceError("");
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) requireLogin();
      else
        setReferenceError(
          error instanceof Error
            ? error.message
            : copyText("Datasheet catalog unavailable.", "Catalogue de référence indisponible."),
        );
      return false;
    }
  };

  return { referenceCatalog, setReferenceCatalog, referenceError, setReferenceError, loadReferenceCatalog };
}
