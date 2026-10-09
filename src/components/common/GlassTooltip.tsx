import { cloneElement, useEffect, useId, useRef, useState, type HTMLAttributes, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

/** Portalled so a quiet content surface cannot clip the floating help layer. */
export function GlassTooltip({ children, label }: { children: ReactElement<HTMLAttributes<HTMLElement>>; label: string }) {
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, above: true });
  const hide = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setAnchor(null); };
  const show = (element: HTMLElement, delay = 0) => {
    if (timer.current) clearTimeout(timer.current);
    const rect = element.getBoundingClientRect();
    const above = rect.top > 64;
    setPosition({ left: Math.max(130, Math.min(innerWidth - 130, rect.left + rect.width / 2)), top: above ? rect.top - 10 : rect.bottom + 10, above });
    if (delay) timer.current = setTimeout(() => setAnchor(element), delay);
    else setAnchor(element);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [anchor]);
  return <>{cloneElement(children, {
    'aria-describedby': anchor ? [children.props['aria-describedby'], id].filter(Boolean).join(' ') : children.props['aria-describedby'],
    onPointerEnter: event => { children.props.onPointerEnter?.(event); if (event.pointerType !== 'touch') show(event.currentTarget, 350); },
    onPointerLeave: event => { children.props.onPointerLeave?.(event); hide(); },
    onFocus: event => { children.props.onFocus?.(event); show(event.currentTarget); },
    onBlur: event => { children.props.onBlur?.(event); hide(); },
    onKeyDown: event => { children.props.onKeyDown?.(event); if (event.key === 'Escape') hide(); },
  })}{anchor && createPortal(<div id={id} role="tooltip" className="glass-material glass-tooltip" data-above={position.above}
    style={{ left: position.left, top: position.top }}>{label}</div>, document.body)}</>;
}
