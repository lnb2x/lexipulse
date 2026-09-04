import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { formatInterval } from '../../services/sm2';
import type { ReviewRating, WordItem } from '../../types/vocab';
import { AudioButton } from '../common/AudioButton';
import { Badge } from '../common/Badge';
import { WordFamilyInteractive } from '../common/WordFamilyInteractive';

interface FlashcardProps {
  word: WordItem;
  currentIndex: number;
  totalCards: number;
  onGrade: (rating: ReviewRating) => void;
  onPrevCard?: () => void;
  onNextCard?: () => void;
}

export const Flashcard: React.FC<FlashcardProps> = ({
  word,
  currentIndex,
  totalCards,
  onGrade,
  onPrevCard,
  onNextCard,
}) => {
  const { language, t } = useLanguage();
  const [isFlipped, setIsFlipped] = useState(false);

  // Reset flip state when card changes
  useEffect(() => {
    setIsFlipped(false);
  }, [word.id]);

  // Keyboard shortcut listener for Space (flip), 1/2/3 (grade), and Arrow Left/Right (nav)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === '1') {
        e.preventDefault();
        onGrade(1);
      } else if (e.key === '2') {
        e.preventDefault();
        onGrade(2);
      } else if (e.key === '3') {
        e.preventDefault();
        onGrade(3);
      } else if (e.key === 'ArrowLeft' && onPrevCard) {
        e.preventDefault();
        onPrevCard();
      } else if (e.key === 'ArrowRight' && onNextCard) {
        e.preventDefault();
        onNextCard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onGrade, onPrevCard, onNextCard]);

  // Highlight target word in example sentence
  const renderHighlightedExample = (sentence: string, target: string) => {
    const regex = new RegExp(`\\b(${target}[a-z]*)\\b`, 'gi');
    const parts = sentence.split(regex);

    return parts.map((part, i) => {
      if (part.toLowerCase().startsWith(target.toLowerCase().slice(0, -1))) {
        return (
          <span
            key={i}
            className="rounded bg-amber-200/80 px-1 py-0.5 font-bold text-amber-950 dark:bg-amber-500/30 dark:text-amber-200"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const workplaceEx = word.examples.find((e) => e.context === 'toeic') || word.examples[0];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      {/* Top progress indicator & Prev/Next navigation */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          {onPrevCard && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrevCard();
              }}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-35 active:scale-95 transition-all dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              title={language === 'vi' ? 'Thẻ trước (phím ←)' : 'Previous card (← key)'}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{language === 'vi' ? 'Thẻ trước' : 'Prev'}</span>
            </button>
          )}

          <span className="font-semibold text-slate-700 dark:text-slate-200 px-1">
            {language === 'vi'
              ? `Thẻ ${currentIndex + 1} / ${totalCards}`
              : `Card ${currentIndex + 1} of ${totalCards}`}
          </span>

          {onNextCard && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNextCard();
              }}
              disabled={currentIndex >= totalCards - 1}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-35 active:scale-95 transition-all dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              title={language === 'vi' ? 'Thẻ tiếp theo (phím →)' : 'Next card (→ key)'}
            >
              <span className="hidden sm:inline">{language === 'vi' ? 'Thẻ sau' : 'Next'}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge status={word.status} size="sm" />
          <span className="text-[11px] font-mono text-slate-400">
            {language === 'vi' ? 'Chu kỳ' : 'Interval'}: {formatInterval(word.reviewMeta.interval)}
          </span>
        </div>
      </div>

      {/* 3D Flashcard Container */}
      <div className="perspective-1000 w-full min-h-[380px] sm:min-h-[420px]">
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className={`relative w-full h-full min-h-[380px] sm:min-h-[420px] rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-100/70 transition-all duration-500 transform-style-3d cursor-pointer select-none dark:border-slate-800 dark:bg-[#111622] dark:shadow-none ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* FRONT SIDE */}
          <div
            className={`absolute inset-0 flex flex-col justify-between p-8 backface-hidden ${
              isFlipped ? 'pointer-events-none' : ''
            }`}
          >
            {/* Top row */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-indigo-500">
                {language === 'vi' ? 'Mặt trước' : 'Front Card'}
              </span>
              <div className="flex gap-1">
                {word.pos.map((p) => (
                  <span
                    key={p}
                    className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 italic"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Center: Word + IPA */}
            <div className="my-auto text-center space-y-4">
              <h2 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                {word.word}
              </h2>

              <div className="flex items-center justify-center gap-3">
                <span className="font-mono text-sm text-slate-500 dark:text-slate-400">
                  {word.phonetics.us || word.phonetics.uk}
                </span>
                <AudioButton
                  text={word.word}
                  accent="US"
                  audioUrl={word.phonetics.audioUs}
                  size="sm"
                />
                <AudioButton
                  text={word.word}
                  accent="UK"
                  audioUrl={word.phonetics.audioUk}
                  size="sm"
                />
              </div>
            </div>

            {/* Bottom hint */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400 dark:border-slate-800">
              <span className="flex items-center gap-1.5">
                <RotateCw className="h-3.5 w-3.5 text-indigo-500" />
                {t.review.flipPrompt}
              </span>
              <span className="text-slate-400 italic">
                {word.tags.slice(0, 2).join(' ')}
              </span>
            </div>
          </div>

          {/* BACK SIDE */}
          <div
            className={`absolute inset-0 flex flex-col justify-between p-8 backface-hidden rotate-y-180 overflow-y-auto ${
              !isFlipped ? 'pointer-events-none' : ''
            }`}
          >
            {/* Top row */}
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  {word.word}
                </span>
                <AudioButton text={word.word} size="sm" showLabel={false} />
              </div>
              <span className="font-semibold uppercase tracking-wider text-emerald-500">
                {language === 'vi' ? 'Mặt sau (Đáp án)' : 'Back Card'}
              </span>
            </div>

            {/* Content */}
            <div className="my-auto space-y-4 py-2">
              {/* Core Meaning */}
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 text-left dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Định nghĩa
                </span>
                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                  {word.vietnameseDefinition}
                </p>
                {word.englishDefinition && (
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {word.englishDefinition}
                  </p>
                )}
              </div>

              {/* Collocations */}
              {word.collocations.length > 0 && (
                <div className="rounded-xl bg-slate-50 p-3 text-left dark:bg-slate-800/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    High-yield Collocations
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                    {word.collocations.slice(0, 3).map((c, i) => (
                      <span key={i} className="text-slate-700 dark:text-slate-300">
                        <strong className="text-indigo-600 dark:text-indigo-400">{c.phrase}</strong> ({c.meaningVi})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Workplace / TOEIC Example */}
              {workplaceEx && (
                <div className="rounded-xl border border-slate-200/70 p-3 text-left dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Workplace Context
                    </span>
                    <AudioButton text={workplaceEx.en} size="sm" showLabel={false} />
                  </div>
                  <p className="mt-1 text-xs text-slate-800 dark:text-slate-200">
                    {renderHighlightedExample(workplaceEx.en, word.word)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 italic">
                    {workplaceEx.vi}
                  </p>
                </div>
              )}

              {/* Word Family */}
              {word.wordFamily && word.wordFamily.length > 0 && (
                <div className="rounded-xl border border-slate-200/70 p-3 text-left dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    {t.lookup.wordFamily}
                  </span>
                  <WordFamilyInteractive
                    wordFamily={word.wordFamily}
                    currentWord={word.word}
                    compact={true}
                    showHint={false}
                  />
                </div>
              )}
            </div>

            {/* Bottom Flip Reminder */}
            <div className="text-center text-[11px] text-slate-400 border-t border-slate-100 pt-2 dark:border-slate-800">
              Grade your recall below or press numbers <kbd className="rounded bg-slate-100 px-1 text-[10px] dark:bg-slate-800">1</kbd>, <kbd className="rounded bg-slate-100 px-1 text-[10px] dark:bg-slate-800">2</kbd>, <kbd className="rounded bg-slate-100 px-1 text-[10px] dark:bg-slate-800">3</kbd>
            </div>
          </div>
        </div>
      </div>

      {/* Self-grading Action Controls (Module C.1) */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        {/* Rating 1: Again */}
        <button
          type="button"
          onClick={() => onGrade(1)}
          className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 text-rose-700 transition-all hover:bg-rose-100 hover:border-rose-300 active:scale-95 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
        >
          <div className="flex items-center gap-1.5 font-bold text-sm">
            <span>{t.review.againRating}</span>
            <kbd className="rounded bg-rose-200/80 px-1.5 py-0.5 text-[10px] font-mono dark:bg-rose-800/80">1</kbd>
          </div>
          <span className="text-[11px] opacity-80 mt-0.5">1 {language === 'vi' ? 'ngày' : 'day'}</span>
        </button>

        {/* Rating 2: Good */}
        <button
          type="button"
          onClick={() => onGrade(2)}
          className="flex flex-col items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-indigo-700 transition-all hover:bg-indigo-100 hover:border-indigo-300 active:scale-95 shadow-sm dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
        >
          <div className="flex items-center gap-1.5 font-bold text-sm">
            <span>{t.review.goodRating}</span>
            <kbd className="rounded bg-indigo-200/80 px-1.5 py-0.5 text-[10px] font-mono dark:bg-indigo-800/80">2</kbd>
          </div>
          <span className="text-[11px] opacity-80 mt-0.5">
            {word.reviewMeta.repetition === 0 ? (language === 'vi' ? '1 ngày' : '1 day') : (language === 'vi' ? '3+ ngày' : '3+ days')}
          </span>
        </button>

        {/* Rating 3: Easy */}
        <button
          type="button"
          onClick={() => onGrade(3)}
          className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-emerald-700 transition-all hover:bg-emerald-100 hover:border-emerald-300 active:scale-95 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <div className="flex items-center gap-1.5 font-bold text-sm">
            <span>{t.review.easyRating}</span>
            <kbd className="rounded bg-emerald-200/80 px-1.5 py-0.5 text-[10px] font-mono dark:bg-emerald-800/80">3</kbd>
          </div>
          <span className="text-[11px] opacity-80 mt-0.5">
            {word.reviewMeta.repetition === 0 ? (language === 'vi' ? '2 ngày' : '2 days') : (language === 'vi' ? '7+ ngày' : '7+ days')}
          </span>
        </button>
      </div>
    </div>
  );
};
