import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCopy } from "../../lib/locale";
import { HelpContent } from "./HelpContent";

// "?" opens the help beside the page it was asked on: the URL does not change. The help is the same on
// every page, so its title names no page.
export function HelpSheet({
  open,
  onOpenChange,
  canStart,
  onStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canStart: boolean;
  onStart: () => void;
}) {
  const copy = useCopy();
  const starting = useRef(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The tour takes the focus when it starts: the sheet must not hand it back to "?". */}
      <SheetContent
        className="p-4 sm:max-w-md sm:p-6"
        onCloseAutoFocus={event => {
          if (starting.current) {
            event.preventDefault();
            starting.current = false;
          }
        }}
      >
        <SheetHeader headerClassName="-mx-4 -mt-4 w-auto border-b bg-muted/40 px-4 py-4 sm:-mx-6 sm:-mt-6 sm:px-6">
          <SheetTitle className="text-xl">{copy("Help", "Aide")}</SheetTitle>
          <SheetDescription>
            {copy("A short path through Registry.", "Parcours rapide dans Registry.")}
          </SheetDescription>
        </SheetHeader>
        <div className="custom-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Button
              type="button"
              disabled={!canStart}
              onClick={() => {
                starting.current = true;
                onStart();
              }}
            >
              {copy("Start the tour", "Commencer la visite")}
            </Button>
            {!canStart && (
              <p className="text-xs text-muted-foreground">
                {copy(
                  "Save or discard your key draft first.",
                  "Enregistrez ou abandonnez d’abord votre brouillon de clé.",
                )}
              </p>
            )}
          </div>
          <HelpContent />
        </div>
      </SheetContent>
    </Sheet>
  );
}
