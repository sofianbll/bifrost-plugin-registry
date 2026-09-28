import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

export type SearchOption = { value: string; label?: string; detail?: string; referenceId?: string; accessId?: string };

export function SearchableSelect({ label, value, options, onChange, placeholder, disabled = false }: {
  label: string;
  value: string;
  options: SearchOption[];
  onChange: (value: string, option?: SearchOption) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const query = value === "Unknown" ? "" : value.trim().toLocaleLowerCase();
  const matches = options.filter(option => `${option.value} ${option.label || ""} ${option.detail || ""}`.toLocaleLowerCase().includes(query)).slice(0, 8);
  const custom = value.trim() && value !== "Unknown" && !options.some(option => option.value.toLocaleLowerCase() === query);
  const count = matches.length + (custom ? 1 : 0);
  useEffect(() => { if (open && active >= 0) list.current?.querySelector(`#${CSS.escape(`${id}-option-${active}`)}`)?.scrollIntoView({ block: "nearest" }); }, [active, open, id]);
  const choose = (index: number) => {
    const option = matches[index];
    onChange(option?.value ?? value.trim(), option);
    setOpen(false);
    setActive(-1);
  };
  return <Popover open={open && count > 0 && !disabled} onOpenChange={setOpen} modal={false}>
    <label htmlFor={id} className="mb-2 block text-sm font-medium">{label}</label>
    <PopoverAnchor asChild><Input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open && count > 0} aria-controls={`${id}-options`} aria-activedescendant={open && active >= 0 && active < count ? `${id}-option-${active}` : undefined} autoComplete="off" spellCheck={false} disabled={disabled} placeholder={placeholder} value={value} onFocus={event => { if (value === "Unknown") event.currentTarget.select(); setOpen(true); setActive(-1); }} onChange={event => { onChange(event.target.value); setActive(-1); setOpen(true); }} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
      if (event.key === "ArrowDown" && count) { event.preventDefault(); setOpen(true); setActive(index => index < count - 1 ? index + 1 : 0); }
      if (event.key === "ArrowUp" && count) { event.preventDefault(); setOpen(true); setActive(index => index < 0 ? count - 1 : (index - 1 + count) % count); }
      if (event.key === "Enter" && open && active >= 0 && active < count) { event.preventDefault(); choose(active); }
    }} /></PopoverAnchor>
    <PopoverContent ref={list} id={`${id}-options`} role="listbox" aria-label={`${label} suggestions`} align="start" sideOffset={4} collisionPadding={8} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()} onInteractOutside={event => { if (event.detail.originalEvent.target === input.current) event.preventDefault(); }} className="max-h-52 w-(--radix-popover-trigger-width) min-w-48 max-w-[calc(100vw-2rem)] overflow-y-auto p-1">
      {matches.map((option, index) => <button key={`${option.value}/${option.referenceId || option.accessId || ""}`} id={`${id}-option-${index}`} role="option" aria-selected={active === index} type="button" className={`block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent ${active === index ? "bg-accent" : ""}`} onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}><span className="block break-all font-medium">{option.label || option.value}</span>{option.label && option.label !== option.value && <span className="block break-all font-mono text-xs text-muted-foreground">{option.value}</span>}{option.detail && <span className="block break-words text-xs text-muted-foreground">{option.detail}</span>}</button>)}
      {custom && <button id={`${id}-option-${matches.length}`} role="option" aria-selected={active === matches.length} type="button" className={`block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent ${active === matches.length ? "bg-accent" : ""}`} onMouseDown={event => event.preventDefault()} onClick={() => choose(matches.length)}>Use custom value: {value.trim()}</button>}
    </PopoverContent>
  </Popover>;
}
