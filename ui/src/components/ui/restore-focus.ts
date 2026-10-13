import { useRef } from "react";

type Handler = (event: Event) => void;

// Sheets and dialogs open from state, not from a Radix Trigger, so Radix has no trigger to give the focus back to
// and it falls to <body> on close. This remembers what had the focus when the content opened and returns it there
// when it closes, if that element is still on the page. A caller that handles the close focus itself
// (event.preventDefault()) keeps it.
export function useRestoreFocus(onOpenAutoFocus?: Handler, onCloseAutoFocus?: Handler) {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      const target = opener.current;
      if (event.defaultPrevented || !target?.isConnected || target === document.body) return;
      event.preventDefault();
      target.focus();
    },
  };
}
