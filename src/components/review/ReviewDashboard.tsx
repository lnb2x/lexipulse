import { Calendar, CheckCircle2, Flame, Layers, Play, Sparkles, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { WordItem } from '../../types/vocab';
import { formatLocalDate } from '../../utils/dateUtils';

interface ReviewDashboardProps {
  dueCards: WordItem[];
  allWords: WordItem[];
  availableDates?: Array<{ date: string; count: number }>;
  reviewedTodayCount: number;
  dailyQuota: number;
  streak: number;
  onStartSession: (mode: 'flashcards' | 'cloze', cardsToReview: WordItem[]) => void;
}

export const ReviewDashboard: React.FC<ReviewDashboardProps> = ({
  dueCards,
  allWords,
  availableDates = [],
  reviewedTodayCount,
  dailyQuota,
  streak,
  onStartSession,
}) => {
  const { language, t } = useLanguage();
  const [selectedMode, setSelectedMode] = useState<'flashcards' | 'cloze'>('flashcards');
  const [selectedReviewDate, setSelectedReviewDate] = useState<string>(
    availableDates[0]?.date || formatLocalDate()
  );

  const quotaProgress = Math.min(100, Math.round((reviewedTodayCount / dailyQuota) * 100));
  const masteredCount = allWords.filter((w) => w.status === 'mastered').length;

  const handleStartDue = () => {
    onStartSession(selectedMode, dueCards);
  };

  const handleStartCram = () => {
    onStartSession(selectedMode, allWords);
  };

  const dateWords = allWords.filter(
    (w) => formatLocalDate(w.createdAt) === selectedReviewDate
  );

  const handleStartReviewByDate = () => {
    if (dateWords.length > 0) {
      onStartSession(selectedMode, dateWords);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Daily Quota & Streak Progress Header */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-100/70 dark:border-slate-800 dark:bg-[#111622] dark:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 dark:border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Spaced Repetition
            </span>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {t.review.dashboardTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t.review.dashboardSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Streak pill */}
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/30">
              <Flame className="h-5 w-5 text-amber-500 fill-amber-500 animate-pulse" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-amber-600/80 dark:text-amber-400/80">
                  {t.review.streakCount}
                </span>
                <span className="font-display text-lg font-black text-amber-700 dark:text-amber-300">
                  {streak} {t.review.streakUnit}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Quota Progress Bar */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-700 dark:text-slate-300">
              {t.review.completedToday} {reviewedTodayCount} / {dailyQuota} {language === 'vi' ? 'từ' : 'words'}
            </span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">
              {quotaProgress}%
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-emerald-400 transition-all duration-500 rounded-full"
              style={{ width: `${quotaProgress}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-slate-50 p-3.5 text-center dark:bg-slate-900/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t.deck.dueToday}
            </span>
            <p className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">
              {dueCards.length}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3.5 text-center dark:bg-slate-900/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t.deck.mastered}
            </span>
            <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {masteredCount}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3.5 text-center dark:bg-slate-900/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t.deck.totalWords}
            </span>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
              {allWords.length}
            </p>
          </div>
        </div>
      </div>

      {/* Select Review Mode */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-100/70 dark:border-slate-800 dark:bg-[#111622] dark:shadow-none space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {language === 'vi' ? 'Chọn chế độ ôn luyện' : 'Choose Practice Mode'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Mode 1: Flashcards */}
          <div
            onClick={() => setSelectedMode('flashcards')}
            className={`cursor-pointer rounded-2xl border p-5 transition-all ${
              selectedMode === 'flashcards'
                ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-600/10 dark:border-indigo-500 dark:bg-indigo-950/30'
                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <Layers className="h-5 w-5" />
              </div>
              {selectedMode === 'flashcards' && (
                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  ✓
                </span>
              )}
            </div>

            <h4 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">
              {t.review.flashcardMode}
            </h4>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t.review.flashcardDesc}
            </p>
          </div>

          {/* Mode 2: Cloze Test */}
          <div
            onClick={() => setSelectedMode('cloze')}
            className={`cursor-pointer rounded-2xl border p-5 transition-all ${
              selectedMode === 'cloze'
                ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-600/10 dark:border-indigo-500 dark:bg-indigo-950/30'
                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <Zap className="h-5 w-5" />
              </div>
              {selectedMode === 'cloze' && (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  ✓
                </span>
              )}
            </div>

            <h4 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">
              {t.review.quizMode}
            </h4>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t.review.quizDesc}
            </p>
          </div>
        </div>

        {/* Start Button for Due Cards */}
        <div className="pt-3">
          {dueCards.length > 0 ? (
            <button
              type="button"
              onClick={handleStartDue}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-500 active:scale-98"
            >
              <Play className="h-4 w-4 fill-white" />
              <span>
                {language === 'vi'
                  ? `Ôn tập ${dueCards.length} thẻ đến hạn hôm nay`
                  : `Review ${dueCards.length} Cards Due Today`}
              </span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <p className="text-xs font-semibold">
                  {t.review.noDueCards}
                </p>
              </div>

              {allWords.length > 0 && (
                <button
                  type="button"
                  onClick={handleStartCram}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 py-3.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  <span>{t.review.reviewAllAnyway} ({allWords.length} {language === 'vi' ? 'từ' : 'words'})</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FEATURE: Ôn tập từ vựng theo ngày nhập (Review by Date Added) */}
      {availableDates && availableDates.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-100/70 dark:border-slate-800 dark:bg-[#111622] dark:shadow-none space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t.review.reviewByDate}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.review.reviewByDateDesc}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              {dateWords.length} {language === 'vi' ? 'từ' : 'words'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <div className="relative w-full sm:flex-1">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                {t.review.selectDateLabel}
              </label>
              <select
                value={selectedReviewDate}
                onChange={(e) => setSelectedReviewDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {availableDates.map((item) => (
                  <option key={item.date} value={item.date}>
                    {item.date} ({item.count} {language === 'vi' ? 'từ vựng' : 'words'})
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-auto self-end">
              <button
                type="button"
                onClick={handleStartReviewByDate}
                disabled={dateWords.length === 0}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50 active:scale-98 transition-all"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                <span>
                  {t.review.startReviewDateBtn} ({dateWords.length})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
