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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0B0F17]/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => onTabChange('lookup')}
            className="flex cursor-pointer items-center gap-2.5 transition-transform hover:scale-105"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Lexi<span className="text-indigo-600 dark:text-indigo-400">Pulse</span>
                </span>
                <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  TOEIC/IELTS
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 rounded-2xl border border-slate-200/60 bg-slate-100/70 p-1 dark:border-slate-800 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={() => onTabChange('lookup')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 ${
              activeTab === 'lookup'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            {t.nav.lookup}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('deck')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 ${
              activeTab === 'deck'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            {t.nav.deck}
            {totalCards > 0 && (
              <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                {totalCards}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('review')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 ${
              activeTab === 'review'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t.nav.review}
            {dueCount > 0 ? (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-rose-500/30 animate-pulse">
                {dueCount} {language === 'vi' ? 'cần ôn' : 'due'}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                ✓
              </span>
            )}
          </button>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <button
            type="button"
            onClick={toggleLanguage}
            title={language === 'vi' ? 'Chuyển sang Tiếng Anh (English)' : 'Switch to Vietnamese (Tiếng Việt)'}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-800 dark:hover:text-indigo-400 transition-colors shadow-sm"
          >
            <span className="text-sm">{language === 'vi' ? '🇻🇳' : '🇬🇧'}</span>
            <span>{language === 'vi' ? 'VI' : 'EN'}</span>
          </button>

          {/* Daily Streak Badge */}
          <div
            title={`Current streak: ${streak} ${t.nav.streakDays}`}
            className="flex items-center gap-1.5 rounded-xl border border-amber-200/60 bg-amber-50/70 px-2.5 py-1.5 text-xs font-bold text-amber-700 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
          >
            <Flame className="h-4 w-4 text-amber-500 fill-amber-500 animate-pulse" />
            <span>{streak}d</span>
          </div>

          {/* Shortcuts Button */}
          <button
            type="button"
            onClick={onOpenShortcuts}
            title={t.nav.shortcuts}
            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Keyboard className="h-4 w-4" />
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            title={t.nav.settings}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Sub-bar */}
      <div className="flex md:hidden items-center justify-around border-t border-slate-100 bg-white/95 px-2 py-1.5 dark:border-slate-800/80 dark:bg-[#0B0F17]/95">
        <button
          onClick={() => onTabChange('lookup')}
          className={`flex flex-col items-center py-1 text-[11px] font-semibold ${
            activeTab === 'lookup' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'
          }`}
        >
          <Search className="h-4 w-4 mb-0.5" />
          {t.nav.lookup}
        </button>

        <button
          onClick={() => onTabChange('deck')}
          className={`relative flex flex-col items-center py-1 text-[11px] font-semibold ${
            activeTab === 'deck' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'
          }`}
        >
          <BookOpen className="h-4 w-4 mb-0.5" />
          {t.nav.deck} ({totalCards})
        </button>

        <button
          onClick={() => onTabChange('review')}
          className={`relative flex flex-col items-center py-1 text-[11px] font-semibold ${
            activeTab === 'review' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'
          }`}
        >
          <RotateCcw className="h-4 w-4 mb-0.5" />
          {t.nav.review}
          {dueCount > 0 && (
            <span className="absolute -top-1 right-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
          )}
        </button>
      </div>
    </header>
  );
};
