import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy, type Copy } from "../../lib/locale";
import { pickAnchor, tourSteps, type TourStep } from "./tourSteps";

// The step texts, also read by the help test.
export const stepCopy = (id: TourStep["id"], copy: Copy) =>
  ({
    models: {
      title: copy("My models", "Mes modèles"),
      text: copy(
        "These are your registered model cards. Open one to read it; use Edit to change it. “To add” lists what Bifrost found and you have not registered yet.",
        "Voici vos fiches modèles enregistrées. Ouvrez-en une pour la lire, puis Modifier pour la changer. « À ajouter » liste ce que Bifrost a trouvé et que vous n’avez pas encore enregistré.",
      ),
    },
    groups: {
      title: copy("Groups", "Groupes"),
      text: copy(
        "A group is a set of models you reuse. Put it on several keys and change it once.",
        "Un groupe est un ensemble de modèles que vous réutilisez. Mettez-le sur plusieurs clés et changez-le une seule fois.",
      ),
    },
    keys: {
      title: copy("Virtual keys", "Clés virtuelles"),
      text: copy(
        "A key lists the models one app or person can call. In Edit selection, work through Models, Groups and Review, then publish.",
        "Une clé liste les modèles qu’une application ou une personne peut appeler. Dans Modifier la sélection, passez par Modèles, Groupes et Vérifier, puis publiez.",
      ),
    },
    adoption: {
      title: copy("Adopting a key", "Adopter une clé"),
      text: copy(
        "A key that already exists in Bifrost is adopted first. Registry shows if it is ready, then you confirm. Registry never gives a key more access than Bifrost allows.",
        "Une clé qui existe déjà dans Bifrost s’adopte d’abord. Registry indique si elle est prête, puis vous confirmez. Registry ne donne jamais plus d’accès que Bifrost.",
      ),
    },
  })[id];

// Offered once on the first visit, inline so that it covers nothing. The app shows it on My models only, and a
// phone does not show it at all (it would push the page down): "?" starts the tour from any page and width.
export function TourOffer({
  canStart,
  onStart,
  onDismiss,
}: {
  canStart: boolean;
  onStart: () => void;
  onDismiss: () => void;
}) {
  const copy = useCopy();
  return (
    <section
      aria-label={copy("Guided tour", "Visite guidée")}
      onKeyDown={event => {
        if (event.key === "Escape") onDismiss();
      }}
      className="mb-5 hidden flex-wrap items-center justify-between gap-3 rounded-sm border bg-muted/30 p-3 text-sm sm:flex"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {copy("New here? Take a one-minute tour.", "Nouveau ici ? Faites un tour d’une minute.")}
        </p>
        <p className="text-muted-foreground">
          {canStart
            ? copy("Models, Groups, Keys, then adopting a key.", "Modèles, groupes, clés, puis l’adoption d’une clé.")
            : copy(
                "Publish or discard your key draft first.",
                "Publiez ou abandonnez d’abord votre brouillon de clé.",
              )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!canStart} onClick={onStart}>
          {copy("Start the tour", "Commencer la visite")}
        </Button>
        <Button size="sm" variant="outline" onClick={onDismiss}>
          {copy("Not now", "Pas maintenant")}
        </Button>
      </div>
    </section>
  );
}

const anchorOf = (name: string) => document.querySelector(`[data-tour="${name}"]`);
const findAnchor = (step: TourStep) => {
  const name = pickAnchor(step, name => !!anchorOf(name));
  return name ? anchorOf(name) : null;
};

// A non-modal tour: a card docked at the bottom and a ring on the anchor. The page stays usable. A step
// whose anchor never shows up is skipped, and leaving the tour puts the person back where they started.
export function Tour({
  page,
  pageId,
  go,
  onClose,
}: {
  page: string;
  pageId?: string;
  go: (page: string, id?: string) => void;
  onClose: () => void;
}) {
  const copy = useCopy();
  const titleId = useId();
  const textId = useId();
  const origin = useRef({ page, id: pageId });
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [index, setIndex] = useState(0);
  const direction = useRef(1);
  // The step on show: it changes only once its anchor is found, so the card never flashes empty.
  const [shown, setShown] = useState<{ index: number; anchor: Element } | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const step = tourSteps[index];

  const close = () => {
    if (page !== origin.current.page || pageId !== origin.current.id) go(origin.current.page, origin.current.id);
    onClose();
    const back = opener.current?.isConnected ? opener.current : document.querySelector<HTMLElement>("[data-help]");
    back?.focus();
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  const move = (by: number) => {
    direction.current = by;
    const next = index + by;
    if (next < 0 || next >= tourSteps.length) closeRef.current();
    else setIndex(next);
  };
  const moveRef = useRef(move);
  moveRef.current = move;

  // A new step goes to its page, then waits for its anchor (the page may still be loading) and gives up
  // after ~2.5 s. Moving around by hand during the tour is left alone: only a new step navigates.
  const pageRef = useRef(page);
  pageRef.current = page;
  useEffect(() => {
    if (pageRef.current !== step.page) go(step.page);
    let tries = 0;
    const look = () => {
      const anchor = pageRef.current === step.page ? findAnchor(step) : null;
      if (anchor) {
        clearInterval(timer);
        setShown({ index, anchor });
        return;
      }
      if (++tries > 16) {
        clearInterval(timer);
        moveRef.current(direction.current);
      }
    };
    const timer = setInterval(look, 150);
    look();
    return () => clearInterval(timer);
  }, [index]);

  // Ring the anchor and keep it in view.
  const anchor = shown?.anchor;
  useEffect(() => {
    if (!anchor) return;
    anchor.scrollIntoView({ block: "center" });
    const measure = () => setRect(anchor.isConnected ? anchor.getBoundingClientRect() : null);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(anchor);
    addEventListener("resize", measure);
    addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      removeEventListener("resize", measure);
      removeEventListener("scroll", measure, true);
    };
  }, [anchor]);

  // Focus moves into the card when it first shows, or when the button that had it went away.
  useEffect(() => {
    if (shown && !card.current?.contains(document.activeElement)) card.current?.focus({ preventScroll: true });
  }, [shown]);

  // Escape leaves the tour, unless a dialog or menu above it took the key first.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector("[role=dialog][data-state=open], [role=alertdialog]")
      )
        closeRef.current();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  if (!shown) return null;
  const { title, text } = stepCopy(tourSteps[shown.index].id, copy);
  const last = shown.index === tourSteps.length - 1;
  return (
    <>
      {rect && (
        <div
          aria-hidden
          data-tour-ring
          className="pointer-events-none fixed z-40 rounded-sm outline-solid outline-2 outline-offset-4 outline-primary"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}
      <div
        ref={card}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={textId}
        tabIndex={-1}
        className="fixed inset-x-4 bottom-4 z-40 space-y-3 rounded-sm border bg-card p-4 text-sm shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:right-6 sm:bottom-6 sm:left-auto sm:w-96"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {copy("Guided tour", "Visite guidée")} ·{" "}
              {copy(
                `Step ${shown.index + 1} of ${tourSteps.length}`,
                `Étape ${shown.index + 1} sur ${tourSteps.length}`,
              )}
            </p>
            <p id={titleId} className="font-semibold">
              {title}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-mt-1 -mr-2 size-8 shrink-0"
            aria-label={copy("Close the tour", "Fermer la visite")}
            onClick={close}
          >
            <X className="size-4" />
          </Button>
        </div>
        <p id={textId} aria-live="polite" className="text-muted-foreground">
          {text}
        </p>
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            {copy("Skip the tour", "Passer la visite")}
          </Button>
          <div className="flex items-center gap-2">
            {shown.index > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  direction.current = -1;
                  setIndex(shown.index - 1);
                }}
              >
                {copy("Back", "Retour")}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => {
                direction.current = 1;
                if (last) close();
                else setIndex(shown.index + 1);
              }}
            >
              {last ? copy("Done", "Terminé") : copy("Next", "Suivant")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
