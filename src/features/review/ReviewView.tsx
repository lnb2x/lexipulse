import React, { Suspense, lazy } from 'react';
import { ArrowLeft, Headphones, HelpCircle, Layers, ListChecks, Loader2, Zap } from 'lucide-react';
import { ReviewDashboard } from '../../components/review/ReviewDashboard';
import { useLanguage } from '../../context/LanguageContext';
import type { ClozeQuestion, ReviewMode, ReviewRating, WordItem } from '../../types/vocab';

// Code-split interactive review modes so they are loaded on-demand
const Flashcard = lazy(() =>
  import('../../components/review/Flashcard').then((m) => ({ default: m.Flashcard }))
);
const ReviewQuiz = lazy(() =>
  import('../../components/review/ReviewQuiz').then((m) => ({ default: m.ReviewQuiz }))
);
const ReviewListening = lazy(() =>
  import('../../components/review/ReviewListening').then((m) => ({ default: m.ReviewListening }))
);
const ReviewChoice = lazy(() =>
  import('../../components/review/ReviewChoice').then((m) => ({ default: m.ReviewChoice }))
);
const ReviewMatch = lazy(() =>
  import('../../components/review/ReviewMatch').then((m) => ({ default: m.ReviewMatch }))
);
const ReviewComplete = lazy(() =>
  import('../../components/review/ReviewComplete').then((m) => ({ default: m.ReviewComplete }))
);

export interface ReviewSessionState {
  inProgress: boolean;
  mode: ReviewMode;
  cards: WordItem[];
  currentIndex: number;
  clozeQuestions: ClozeQuestion[];
  sessionHistory: Array<{ word: WordItem; rating: number }>;
  isCompleted: boolean;
}

export interface ReviewViewProps {
  allWords: WordItem[];
  dueCards: WordItem[];
  streak: number;
  reviewedTodayCount: number;
  dailyQuota: number;
  availableDates?: Array<{ date: string; count: number }>;
  reviewState: ReviewSessionState;
  setReviewState: React.Dispatch<React.SetStateAction<ReviewSessionState>>;
  onStartReviewSession: (mode: ReviewMode, cards?: WordItem[]) => void;
  onSwitchReviewMode: (mode: ReviewMode) => void;
  onGradeReview: (rating: ReviewRating) => void;
  onGradeSingleWord?: (wordId: string, rating: ReviewRating) => Promise<void> | void;
  onGoToDeck: () => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  allWords,
  dueCards,
  streak,
  reviewedTodayCount,
  dailyQuota,
  availableDates = [],
  reviewState,
  setReviewState,
  onStartReviewSession,
  onSwitchReviewMode,
  onGradeReview,
  onGradeSingleWord,
  onGoToDeck,
}) => {
  const { language } = useLanguage();

  if (!reviewState.inProgress) {
    return (
      <div className="space-y-6 animate-fade-in">
        <ReviewDashboard
          dueCards={dueCards}
          allWords={allWords}
          availableDates={availableDates}
          reviewedTodayCount={reviewedTodayCount}
          dailyQuota={dailyQuota}
          streak={streak}
          onStartSession={onStartReviewSession}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {reviewState.isCompleted ? (
        <Suspense
          fallback={
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          }
        >
          <ReviewComplete
            reviewedCount={reviewState.sessionHistory.length}
            streak={streak}
            history={reviewState.sessionHistory}
            onRestart={() => {
              onStartReviewSession(reviewState.mode, reviewState.cards);
            }}
            onGoToDeck={onGoToDeck}
          />
        </Suspense>
      ) : (
        <div className="space-y-4">
          {/* Top Navigation & Mode Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setReviewState((prev) => ({ ...prev, inProgress: false }))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 shadow-sm transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{language === 'vi' ? 'Quay lại Hub Ôn tập' : 'Back to Review Hub'}</span>
            </button>

            {/* Quick Mode Switcher */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm">
              {(
                [
                  { id: 'flashcards', labelVi: 'Flashcard', labelEn: 'Flashcards', icon: Layers },
                  { id: 'cloze', labelVi: 'Điền từ', labelEn: 'Cloze', icon: HelpCircle },
                  { id: 'listen', labelVi: 'Nghe chép', labelEn: 'Dictation', icon: Headphones },
                  { id: 'choice', labelVi: '4 Đáp án', labelEn: 'Choice', icon: ListChecks },
                  { id: 'match', labelVi: 'Nối từ', labelEn: 'Match', icon: Zap },
                ] as const
              ).map((m) => {
                const Icon = m.icon;
                const isActive = reviewState.mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSwitchReviewMode(m.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">
                      {language === 'vi' ? m.labelVi : m.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Review Mode Content */}
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              </div>
            }
          >
            {reviewState.mode === 'flashcards' && reviewState.cards[reviewState.currentIndex] && (
              <Flashcard
                word={reviewState.cards[reviewState.currentIndex]}
                currentIndex={reviewState.currentIndex}
                totalCards={reviewState.cards.length}
                onGrade={onGradeReview}
                onPrevCard={
                  reviewState.currentIndex > 0
                    ? () =>
                        setReviewState((prev) => ({
                          ...prev,
                          currentIndex: prev.currentIndex - 1,
                        }))
                    : undefined
                }
                onNextCard={
                  reviewState.currentIndex < reviewState.cards.length - 1
                    ? () =>
                        setReviewState((prev) => ({
                          ...prev,
                          currentIndex: prev.currentIndex + 1,
                        }))
                    : undefined
                }
              />
            )}

            {reviewState.mode === 'cloze' &&
              reviewState.clozeQuestions[reviewState.currentIndex] && (
                <ReviewQuiz
                  question={reviewState.clozeQuestions[reviewState.currentIndex]}
                  currentIndex={reviewState.currentIndex}
                  totalQuestions={reviewState.clozeQuestions.length}
                  onAnswer={onGradeReview}
                />
              )}

            {reviewState.mode === 'listen' && reviewState.cards[reviewState.currentIndex] && (
              <ReviewListening
                word={reviewState.cards[reviewState.currentIndex]}
                currentIndex={reviewState.currentIndex}
                totalCards={reviewState.cards.length}
                onAnswer={onGradeReview}
                onPrevCard={
                  reviewState.currentIndex > 0
                    ? () =>
                        setReviewState((prev) => ({
                          ...prev,
                          currentIndex: prev.currentIndex - 1,
                        }))
                    : undefined
                }
                onNextCard={
                  reviewState.currentIndex < reviewState.cards.length - 1
                    ? () =>
                        setReviewState((prev) => ({
                          ...prev,
                          currentIndex: prev.currentIndex + 1,
                        }))
                    : undefined
                }
              />
            )}

            {reviewState.mode === 'choice' && reviewState.cards[reviewState.currentIndex] && (
              <ReviewChoice
                word={reviewState.cards[reviewState.currentIndex]}
                allWords={allWords}
                currentIndex={reviewState.currentIndex}
                totalCards={reviewState.cards.length}
                onAnswer={onGradeReview}
              />
            )}

            {reviewState.mode === 'match' && (
              <ReviewMatch
                cards={reviewState.cards}
                onCompleteSession={(history) =>
                  setReviewState((prev) => ({
                    ...prev,
                    isCompleted: true,
                    sessionHistory: history,
                  }))
                }
                onGradeSingleWord={onGradeSingleWord}
              />
            )}
          </Suspense>
        </div>
      )}
    </div>
  );
};
