import { BookOpen, Flame, Keyboard, Moon, RotateCcw, Search, Settings, Sparkles, Sun } from 'lucide-react';
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface HeaderProps {
  activeTab: 'lookup' | 'deck' | 'review';
  onTabChange: (tab: 'lookup' | 'deck' | 'review') => void;
  streak: number;
  totalCards: number;
  dueCount: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  streak,
  totalCards,
  dueCount,
  theme,
  onToggleTheme,
  onOpenSettings,
  onOpenShortcuts,
}) => {
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0c1017]/90 transition-colors">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onTabChange('lookup')}
            className="group flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 group-hover:bg-indigo-500 transition-colors">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Lexi<span className="text-indigo-600 dark:text-indigo-400">Pulse</span>
                </span>
                <span className="hidden sm:inline-block rounded-md border border-indigo-200/80 bg-indigo-50/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
                  TOEIC / IELTS
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Desktop Navigation Tabs (Segmented Control) */}
        <nav className="hidden md:flex items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900/80 shadow-sm">
          {/* Tab 1: Lookup */}
          <button
            type="button"
            onClick={() => onTabChange('lookup')}
            className={`group flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
              activeTab === 'lookup'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Search className={`h-3.5 w-3.5 ${activeTab === 'lookup' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
            <span>{t.nav.lookup}</span>
            <kbd className="hidden lg:inline text-[9px] opacity-60">Alt+1</kbd>
          </button>

          {/* Tab 2: Deck */}
          <button
            type="button"
            onClick={() => onTabChange('deck')}
            className={`group flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
              activeTab === 'deck'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className={`h-3.5 w-3.5 ${activeTab === 'deck' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
            <span>{t.nav.deck}</span>
            {totalCards > 0 && (
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === 'deck'
                  ? 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                  : 'bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {totalCards}
              </span>
            )}
            <kbd className="hidden lg:inline text-[9px] opacity-60">Alt+2</kbd>
          </button>

          {/* Tab 3: Review */}
          <button
            type="button"
            onClick={() => onTabChange('review')}
            className={`group flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
              activeTab === 'review'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <RotateCcw className={`h-3.5 w-3.5 ${activeTab === 'review' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
            <span>{t.nav.review}</span>
            {dueCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span>{dueCount}</span>
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                ✓
              </span>
            )}
            <kbd className="hidden lg:inline text-[9px] opacity-60">Alt+3</kbd>
          </button>
        </nav>

        {/* Right Utility Controls */}
        <div className="flex items-center gap-2">
          {/* Daily Streak Badge */}
          <div
            title={`Current streak: ${streak} ${t.nav.streakDays}`}
            className="flex items-center gap-1.5 rounded-xl border border-amber-200/70 bg-amber-50/80 px-2.5 py-1.5 text-xs font-bold text-amber-800 shadow-subtle dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
          >
            <Flame className="h-4 w-4 text-amber-500 fill-amber-500" />
            <span>{streak}d</span>
          </div>

          {/* Language Toggle */}
          <button
            type="button"
            onClick={toggleLanguage}
            title={language === 'vi' ? 'Chuyển sang Tiếng Anh (English)' : 'Switch to Vietnamese (Tiếng Việt)'}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/80 transition-colors shadow-subtle"
          >
            <span className="text-xs">{language === 'vi' ? '🇻🇳' : '🇬🇧'}</span>
            <span className="text-[11px] font-bold">{language === 'vi' ? 'VI' : 'EN'}</span>
          </button>

          {/* Shortcuts Button */}
          <button
            type="button"
            onClick={onOpenShortcuts}
            title={t.nav.shortcuts}
            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200 transition-colors shadow-subtle"
          >
            <Keyboard className="h-4 w-4" />
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng (Light)' : 'Chuyển sang Giao diện Tối (Dark)'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200 transition-colors shadow-subtle"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            title={t.nav.settings}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200 transition-colors shadow-subtle"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="flex md:hidden items-center justify-around border-t border-slate-200/80 bg-white px-2 py-1.5 dark:border-slate-800/80 dark:bg-[#0c1017]">
        <button
          type="button"
          onClick={() => onTabChange('lookup')}
          className={`flex flex-col items-center py-1 text-[11px] font-semibold transition-colors ${
            activeTab === 'lookup' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Search className="h-4 w-4 mb-0.5" />
          <span>{t.nav.lookup}</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('deck')}
          className={`relative flex flex-col items-center py-1 text-[11px] font-semibold transition-colors ${
            activeTab === 'deck' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <BookOpen className="h-4 w-4 mb-0.5" />
          <span>{t.nav.deck} ({totalCards})</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('review')}
          className={`relative flex flex-col items-center py-1 text-[11px] font-semibold transition-colors ${
            activeTab === 'review' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <RotateCcw className="h-4 w-4 mb-0.5" />
          <span>{t.nav.review}</span>
          {dueCount > 0 && (
            <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
          )}
        </button>
      </div>
    </header>
  );
};
