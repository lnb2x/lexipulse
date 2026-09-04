import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { ClozeQuestion, ReviewRating } from '../../types/vocab';
import { AudioButton } from '../common/AudioButton';

interface ReviewQuizProps {
  question: ClozeQuestion;
  currentIndex: number;
  totalQuestions: number;
  onAnswer: (rating: ReviewRating) => void;
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
    onAnswer(isCorrect ? 3 : 1);
    // Reset state for next question
    setSelectedOption(null);
    setTypedAnswer('');
    setIsSubmitted(false);
    setIsCorrect(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 animate-slide-up">
      {/* Top progress & mode toggle */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold">
          {language === 'vi' ? `Câu hỏi ${currentIndex + 1} / ${totalQuestions}` : `Question ${currentIndex + 1} of ${totalQuestions}`}
        </span>

        {/* MCQ vs Type Mode Toggle */}
        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setMode('mcq')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
              mode === 'mcq'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-500'
            }`}
          >
            {t.review.multipleChoice}
          </button>
          <button
            type="button"
            onClick={() => setMode('type')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
              mode === 'type'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-500'
            }`}
          >
            {t.review.typeIn}
          </button>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-100/70 dark:border-slate-800 dark:bg-[#111622] dark:shadow-none space-y-6">
        {/* Context badge & hints */}
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
            TOEIC Cloze Context
          </span>

          <span className="text-xs text-slate-400 italic">
            Hint: {question.hintPos || question.word.pos.join(', ')}
          </span>
        </div>

        {/* Masked sentence display */}
        <div className="rounded-2xl bg-slate-50/70 p-5 text-center sm:text-left dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
          <p className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
            {isSubmitted
              ? question.sentenceWithBlank.replace(
                  '________',
                  `[ ${question.targetWord.toUpperCase()} ]`
                )
              : question.sentenceWithBlank}
          </p>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {language === 'vi' ? 'Nghĩa gợi ý:' : 'Hint definition:'}{' '}
            <strong>{question.hintDefinition || question.word.vietnameseDefinition}</strong>
          </p>
        </div>

        {/* Audio helper when submitted */}
        {isSubmitted && (
          <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-2.5 dark:border-indigo-900/50 dark:bg-indigo-950/20 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {question.targetWord}
              </span>
              <span className="font-mono text-xs text-slate-400">
                {question.word.phonetics.us}
              </span>
            </div>
            <AudioButton text={question.targetWord} size="sm" />
          </div>
        )}

        {/* Input Area: Multiple Choice OR Type Mode */}
        {mode === 'mcq' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {question.options.map((opt, i) => {
              const isOptionCorrect = opt.toLowerCase() === targetWordClean;
              const isOptionSelected = selectedOption === opt;

              let btnStyle = 'border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-700';

              if (isSubmitted) {
                if (isOptionCorrect) {
                  btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold dark:bg-emerald-950/40 dark:text-emerald-300';
                } else if (isOptionSelected && !isOptionCorrect) {
                  btnStyle = 'border-rose-500 bg-rose-50 text-rose-800 font-bold dark:bg-rose-950/40 dark:text-rose-300';
                } else {
                  btnStyle = 'opacity-40 border-slate-200 dark:border-slate-800';
                }
              }

              return (
                <button
                  key={i}
                  type="button"
                  disabled={isSubmitted}
                  onClick={() => handleSelectOption(opt)}
                  className={`flex items-center justify-between rounded-2xl border p-4 text-sm font-semibold transition-all ${btnStyle}`}
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
          <form onSubmit={handleTypeSubmit} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                disabled={isSubmitted}
                placeholder={language === 'vi' ? 'Nhập từ còn thiếu vào đây...' : 'Type the missing word here...'}
                autoFocus
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
              {!isSubmitted && (
                <button
                  type="submit"
                  disabled={!typedAnswer.trim()}
                  className="rounded-2xl bg-indigo-600 px-6 py-3 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50"
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
            className={`flex items-center justify-between rounded-2xl p-4 animate-fade-in ${
              isCorrect
                ? 'border border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'border border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200'
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
                <p className="text-[11px] opacity-80">
                  {isCorrect
                    ? (language === 'vi' ? 'Khoảng cách ôn tập sẽ được tăng lên.' : 'Interval will be increased.')
                    : (language === 'vi' ? 'Thẻ sẽ sớm được lên lịch ôn tập lại.' : 'Card will be scheduled for review again soon.')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
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
