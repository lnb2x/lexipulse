import { useLayoutEffect, useRef, type HTMLAttributes } from 'react';
import { GlassSurface } from './Glass';

interface SlidingSelectionProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

/** One moving selection surface; child controls keep their existing ARIA and behavior. */
export function SlidingSelection({ value, className = '', children, ...props }: SlidingSelectionProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const previousValue = useRef(value);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const selectionChanged = previousValue.current !== value;
    previousValue.current = value;
    const measure = (animate = false) => {
      const selected = group.querySelector<HTMLElement>(":scope > button[aria-selected='true'], :scope > button[aria-pressed='true']");
      if (!selected) return;
      const geometry = { '--selection-x': selected.offsetLeft, '--selection-y': selected.offsetTop,
        '--selection-width': selected.offsetWidth, '--selection-height': selected.offsetHeight };
      if (Object.entries(geometry).some(([name, pixels]) => group.style.getPropertyValue(name) !== `${pixels}px`)) {
        // Resize snaps to the new layout; only a user's selection change slides.
        group.dataset.selectionMotion = animate ? 'animate' : 'snap';
        for (const [name, pixels] of Object.entries(geometry)) group.style.setProperty(name, `${pixels}px`);
      }
      group.dataset.selectionReady = selected.offsetWidth > 0 ? 'true' : 'false';
    };
    measure(selectionChanged);
    const remeasure = () => measure();
    const frame = requestAnimationFrame(remeasure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(remeasure);
    observer?.observe(group);
    group.querySelectorAll(':scope > button').forEach(button => observer?.observe(button));
    window.addEventListener('resize', remeasure);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', remeasure);
    };
  }, [value]);

  return <GlassSurface {...props} ref={groupRef} className={`sliding-selection ${className}`}>
    <span className="selection-surface" aria-hidden="true" />
    {children}
  </GlassSurface>;
}
