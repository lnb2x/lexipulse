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

  const total = stats.total || 1;
  const masteredPct = Math.round((stats.mastered / total) * 100);
  const learningPct = Math.round((stats.learning / total) * 100);
  const newPct = Math.max(0, 100 - masteredPct - learningPct);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-card dark:border-slate-800 dark:bg-[#121824] space-y-4">
      {/* 5-Column Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
        {/* Total Words */}
        <div className="pt-2 sm:pt-0 sm:pr-3">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-xs font-semibold">{t.deck.totalWords}</span>
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-slate-900 dark:text-white">
            {stats.total}
          </p>
        </div>

        {/* Due Today */}
        <div className="pt-2 sm:pt-0 sm:px-3">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <AlertCircle className={`h-3.5 w-3.5 ${stats.due > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
            <span className="text-xs font-semibold">{t.deck.dueToday}</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className={`font-display text-2xl font-bold ${stats.due > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
              {stats.due}
            </span>
            {stats.due > 0 && (
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </div>
        </div>

        {/* Learning */}
        <div className="pt-2 sm:pt-0 sm:px-3">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-semibold">{t.deck.learning}</span>
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.learning}
          </p>
        </div>

        {/* Mastered */}
        <div className="pt-2 sm:pt-0 sm:px-3">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-semibold">{t.deck.mastered}</span>
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.mastered}
          </p>
        </div>

        {/* New Words */}
        <div className="col-span-2 sm:col-span-1 pt-2 sm:pt-0 sm:pl-3">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-xs font-semibold">{t.deck.newWords}</span>
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-slate-700 dark:text-slate-300">
            {stats.new}
          </p>
        </div>
      </div>

      {/* Progress Breakdown Bar */}
      {stats.total > 0 && (
        <div className="space-y-1 pt-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 flex">
            {stats.mastered > 0 && (
              <div
                title={`${t.deck.mastered}: ${stats.mastered} (${masteredPct}%)`}
                style={{ width: `${masteredPct}%` }}
                className="bg-emerald-500 transition-all duration-300"
              />
            )}
            {stats.learning > 0 && (
              <div
                title={`${t.deck.learning}: ${stats.learning} (${learningPct}%)`}
                style={{ width: `${learningPct}%` }}
                className="bg-amber-400 transition-all duration-300"
              />
            )}
            {stats.new > 0 && (
              <div
                title={`${t.deck.newWords}: ${stats.new} (${newPct}%)`}
                style={{ width: `${newPct}%` }}
                className="bg-slate-300 dark:bg-slate-700 transition-all duration-300"
              />
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t.deck.mastered} ({masteredPct}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {t.deck.learning} ({learningPct}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-600" />
              {t.deck.newWords} ({newPct}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
