import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { AudioButton } from '../common/AudioButton';
import type { ReviewRating, WordItem } from '../../types/vocab';

interface ReviewChoiceProps {
  word: WordItem;
  allWords: WordItem[];
  currentIndex: number;
  totalCards: number;
  onAnswer: (rating: ReviewRating) => void;
}

export const ReviewChoice: React.FC<ReviewChoiceProps> = ({
  word,
  allWords,
  currentIndex,
  totalCards,
  onAnswer,
}) => {
  const { language, t } = useLanguage();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Generate 4 shuffled options (1 correct, 3 distractors)
  const options = useMemo(() => {
    const correctMeaning = word.vietnameseDefinition;

    // Pull other definitions from allWords
    const otherMeanings = allWords
      .filter((w) => w.word !== word.word && w.vietnameseDefinition !== correctMeaning)
      .map((w) => w.vietnameseDefinition);

    // Shuffle and pick 3
    const shuffledOthers = [...otherMeanings].sort(() => 0.5 - Math.random());
    const distractors = shuffledOthers.slice(0, 3);

    // Fallbacks if deck has few words
    const fallbackDistractors = [
      'Tạo điều kiện thuận lợi, hỗ trợ',
      'Đàm phán, thương lượng hợp đồng',
      'Tuân thủ, sự phục tùng quy định',
      'Toàn diện, bao quát mọi mặt',
    ];
    for (const f of fallbackDistractors) {
      if (distractors.length < 3 && f !== correctMeaning && !distractors.includes(f)) {
        distractors.push(f);
      }
    }

    return [correctMeaning, ...distractors].sort(() => 0.5 - Math.random());
  }, [word.id, allWords]);

  // Reset state on word change
  useEffect(() => {
    setSelectedOption(null);
    setIsSubmitted(false);
    setIsCorrect(false);
  }, [word.id]);

  // Keyboard shortcut listener: 1, 2, 3, 4 to select options; Enter/Space to advance
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (!isSubmitted) {
        if (['1', '2', '3', '4'].includes(e.key)) {
          const index = parseInt(e.key, 10) - 1;
          if (options[index]) {
            e.preventDefault();
            handleSelectOption(options[index]);
          }
        }
      } else {
        if (e.key === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, isSubmitted, isCorrect]);

  const handleSelectOption = (chosen: string) => {
    if (isSubmitted) return;
    setSelectedOption(chosen);
    const correct = chosen === word.vietnameseDefinition;
    setIsCorrect(correct);
    setIsSubmitted(true);
  };

  const handleNext = () => {
    onAnswer(isCorrect ? 3 : 1);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 animate-slide-up">
      {/* Top progress indicator */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
          {language === 'vi'
            ? `Câu hỏi ${currentIndex + 1} / ${totalCards} (Trắc nghiệm nghĩa)`
            : `Question ${currentIndex + 1} of ${totalCards} (Definition Choice)`}
        </span>

        <span className="text-[11px] text-slate-400">
          {language === 'vi' ? 'Nhấn phím 1, 2, 3, 4 để chọn' : 'Press keys 1, 2, 3, 4'}
        </span>
      </div>

      {/* Main Question Card */}
      <div className="card-elevated p-6 sm:p-8 space-y-6">
        {/* Word Prompt Header */}
        <div className="flex flex-col items-center justify-center text-center space-y-2.5 pb-2">
          <div className="flex items-center gap-1.5">
            {word.pos.map((p) => (
              <span
                key={p}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 italic"
              >
                {p}
              </span>
            ))}
          </div>

          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            {word.word}
          </h2>

          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-slate-500 dark:text-slate-400">
              {word.phonetics.us || word.phonetics.uk}
            </span>
            <AudioButton text={word.word} size="sm" showLabel={false} />
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
            {t.review.chooseCorrectMeaning}
          </p>
        </div>

        {/* 4 Definition Options */}
        <div className="grid grid-cols-1 gap-2.5">
          {options.map((opt, i) => {
            const isOptionCorrect = opt === word.vietnameseDefinition;
            const isOptionSelected = selectedOption === opt;

            let btnStyle =
              'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/70 text-slate-800 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:text-slate-200';

            if (isSubmitted) {
              if (isOptionCorrect) {
                btnStyle =
                  'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200';
              } else if (isOptionSelected && !isOptionCorrect) {
                btnStyle =
                  'border-rose-500 bg-rose-50 text-rose-900 font-bold dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200';
              } else {
                btnStyle = 'opacity-40 border-slate-200 dark:border-slate-800 text-slate-400';
              }
            }

            return (
              <button
                key={i}
                type="button"
                disabled={isSubmitted}
                onClick={() => handleSelectOption(opt)}
                className={`flex items-center justify-between rounded-xl border p-4 text-left text-sm font-semibold transition-all shadow-sm ${btnStyle}`}
              >
                <div className="flex items-center gap-3">
                  <kbd className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 font-mono text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {i + 1}
                  </kbd>
                  <span className="leading-snug">{opt}</span>
                </div>

                {isSubmitted && isOptionCorrect && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 ml-2" />
                )}
                {isSubmitted && isOptionSelected && !isOptionCorrect && (
                  <XCircle className="h-5 w-5 text-rose-500 shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>

        {/* Immediate Feedback Bar */}
        {isSubmitted && (
          <div
            className={`flex items-center justify-between rounded-xl p-4 animate-fade-in ${
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
                  {isCorrect
                    ? t.review.correctFeedback
                    : `${t.review.incorrectFeedback} "${word.vietnameseDefinition}"`}
                </p>
                <p className="text-[11px] opacity-80 font-medium">
                  {isCorrect
                    ? language === 'vi'
                      ? 'Khoảng cách ôn tập sẽ được tăng lên.'
                      : 'Interval will be increased.'
                    : language === 'vi'
                    ? 'Thẻ sẽ sớm được lên lịch ôn tập lại.'
                    : 'Card will be scheduled for review again soon.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleNext}
              autoFocus
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-all active:scale-95 shrink-0 ml-3"
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
