import { useEffect } from 'react';

/** One delegated pointer light for the nearest functional glass control. */
export function GlassLighting() {
  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const reducedTransparency = window.matchMedia?.('(prefers-reduced-transparency: reduce)');
    const increasedContrast = window.matchMedia?.('(prefers-contrast: more)');
    const fineHoverPointer = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    let surface: HTMLElement | null = null;
    let frame = 0;
    let mouseX = 0;
    let mouseY = 0;

    const clear = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      surface?.style.removeProperty('--mouse-x');
      surface?.style.removeProperty('--mouse-y');
      surface?.removeAttribute('data-glass-lit');
      surface = null;
    };

    const nearestSurface = (target: EventTarget | null) => {
      const element = target instanceof Element ? target.closest('[data-glass]') : null;
      return element instanceof HTMLElement ? element : null;
    };

    const illuminate = () => {
      frame = 0;
      if (!surface?.isConnected) {
        clear();
        return;
      }
      const rect = surface.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.max(0, Math.min(100, (mouseX - rect.left) / rect.width * 100));
      const y = Math.max(0, Math.min(100, (mouseY - rect.top) / rect.height * 100));
      surface.style.setProperty('--mouse-x', `${x.toFixed(2)}%`);
      surface.style.setProperty('--mouse-y', `${y.toFixed(2)}%`);
      surface.dataset.glassLit = 'true';
    };

    const move = (event: PointerEvent) => {
      if (document.hidden || reducedMotion?.matches || reducedTransparency?.matches || increasedContrast?.matches || !fineHoverPointer?.matches || event.pointerType === 'touch') {
        clear();
        return;
      }
      const nextSurface = nearestSurface(event.target);
      if (nextSurface !== surface) {
        clear();
        surface = nextSurface;
      }
      if (!surface) return;
      mouseX = event.clientX;
      mouseY = event.clientY;
      if (!frame) frame = requestAnimationFrame(illuminate);
    };

    const leave = (event: PointerEvent) => {
      if (nearestSurface(event.relatedTarget) !== surface) clear();
    };
    const scroll = () => {
      if (!surface) return;
      const rect = surface.getBoundingClientRect();
      const containsPointer = surface.isConnected && mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom;
      if (!containsPointer || (typeof document.elementFromPoint === 'function' && nearestSurface(document.elementFromPoint(mouseX, mouseY)) !== surface)) {
        clear();
      } else if (!frame) {
        frame = requestAnimationFrame(illuminate);
      }
    };
    const visibility = () => {
      document.documentElement.dataset.pageVisibility = document.hidden ? 'hidden' : 'visible';
      if (document.hidden) clear();
    };

    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerout', leave, { passive: true });
    document.addEventListener('pointerleave', clear);
    document.addEventListener('scroll', scroll, { capture: true, passive: true });
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', clear);
    reducedMotion?.addEventListener?.('change', clear);
    reducedTransparency?.addEventListener?.('change', clear);
    increasedContrast?.addEventListener?.('change', clear);
    fineHoverPointer?.addEventListener?.('change', clear);
    visibility();
    return () => {
      clear();
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerout', leave);
      document.removeEventListener('pointerleave', clear);
      document.removeEventListener('scroll', scroll, true);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', clear);
      reducedMotion?.removeEventListener?.('change', clear);
      reducedTransparency?.removeEventListener?.('change', clear);
      increasedContrast?.removeEventListener?.('change', clear);
      fineHoverPointer?.removeEventListener?.('change', clear);
      delete document.documentElement.dataset.pageVisibility;
    };
  }, []);

  return <svg className="glass-optics" aria-hidden="true" focusable="false">
    <defs>
      <filter id="lexipulse-glass-refraction" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="1" seed="7" result="lens" />
        <feGaussianBlur in="lens" stdDeviation="2" result="smooth-lens" />
        <feDisplacementMap in="SourceGraphic" in2="smooth-lens" scale="8" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  </svg>;
}
