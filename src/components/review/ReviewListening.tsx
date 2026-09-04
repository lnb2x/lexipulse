import { ArrowRight, CheckCircle2, Headphones, HelpCircle, RotateCcw, Volume2, XCircle } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { playPronunciation } from '../../services/audio';
import type { ReviewRating, WordItem } from '../../types/vocab';

interface ReviewListeningProps {
  word: WordItem;
  currentIndex: number;
  totalCards: number;
  onAnswer: (rating: ReviewRating) => void;
  onPrevCard?: () => void;
  onNextCard?: () => void;
}

export const ReviewListening: React.FC<ReviewListeningProps> = ({
  word,
  currentIndex,
  totalCards,
  onAnswer,
}) => {
  const { language, t } = useLanguage();
  const [userInput, setUserInput] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintLevel, setHintLevel] = useState<number>(0); // 0: none, 1: length & pos, 2: full meaning
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cleanTarget = word.word.trim().toLowerCase();

  // Reset state when word changes and auto-play audio
  useEffect(() => {
    setUserInput('');
    setIsSubmitted(false);
    setIsCorrect(false);
    setShowHint(false);
    setHintLevel(0);

    // Auto-play US audio
    handlePlayAudio(1.0);

    // Focus input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
  }, [word.id]);

  // Global keyboard shortcuts: Ctrl+Space (play audio), Enter (submit or next)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault();
        handlePlayAudio(1.0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [word]);

  const handlePlayAudio = async (rate: number = 1.0) => {
    setIsPlayingAudio(true);
    try {
      const audioUrl = word.phonetics.audioUs || word.phonetics.audioUk;
      await playPronunciation(word.word, 'US', audioUrl, {
        rate,
        preferNative: !audioUrl,
      });
    } finally {
      setIsPlayingAudio(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitted) {
      handleNext();
      return;
    }

    if (!userInput.trim()) return;

    const correct = userInput.trim().toLowerCase() === cleanTarget;
    setIsCorrect(correct);
    setIsSubmitted(true);
  };

  const handleNext = () => {
    // Scoring:
    // Correct without hints: 3 (Easy)
    // Correct with hint: 2 (Good)
    // Incorrect: 1 (Again)
    const rating: ReviewRating = isCorrect ? (hintLevel > 0 ? 2 : 3) : 1;
    onAnswer(rating);
  };

  const handleToggleHint = () => {
    setShowHint(true);
    setHintLevel((prev) => (prev < 2 ? prev + 1 : 2));
  };

  // Masked dashes for letters: e.g. "f _ c _ l _ t y"
  const renderMaskedLetters = () => {
    return cleanTarget
      .split('')
      .map((char, index) => {
        if (index === 0 || index === cleanTarget.length - 1 || char === ' ' || char === '-') {
          return char;
        }
        return '_';
      })
      .join(' ');
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 animate-slide-up">
      {/* Top progress bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
          {language === 'vi'
            ? `Thẻ ${currentIndex + 1} / ${totalCards} (Nghe chính tả)`
            : `Card ${currentIndex + 1} of ${totalCards} (Dictation)`}
        </span>

        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
          <Headphones className="h-3.5 w-3.5 text-indigo-500" />
          <span>{language === 'vi' ? 'Nhấn Ctrl + Space để nghe lại' : 'Press Ctrl + Space to replay'}</span>
        </span>
      </div>

      {/* Main Dictation Card */}
      <div className="card-elevated p-6 sm:p-8 space-y-6">
        {/* Audio Player Hub */}
        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          <button
            type="button"
            onClick={() => handlePlayAudio(1.0)}
            disabled={isPlayingAudio}
            className={`group relative flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transition-all hover:bg-indigo-500 active:scale-95 ${
              isPlayingAudio ? 'animate-pulse ring-4 ring-indigo-300 dark:ring-indigo-800' : ''
            }`}
            title="Play Audio (Ctrl+Space)"
          >
            <Volume2 className="h-9 w-9 text-white transition-transform group-hover:scale-110" />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePlayAudio(1.0)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-sm transition-colors"
            >
              <Volume2 className="h-3.5 w-3.5 text-indigo-500" />
              <span>{t.review.playAudio} (1.0x)</span>
            </button>

            <button
              type="button"
              onClick={() => handlePlayAudio(0.75)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-sm transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
              <span>{t.review.playSlow}</span>
            </button>
          </div>
        </div>

        {/* Hints Box */}
        {showHint && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/30 space-y-2 animate-fade-in text-center sm:text-left">
            <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
              <span className="font-bold uppercase tracking-wider text-[10px]">
                {language === 'vi' ? 'Gợi ý từ vựng' : 'Vocabulary Hint'}
              </span>
              <span className="font-mono text-[11px]">
                {cleanTarget.length} {language === 'vi' ? 'ký tự' : 'letters'}
              </span>
            </div>

            <div className="font-mono text-base tracking-widest font-bold text-slate-800 dark:text-slate-200">
              {renderMaskedLetters()}
            </div>

            {hintLevel >= 1 && (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold">{language === 'vi' ? 'Từ loại:' : 'POS:'}</span> {word.pos.join(', ')}
              </p>
            )}

            {hintLevel >= 2 && (
              <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">
                <span className="font-semibold">{language === 'vi' ? 'Nghĩa:' : 'Meaning:'}</span> {word.vietnameseDefinition}
              </p>
            )}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.review.typeWhatYouHear}
              </label>

              {!isSubmitted && (
                <button
                  type="button"
                  onClick={handleToggleHint}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>
                    {hintLevel === 0
                      ? t.review.revealHint
                      : hintLevel === 1
                      ? (language === 'vi' ? 'Thêm gợi ý nghĩa' : 'Reveal meaning hint')
                      : t.review.hideHint}
                  </span>
                </button>
              )}
            </div>

            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={isSubmitted}
              placeholder={language === 'vi' ? 'Nhập từ tiếng Anh...' : 'Type English word here...'}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              className={`w-full rounded-xl border px-4 py-3.5 text-base font-bold tracking-wide shadow-sm focus:outline-none transition-all ${
                isSubmitted
                  ? isCorrect
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100'
                    : 'border-rose-500 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-100'
                  : 'border-slate-200 bg-white text-slate-900 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
              }`}
            />
          </div>

          {!isSubmitted ? (
            <button
              type="submit"
              disabled={!userInput.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-50 transition-all"
            >
              <span>{t.review.checkAnswer}</span>
              <kbd className="rounded bg-indigo-700 px-1.5 py-0.5 text-[10px] font-mono">Enter</kbd>
            </button>
          ) : (
            <div className="space-y-4 animate-fade-in">
              {/* Feedback Alert */}
              <div
                className={`flex items-start gap-3 rounded-xl p-4 ${
                  isCorrect
                    ? 'border border-emerald-200/80 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
                    : 'border border-rose-200/80 bg-rose-50/70 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200'
                }`}
              >
                {isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="text-xs font-bold">
                    {isCorrect ? t.review.correctFeedback : `${t.review.incorrectFeedback} "${word.word}"`}
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span className="font-bold">{word.word}</span> <span className="font-mono text-slate-500">({word.phonetics.us})</span> — {word.vietnameseDefinition}
                  </p>
                </div>
              </div>

              {/* Next Question Button */}
              <button
                type="button"
                onClick={handleNext}
                autoFocus
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-all active:scale-[0.99]"
              >
                <span>{t.review.nextQuestion}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
