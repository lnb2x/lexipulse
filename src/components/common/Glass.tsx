import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from 'react';

export type GlassVariant = 'thin' | 'regular' | 'thick' | 'clear' | 'tinted';
interface LiquidGlassProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  refract?: boolean;
}

/** Edge-only backdrop displacement; foreground content never passes through the filter. */
export function GlassRefraction() {
  return <span aria-hidden="true" className="glass-refraction" />;
}

export const LiquidGlass = forwardRef<HTMLDivElement, LiquidGlassProps>(function LiquidGlass({ variant = 'regular', refract = false, className = '', children, ...props }, ref) {
  return <div {...props} ref={ref} data-glass data-glass-variant={variant} className={`glass-material liquid-glass ${className}`}>
    <span aria-hidden="true" className="liquid-glass-backdrop" />
    {refract && <GlassRefraction />}
    <span aria-hidden="true" className="liquid-glass-edge" />
    <span aria-hidden="true" className="liquid-glass-reflection" />
    {children}
  </div>;
});

/** Compatibility entry point for the existing navigation and segmented controls. */
export const GlassSurface = LiquidGlass;

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  prominent?: boolean;
  busy?: boolean;
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton({ prominent, busy, className = '', children, ...props }, ref) {
  return <button type="button" {...props} ref={ref} data-glass aria-busy={busy || undefined}
    className={`liquid-glass glass-control glass-button glass-pill ${prominent ? 'glass-prominent' : ''} ${className}`}>{children}</button>;
});

export const GlassIconButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassIconButton({ className = '', ...props }, ref) {
  return <GlassButton {...props} ref={ref} className={`glass-icon-button ${className}`} />;
});

export function GlassSearchField({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <LiquidGlass {...props} refract className={`glass-control glass-pill glass-search-field ${className}`} />;
}

export function ContentSurface({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`content-surface ${className}`} />;
}
