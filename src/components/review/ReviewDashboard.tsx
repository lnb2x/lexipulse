import { Calendar, CheckCircle2, CheckSquare, Flame, Headphones, HelpCircle, Layers, Play, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { ReviewMode, WordItem } from '../../types/vocab';
import { formatLocalDate } from '../../utils/dateUtils';

interface ReviewDashboardProps {
  dueCards: WordItem[];
  allWords: WordItem[];
  availableDates?: Array<{ date: string; count: number }>;
  reviewedTodayCount: number;
  dailyQuota: number;
  streak: number;
  onStartSession: (mode: ReviewMode, cardsToReview: WordItem[]) => void;
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
  const [selectedMode, setSelectedMode] = useState<ReviewMode>('flashcards');
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

  const practiceModes: Array<{
    id: ReviewMode;
    title: string;
    desc: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      id: 'flashcards',
      title: t.review.flashcardMode,
      desc: t.review.flashcardDesc,
      icon: <Layers className="h-4 w-4" />,
      color: 'bg-indigo-600',
    },
    {
      id: 'cloze',
      title: t.review.quizMode,
      desc: t.review.quizDesc,
      icon: <HelpCircle className="h-4 w-4" />,
      color: 'bg-emerald-600',
    },
    {
      id: 'listen',
      title: t.review.listenMode,
      desc: t.review.listenDesc,
      icon: <Headphones className="h-4 w-4" />,
      color: 'bg-violet-600',
    },
    {
      id: 'choice',
      title: t.review.choiceMode,
      desc: t.review.choiceDesc,
      icon: <CheckSquare className="h-4 w-4" />,
      color: 'bg-sky-600',
    },
    {
      id: 'match',
      title: t.review.matchMode,
      desc: t.review.matchDesc,
      icon: <Sparkles className="h-4 w-4" />,
      color: 'bg-amber-600',
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Daily Quota & Streak Progress Header */}
      <div className="card-elevated p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Spaced Repetition
            </span>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t.review.dashboardTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t.review.dashboardSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Streak pill */}
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/60 px-3.5 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
              <Flame className="h-5 w-5 text-amber-500 fill-amber-500 animate-pulse" />
              <div>
                <span className="block text-[10px] uppercase font-bold tracking-wider text-amber-700/80 dark:text-amber-400/80">
                  {t.review.streakCount}
                </span>
                <span className="font-display text-base font-bold text-amber-900 dark:text-amber-200 leading-none">
                  {streak} {t.review.streakUnit}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Quota Progress Bar */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-slate-700 dark:text-slate-300">
              {t.review.completedToday}{' '}
              <strong className="text-slate-900 dark:text-white font-bold">{reviewedTodayCount}</strong> / {dailyQuota} {language === 'vi' ? 'từ' : 'words'}
            </span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold font-mono">
              {quotaProgress}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500 rounded-full"
              style={{ width: `${quotaProgress}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.deck.dueToday}
            </span>
            <p className="mt-1 font-display text-2xl font-bold text-rose-600 dark:text-rose-400">
              {dueCards.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.deck.mastered}
            </span>
            <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {masteredCount}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.deck.totalWords}
            </span>
            <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
              {allWords.length}
            </p>
          </div>
        </div>
      </div>

      {/* Select Review Mode */}
      <div className="card-elevated p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {language === 'vi' ? 'Chọn chế độ ôn luyện (5 phương thức)' : 'Choose Practice Mode (5 Methods)'}
          </h3>

          <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
            {practiceModes.find((m) => m.id === selectedMode)?.title}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {practiceModes.map((mode) => {
            const isSelected = selectedMode === mode.id;
            return (
              <div
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                className={`cursor-pointer rounded-xl border p-4 transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm dark:border-indigo-500 dark:bg-indigo-950/30 ring-1 ring-indigo-600/30 dark:ring-indigo-400/30'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${mode.color} text-white shadow-sm`}>
                      {mode.icon}
                    </div>
                    {isSelected && (
                      <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                        Active
                      </span>
                    )}
                  </div>

                  <h4 className="mt-3 font-display text-sm font-bold text-slate-900 dark:text-white">
                    {mode.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {mode.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Start Button for Due Cards */}
        <div className="pt-2">
          {dueCards.length > 0 ? (
            <button
              type="button"
              onClick={handleStartDue}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-500 active:scale-[0.99] transition-all"
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
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <p className="text-xs font-medium">
                  {t.review.noDueCards}
                </p>
              </div>

              {allWords.length > 0 && (
                <button
                  type="button"
                  onClick={handleStartCram}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
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
        <div className="card-elevated p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <Calendar className="h-4 w-4" />
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
            <span className="rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-xs font-bold font-mono text-indigo-600 dark:border-indigo-900/50 dark:bg-indigo-950/60 dark:text-indigo-400">
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
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
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
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 active:scale-[0.99] transition-all"
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
