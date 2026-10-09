import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface GlassOption { value: string; label: string; disabled?: boolean }
interface GlassDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: GlassOption[];
  label: string;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
}

/** Select-only combobox, with roving active descendant, typeahead and viewport anchoring. */
export function GlassDropdown({ value, onChange, options, label, icon, className = '', disabled }: GlassDropdownProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 320, above: false });
  const selected = options.findIndex(option => option.value === value);
  const show = () => {
    if (disabled || !options.length) return;
    setActive(Math.max(0, selected)); setPresent(true); setOpen(true);
  };
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  };
  useLayoutEffect(() => {
    if (!present) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 20;
      const above = below < Math.min(280, options.length * 42 + 14) && rect.top > below;
      const maxHeight = Math.min(320, Math.max(80, above ? rect.top - 20 : below));
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: above ? rect.top - 8 : rect.bottom + 8, width, maxHeight, above });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [present, options.length]);
  useEffect(() => {
    if (!present || open) return;
    const timer = setTimeout(() => setPresent(false), 160);
    return () => clearTimeout(timer);
  }, [open, present]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !popover.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (open) popover.current?.querySelector(`[id="${id}-option-${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open, id]);
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value); close(true);
  };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    else if (event.key === 'Tab') close();
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); if (open) choose(active); else show();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { show(); return; }
      let next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : active;
      const direction = event.key === 'ArrowUp' || event.key === 'End' ? -1 : 1;
      if (event.key.startsWith('Arrow')) next = (next + direction + options.length) % options.length;
      for (let i = 0; i < options.length && options[next]?.disabled; i++) next = (next + direction + options.length) % options.length;
      setActive(next);
    } else if (event.key.length === 1) {
      const now = Date.now();
      const text = now - typeahead.current.time > 700 ? event.key : typeahead.current.text + event.key;
      typeahead.current = { text, time: now };
      const index = options.findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(text.toLocaleLowerCase()));
      if (index >= 0) { if (!open) { setPresent(true); setOpen(true); } setActive(index); }
    }
  };
  return <>
    <button ref={trigger} type="button" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open}
      aria-controls={present ? `${id}-list` : undefined} aria-activedescendant={open ? `${id}-option-${active}` : undefined}
      disabled={disabled} data-glass className={`glass-dropdown-trigger ${className}`} onKeyDown={keyDown}
      onBlur={event => { if (!popover.current?.contains(event.relatedTarget)) close(); }} onClick={() => open ? close() : show()}>
      {icon}<span>{options[selected]?.label || label}</span><ChevronDown size={15} aria-hidden="true" />
    </button>
    {present && createPortal(<div ref={popover} id={`${id}-list`} role="listbox" aria-label={label} aria-hidden={!open} inert={!open} data-glass
      className="glass-popover glass-dropdown-panel" data-open={open} data-above={position.above}
      style={{ position: 'fixed', left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }}
      onPointerDown={event => event.preventDefault()}>
      {options.map((option, index) => <div key={option.value} id={`${id}-option-${index}`} role="option"
        aria-selected={value === option.value} aria-disabled={option.disabled || undefined} data-active={active === index}
        className="glass-dropdown-option" onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={() => choose(index)}>
        <span>{option.label}</span>{value === option.value && <Check size={16} aria-hidden="true" />}
      </div>)}
    </div>, document.body)}
  </>;
}
