import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import React, { useState } from 'react';
import { normalizeVietnameseDefinition } from '../../utils/definitionUtils';
import { useLanguage } from '../../context/LanguageContext';
import { playPronunciation } from '../../services/audio';
import type { ClozeQuestion, ReviewRating } from '../../types/vocab';
import type { AttemptEvidence } from '../../types/study';
import { AudioButton } from '../common/AudioButton';
import { SlidingSelection } from '../common/SlidingSelection';

interface ReviewQuizProps {
  question: ClozeQuestion;
  currentIndex: number;
  totalQuestions: number;
  onAnswer: (rating: ReviewRating, evidence?: AttemptEvidence) => void;
}

export const ReviewQuiz: React.FC<ReviewQuizProps> = ({
  question,
  currentIndex,
  totalQuestions,
  onAnswer,
}) => {
  const { language, t } = useLanguage();
  const [mode, setMode] = useState<'mcq' | 'type'>('mcq');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const targetWordClean = question.targetWord.toLowerCase().trim();

  const handleSelectOption = (opt: string) => {
    if (isSubmitted) return;
    setSelectedOption(opt);
    const correct = opt.toLowerCase() === targetWordClean;
    setIsCorrect(correct);
    setIsSubmitted(true);
  };

  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitted || !typedAnswer.trim()) return;
    const correct = typedAnswer.trim().toLowerCase() === targetWordClean;
    setIsCorrect(correct);
    setIsSubmitted(true);
  };

  const handleNext = () => {
    // If correct on first attempt, award Easy (3), else Again (1)
    onAnswer(isCorrect ? 3 : 1, { firstAttemptCorrect: isCorrect, incorrectSubmissionCount: isCorrect ? 0 : 1 });
    // The parent mounts the next card only after its result is saved.
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      const isAudioShortcut =
        ((e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'a') && !isInput && !isCtrlOrMeta && !e.altKey) ||
        (isCtrlOrMeta && e.code === 'Space');

      if (isAudioShortcut && isSubmitted) {
        e.preventDefault();
        const accent = e.shiftKey ? 'UK' : 'US';
        const audioUrl = accent === 'UK'
          ? (question.word.phonetics.audioUk || question.word.phonetics.audioUs)
          : (question.word.phonetics.audioUs || question.word.phonetics.audioUk);
        playPronunciation(question.targetWord, accent, audioUrl);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitted, question]);

  return (
    <div className="review-exercise w-full max-w-2xl mx-auto space-y-5 animate-slide-up">
      {/* Top progress & mode toggle */}
      <div className="exercise-heading flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
          {language === 'vi' ? `Câu hỏi ${currentIndex + 1} / ${totalQuestions}` : `Question ${currentIndex + 1} of ${totalQuestions}`}
        </span>

        {/* MCQ vs Type Mode Toggle */}
        <SlidingSelection value={mode} className="exercise-mode-selection" role="group" aria-label={language === 'vi' ? 'Cách trả lời' : 'Answer mode'}>
          <button
            type="button"
            aria-pressed={mode === 'mcq'}
            onClick={() => setMode('mcq')}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
              mode === 'mcq'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t.review.multipleChoice}
          </button>
          <button
            type="button"
            aria-pressed={mode === 'type'}
            onClick={() => setMode('type')}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
              mode === 'type'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t.review.typeIn}
          </button>
        </SlidingSelection>
      </div>

      {/* Main Question Card */}
      <div className="review-question-panel card-elevated p-6 sm:p-7 space-y-5">
        {/* Context badge & hints */}
        <div className="review-question-heading flex items-center justify-between">
          <span className="exercise-context-badge">
            {language === 'vi' ? 'Điền từ trong ngữ cảnh' : 'Cloze context'}
          </span>

          <span className="text-xs text-slate-400 dark:text-slate-500 italic">
            {language === 'vi' ? 'Loại từ:' : 'Part of speech:'} {question.hintPos || question.word.pos.join(', ')}
          </span>
        </div>

        {/* Masked sentence display */}
        <div className="review-prompt text-left">
          <p className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
            {isSubmitted
              ? question.sentenceWithBlank.replace(
                  '________',
                  `[ ${question.targetWord.toUpperCase()} ]`
                )
              : question.sentenceWithBlank}
          </p>

          <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
            {language === 'vi' ? 'Nghĩa gợi ý:' : 'Hint definition:'}{' '}
            <strong className="text-slate-700 dark:text-slate-300 font-semibold">{normalizeVietnameseDefinition(question.hintDefinition || question.word.vietnameseDefinition)}</strong>
          </p>
        </div>

        {/* Audio helper when submitted */}
        {isSubmitted && (
          <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 dark:border-indigo-900/50 dark:bg-indigo-950/30 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {question.targetWord}
              </span>
              <span className="font-mono text-xs text-slate-400">
                {question.word.phonetics.us}
              </span>
            </div>
            <AudioButton text={question.targetWord} size="sm" shortcutHint="R" />
          </div>
        )}

        {/* Input Area: Multiple Choice OR Type Mode */}
        {mode === 'mcq' ? (
          <div className="review-answer-grid grid grid-cols-1 sm:grid-cols-2 gap-3">
            {question.options.map((opt, i) => {
              const isOptionCorrect = opt.toLowerCase() === targetWordClean;
              const isOptionSelected = selectedOption === opt;

              let btnStyle = 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200';

              if (isSubmitted) {
                if (isOptionCorrect) {
                  btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
                } else if (isOptionSelected && !isOptionCorrect) {
                  btnStyle = 'border-rose-500 bg-rose-50 text-rose-800 font-bold dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300';
                } else {
                  btnStyle = 'opacity-40 border-slate-200 dark:border-slate-800 text-slate-400';
                }
              }

              return (
                <button
                  key={i}
                  type="button"
                  data-glass
                  data-answer-state={isSubmitted ? isOptionCorrect ? 'correct' : isOptionSelected ? 'incorrect' : 'muted' : 'idle'}
                  disabled={isSubmitted}
                  onClick={() => handleSelectOption(opt)}
                  className={`review-answer flex items-center justify-between rounded-xl border p-3.5 text-sm font-semibold transition-all shadow-sm ${btnStyle}`}
                >
                  <span>{opt}</span>
                  {isSubmitted && isOptionCorrect && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                  {isSubmitted && isOptionSelected && !isOptionCorrect && (
                    <XCircle className="h-4 w-4 text-rose-500" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <form onSubmit={handleTypeSubmit} className="review-typed-answer space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                disabled={isSubmitted}
                placeholder={language === 'vi' ? 'Nhập từ còn thiếu vào đây...' : 'Type the missing word here...'}
                autoFocus
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
              {!isSubmitted && (
                <button
                  type="submit"
                  disabled={!typedAnswer.trim()}
                  className="btn-primary"
                >
                  {t.review.checkAnswer}
                </button>
              )}
            </div>
          </form>
        )}

        {/* Immediate Feedback Bar */}
        {isSubmitted && (
          <div
            className={`flex items-center justify-between rounded-xl p-3.5 animate-fade-in ${
              isCorrect
                ? 'border border-emerald-200/80 bg-emerald-50/60 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
                : 'border border-rose-200/80 bg-rose-50/60 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isCorrect ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
              )}
              <div>
                <p className="text-xs font-bold">
                  {isCorrect ? t.review.correctFeedback : `${t.review.incorrectFeedback} "${question.targetWord}"`}
                </p>
                <p className="text-[11px] opacity-80 font-medium">
                  {isCorrect
                    ? (language === 'vi' ? 'Khoảng cách ôn tập sẽ được tăng lên.' : 'Interval will be increased.')
                    : (language === 'vi' ? 'Thẻ sẽ sớm được lên lịch ôn tập lại.' : 'Card will be scheduled for review again soon.')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="review-continue flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-all active:scale-95"
            >
              <span>{t.review.nextQuestion}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
