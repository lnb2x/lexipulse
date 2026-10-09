import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Headphones, HelpCircle, Layers, ListChecks, Loader2, Sparkles, Zap } from 'lucide-react';
import { ReviewDashboard } from '../../components/review/ReviewDashboard';
import { SlidingSelection } from '../../components/common/SlidingSelection';
import { ContentSurface, GlassButton } from '../../components/common/Glass';
import { useLanguage } from '../../context/LanguageContext';
import { stopPronunciation } from '../../services/audio';
import type { ReviewMode, ReviewRating, WordItem } from '../../types/vocab';
import type { AttemptEvidence, ReviewSessionState, StudyAttempt } from '../../types/study';
import { EMPTY_STUDY_ATTEMPTS } from '../../services/practiceSelection';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db/schema';
import { difficultWords, restoreStudySession, STUDY_SESSION_KEY } from '../../services/studyProgress';
import { SkillProgress } from '../../components/review/SkillProgress';
import { BackupReminder } from '../../components/deck/BackupReminder';
import { ToeicPractice } from '../../components/review/ToeicPractice';
import { getLearnProgress, getLearnQuestion } from '../../services/adaptiveLearning';
import { withCleanDefinitions } from '../../services/definitionCleanup';
export type { ReviewSessionState } from '../../types/study';


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
const LearnSession = lazy(() =>
  import('../../components/review/LearnSession').then((m) => ({ default: m.LearnSession }))
);

export interface ReviewViewProps {
  allWords: WordItem[];
  studyAttempts?: StudyAttempt[];
  dueCards: WordItem[];
  streak: number;
  reviewedTodayCount: number;
  dailyQuota: number;
  availableDates?: Array<{ date: string; count: number }>;
  reviewState: ReviewSessionState;
  setReviewState: React.Dispatch<React.SetStateAction<ReviewSessionState>>;
  onStartReviewSession: (mode: ReviewMode, cards?: WordItem[], sessionType?: 'due' | 'cram') => void;
  onSwitchReviewMode: (mode: ReviewMode) => void;
  onGradeReview: (rating: ReviewRating, evidence?: AttemptEvidence) => void;
  onGradeSingleWord?: (wordId: string, rating: ReviewRating) => Promise<void> | void;
  onGoToDeck: () => void;
  isSubmitting?: boolean;
  desiredRetention?: number;
  queueStats?: import('../../types/vocab').ReviewQueueStats;
  loopInterval?: number;
  onLoopIntervalChange?: (interval: number) => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  allWords,
  studyAttempts = EMPTY_STUDY_ATTEMPTS,
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
  isSubmitting,
  desiredRetention,
  queueStats,
  loopInterval,
  onLoopIntervalChange,
}) => {
  const { language } = useLanguage();
  const cleanReviewCards = useMemo(() => reviewState.cards.map(withCleanDefinitions), [reviewState.cards]);
  const [isAudioLooping, setIsAudioLooping] = useState(false);
  const [practiceSection, setPracticeSection] = useState<'vocabulary' | 'toeic'>('vocabulary');
  const savedSession = useLiveQuery(() => db.settingsTable.get(STUDY_SESSION_KEY), []);
  const resumable = restoreStudySession(savedSession?.value, allWords);
  const learnQuestion = getLearnQuestion(reviewState.learn);
  const learnProgress = getLearnProgress(reviewState.learn);
  const deferredWords = reviewState.learn?.items.filter(item => item.stage === 'deferred').map(item => item.word) ?? [];
  const remainingCount = resumable?.mode === 'learn'
    ? getLearnProgress(resumable.learn).total - getLearnProgress(resumable.learn).mastered - getLearnProgress(resumable.learn).deferred
    : resumable?.cards.length ?? 0;

  // Stop audio playback and cancel loop mode when review ends, pauses, or switches
  useEffect(() => {
    if (!reviewState.inProgress || reviewState.isCompleted) {
      setIsAudioLooping(false);
      stopPronunciation();
    }
  }, [reviewState.inProgress, reviewState.isCompleted]);

  if (!reviewState.inProgress) {
    return (
      <div className="review-workspace animate-fade-in">
        <div className="study-page-heading">
          <div><h1>{language === 'vi' ? 'Học hôm nay' : 'Study today'}</h1><p>{language === 'vi' ? 'Một chút tập trung mỗi ngày, thêm nhiều từ bạn nhớ.' : 'A little focus each day, more words you remember.'}</p></div>
        <SlidingSelection value={practiceSection} className="review-practice-tabs" role="group" aria-label={language === 'vi' ? 'Nội dung luyện tập' : 'Practice section'}>
          <button type="button" className="btn-secondary" aria-pressed={practiceSection === 'vocabulary'} onClick={() => setPracticeSection('vocabulary')}>
            {language === 'vi' ? 'Từ vựng' : 'Vocabulary'}
          </button>
          <button type="button" className="btn-secondary" aria-pressed={practiceSection === 'toeic'} onClick={() => setPracticeSection('toeic')}>TOEIC Part 5</button>
        </SlidingSelection>
        </div>
        {resumable && (
          <ContentSurface className="review-resume-notice flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">{language === 'vi' ? `Phiên học đang dở: còn ${remainingCount} từ.` : `Unfinished session: ${remainingCount} words left.`}</p>
            <GlassButton onClick={() => { setReviewState(resumable); setPracticeSection('vocabulary'); }}>
              {language === 'vi' ? 'Tiếp tục phiên học' : 'Continue session'}
            </GlassButton>
          </ContentSurface>
        )}
        {practiceSection === 'toeic' ? <ToeicPractice /> : <div className="study-workspace-grid review-workspace-grid">
        <ReviewDashboard
          dueCards={dueCards}
          allWords={allWords}
          studyAttempts={studyAttempts}
          availableDates={availableDates}
          reviewedTodayCount={reviewedTodayCount}
          dailyQuota={dailyQuota}
          streak={streak}
          queueStats={queueStats}
          onStartSession={onStartReviewSession}
        />
        <aside className="study-sidebar">
        <SkillProgress allWords={allWords} attempts={studyAttempts} onStartSession={onStartReviewSession} />
        <BackupReminder wordCount={allWords.length} />
        </aside>
        </div>}
      </div>
    );
  }

  return (
    <div className="review-active-workspace space-y-6">
      {reviewState.isCompleted ? (
        <Suspense
          fallback={
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          }
        >
          {reviewState.mode === 'learn' ? <ContentSurface className="learn-complete" aria-label={language === 'vi' ? 'Kết quả lượt học' : 'Learning results'}>
            <CheckCircle2 size={44} aria-hidden="true" />
            <h2>{language === 'vi' ? 'Bạn đã hoàn thành lượt học' : 'You completed this session'}</h2>
            <p>{language === 'vi' ? `Đã luyện ${learnProgress.answered} câu hỏi. Những từ cần luyện thêm vẫn có trong lịch ôn của bạn.` : `${learnProgress.answered} questions practiced. Words that need more practice remain in your review schedule.`}</p>
            <div className="learn-complete-stats"><div><strong>{learnProgress.mastered}</strong>{' '}<span>{language === 'vi' ? 'từ đã tự nhớ' : 'words recalled'}</span></div><div><strong>{learnProgress.deferred}</strong>{' '}<span>{language === 'vi' ? 'từ cần ôn lại' : 'words to revisit'}</span></div></div>
            {deferredWords.length > 0 && <div className="learn-complete-word-list"><p>{language === 'vi' ? 'Dành thêm thời gian cho:' : 'Spend a little more time on:'}</p>{deferredWords.map(word => <span key={word.id}>{word.word}</span>)}</div>}
            <div className="learn-complete-actions">
              {deferredWords.length > 0 && <GlassButton prominent className="learn-primary-button" onClick={() => onStartReviewSession('learn', deferredWords, 'cram')}>{language === 'vi' ? `Luyện lại ${deferredWords.length} từ cần ôn` : `Practice ${deferredWords.length} words`}</GlassButton>}
              <GlassButton className="learn-secondary-button" onClick={() => onStartReviewSession('learn', reviewState.cards, 'cram')}>{language === 'vi' ? 'Ôn tập lại' : 'Review Again'}</GlassButton>
              <GlassButton className="learn-secondary-button" onClick={onGoToDeck}>{language === 'vi' ? 'Khám phá Bộ từ vựng' : 'Explore Vocabulary Deck'}</GlassButton>
            </div>
          </ContentSurface> : <ReviewComplete
            reviewedCount={reviewState.sessionHistory.length}
            streak={streak}
            history={reviewState.sessionHistory}
            onRestart={() => {
              onStartReviewSession(reviewState.mode, reviewState.cards, 'cram');
            }}
            difficultCount={difficultWords(reviewState.sessionHistory, allWords).length}
            onRetryDifficult={() => onStartReviewSession(reviewState.mode, difficultWords(reviewState.sessionHistory, allWords), 'cram')}
            onGoToDeck={onGoToDeck}
          />}
        </Suspense>
      ) : (
        <div className="space-y-4">
          {/* Top Navigation & Mode Switcher Bar */}
          <div className="review-session-toolbar flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GlassButton
                onClick={() => {
                  setIsAudioLooping(false);
                  stopPronunciation();
                  if (!isSubmitting) setReviewState((prev) => ({ ...prev, inProgress: false }));
                }}
                className="review-session-back inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{language === 'vi' ? 'Quay lại Hub Ôn tập' : 'Back to Review Hub'}</span>
              </GlassButton>

              {reviewState.sessionType === 'cram' && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300/80 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-300 shadow-sm">
                  ⚡ {language === 'vi' ? 'Luyện thêm • Luyện tập mà không thay đổi lịch ôn' : 'Extra Practice • Practice without altering review schedule'}
                </span>
              )}
            </div>

            {/* Quick Mode Switcher */}
            <SlidingSelection value={reviewState.mode} className="review-session-modes" role="group" aria-label={language === 'vi' ? 'Chế độ học' : 'Study mode'}>
              {(
                [
                  { id: 'learn', labelVi: 'Học thông minh', labelEn: 'Learn', icon: Sparkles },
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
                    aria-label={language === 'vi' ? m.labelVi : m.labelEn}
                    aria-pressed={isActive}
                    disabled={isSubmitting}
                    onClick={() => {
                      setIsAudioLooping(false);
                      stopPronunciation();
                      onSwitchReviewMode(m.id);
                    }}
                    className="review-session-mode"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">
                      {language === 'vi' ? m.labelVi : m.labelEn}
                    </span>
                  </button>
                );
              })}
            </SlidingSelection>
          </div>

          {/* Active Review Mode Content */}
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              </div>
            }
          >
            {reviewState.mode === 'learn' && learnQuestion && <LearnSession
              key={`${reviewState.sessionId}:${learnQuestion.key}:${learnQuestion.word.updatedAt}`}
              question={learnQuestion}
              progress={learnProgress}
              allWords={allWords}
              isSubmitting={!!isSubmitting}
              onAnswer={onGradeReview}
            />}
            {reviewState.mode === 'flashcards' && reviewState.cards[reviewState.currentIndex] && (
              <Flashcard
                key={reviewState.cards[reviewState.currentIndex].id}
                word={cleanReviewCards[reviewState.currentIndex]}
                currentIndex={reviewState.currentIndex}
                totalCards={reviewState.cards.length}
                onGrade={onGradeReview}
                isSubmitting={isSubmitting}
                desiredRetention={desiredRetention}
                isLooping={isAudioLooping}
                onToggleLoop={setIsAudioLooping}
                loopInterval={loopInterval}
                onLoopIntervalChange={onLoopIntervalChange}
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
                  key={reviewState.clozeQuestions[reviewState.currentIndex].word.id}
                  question={reviewState.clozeQuestions[reviewState.currentIndex]}
                  currentIndex={reviewState.currentIndex}
                  totalQuestions={reviewState.clozeQuestions.length}
                  onAnswer={onGradeReview}
                />
              )}

            {reviewState.mode === 'listen' && reviewState.cards[reviewState.currentIndex] && (
              <ReviewListening
                key={reviewState.cards[reviewState.currentIndex].id}
                word={cleanReviewCards[reviewState.currentIndex]}
                currentIndex={reviewState.currentIndex}
                totalCards={reviewState.cards.length}
                onAnswer={onGradeReview}
                isLooping={isAudioLooping}
                onToggleLoop={setIsAudioLooping}
                loopInterval={loopInterval}
                onLoopIntervalChange={onLoopIntervalChange}
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
                key={reviewState.cards[reviewState.currentIndex].id}
                word={cleanReviewCards[reviewState.currentIndex]}
                allWords={allWords}
                currentIndex={reviewState.currentIndex}
                totalCards={reviewState.cards.length}
                onAnswer={onGradeReview}
              />
            )}

            {reviewState.mode === 'match' && (
              <ReviewMatch
                key={reviewState.sessionId}
                cards={cleanReviewCards}
                initialHistory={reviewState.sessionHistory}
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
