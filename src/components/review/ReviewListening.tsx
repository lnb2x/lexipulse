import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Headphones,
  HelpCircle,
  Repeat,
  RotateCcw,
  Sparkles,
  Volume2,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { playPronunciation, stopPronunciation } from '../../services/audio';
import type { ReviewRating, WordItem } from '../../types/vocab';
import type { AttemptEvidence } from '../../types/study';
import { parseMultipleMeanings } from '../../utils/definitionUtils';
import {
  alignDictationStrings,
  calculateDictationRating,
  findNextHintTargetIndex,
  type AlignmentResult,
  type DictationAttemptStats,
  type DiffToken,
} from '../../utils/dictationDiff';

interface ReviewListeningProps {
  word: WordItem;
  currentIndex: number;
  totalCards: number;
  onAnswer: (rating: ReviewRating, evidence?: AttemptEvidence) => void;
  onPrevCard?: () => void;
  onNextCard?: () => void;
  isLooping?: boolean;
  onToggleLoop?: (looping: boolean) => void;
  loopInterval?: number;
  onLoopIntervalChange?: (interval: number) => void;
}

export const ReviewListening: React.FC<ReviewListeningProps> = ({
  word,
  currentIndex,
  totalCards,
  onAnswer,
  isLooping: externalIsLooping,
  onToggleLoop,
  loopInterval = 1.5,
}) => {
  const { language, t } = useLanguage();

  // User input & validation state
  const [userInput, setUserInput] = useState('');
  const [hasChecked, setHasChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [isEditingAfterError, setIsEditingAfterError] = useState(false);

  // Alignment Diff & Hints
  const [diffResult, setDiffResult] = useState<AlignmentResult | null>(null);
  const [revealedTargetIndices, setRevealedTargetIndices] = useState<Set<number>>(new Set());
  const [activeHintMessage, setActiveHintMessage] = useState<string | null>(null);
  const [showMeaning, setShowMeaning] = useState(true);

  // Comprehensive attempt tracking for Spaced Repetition (FSRS v5)
  const [attemptStats, setAttemptStats] = useState<DictationAttemptStats>({
    firstAttemptCorrect: false,
    firstAttemptEditDistance: 0,
    incorrectSubmissionCount: 0,
    hintsUsedCount: 0,
    revealedAnswer: false,
    audioPlayCount: 0,
  });

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Audio Loop & Repeat State ---
  const [localIsLooping, setLocalIsLooping] = useState(false);
  const isLooping = externalIsLooping !== undefined ? externalIsLooping : localIsLooping;

  const isLoopingRef = useRef(isLooping);
  isLoopingRef.current = isLooping;

  const loopIntervalRef = useRef(loopInterval);
  loopIntervalRef.current = loopInterval;

  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playIdRef = useRef(0);

  // Finite repeat count (e.g. "Phát 3 lần")
  const [remainingRepeats, setRemainingRepeats] = useState<number>(0);
  const remainingRepeatsRef = useRef<number>(0);
  remainingRepeatsRef.current = remainingRepeats;

  const setIsLooping = useCallback(
    (nextVal: boolean) => {
      isLoopingRef.current = nextVal;
      setLocalIsLooping(nextVal);
      if (onToggleLoop) {
        onToggleLoop(nextVal);
      }
    },
    [onToggleLoop]
  );

  const clearLoopTimer = useCallback(() => {
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  }, []);

  // Core pronunciation playback function
  const playWordAudio = useCallback(
    async (rate: number = 1.0): Promise<boolean> => {
      const playId = ++playIdRef.current;
      setIsPlayingAudio(true);
      setAttemptStats((prev) => ({ ...prev, audioPlayCount: prev.audioPlayCount + 1 }));

      try {
        const audioUrl = word.phonetics.audioUs || word.phonetics.audioUk;
        await playPronunciation(word.word, 'US', audioUrl, {
          rate,
          preferNative: !audioUrl,
        });

        // If another playback took over or audio was stopped, report not completed
        if (playId !== playIdRef.current) {
          return false;
        }
        return true;
      } catch (err) {
        console.warn('Dictation audio playback error:', err);
        return false;
      } finally {
        if (playId === playIdRef.current) {
          setIsPlayingAudio(false);
        }
      }
    },
    [word.word, word.phonetics.audioUs, word.phonetics.audioUk]
  );

  // Recursive loop iteration runner
  const runLoopStep = useCallback(
    async (rate: number = 1.0) => {
      const isContinuous = isLoopingRef.current;
      const isFinite = remainingRepeatsRef.current > 0;

      if (!isContinuous && !isFinite) return;

      const playId = playIdRef.current + 1;
      const completed = await playWordAudio(rate);

      if (playId !== playIdRef.current || !completed) {
        return;
      }

      // Handle finite repeats countdown (e.g. 3 times)
      if (remainingRepeatsRef.current > 1) {
        remainingRepeatsRef.current -= 1;
        setRemainingRepeats(remainingRepeatsRef.current);
        const delayMs = Math.round(Math.max(0.3, loopIntervalRef.current) * 1000);
        loopTimerRef.current = setTimeout(() => {
          if (playId === playIdRef.current) {
            runLoopStep(rate);
          }
        }, delayMs);
        return;
      } else if (remainingRepeatsRef.current === 1) {
        remainingRepeatsRef.current = 0;
        setRemainingRepeats(0);
        return;
      }

      // Continuous loop
      if (isLoopingRef.current) {
        const delayMs = Math.round(Math.max(0.3, loopIntervalRef.current) * 1000);
        loopTimerRef.current = setTimeout(() => {
          if (isLoopingRef.current && playId === playIdRef.current) {
            runLoopStep(rate);
          }
        }, delayMs);
      }
    },
    [playWordAudio]
  );

  // Play audio once (e.g. 1.0x or 0.75x)
  const handlePlayOnce = useCallback(
    (rate: number = 1.0) => {
      clearLoopTimer();
      setIsLooping(false);
      remainingRepeatsRef.current = 0;
      setRemainingRepeats(0);
      playWordAudio(rate);
    },
    [clearLoopTimer, playWordAudio, setIsLooping]
  );

  // Toggle continuous auto-looping (Shift+P)
  const handleToggleLoop = useCallback(() => {
    const nextVal = !isLoopingRef.current;
    setIsLooping(nextVal);
    clearLoopTimer();
    remainingRepeatsRef.current = 0;
    setRemainingRepeats(0);

    if (nextVal) {
      runLoopStep(1.0);
    } else {
      playIdRef.current++;
      stopPronunciation();
      setIsPlayingAudio(false);
    }
  }, [clearLoopTimer, runLoopStep, setIsLooping]);

  // Trigger finite 3x repeat mode
  const handlePlay3Times = useCallback(() => {
    clearLoopTimer();
    setIsLooping(false);
    remainingRepeatsRef.current = 3;
    setRemainingRepeats(3);
    runLoopStep(1.0);
  }, [clearLoopTimer, runLoopStep, setIsLooping]);

  // Reset state when word changes and auto-play audio
  useEffect(() => {
    setUserInput('');
    setHasChecked(false);
    setIsCorrect(false);
    setIsAnswerRevealed(false);
    setIsEditingAfterError(false);
    setDiffResult(null);
    setRevealedTargetIndices(new Set());
    setActiveHintMessage(null);
    remainingRepeatsRef.current = 0;
    setRemainingRepeats(0);

    setAttemptStats({
      firstAttemptCorrect: false,
      firstAttemptEditDistance: 0,
      incorrectSubmissionCount: 0,
      hintsUsedCount: 0,
      revealedAnswer: false,
      audioPlayCount: 0,
    });

    playIdRef.current++;
    clearLoopTimer();
    stopPronunciation();
    setIsPlayingAudio(false);

    // If loop mode is already ON, continue looping on the new word
    if (isLoopingRef.current) {
      runLoopStep(1.0);
    } else {
      // Auto-play 1.0x once
      playWordAudio(1.0);
    }

    // Focus input for fast typing
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);

    return () => {
      clearTimeout(focusTimer);
      playIdRef.current++;
      clearLoopTimer();
      stopPronunciation();
      setIsPlayingAudio(false);
    };
  }, [word.id, clearLoopTimer, playWordAudio, runLoopStep]);

  // Stop loop when modal opens
  useEffect(() => {
    const handleModalOpened = () => {
      if (isLoopingRef.current) {
        setIsLooping(false);
      }
      playIdRef.current++;
      clearLoopTimer();
      stopPronunciation();
      setIsPlayingAudio(false);
      remainingRepeatsRef.current = 0;
      setRemainingRepeats(0);
    };

    window.addEventListener('lexipulse:modal-opened', handleModalOpened);
    return () => {
      window.removeEventListener('lexipulse:modal-opened', handleModalOpened);
    };
  }, [clearLoopTimer, setIsLooping]);

  // Global keyboard shortcuts:
  // - Ctrl+Space / Alt+R: play audio once (Shift = slow 0.75x)
  // - Shift+P: toggle loop mode (when not typing in an input, or Alt+Shift+P anywhere)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Toggle loop shortcut: Shift+P when outside input, or Alt+Shift+P / Ctrl+Alt+L anywhere
      const isLoopToggle =
        (!isInput && e.shiftKey && (e.key === 'P' || e.code === 'KeyP')) ||
        (e.altKey && e.shiftKey && (e.key === 'p' || e.key === 'P')) ||
        (isCtrlOrMeta && e.altKey && (e.key.toLowerCase() === 'l' || e.key.toLowerCase() === 'p'));

      if (isLoopToggle) {
        e.preventDefault();
        handleToggleLoop();
        return;
      }

      // Replay combo: Ctrl+Space / Alt+R / Alt+P
      const isAudioReplayCombo =
        (isCtrlOrMeta && (e.code === 'Space' || e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'p')) ||
        (e.altKey && (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'p'));

      const isDirectKey =
        !isInput &&
        !isCtrlOrMeta &&
        !e.altKey &&
        (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'p');

      if (isAudioReplayCombo || isDirectKey) {
        e.preventDefault();
        const rate = e.shiftKey ? 0.75 : 1.0;
        handlePlayOnce(rate);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayOnce, handleToggleLoop]);

  // Stop this card's playback while preserving the loop preference for the next card.
  const stopCardAudio = () => {
    playIdRef.current++;
    clearLoopTimer();
    remainingRepeatsRef.current = 0;
    setRemainingRepeats(0);
    stopPronunciation();
    setIsPlayingAudio(false);
  };

  // Handle checking user answer
  const handleCheckAnswer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // If already finished or answer revealed, Enter triggers Continue
    if (isCorrect || isAnswerRevealed) {
      handleContinue();
      return;
    }

    if (!userInput.trim()) return;

    // Run string alignment with Needleman-Wunsch diff
    const result = alignDictationStrings(userInput, word.word, revealedTargetIndices);
    setDiffResult(result);
    setHasChecked(true);
    setIsEditingAfterError(false);

    // If first ever check for this card, record initial accuracy and distance
    const isFirstCheckEver = attemptStats.incorrectSubmissionCount === 0 && !hasChecked;

    if (result.isExactMatch) {
      setIsCorrect(true);
      if (isFirstCheckEver) {
        setAttemptStats((prev) => ({
          ...prev,
          firstAttemptCorrect: true,
          firstAttemptEditDistance: 0,
        }));
      }
      stopCardAudio();
    } else {
      setIsCorrect(false);
      setAttemptStats((prev) => ({
        ...prev,
        firstAttemptCorrect: isFirstCheckEver ? false : prev.firstAttemptCorrect,
        firstAttemptEditDistance: isFirstCheckEver ? result.editDistance : prev.firstAttemptEditDistance,
        incorrectSubmissionCount: prev.incorrectSubmissionCount + 1,
      }));

      // Focus back to input immediately for seamless editing
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  // Action: "Thử lại" - Focus input and ready cursor
  const handleRetryFocus = () => {
    inputRef.current?.focus();
  };

  // Action: "Gợi ý" - Progressive hint revealing
  const handleRequestHint = () => {
    setAttemptStats((prev) => ({ ...prev, hintsUsedCount: prev.hintsUsedCount + 1 }));

    // 1. If diffResult is present, find first unrevealed error position
    if (diffResult) {
      const nextHint = findNextHintTargetIndex(diffResult.tokens, revealedTargetIndices);
      if (nextHint) {
        const nextSet = new Set(revealedTargetIndices);
        nextSet.add(nextHint.targetIndex);
        setRevealedTargetIndices(nextSet);

        // Update alignment tokens with newly revealed index
        const updated = alignDictationStrings(userInput, word.word, nextSet);
        setDiffResult(updated);

        const posText = nextHint.targetIndex + 1;
        const msg =
          language === 'vi'
            ? `Gợi ý: Ký tự tại vị trí ${posText} là chữ "${nextHint.targetChar}"`
            : `Hint: Letter at position ${posText} is "${nextHint.targetChar}"`;
        setActiveHintMessage(msg);

        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }
    }

    // 2. If no prior check or all error letters already revealed, reveal first letter or POS/meaning
    if (revealedTargetIndices.size === 0 && word.word.length > 0) {
      const nextSet = new Set<number>([0]);
      setRevealedTargetIndices(nextSet);
      const firstChar = word.word[0];
      const msg =
        language === 'vi'
          ? `Gợi ý: Từ bắt đầu bằng chữ cái "${firstChar}"`
          : `Hint: The word begins with letter "${firstChar}"`;
      setActiveHintMessage(msg);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    // 3. Meaning / Additional Clue Hint
    if (!showMeaning) {
      setShowMeaning(true);
      const msg =
        language === 'vi'
          ? `Gợi ý nghĩa: ${word.vietnameseDefinition} (${word.pos.join(', ')})`
          : `Hint definition: ${word.vietnameseDefinition} (${word.pos.join(', ')})`;
      setActiveHintMessage(msg);
    } else if (word.englishDefinition) {
      const msg =
        language === 'vi'
          ? `Định nghĩa tiếng Anh: ${word.englishDefinition}`
          : `English definition: ${word.englishDefinition}`;
      setActiveHintMessage(msg);
    } else if (word.examples && word.examples.length > 0) {
      const ex = word.examples[0];
      const masked = ex.en.replace(new RegExp(`\\b${word.word}\\b`, 'gi'), '_____');
      const msg =
        language === 'vi'
          ? `Ngữ cảnh: ${masked}`
          : `Context: ${masked}`;
      setActiveHintMessage(msg);
    } else {
      const msg =
        language === 'vi'
          ? `Gợi ý nghĩa: ${word.vietnameseDefinition} (${word.pos.join(', ')})`
          : `Hint definition: ${word.vietnameseDefinition} (${word.pos.join(', ')})`;
      setActiveHintMessage(msg);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Action: "Xem đáp án" - Reveals correct answer, sets memory rating to Again (1)
  const handleShowAnswer = () => {
    setIsAnswerRevealed(true);
    setAttemptStats((prev) => ({
      ...prev,
      revealedAnswer: true,
    }));
    stopCardAudio();
    playWordAudio(1.0);
  };

  // Action: "Tiếp tục" - Submit final rating to FSRS Spaced Repetition
  const handleContinue = () => {
    stopCardAudio();

    const rating = calculateDictationRating(attemptStats, word.word.length);
    onAnswer(rating, { ...attemptStats });
  };

  // Compute memory score preview for feedback badge
  const currentRating = calculateDictationRating(attemptStats, word.word.length);

  // Render individual character alignment token with rich visual cues & a11y labels
  const renderDiffToken = (token: DiffToken, idx: number) => {
    if (token.status === 'correct') {
      return (
        <div
          key={token.id || idx}
          className="flex flex-col items-center gap-1 group"
          title={language === 'vi' ? 'Ký tự chính xác' : 'Correct character'}
        >
          <span className="flex h-10 w-9 sm:h-11 sm:w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-900 border-2 border-emerald-500 font-mono text-lg font-bold shadow-sm dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-600 transition-transform">
            {token.inputChar}
          </span>
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            ✓
          </span>
        </div>
      );
    }

    if (token.status === 'missing') {
      const isRevealed = token.isRevealed;
      return (
        <div
          key={token.id || idx}
          className="flex flex-col items-center gap-1"
          title={
            isRevealed
              ? language === 'vi'
                ? `Ký tự gợi ý: ${token.targetChar}`
                : `Hinted letter: ${token.targetChar}`
              : language === 'vi'
              ? 'Thiếu 1 ký tự ở vị trí này'
              : 'Missing letter at this position'
          }
        >
          <span
            className={`flex h-10 w-9 sm:h-11 sm:w-10 items-center justify-center rounded-xl border-2 font-mono text-lg font-bold shadow-sm transition-all ${
              isRevealed
                ? 'bg-indigo-100 border-indigo-500 text-indigo-900 dark:bg-indigo-950/60 dark:border-indigo-400 dark:text-indigo-200 animate-pulse'
                : 'border-dashed border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:border-amber-600 dark:text-amber-300'
            }`}
          >
            {isRevealed ? token.targetChar : '+'}
          </span>
          <span
            className={`text-[10px] font-semibold ${
              isRevealed
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {isRevealed ? (language === 'vi' ? 'Gợi ý' : 'Hint') : language === 'vi' ? 'Thiếu' : 'Missing'}
          </span>
        </div>
      );
    }

    if (token.status === 'wrong') {
      const isRevealed = token.isRevealed;
      return (
        <div
          key={token.id || idx}
          className="flex flex-col items-center gap-1"
          title={
            isRevealed
              ? language === 'vi'
                ? `Ký tự đúng là: ${token.targetChar}`
                : `Correct letter is: ${token.targetChar}`
              : language === 'vi'
              ? 'Ký tự này chưa chính xác'
              : 'Incorrect character'
          }
        >
          <span
            className={`flex h-10 w-9 sm:h-11 sm:w-10 items-center justify-center rounded-xl border-2 font-mono text-lg font-bold shadow-sm ${
              isRevealed
                ? 'bg-indigo-100 border-indigo-500 text-indigo-900 dark:bg-indigo-950/60 dark:border-indigo-400 dark:text-indigo-200'
                : 'border-rose-500 bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:border-rose-600 dark:text-rose-200'
            }`}
          >
            {isRevealed ? token.targetChar : token.inputChar}
          </span>
          <span
            className={`text-[10px] font-semibold ${
              isRevealed
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isRevealed ? (language === 'vi' ? 'Gợi ý' : 'Hint') : language === 'vi' ? 'Sai' : 'Wrong'}
          </span>
        </div>
      );
    }

    // status === 'extra' (Thừa ký tự)
    return (
      <div
        key={token.id || idx}
        className="flex flex-col items-center gap-1"
        title={language === 'vi' ? 'Ký tự gõ thừa' : 'Extra character to delete'}
      >
        <span className="flex h-10 w-9 sm:h-11 sm:w-10 items-center justify-center rounded-xl border-2 border-rose-400 bg-rose-50 text-rose-700 line-through font-mono text-lg font-bold shadow-sm dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-300 opacity-90">
          {token.inputChar}
        </span>
        <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
          {language === 'vi' ? 'Thừa' : 'Extra'}
        </span>
      </div>
    );
  };

  // Memory rating badge description
  const getRatingBadge = (rating: ReviewRating) => {
    switch (rating) {
      case 4:
        return {
          title: language === 'vi' ? 'Độ nhớ cao (FSRS: Dễ ⭐⭐⭐⭐)' : 'High Retention (FSRS: Easy ⭐⭐⭐⭐)',
          desc: language === 'vi' ? 'Đúng ngay lần đầu tiên' : 'Answered correctly on first try',
          color: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
        };
      case 3:
        return {
          title: language === 'vi' ? 'Độ nhớ khá (FSRS: Nhớ ⭐⭐⭐)' : 'Good Retention (FSRS: Good ⭐⭐⭐)',
          desc: language === 'vi' ? 'Tự sửa đúng sau sai sót nhỏ' : 'Self-corrected minor typo',
          color: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200',
        };
      case 2:
        return {
          title: language === 'vi' ? 'Độ nhớ thấp (FSRS: Khó ⭐⭐)' : 'Low Retention (FSRS: Hard ⭐⭐)',
          desc: language === 'vi' ? 'Cần dùng gợi ý hoặc thử nhiều lần' : 'Required hints or multiple attempts',
          color: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
        };
      case 1:
      default:
        return {
          title: language === 'vi' ? 'Chưa nhớ (FSRS: Quên ⭐)' : 'Not Remembered (FSRS: Again ⭐)',
          desc: language === 'vi' ? 'Đã xem đáp án • Ôn lại sớm' : 'Viewed answer • Scheduled for review soon',
          color: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200',
        };
    }
  };

  const ratingInfo = getRatingBadge(currentRating);

  return (
    <div className="review-exercise w-full max-w-2xl mx-auto space-y-5 animate-slide-up">
      {/* Top progress bar & helper hint */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
          {language === 'vi'
            ? `Thẻ ${currentIndex + 1} / ${totalCards} (Nghe chính tả)`
            : `Card ${currentIndex + 1} of ${totalCards} (Dictation)`}
        </span>

        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
          <Headphones className="h-3.5 w-3.5 text-indigo-500" />
          <span>
            {language === 'vi'
              ? 'Ctrl+Space / Alt+R nghe lại • Shift+P bật/tắt lặp'
              : 'Ctrl+Space / Alt+R to replay • Shift+P loop toggle'}
          </span>
        </span>
      </div>

      {/* Main Dictation Card */}
      <div className="card-elevated p-5 sm:p-8 space-y-6">
        {/* Audio Player Hub with Unlimited Replay & Loop Controls */}
        <div className="flex flex-col items-center justify-center py-2 sm:py-4 space-y-3.5">
          {/* Main big Play button */}
          <button
            type="button"
            onClick={() => handlePlayOnce(1.0)}
            className={`group relative flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transition-all hover:bg-indigo-500 active:scale-95 ${
              isPlayingAudio ? 'animate-pulse ring-4 ring-indigo-300 dark:ring-indigo-800' : ''
            } ${isLooping ? 'ring-4 ring-indigo-500/80 shadow-indigo-600/50' : ''}`}
            title="Play Audio (Ctrl+Space / Alt+R)"
            aria-label={t.review.playAudio}
          >
            <Volume2 className="h-9 w-9 text-white transition-transform group-hover:scale-110" />
            {isLooping && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-slate-900 shadow">
                ∞
              </span>
            )}
            {remainingRepeats > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white shadow">
                {remainingRepeats}
              </span>
            )}
          </button>

          {/* Dedicated controls: 1.0x, 0.75x, Repeat 3x, Loop Toggle */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Play 1.0x */}
            <button
              type="button"
              onClick={() => handlePlayOnce(1.0)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-sm transition-colors"
              title="Ctrl+Space / Alt+R"
            >
              <Volume2 className="h-3.5 w-3.5 text-indigo-500" />
              <span>{t.review.playAudio} (1.0x)</span>
            </button>

            {/* Play Slow 0.75x */}
            <button
              type="button"
              onClick={() => handlePlayOnce(0.75)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-sm transition-colors"
              title="Ctrl+Shift+Space / Alt+Shift+R"
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
              <span>{t.review.playSlow}</span>
            </button>

            {/* Repeat 3 Times Button */}
            <button
              type="button"
              onClick={handlePlay3Times}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition-all ${
                remainingRepeats > 0
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-400/40'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
              }`}
              title={language === 'vi' ? 'Phát lặp lại 3 lần liên tiếp' : 'Play pronunciation 3 times'}
            >
              <span className="font-bold font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                3x
              </span>
              <span>
                {remainingRepeats > 0
                  ? language === 'vi'
                    ? `Đang phát (${4 - remainingRepeats}/3)...`
                    : `Playing (${4 - remainingRepeats}/3)...`
                  : t.review.play3x || 'Lặp 3 lần'}
              </span>
            </button>

            {/* Infinite Loop Toggle Button */}
            <button
              type="button"
              onClick={handleToggleLoop}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition-all ${
                isLooping
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 ring-2 ring-indigo-400/40 font-bold'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
              }`}
              title={
                language === 'vi'
                  ? `Phát âm lặp lại [Shift+P]: ${isLooping ? 'Đang BẬT' : 'Đang TẮT'}`
                  : `Loop pronunciation [Shift+P]: ${isLooping ? 'ON' : 'OFF'}`
              }
              aria-pressed={isLooping}
            >
              <Repeat
                className={`h-3.5 w-3.5 ${
                  isLooping ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : 'text-slate-500'
                }`}
              />
              <span>
                {isLooping
                  ? t.review.loopOn || (language === 'vi' ? 'Lặp: Bật' : 'Loop: On')
                  : t.review.loopAudio || (language === 'vi' ? 'Phát lặp lại' : 'Loop')}
              </span>
            </button>
          </div>

          {/* Quick Stats & Reassurance subtitle */}
          <div className="flex flex-col items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 text-center">
            <div>
              {language === 'vi'
                ? `Lần kiểm tra: ${attemptStats.incorrectSubmissionCount + (isCorrect ? 1 : 0)} • Đã nghe: ${attemptStats.audioPlayCount} lần`
                : `Checks: ${attemptStats.incorrectSubmissionCount + (isCorrect ? 1 : 0)} • Replays: ${attemptStats.audioPlayCount}`}
            </div>
            <div className="text-[10px] text-slate-400/90 italic">
              {t.review.unlimitedListeningNote ||
                (language === 'vi'
                  ? 'Nghe thoải mái, không giới hạn lượt nghe'
                  : 'Listen as many times as you need, no limits')}
            </div>
          </div>
        </div>

        {/* Active Hint Alert Banner */}
        {activeHintMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-xs font-medium text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-200 animate-fade-in shadow-sm">
            <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
            <span className="flex-1">{activeHintMessage}</span>
          </div>
        )}

        {/* Vietnamese Meaning Section: Displayed during dictation before answer is revealed or correct */}
        {!isAnswerRevealed && !isCorrect && word.vietnameseDefinition && (
          <div className="rounded-2xl border border-indigo-100/90 bg-indigo-50/40 p-4 sm:p-5 text-center dark:border-indigo-900/40 dark:bg-indigo-950/20 space-y-2 animate-fade-in shadow-xs transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  {t.review.vietnameseMeaning || (language === 'vi' ? 'Nghĩa tiếng Việt' : 'Vietnamese Meaning')}
                </span>
                {word.pos && word.pos.length > 0 && (
                  <span className="rounded-md bg-indigo-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                    {word.pos.join(', ')}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowMeaning((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                title={
                  showMeaning
                    ? language === 'vi'
                      ? 'Ẩn nghĩa tiếng Việt'
                      : 'Hide meaning'
                    : language === 'vi'
                    ? 'Hiện nghĩa tiếng Việt'
                    : 'Show meaning'
                }
              >
                {showMeaning ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>{t.review.hideMeaning || (language === 'vi' ? 'Ẩn nghĩa' : 'Hide')}</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    <span>{t.review.showMeaning || (language === 'vi' ? 'Hiện nghĩa' : 'Show')}</span>
                  </>
                )}
              </button>
            </div>

            {showMeaning ? (
              <div className="pt-1 text-slate-800 dark:text-slate-100">
                {(() => {
                  const senses = parseMultipleMeanings(word.vietnameseDefinition);
                  if (senses.length > 1) {
                    return (
                      <div className="space-y-1.5 text-left max-w-md mx-auto">
                        {senses.map((sense) => (
                          <div key={sense.index} className="flex items-start gap-2">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 text-[10px] font-bold shrink-0 mt-0.5 shadow-xs">
                              {sense.index}
                            </span>
                            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                              {sense.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                      {word.vietnameseDefinition}
                    </p>
                  );
                })()}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowMeaning(true)}
                className="py-1 text-xs italic text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors"
              >
                {language === 'vi'
                  ? '• Nghĩa tiếng Việt đang ẩn (nhấn để xem) •'
                  : '• Vietnamese meaning hidden (click to reveal) •'}
              </button>
            )}
          </div>
        )}

        {/* Sequence Alignment Diff Display: Only shown AFTER user clicks check */}
        {hasChecked && !isCorrect && diffResult && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5 dark:border-amber-900/40 dark:bg-amber-950/20 space-y-3.5 animate-fade-in">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span>
                  {language === 'vi' ? 'Vị trí ký tự cần sửa:' : 'Spelling Alignment:'}
                </span>
                {isEditingAfterError && (
                  <span className="font-normal italic text-slate-500 text-[11px]">
                    {language === 'vi' ? '(Đang chỉnh sửa...)' : '(Editing...)'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono font-medium text-slate-500">
                <span>
                  ✓ {diffResult.correctCount} {language === 'vi' ? 'đúng' : 'correct'}
                </span>
                {diffResult.missingCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    + {diffResult.missingCount} {language === 'vi' ? 'thiếu' : 'missing'}
                  </span>
                )}
                {diffResult.extraCount > 0 && (
                  <span className="text-rose-600 dark:text-rose-400">
                    - {diffResult.extraCount} {language === 'vi' ? 'thừa' : 'extra'}
                  </span>
                )}
                {diffResult.wrongCount > 0 && (
                  <span className="text-rose-600 dark:text-rose-400">
                    × {diffResult.wrongCount} {language === 'vi' ? 'sai' : 'wrong'}
                  </span>
                )}
              </div>
            </div>

            {/* Visual Token Tiles with Flex-wrap for mobile responsiveness */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 py-1">
              {diffResult.tokens.map((token, idx) => renderDiffToken(token, idx))}
            </div>

            <p className="text-[11px] text-center sm:text-left text-slate-600 dark:text-slate-400">
              {language === 'vi'
                ? 'Ký tự thiếu (+) hoặc sai đã được định vị. Hãy sửa trực tiếp trong ô gõ bên dưới rồi nhấn Enter.'
                : 'Missing (+) or incorrect letters are marked above. Modify your input below and press Enter.'}
            </p>
          </div>
        )}

        {/* Revealed Answer Card (When user clicks "Xem đáp án") */}
        {isAnswerRevealed && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 sm:p-5 dark:border-rose-900/40 dark:bg-rose-950/20 space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
              <span>{language === 'vi' ? 'Đáp án chính xác:' : 'Correct Answer:'}</span>
              <span className="text-[11px] font-normal opacity-80">
                {language === 'vi' ? 'Chế độ luyện tập (FSRS: Quên)' : 'Practice Mode (FSRS: Again)'}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-wide">
                {word.word}
              </span>
              <span className="font-mono text-sm text-slate-500">
                ({word.phonetics.us || word.phonetics.uk})
              </span>
              <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {word.pos.join(', ')}
              </span>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              {word.vietnameseDefinition}
            </p>
          </div>
        )}

        {/* Successful Correct Feedback Banner */}
        {isCorrect && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20 space-y-2.5 animate-fade-in">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>{t.review.correctFeedback}</span>
            </div>

            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                {word.word}
              </span>
              <span className="font-mono text-xs text-slate-500">
                ({word.phonetics.us || word.phonetics.uk})
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-300">
                — {word.vietnameseDefinition}
              </span>
            </div>

            {/* Retention score badge */}
            <div
              className={`mt-2 inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm ${ratingInfo.color}`}
            >
              <span>{ratingInfo.title}</span>
              <span className="text-[11px] opacity-80 font-normal">• {ratingInfo.desc}</span>
            </div>
          </div>
        )}

        {/* Input Form Area */}
        <form onSubmit={handleCheckAnswer} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.review.typeWhatYouHear}
              </label>

              {/* Action buttons on top right of input */}
              {!isCorrect && !isAnswerRevealed && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRequestHint}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>{t.review.letterHint || 'Gợi ý chữ cái'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShowAnswer}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>{t.review.showAnswer || 'Xem đáp án'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Input field with mobile-friendly attributes */}
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={(e) => {
                setUserInput(e.target.value);
                if (hasChecked && !isCorrect) {
                  setIsEditingAfterError(true);
                }
              }}
              disabled={isCorrect}
              placeholder={language === 'vi' ? 'Nhập từ tiếng Anh...' : 'Type English word here...'}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              className={`w-full rounded-xl border px-4 py-3.5 text-base font-bold tracking-wide shadow-sm focus:outline-none transition-all ${
                isCorrect
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100'
                  : hasChecked && !isCorrect
                  ? 'border-amber-400 bg-white text-slate-900 focus:border-indigo-500 dark:border-amber-600 dark:bg-slate-900 dark:text-slate-100'
                  : 'border-slate-200 bg-white text-slate-900 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
              }`}
            />
          </div>

          {/* Action Button Bar */}
          {!isCorrect && !isAnswerRevealed ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* Main Check Button */}
                <button
                  type="submit"
                  disabled={!userInput.trim()}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-50 transition-all"
                >
                  <span>{t.review.checkAnswer}</span>
                  <kbd className="rounded bg-indigo-700 px-1.5 py-0.5 text-[10px] font-mono">
                    Enter
                  </kbd>
                </button>

                {/* Optional "Thử lại" quick-focus button when failed */}
                {hasChecked && !isCorrect && (
                  <button
                    type="button"
                    onClick={handleRetryFocus}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-sm transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{t.review.tryAgain || 'Thử lại'}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Finished Card Actions: Continue Button */
            <div className="space-y-3 animate-fade-in">
              <button
                type="button"
                onClick={handleContinue}
                autoFocus
                className="review-continue flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-all active:scale-[0.99]"
              >
                <span>{t.review.continueBtn || t.review.nextQuestion}</span>
                <ArrowRight className="h-4 w-4" />
                <kbd className="ml-1 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-200 dark:bg-slate-200 dark:text-slate-800">
                  Enter
                </kbd>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
