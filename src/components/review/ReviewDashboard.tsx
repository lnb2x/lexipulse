import { ArrowRight, BrainCircuit, Calendar, CheckCircle2, CheckSquare, Flame, Headphones, HelpCircle, Layers, Play, Sparkles } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { GlassDropdown } from '../common/GlassDropdown';
import { ContentSurface, GlassButton } from '../common/Glass';
import { SlidingSelection } from '../common/SlidingSelection';
import { useLanguage } from '../../context/LanguageContext';
import type { ReviewMode, ReviewQueueStats, WordItem } from '../../types/vocab';
import { formatLocalDate } from '../../utils/dateUtils';
import type { StudyAttempt } from '../../types/study';
import { EMPTY_STUDY_ATTEMPTS, selectExtraPracticeWords } from '../../services/practiceSelection';

interface ReviewDashboardProps {
  dueCards: WordItem[];
  allWords: WordItem[];
  availableDates?: Array<{ date: string; count: number }>;
  reviewedTodayCount: number;
  dailyQuota: number;
  streak: number;
  queueStats?: ReviewQueueStats;
  studyAttempts?: StudyAttempt[];
  onStartSession: (mode: ReviewMode, cards: WordItem[], sessionType?: 'due' | 'cram') => void;
}

export const ReviewDashboard: React.FC<ReviewDashboardProps> = ({ dueCards, allWords, availableDates = [], reviewedTodayCount, dailyQuota, streak, queueStats, studyAttempts = EMPTY_STUDY_ATTEMPTS, onStartSession }) => {
  const { language, t } = useLanguage();
  const vi = language === 'vi';
  const [selectedMode, setSelectedMode] = useState<ReviewMode>('learn');
  const [sessionSize, setSessionSize] = useState<number>(10);
  const [selectedReviewDate, setSelectedReviewDate] = useState(availableDates[0]?.date || formatLocalDate());
  const activeReviewDate = availableDates.some(item => item.date === selectedReviewDate) ? selectedReviewDate : availableDates[0]?.date || selectedReviewDate;
  const quotaProgress = dailyQuota > 0 ? Math.min(100, Math.round(reviewedTodayCount / dailyQuota * 100)) : 0;
  const masteredCount = allWords.filter(word => word.status === 'mastered').length;
  const dateWords = allWords.filter(word => formatLocalDate(word.createdAt) === activeReviewDate);
  const sessionType = dueCards.length > 0 ? 'due' : 'cram';
  const sessionCards = useMemo(() => sessionType === 'due' ? dueCards.slice(0, sessionSize)
    : selectExtraPracticeWords(allWords, studyAttempts, sessionSize), [sessionType, dueCards, allWords, studyAttempts, sessionSize]);
  const practiceModes = [
    { id: 'learn' as const, title: vi ? 'Học thông minh' : 'Learn', shortTitle: vi ? 'Học thông minh' : 'Learn', desc: vi ? 'Bắt đầu với trắc nghiệm, tiến đến tự gõ từ. Những từ chưa nhớ sẽ quay lại sau vài câu để bạn luyện thêm.' : 'Start with multiple choice, then recall and type the word. Difficult words come back after a few questions for more practice.', icon: BrainCircuit },
    { id: 'flashcards' as const, title: t.review.flashcardMode, shortTitle: t.review.flashcardMode, desc: t.review.flashcardDesc, icon: Layers },
    { id: 'cloze' as const, title: t.review.quizMode, shortTitle: vi ? 'Điền từ' : 'Fill in', desc: t.review.quizDesc, icon: HelpCircle },
    { id: 'listen' as const, title: t.review.listenMode, shortTitle: vi ? 'Nghe chép' : 'Listen', desc: t.review.listenDesc, icon: Headphones },
    { id: 'choice' as const, title: t.review.choiceMode, shortTitle: vi ? 'Trắc nghiệm' : 'Test', desc: t.review.choiceDesc, icon: CheckSquare },
    { id: 'match' as const, title: t.review.matchMode, shortTitle: vi ? 'Nối từ' : 'Match', desc: t.review.matchDesc, icon: Sparkles },
  ];
  const activeMode = practiceModes.find(mode => mode.id === selectedMode)!;
  const ActiveIcon = activeMode.icon;

  return <div className="quizlet-review-dashboard">
    <SlidingSelection value={selectedMode} className="quizlet-review-mode-tabs" role="group" aria-label={vi ? 'Chọn cách luyện' : 'Choose a practice mode'}>
      {practiceModes.map(mode => <button type="button" key={mode.id} aria-label={mode.title} aria-pressed={selectedMode === mode.id} onClick={() => setSelectedMode(mode.id)} className="quizlet-review-mode-tab">
        <mode.icon size={19} aria-hidden="true" />
        <span>{mode.shortTitle}</span>
      </button>)}
    </SlidingSelection>

    <ContentSurface className="quizlet-review-study-card" aria-labelledby="quizlet-review-mode-heading">
      <div className="quizlet-review-card-heading">
        <span className="quizlet-review-mode-symbol"><ActiveIcon size={26} aria-hidden="true" /></span>
        <span className="quizlet-review-pill">{selectedMode === 'learn' ? (vi ? 'Lộ trình của bạn' : 'Your learning path') : (vi ? 'Luyện theo cách của bạn' : 'Practice your way')}</span>
      </div>
      <div className="quizlet-review-intro" aria-live="polite">
        <h2 id="quizlet-review-mode-heading">{activeMode.title}</h2>
        <p>{activeMode.desc}</p>
      </div>

      {selectedMode === 'learn' && <ol className="quizlet-review-learning-path" aria-label={vi ? 'Cách học thông minh hoạt động' : 'How Learn works'}>
        <li><span>1</span>{vi ? 'Nhận diện nghĩa' : 'Recognize the meaning'}</li>
        <li><span>2</span>{vi ? 'Tự nhớ và viết' : 'Recall and write'}</li>
        <li><span>3</span>{vi ? 'Luyện lại từ khó' : 'Revisit difficult words'}</li>
      </ol>}

      <div className="quizlet-review-start-settings">
        <fieldset className="quizlet-review-session-size">
          <legend>{vi ? 'Số từ mỗi lượt' : 'Words per session'}</legend>
          <div>{[10, 20, Infinity].map(size => <label key={String(size)} data-glass className={`glass-control glass-pill ${sessionSize === size ? 'is-selected' : ''}`}>
            <input type="radio" name="session-size" checked={sessionSize === size} onChange={() => setSessionSize(size)} />
            {Number.isFinite(size) ? size : vi ? 'Tất cả' : 'All'}
          </label>)}</div>
        </fieldset>
        <div className="quizlet-review-session-note">
          {dueCards.length === 0 && allWords.length > 0 && <span className="quizlet-review-done"><CheckCircle2 size={15} aria-hidden="true" />{t.review.noDueCards}</span>}
          <p>{sessionCards.length > 0 ? sessionType === 'due' ? (vi ? `${sessionCards.length} từ đến hạn hôm nay` : `${sessionCards.length} words due today`) : (vi ? `${sessionCards.length} từ · Luyện thêm` : `${sessionCards.length} words · Extra practice`) : (vi ? 'Thêm từ vào bộ từ vựng để bắt đầu.' : 'Add words to your vocabulary deck to get started.')}</p>
          {sessionType === 'cram' && sessionCards.length > 0 && <small>{vi ? 'Ưu tiên từ khó và từ lâu chưa luyện. Luyện thêm không thay đổi lịch ôn.' : 'Prioritizes difficult words and words you have not practiced recently. Extra practice keeps your review schedule.'}</small>}
        </div>
      </div>

      <GlassButton prominent disabled={sessionCards.length === 0} className="quizlet-review-start-button" onClick={() => onStartSession(selectedMode, sessionCards, sessionType)}>
        <Play size={17} fill="currentColor" aria-hidden="true" />
        <span>{selectedMode === 'learn' ? (vi ? 'Bắt đầu học' : 'Start learning') : sessionType === 'due' ? (vi ? `Ôn tập ${sessionCards.length} thẻ đến hạn hôm nay` : `Review ${sessionCards.length} Cards Due Today`) : (vi ? `Luyện thêm ${sessionCards.length} thẻ` : `Practice ${sessionCards.length} cards`)}</span>
        <ArrowRight size={18} aria-hidden="true" />
      </GlassButton>
      <p className="quizlet-review-supporting-note">{selectedMode === 'learn' ? (vi ? 'Câu hỏi thay đổi theo mức độ bạn nhớ từng từ.' : 'Questions adapt to how well you know each word.') : (vi ? 'Một chút tập trung, thêm nhiều từ bạn nhớ.' : 'A little focus, more words you remember.')}</p>
    </ContentSurface>

    <ContentSurface className="quizlet-review-today" aria-label={vi ? 'Tiến độ hôm nay' : "Today's progress"}>
      <div className="quizlet-review-today-heading"><h3>{vi ? 'Tiến độ hôm nay' : "Today's progress"}</h3><span className="quizlet-review-streak"><Flame size={15} aria-hidden="true" />{streak} {t.review.streakUnit}</span></div>
      <div className="quizlet-review-today-stats">
        <p><strong>{reviewedTodayCount}<small> / {dailyQuota}</small></strong><span>{t.review.completedToday}</span></p>
        <p><strong>{dueCards.length}</strong><span>{vi ? 'Từ đến hạn' : 'Words due'}</span></p>
        <div className="quizlet-review-daily-progress"><span>{vi ? 'Mục tiêu mỗi ngày' : 'Daily goal'}<strong>{quotaProgress}%</strong></span><div className="study-progress-track" role="progressbar" aria-label={t.review.completedToday} aria-valuemin={0} aria-valuemax={100} aria-valuenow={quotaProgress}><div style={{ width: `${quotaProgress}%` }} /></div></div>
      </div>
      <div className="quizlet-review-library-summary"><span><strong>{allWords.length}</strong> {t.deck.totalWords}</span><span><strong>{masteredCount}</strong> {t.deck.mastered}</span>
        {queueStats && queueStats.retentionSampleCount > 0 && queueStats.actualRetentionRate !== null && <span>{vi ? 'Độ nhớ thực tế' : 'Retention'} <strong>{Math.round(queueStats.actualRetentionRate * 100)}%</strong> (N={queueStats.retentionSampleCount})</span>}
      </div>
    </ContentSurface>

    {availableDates.length > 0 && <ContentSurface className="quizlet-review-date-panel">
      <div className="quizlet-review-date-heading"><h3><Calendar size={17} aria-hidden="true" />{t.review.reviewByDate}</h3><span>{dateWords.length} {vi ? 'từ' : 'words'}</span></div>
      <p>{t.review.reviewByDateDesc}</p>
      <div className="quizlet-review-date-controls">
        <div><span className="quizlet-review-date-label">{t.review.selectDateLabel}</span><GlassDropdown label={t.review.selectDateLabel} value={activeReviewDate} onChange={setSelectedReviewDate}
          icon={<Calendar size={15} />} options={availableDates.map(item => ({ value: item.date, label: `${item.date} (${item.count} ${vi ? 'từ vựng' : 'words'})` }))} /></div>
        <GlassButton disabled={dateWords.length === 0} onClick={() => onStartSession(selectedMode, dateWords.slice(0, sessionSize), 'cram')}><Play size={15} aria-hidden="true" />{t.review.startReviewDateBtn} ({Math.min(dateWords.length, sessionSize)})</GlassButton>
      </div>
    </ContentSurface>}
  </div>;
};
