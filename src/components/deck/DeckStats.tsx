import { AlertCircle, CheckCircle2, Clock, Layers, Sparkles } from 'lucide-react';
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface DeckStatsProps {
  stats: {
    total: number;
    due: number;
    new: number;
    learning: number;
    mastered: number;
  };
}

export const DeckStats: React.FC<DeckStatsProps> = ({ stats }) => {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {/* Total Words */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-[#111622]">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-semibold uppercase tracking-wider">{t.deck.totalWords}</span>
          <Layers className="h-4 w-4 text-indigo-500" />
        </div>
        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
          {stats.total}
        </p>
      </div>

      {/* Due Today */}
      <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/20">
        <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
          <span className="text-xs font-semibold uppercase tracking-wider">{t.deck.dueToday}</span>
          <AlertCircle className="h-4 w-4 text-rose-500 animate-pulse" />
        </div>
        <p className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">
          {stats.due}
        </p>
      </div>

      {/* Learning */}
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
          <span className="text-xs font-semibold uppercase tracking-wider">{t.deck.learning}</span>
          <Clock className="h-4 w-4 text-amber-500" />
        </div>
        <p className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
          {stats.learning}
        </p>
      </div>

      {/* Mastered */}
      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
          <span className="text-xs font-semibold uppercase tracking-wider">{t.deck.mastered}</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </div>
        <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
          {stats.mastered}
        </p>
      </div>

      {/* New */}
      <div className="col-span-2 sm:col-span-1 rounded-2xl border border-sky-200/80 bg-sky-50/40 p-4 shadow-sm dark:border-sky-900/40 dark:bg-sky-950/20">
        <div className="flex items-center justify-between text-sky-600 dark:text-sky-400">
          <span className="text-xs font-semibold uppercase tracking-wider">{t.deck.newWords}</span>
          <Sparkles className="h-4 w-4 text-sky-500" />
        </div>
        <p className="mt-2 text-2xl font-black text-sky-600 dark:text-sky-400">
          {stats.new}
        </p>
      </div>
    </div>
  );
};
