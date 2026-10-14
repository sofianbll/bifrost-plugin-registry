import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/lib/locale";

type Props = {
  labels: string[];
  step: number;
  onStepChange: (step: number) => boolean | void;
  expert: boolean;
  children: ReactNode;
  expertContent?: ReactNode;
  summary: ReactNode;
  footer: ReactNode;
  // The read view of a saved card shows no steps.
  hideSteps?: boolean;
  // Expert's one scroll: the active step follows what fills the view (scroll-spy), not only clicks (#110).
  onStepSpy?: (step: number) => void;
};

// Expert shows every step in one scroll: whatever moves to a step brings its section into view. Only the editor's
// own scroll container moves: scrollIntoView also scrolls the overflow-hidden sheet shell once the container
// reaches its end, which takes the header and the stepper off screen.
export function revealJourneyStep(index: number, last: boolean) {
  const section =
    document.getElementById(`editor-journey-step-${index}`) ??
    (last ? document.getElementById("editor-journey-summary") : null);
  const scroller = section?.closest<HTMLElement>("[data-journey-scroll]");
  if (!section || !scroller) return;
  const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
  scroller.scrollTo({
    top: scroller.scrollTop + section.getBoundingClientRect().top - scroller.getBoundingClientRect().top - margin,
    behavior: "smooth",
  });
}

// Basic or Expert is the header switch's choice: the editor has no switch of its own.
export function EditorJourney({
  labels,
  step,
  onStepChange,
  expert,
  children,
  expertContent,
  summary,
  footer,
  hideSteps,
  onStepSpy,
}: Props) {
  const copy = useCopy();
  // The spy reads the sections once the scroll settles (one animation frame), never mid-frame.
  const spyFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(spyFrame.current), []);
  const spy = (event: React.UIEvent<HTMLElement>) => {
    if (!expert || !onStepSpy) return;
    const scroller = event.currentTarget;
    cancelAnimationFrame(spyFrame.current);
    spyFrame.current = requestAnimationFrame(() => {
      const sections = [...scroller.querySelectorAll<HTMLElement>('[id^="editor-journey-step-"]')];
      if (!sections.length) return;
      const index = (section: Element) => Number(section.id.replace("editor-journey-step-", ""));
      const top = scroller.getBoundingClientRect().top;
      let active = index(sections[0]);
      for (const section of sections) if (section.getBoundingClientRect().top - top <= 96) active = index(section);
      // Scrolled to the end: the last step is active even when its section is shorter than the view.
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4)
        active = index(sections[sections.length - 1]);
      onStepSpy(active);
    });
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!hideSteps && (
        <header className="shrink-0 space-y-3 border-b pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <nav aria-label={copy("Steps", "Étapes")}>
              <ol className="flex flex-wrap gap-1">
                {labels.map((label, index) => (
                  <li key={label}>
                    <Button
                      type="button"
                      size="sm"
                      variant={step === index ? "default" : "ghost"}
                      aria-current={step === index ? "step" : undefined}
                      onClick={() => {
                        const accepted = onStepChange(index);
                        if (expert && accepted !== false) revealJourneyStep(index, index === labels.length - 1);
                      }}
                    >
                      {index + 1}. {label}
                    </Button>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </header>
      )}
      <div
        data-journey-scroll
        onScroll={spy}
        className="@container/journey custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 pr-1"
      >
        {expert ? (
          <div className="grid min-w-0 items-start gap-4 @min-[52rem]/journey:grid-cols-[minmax(0,1fr)_minmax(15rem,19rem)]">
            <div className="min-w-0 space-y-5">{expertContent ?? children}</div>
            <aside
              id="editor-journey-summary"
              className="min-w-0 rounded-sm border bg-card p-3 @min-[52rem]/journey:sticky @min-[52rem]/journey:top-0 @min-[52rem]/journey:max-h-[max(12rem,calc(100dvh-18rem))] @min-[52rem]/journey:overflow-y-auto"
            >
              {summary}
            </aside>
          </div>
        ) : (
          children
        )}
      </div>
      <footer className="shrink-0 border-t bg-card pt-3">{footer}</footer>
    </div>
  );
}
