import confetti from 'canvas-confetti';
import { Award, Flame, RotateCcw, Sparkles } from 'lucide-react';
import React, { useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { WordItem } from '../../types/vocab';

interface ReviewCompleteProps {
  reviewedCount: number;
  streak: number;
  onRestart: () => void;
  onGoToDeck: () => void;
  history: Array<{ word: WordItem; rating: number }>;
}

export const ReviewComplete: React.FC<ReviewCompleteProps> = ({
  reviewedCount,
  streak,
  onRestart,
  onGoToDeck,
  history,
}) => {
  const { language, t } = useLanguage();

  useEffect(() => {
    // Fire festive confetti animation
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#f59e0b', '#ec4899'],
      });
    } catch {
      // Graceful fallback if canvas is unavailable
    }
  }, []);

  const goodOrEasyCount = history.filter((h) => h.rating >= 2).length;
  const retentionRate = history.length > 0 ? Math.round((goodOrEasyCount / history.length) * 100) : 100;

  return (
    <div className="w-full max-w-xl mx-auto text-center p-7 sm:p-8 card-elevated animate-slide-up">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
        <Award className="h-7 w-7" />
      </div>

      <h2 className="mt-4 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        {t.review.celebrationTitle}
      </h2>
      <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
        {t.review.celebrationSubtitle}
      </p>

      {/* Summary Metrics */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t.review.reviewedCount}
          </span>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
            {reviewedCount}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {t.review.retentionRate}
          </span>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {retentionRate}%
          </p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            {t.review.newStreak}
          </span>
          <div className="mt-1 flex items-center justify-center gap-1">
            <Flame className="h-5 w-5 text-amber-500 fill-amber-500" />
            <span className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
              {streak}d
            </span>
          </div>
        </div>
      </div>

      {/* Review history summary pills */}
      {history.length > 0 && (
        <div className="mt-6 text-left">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            {language === 'vi' ? 'Các thẻ đã ôn tập trong phiên này:' : 'Reviewed Cards in This Session:'}
          </span>
          <div className="mt-2 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
            {history.map((h, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  h.rating === 3
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80'
                    : h.rating === 2
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/80'
                    : 'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/80'
                }`}
              >
                <span className="font-semibold">{h.word.word}</span>
                <span className="text-[10px] opacity-75">
                  ({h.rating === 3 ? t.review.easyRating : h.rating === 2 ? t.review.goodRating : t.review.againRating})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 active:scale-[0.99] transition-all"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{language === 'vi' ? 'Ôn tập lại' : 'Review Again'}</span>
        </button>

        <button
          type="button"
          onClick={onGoToDeck}
          className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-[0.99] transition-all"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{language === 'vi' ? 'Khám phá Bộ từ vựng' : 'Explore Vocabulary Deck'}</span>
        </button>
      </div>
    </div>
  );
};
