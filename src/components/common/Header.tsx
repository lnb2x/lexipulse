import { BookOpen, Flame, Keyboard, Moon, RotateCcw, Search, Settings, Sun } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { GlassRefraction } from './Glass';

interface HeaderProps {
  activeTab: 'lookup' | 'deck' | 'review';
  onTabChange: (tab: 'lookup' | 'deck' | 'review') => void;
  streak: number;
  dueCount: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
}

interface IndicatorRect {
  left: number;
  top: number;
  width: number;
  height: number;
  ready: boolean;
}

const TAB_KEYS: Array<'lookup' | 'deck' | 'review'> = ['lookup', 'deck', 'review'];

function getTabLayoutRect(button: HTMLButtonElement) {
  const rect = button.getBoundingClientRect();
  if (typeof window.DOMMatrix !== 'function') return rect;
  const transform = getComputedStyle(button).transform;
  if (!transform || transform === 'none') return rect;

  // Hover/press scaling should not change the sliding capsule's layout bounds.
  const matrix = new window.DOMMatrix(transform);
  const scaleX = Math.hypot(matrix.a, matrix.b) || 1;
  const scaleY = Math.hypot(matrix.c, matrix.d) || 1;
  const width = rect.width / scaleX;
  const height = rect.height / scaleY;
  return {
    left: rect.left + (rect.width - width) / 2,
    top: rect.top + (rect.height - height) / 2,
    width,
    height,
  };
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  streak,
  dueCount,
  theme,
  onToggleTheme,
  onOpenSettings,
  onOpenShortcuts,
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  const prefersReducedMotion = usePrefersReducedMotion();

  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      headerRef.current?.style.setProperty('--scroll-edge-opacity', String(Math.min(.85, window.scrollY / 140)));
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', scroll, { passive: true });
    return () => { window.removeEventListener('scroll', scroll); cancelAnimationFrame(frame); };
  }, []);
  const desktopNavRef = useRef<HTMLElement | null>(null);
  const mobileNavRef = useRef<HTMLDivElement | null>(null);

  const desktopTabRefs = useRef<Record<'lookup' | 'deck' | 'review', HTMLButtonElement | null>>({
    lookup: null,
    deck: null,
    review: null,
  });

  const mobileTabRefs = useRef<Record<'lookup' | 'deck' | 'review', HTMLButtonElement | null>>({
    lookup: null,
    deck: null,
    review: null,
  });

  const [desktopIndicator, setDesktopIndicator] = useState<IndicatorRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  const [mobileIndicator, setMobileIndicator] = useState<IndicatorRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  const indicatorTransition = prefersReducedMotion
    ? 'none'
    : 'transform 420ms var(--spring-standard), width 420ms var(--spring-standard), height 420ms var(--spring-standard), opacity 150ms ease-out';

  // Dynamically measure active tab button position & size for sliding pill indicators
  const updateIndicators = useCallback(() => {
    const header = headerRef.current;
    if (header) {
      const height = Math.ceil(header.getBoundingClientRect().height);
      if (height > 0) header.closest<HTMLElement>('.lexipulse-app')?.style.setProperty('--app-header-height', `${height}px`);
    }
    // Desktop indicator measurement
    const desktopContainer = desktopNavRef.current;
    const activeDesktopBtn = desktopTabRefs.current[activeTab];

    if (desktopContainer && activeDesktopBtn) {
      const containerRect = desktopContainer.getBoundingClientRect();
      const btnRect = getTabLayoutRect(activeDesktopBtn);

      const hasValidDomRects = containerRect.width > 0 && btnRect.width > 0;
      const left = hasValidDomRects ? btnRect.left - containerRect.left - desktopContainer.clientLeft : activeDesktopBtn.offsetLeft;
      const top = hasValidDomRects ? btnRect.top - containerRect.top - desktopContainer.clientTop : activeDesktopBtn.offsetTop;
      const width = hasValidDomRects ? btnRect.width : activeDesktopBtn.offsetWidth;
      const height = hasValidDomRects ? btnRect.height : activeDesktopBtn.offsetHeight;

      setDesktopIndicator((prev) => {
        if (
          Math.abs(prev.left - left) < 0.5 &&
          Math.abs(prev.top - top) < 0.5 &&
          Math.abs(prev.width - width) < 0.5 &&
          Math.abs(prev.height - height) < 0.5 &&
          prev.ready === (width > 0)
        ) {
          return prev;
        }
        return { left, top, width, height, ready: width > 0 };
      });
    }

    // Mobile indicator measurement
    const mobileContainer = mobileNavRef.current;
    const activeMobileBtn = mobileTabRefs.current[activeTab];

    if (mobileContainer && activeMobileBtn) {
      const containerRect = mobileContainer.getBoundingClientRect();
      const btnRect = getTabLayoutRect(activeMobileBtn);

      const hasValidDomRects = containerRect.width > 0 && btnRect.width > 0;
      const left = hasValidDomRects ? btnRect.left - containerRect.left - mobileContainer.clientLeft : activeMobileBtn.offsetLeft;
      const top = hasValidDomRects ? btnRect.top - containerRect.top - mobileContainer.clientTop : activeMobileBtn.offsetTop;
      const width = hasValidDomRects ? btnRect.width : activeMobileBtn.offsetWidth;
      const height = hasValidDomRects ? btnRect.height : activeMobileBtn.offsetHeight;

      setMobileIndicator((prev) => {
        if (
          Math.abs(prev.left - left) < 0.5 &&
          Math.abs(prev.top - top) < 0.5 &&
          Math.abs(prev.width - width) < 0.5 &&
          Math.abs(prev.height - height) < 0.5 &&
          prev.ready === (width > 0)
        ) {
          return prev;
        }
        return { left, top, width, height, ready: width > 0 };
      });
    }
  }, [activeTab]);

  // Synchronize on activeTab, language, or font updates
  useLayoutEffect(() => {
    updateIndicators();
    // Re-check after render frame to accommodate layout reflows (e.g. font loading, translation text width)
    const frameId = requestAnimationFrame(updateIndicators);
    return () => cancelAnimationFrame(frameId);
  }, [updateIndicators, language]);

  // Observe container & tab size changes via ResizeObserver + window resize fallback
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateIndicators();
      });

      if (desktopNavRef.current) resizeObserver.observe(desktopNavRef.current);
      if (headerRef.current) resizeObserver.observe(headerRef.current);
      if (mobileNavRef.current) resizeObserver.observe(mobileNavRef.current);
      Object.values(desktopTabRefs.current).forEach((el) => {
        if (el) resizeObserver?.observe(el);
      });
      Object.values(mobileTabRefs.current).forEach((el) => {
        if (el) resizeObserver?.observe(el);
      });
    }

    const handleWindowResize = () => {
      updateIndicators();
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [updateIndicators]);

  // Accessible keyboard roving on tablist
  const handleNavigationKeyDown = (e: React.KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const tabRefs = e.currentTarget === mobileNavRef.current ? mobileTabRefs.current : desktopTabRefs.current;
    const currentIndex = TAB_KEYS.indexOf(activeTab);
    if (currentIndex === -1) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextTab = TAB_KEYS[(currentIndex + 1) % TAB_KEYS.length];
      onTabChange(nextTab);
      tabRefs[nextTab]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevTab = TAB_KEYS[(currentIndex - 1 + TAB_KEYS.length) % TAB_KEYS.length];
      onTabChange(prevTab);
      tabRefs[prevTab]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      onTabChange(TAB_KEYS[0]);
      tabRefs[TAB_KEYS[0]]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      onTabChange(TAB_KEYS[TAB_KEYS.length - 1]);
      tabRefs[TAB_KEYS[TAB_KEYS.length - 1]]?.focus();
    }
  };

  return (
    <header ref={headerRef} className="app-header sticky z-40 transition-colors">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onTabChange('lookup')}
            className="group flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl"
            aria-label="LexiPulse Home"
          >
            <div className="brand-symbol flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 group-hover:bg-indigo-500 transition-colors">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="brand-name font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Lexi<span className="text-indigo-600 dark:text-indigo-400">Pulse</span>
                </span>
                <span className="brand-caption hidden sm:inline-block rounded-md border border-indigo-200/80 bg-indigo-50/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
                  TOEIC / IELTS
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Desktop Navigation Tabs (Segmented Control with Shared Sliding Active Background) */}
        <nav
          ref={desktopNavRef}
          data-glass
          role="tablist"
          aria-label={language === 'vi' ? 'Điều hướng chính' : 'Main navigation'}
          onKeyDown={handleNavigationKeyDown}
          className="glass-material liquid-glass glass-control glass-pill glass-nav relative hidden md:flex items-center gap-1 p-1"
        >
          <GlassRefraction />
          {/* Shared Sliding Active Background Indicator */}
          <div
            aria-hidden="true"
            data-testid="desktop-active-indicator"
            className="glass-selection-indicator pointer-events-none absolute z-0"
            style={{
              top: desktopIndicator.top,
              left: 0,
              width: desktopIndicator.width,
              height: desktopIndicator.height,
              transform: `translateX(${desktopIndicator.left}px)`,
              opacity: desktopIndicator.ready ? 1 : 0,
              transition: indicatorTransition,
            }}
          />

          {/* Tab 1: Lookup */}
          <button
            ref={(el) => {
              desktopTabRefs.current.lookup = el;
            }}
            type="button"
            data-glass
            role="tab"
            id="tab-desktop-lookup"
            aria-selected={activeTab === 'lookup'}
            aria-controls="panel-lookup"
            tabIndex={activeTab === 'lookup' ? 0 : -1}
            onClick={() => onTabChange('lookup')}
            className={`glass-control glass-control-inset glass-pill relative z-10 group flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors duration-200 ease-out ${
              activeTab === 'lookup'
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Search className={`h-3.5 w-3.5 transition-colors duration-200 ease-out ${activeTab === 'lookup' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
            <span>{t.nav.lookup}</span>
            <kbd className="hidden lg:inline text-[9px] opacity-60 transition-opacity duration-200 ease-out">Alt+1</kbd>
          </button>

          {/* Tab 2: Deck */}
          <button
            ref={(el) => {
              desktopTabRefs.current.deck = el;
            }}
            type="button"
            data-glass
            role="tab"
            id="tab-desktop-deck"
            aria-selected={activeTab === 'deck'}
            aria-controls="panel-deck"
            tabIndex={activeTab === 'deck' ? 0 : -1}
            onClick={() => onTabChange('deck')}
            className={`glass-control glass-control-inset glass-pill relative z-10 group flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors duration-200 ease-out ${
              activeTab === 'deck'
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className={`h-3.5 w-3.5 transition-colors duration-200 ease-out ${activeTab === 'deck' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
            <span>{t.nav.deck}</span>
            <kbd className="hidden lg:inline text-[9px] opacity-60 transition-opacity duration-200 ease-out">Alt+2</kbd>
          </button>

          {/* Tab 3: Review */}
          <button
            ref={(el) => {
              desktopTabRefs.current.review = el;
            }}
            type="button"
            data-glass
            role="tab"
            id="tab-desktop-review"
            aria-selected={activeTab === 'review'}
            aria-controls="panel-review"
            tabIndex={activeTab === 'review' ? 0 : -1}
            onClick={() => onTabChange('review')}
            className={`glass-control glass-control-inset glass-pill relative z-10 group flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors duration-200 ease-out ${
              activeTab === 'review'
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <RotateCcw className={`h-3.5 w-3.5 transition-colors duration-200 ease-out ${activeTab === 'review' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
            <span>{t.nav.review}</span>
            {dueCount > 0 && (
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            )}
            <kbd className="hidden lg:inline text-[9px] opacity-60 transition-opacity duration-200 ease-out">Alt+3</kbd>
          </button>
        </nav>

        {/* Right Utility Controls */}
        <div className="header-utilities flex items-center gap-2">
          <div data-glass className="header-identity glass-material liquid-glass glass-control glass-pill glass-nav">
          {/* Daily Streak Badge */}
          <div
            title={`Current streak: ${streak} ${t.nav.streakDays}`}
            className="header-streak flex items-center gap-1.5 rounded-xl border border-amber-200/70 bg-amber-50/80 px-2.5 py-1.5 text-xs font-bold text-amber-800 shadow-subtle dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
          >
            <Flame className="h-4 w-4 text-amber-500 fill-amber-500" />
            <span>{streak}d</span>
          </div>

          {/* Language Toggle */}
          <button
            type="button"
            data-glass
            onClick={toggleLanguage}
            title={language === 'vi' ? 'Chuyển sang Tiếng Anh (English)' : 'Switch to Vietnamese (Tiếng Việt)'}
            aria-label={language === 'vi' ? 'Chuyển sang Tiếng Anh' : 'Switch to Vietnamese'}
            className="glass-control glass-control-inset glass-pill flex h-9 items-center gap-1.5 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            <span className="text-xs">{language === 'vi' ? '🇻🇳' : '🇬🇧'}</span>
            <span className="text-[11px] font-bold">{language === 'vi' ? 'VI' : 'EN'}</span>
          </button>

          </div>

          <div data-glass className="header-tools glass-material liquid-glass glass-control glass-pill glass-nav" role="group" aria-label={language === 'vi' ? 'Công cụ ứng dụng' : 'App tools'}>
          {/* Shortcuts Button */}
          <button
            type="button"
            data-glass
            onClick={onOpenShortcuts}
            title={t.nav.shortcuts}
            aria-label={t.nav.shortcuts}
            className="glass-control glass-control-inset glass-pill hidden sm:flex h-9 w-9 items-center justify-center text-slate-500 dark:text-slate-400 transition-colors"
          >
            <Keyboard className="h-4 w-4" />
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            data-glass
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng (Light)' : 'Chuyển sang Giao diện Tối (Dark)'}
            aria-label={
              theme === 'dark'
                ? language === 'vi'
                  ? 'Chuyển sang Giao diện Sáng'
                  : 'Switch to Light Mode'
                : language === 'vi'
                  ? 'Chuyển sang Giao diện Tối'
                  : 'Switch to Dark Mode'
            }
            className="glass-control glass-control-inset glass-pill flex h-9 w-9 items-center justify-center text-slate-500 dark:text-slate-400 transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            data-glass
            onClick={onOpenSettings}
            title={t.nav.settings}
            aria-label={t.nav.settings}
            className="glass-control glass-control-inset glass-pill flex h-9 w-9 items-center justify-center text-slate-500 dark:text-slate-400 transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Bar (with Shared Sliding Active Background Indicator) */}
      <div
        ref={mobileNavRef}
        data-glass
        role="tablist"
        onKeyDown={handleNavigationKeyDown}
        aria-label={language === 'vi' ? 'Thanh điều hướng di động' : 'Mobile navigation'}
        className="glass-material liquid-glass glass-control glass-pill glass-nav relative flex md:hidden items-center justify-around px-2 py-1.5"
      >
        <GlassRefraction />
        {/* Mobile Shared Sliding Active Background Pill */}
        <div
          aria-hidden="true"
          data-testid="mobile-active-indicator"
          className="glass-selection-indicator pointer-events-none absolute z-0"
          style={{
            top: mobileIndicator.top,
            left: 0,
            width: mobileIndicator.width,
            height: mobileIndicator.height,
            transform: `translateX(${mobileIndicator.left}px)`,
            opacity: mobileIndicator.ready ? 1 : 0,
            transition: indicatorTransition,
          }}
        />

        <button
          ref={(el) => {
            mobileTabRefs.current.lookup = el;
          }}
          type="button"
          data-glass
          role="tab"
          id="tab-mobile-lookup"
          aria-selected={activeTab === 'lookup'}
          aria-controls="panel-lookup"
          tabIndex={activeTab === 'lookup' ? 0 : -1}
          onClick={() => onTabChange('lookup')}
          className={`glass-control glass-control-inset glass-pill relative z-10 flex flex-1 flex-col items-center py-1 text-[11px] font-semibold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            activeTab === 'lookup'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Search className="h-4 w-4 mb-0.5 transition-colors duration-200 ease-out" />
          <span>{t.nav.lookup}</span>
        </button>

        <button
          ref={(el) => {
            mobileTabRefs.current.deck = el;
          }}
          type="button"
          data-glass
          role="tab"
          id="tab-mobile-deck"
          aria-selected={activeTab === 'deck'}
          aria-controls="panel-deck"
          tabIndex={activeTab === 'deck' ? 0 : -1}
          onClick={() => onTabChange('deck')}
          className={`glass-control glass-control-inset glass-pill relative z-10 flex flex-1 flex-col items-center py-1 text-[11px] font-semibold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            activeTab === 'deck'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="h-4 w-4 mb-0.5 transition-colors duration-200 ease-out" />
          <span>
            {language === 'vi' ? 'Bộ từ' : 'Deck'}
          </span>
        </button>

        <button
          ref={(el) => {
            mobileTabRefs.current.review = el;
          }}
          type="button"
          data-glass
          role="tab"
          id="tab-mobile-review"
          aria-selected={activeTab === 'review'}
          aria-controls="panel-review"
          tabIndex={activeTab === 'review' ? 0 : -1}
          onClick={() => onTabChange('review')}
          className={`glass-control glass-control-inset glass-pill relative z-10 flex flex-1 flex-col items-center py-1 text-[11px] font-semibold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            activeTab === 'review'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <RotateCcw className="h-4 w-4 mb-0.5 transition-colors duration-200 ease-out" />
          <span>{t.nav.review}</span>
          {dueCount > 0 && (
            <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
          )}
        </button>
      </div>
    </header>
  );
};
