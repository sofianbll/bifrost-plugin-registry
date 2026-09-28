import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/lib/locale";

type Props = {
  labels: string[];
  step: number;
  onStepChange: (step: number) => boolean | void;
  expert: boolean;
  onExpertChange: (expert: boolean) => void;
  canExpert?: boolean;
  children: ReactNode;
  expertContent?: ReactNode;
  summary: ReactNode;
  footer: ReactNode;
};

export function EditorJourney({ labels, step, onStepChange, expert, onExpertChange, canExpert = true, children, expertContent, summary, footer }: Props) {
  const copy = useCopy();
  return <div className="flex min-h-0 flex-1 flex-col">
    <header className="shrink-0 space-y-3 border-b pb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label={copy("Steps", "Étapes")}><ol className="flex flex-wrap gap-1">{labels.map((label, index) => <li key={label}><Button type="button" size="sm" variant={step === index ? "default" : "ghost"} aria-current={step === index ? "step" : undefined} onClick={() => { const accepted = onStepChange(index); if (expert && accepted !== false) (document.getElementById(`editor-journey-step-${index}`) ?? (index === labels.length - 1 ? document.getElementById("editor-journey-summary") : null))?.scrollIntoView({ block: "start", behavior: "smooth" }); }}>{index + 1}. {label}</Button></li>)}</ol></nav>
        {canExpert && <div className="flex gap-1" role="group" aria-label={copy("Editor detail", "Détail de l’éditeur")}>
          <Button type="button" size="sm" variant={!expert ? "secondary" : "ghost"} aria-pressed={!expert} onClick={() => onExpertChange(false)}>{copy("Basic", "Simple")}</Button>
          <Button type="button" size="sm" variant={expert ? "secondary" : "ghost"} aria-pressed={expert} onClick={() => onExpertChange(true)}>{copy("Expert", "Expert")}</Button>
        </div>}
      </div>
    </header>
    <div className="@container/journey custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 pr-1">
      {expert ? <div className="grid min-w-0 items-start gap-4 @min-[52rem]/journey:grid-cols-[minmax(0,1fr)_minmax(15rem,19rem)]"><div className="min-w-0 space-y-5">{expertContent ?? children}</div><aside id="editor-journey-summary" className="min-w-0 rounded-sm border bg-card p-3 @min-[52rem]/journey:sticky @min-[52rem]/journey:top-0 @min-[52rem]/journey:max-h-[max(12rem,calc(100dvh-18rem))] @min-[52rem]/journey:overflow-y-auto">{summary}</aside></div> : children}
    </div>
    <footer className="shrink-0 border-t bg-card pt-3">{footer}</footer>
  </div>;
}
