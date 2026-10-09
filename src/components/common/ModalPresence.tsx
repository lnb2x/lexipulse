import { useEffect, useState, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

/** Keep the closing panel for one short exit; rapid reopen cancels its removal. */
export function ModalPresence({ open, children }: { open: boolean; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState({ open, children });
  const reducedMotion = usePrefersReducedMotion();
  if (open !== snapshot.open || (open && children !== snapshot.children)) {
    setSnapshot({ open, children: open ? children : snapshot.children });
  }
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => setSnapshot(previous => ({ ...previous, children: null })), reducedMotion ? 0 : 160);
    return () => clearTimeout(timer);
  }, [open, reducedMotion]);
  const content = open ? children : snapshot.children;
  if (!content) return null;
  return <div className="modal-presence" data-state={open ? 'open' : 'closing'} inert={!open} aria-hidden={!open || undefined}>
    {content}
  </div>;
}
