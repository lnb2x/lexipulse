import { ChevronLeft, ChevronRight, Repeat, RotateCw, Volume2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { playPronunciation, stopPronunciation } from '../../services/audio';
import { previewFSRS } from '../../services/fsrs/fsrsService';
import type { ReviewRating, WordItem } from '../../types/vocab';
import { AudioButton } from '../common/AudioButton';
import { Badge } from '../common/Badge';
import { WordFamilyInteractive } from '../common/WordFamilyInteractive';
import { parseMultipleMeanings } from '../../utils/definitionUtils';

function formatInterval(days: number, language: 'vi' | 'en' = 'vi'): string {
  if (!days || days < 1) return language === 'vi' ? '< 1 ngày' : '< 1 day';
  if (days < 30) return `${Math.round(days)}${language === 'vi' ? ' ngày' : 'd'}`;
  if (days < 365) {
    const m = Math.round(days / 30);
    return `${m}${language === 'vi' ? ' tháng' : 'm'}`;
  }
  const y = (days / 365).toFixed(1);
  return `${y}${language === 'vi' ? ' năm' : 'y'}`;
}

interface FlashcardProps {
  word: WordItem;
  currentIndex: number;
  totalCards: number;
  onGrade: (rating: ReviewRating) => void;
  onPrevCard?: () => void;
  onNextCard?: () => void;
  isSubmitting?: boolean;
  desiredRetention?: number;
  isLooping?: boolean;
  onToggleLoop?: (looping: boolean) => void;
  loopInterval?: number;
  onLoopIntervalChange?: (interval: number) => void;
}

export const Flashcard: React.FC<FlashcardProps> = ({
  word,
  currentIndex,
  totalCards,
  onGrade,
  onPrevCard,
  onNextCard,
  isSubmitting = false,
  desiredRetention = 0.90,
  isLooping: externalIsLooping,
  onToggleLoop,
  loopInterval,
  onLoopIntervalChange,
}) => {
  const { language, t } = useLanguage();

  // Synchronous flip state derivation: guaranteed front face on frame 0 of any new card
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null);
  const [prevWordId, setPrevWordId] = useState(word.id);
  const [shouldAnimateFlip, setShouldAnimateFlip] = useState(false);

  if (prevWordId !== word.id) {
    setPrevWordId(word.id);
    setFlippedCardId(null);
    setShouldAnimateFlip(false);
  }

  const isFlipped = flippedCardId === word.id;

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playingAccent, setPlayingAccent] = useState<'US' | 'UK'>('US');

  // Loop mode state: supports both external (session-level) and internal fallback
  const [localIsLooping, setLocalIsLooping] = useState(false);
  const isLooping = externalIsLooping !== undefined ? externalIsLooping : localIsLooping;

  // Loop interval state (in seconds): supports external prop and internal state
  const [localLoopInterval, setLocalLoopInterval] = useState(loopInterval ?? 1.5);
  const currentLoopInterval = loopInterval !== undefined ? loopInterval : localLoopInterval;
  const loopIntervalRef = useRef(currentLoopInterval);
  loopIntervalRef.current = currentLoopInterval;

  const PRESET_INTERVALS = [0.5, 1.0, 1.5, 2.0, 3.0];
  const handleCycleLoopInterval = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const cur = loopIntervalRef.current;
    const currentIdx = PRESET_INTERVALS.findIndex((val) => Math.abs(val - cur) < 0.05);
    const nextIdx = (currentIdx + 1) % PRESET_INTERVALS.length;
    const nextVal = PRESET_INTERVALS[nextIdx >= 0 ? nextIdx : 2];
    setLocalLoopInterval(nextVal);
    onLoopIntervalChange?.(nextVal);
  }, [onLoopIntervalChange]);

  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playIdRef = useRef(0);
  const isLoopingRef = useRef(isLooping);
  isLoopingRef.current = isLooping;

  const setIsLooping = useCallback((nextVal: boolean) => {
    isLoopingRef.current = nextVal;
    setLocalIsLooping(nextVal);
    onToggleLoop?.(nextVal);
  }, [onToggleLoop]);

  const clearLoopTimer = useCallback(() => {
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  }, []);

  // Compute live FSRS scheduling previews
  const preview = useMemo(() => {
    return previewFSRS(word.reviewMeta, Date.now(), desiredRetention);
  }, [word.id, word.reviewMeta, desiredRetention]);

  // Core pronunciation playback with concurrency protection
  const playWordAudio = useCallback(async (preferredAccent: 'US' | 'UK' = 'US'): Promise<boolean> => {
    const playId = ++playIdRef.current;
    clearLoopTimer();
    stopPronunciation();

    setIsPlayingAudio(true);
    setPlayingAccent(preferredAccent);

    try {
      const audioUrl = preferredAccent === 'UK'
        ? (word.phonetics.audioUk || word.phonetics.audioUs)
        : (word.phonetics.audioUs || word.phonetics.audioUk);
      await playPronunciation(word.word, preferredAccent, audioUrl);
      return playId === playIdRef.current;
    } catch (err) {
      console.warn('Flashcard audio playback error:', err);
      return false;
    } finally {
      if (playId === playIdRef.current) {
        setIsPlayingAudio(false);
      }
    }
  }, [word, clearLoopTimer]);

  // Recursive loop iteration with ~1.5s pause
  const runLoopStep = useCallback(async () => {
    if (!isLoopingRef.current) return;

    const playId = playIdRef.current + 1;
    const completed = await playWordAudio('US');

    if (!isLoopingRef.current || playId !== playIdRef.current || !completed) {
      return;
    }

    // Pause for customizable loopInterval between playback iterations
    const delayMs = Math.round(Math.max(0.2, loopIntervalRef.current) * 1000);
    loopTimerRef.current = setTimeout(() => {
      if (isLoopingRef.current && playId === playIdRef.current) {
        runLoopStep();
      }
    }, delayMs);
  }, [playWordAudio]);

  // Handle playing word once (cancels loop so P strictly plays once)
  const handlePlayOnce = useCallback((accent: 'US' | 'UK' = 'US') => {
    if (isLoopingRef.current) {
      setIsLooping(false);
    }
    clearLoopTimer();
    playWordAudio(accent);
  }, [clearLoopTimer, playWordAudio, setIsLooping]);

  // Handle toggling loop mode (Shift+P)
  const handleToggleLoop = useCallback(() => {
    const nextVal = !isLoopingRef.current;
    setIsLooping(nextVal);
    clearLoopTimer();

    if (nextVal) {
      runLoopStep();
    } else {
      playIdRef.current++;
      stopPronunciation();
      setIsPlayingAudio(false);
    }
  }, [clearLoopTimer, runLoopStep, setIsLooping]);

  // When card changes: stop previous audio; if loop mode is ON, play the new card's pronunciation
  useEffect(() => {
    playIdRef.current++;
    clearLoopTimer();
    stopPronunciation();
    setIsPlayingAudio(false);

    if (isLoopingRef.current) {
      runLoopStep();
    }

    return () => {
      playIdRef.current++;
      clearLoopTimer();
      stopPronunciation();
      setIsPlayingAudio(false);
    };
  }, [word.id, clearLoopTimer, runLoopStep]);

  // When exiting or opening any modal/dialog: stop audio and disable loop mode
  useEffect(() => {
    const handleModalOpened = () => {
      if (isLoopingRef.current) {
        setIsLooping(false);
      }
      playIdRef.current++;
      clearLoopTimer();
      stopPronunciation();
      setIsPlayingAudio(false);
    };

    window.addEventListener('lexipulse:modal-opened', handleModalOpened);
    return () => {
      window.removeEventListener('lexipulse:modal-opened', handleModalOpened);
    };
  }, [clearLoopTimer, setIsLooping]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable ||
        (typeof target?.closest === 'function' && Boolean(target.closest('[contenteditable="true"]')));
      if (isTyping) {
        return;
      }

      // Don't trigger shortcuts if a modal dialog is open
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) {
        return;
      }

      // Shortcut: P (play once) and Shift+P (toggle loop mode)
      if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (e.shiftKey) {
          handleToggleLoop();
        } else {
          handlePlayOnce('US');
        }
        return;
      }

      // Existing audio shortcuts: R/A (play), Shift+R (UK), Ctrl+Space
      const isAudioShortcut =
        ((e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'a') && !e.ctrlKey && !e.altKey && !e.metaKey) ||
        ((e.ctrlKey || e.metaKey) && e.code === 'Space');

      if (isAudioShortcut) {
        e.preventDefault();
        const accent: 'US' | 'UK' = e.shiftKey ? 'UK' : 'US';
        handlePlayOnce(accent);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setShouldAnimateFlip(true);
        setFlippedCardId((prev) => (prev === word.id ? null : word.id));
      } else if (isFlipped && !isSubmitting) {
        if (e.key === '1') {
          e.preventDefault();
          onGrade(1);
        } else if (e.key === '2') {
          e.preventDefault();
          onGrade(2);
        } else if (e.key === '3') {
          e.preventDefault();
          onGrade(3);
        } else if (e.key === '4') {
          e.preventDefault();
          onGrade(4);
        }
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
  }, [isFlipped, isSubmitting, onGrade, onPrevCard, onNextCard, handlePlayOnce, handleToggleLoop, word.id]);


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

          <span className="font-bold text-slate-800 dark:text-slate-200 px-1 font-mono">
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
          <span className="text-[11px] font-mono font-medium text-slate-400 dark:text-slate-500">
            {language === 'vi' ? 'Chu kỳ' : 'Interval'}: {formatInterval(word.reviewMeta.interval, language)}
          </span>
        </div>
      </div>

      {/* 3D Flashcard Container */}
      <div className="perspective-1000 w-full min-h-[380px] sm:min-h-[420px] animate-fade-in">
        <div
          onClick={() => {
            setShouldAnimateFlip(true);
            setFlippedCardId(isFlipped ? null : word.id);
          }}
          className={`relative w-full h-full min-h-[380px] sm:min-h-[420px] rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transform-style-3d cursor-pointer select-none dark:border-slate-800 dark:bg-[#111622] ${
            shouldAnimateFlip ? 'transition-transform duration-500' : ''
          } ${
            isFlipped ? 'rotate-y-180' : 'hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          {/* FRONT SIDE */}
          <div
            className={`absolute inset-0 flex flex-col justify-between p-7 backface-hidden ${
              isFlipped ? 'pointer-events-none' : ''
            }`}
          >
            {/* Top row */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {language === 'vi' ? 'Mặt trước' : 'Front Card'}
              </span>
              <div className="flex gap-1">
                {word.pos?.map((p) => (
                  <span
                    key={p}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 italic"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Center: Word + IPA + Audio Controls */}
            <div className="my-auto text-center space-y-4">
              <h2 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                {word.word}
              </h2>

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <span className="font-mono text-sm text-slate-500 dark:text-slate-400 mr-1">
                  {word.phonetics.us || word.phonetics.uk}
                </span>
                <AudioButton
                  text={word.word}
                  accent="US"
                  audioUrl={word.phonetics.audioUs}
                  size="sm"
                  shortcutHint="P"
                  isPlaying={isPlayingAudio && playingAccent === 'US'}
                />
                <AudioButton
                  text={word.word}
                  accent="UK"
                  audioUrl={word.phonetics.audioUk}
                  size="sm"
                  shortcutHint="Shift+R"
                  isPlaying={isPlayingAudio && playingAccent === 'UK'}
                />
                {/* Loop Mode Toggle & Delay Button */}
                <div className={`inline-flex items-center rounded-lg border shadow-xs transition-all ${
                  isLooping
                    ? 'border-indigo-500 bg-indigo-50/70 text-indigo-700 ring-2 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700'
                }`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLoop();
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold active:scale-95 transition-transform ${
                      isLooping ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title={
                      language === 'vi'
                        ? `Phát âm lặp lại [Shift+P]: ${isLooping ? 'Đang BẬT' : 'Đang TẮT'}`
                        : `Loop pronunciation [Shift+P]: ${isLooping ? 'ON' : 'OFF'}`
                    }
                    aria-label={
                      language === 'vi'
                        ? `Phát âm lặp lại: ${isLooping ? 'Bật' : 'Tắt'}`
                        : `Loop pronunciation: ${isLooping ? 'On' : 'Off'}`
                    }
                    aria-pressed={isLooping}
                  >
                    <Repeat className={`h-3.5 w-3.5 ${isLooping ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : ''}`} />
                    <span>
                      {isLooping
                        ? (language === 'vi' ? 'Lặp: Bật' : 'Loop: On')
                        : (language === 'vi' ? 'Lặp lại' : 'Loop')}
                    </span>
                    <kbd className="kbd-shortcut hidden sm:inline-block text-[10px]">Shift+P</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={handleCycleLoopInterval}
                    className={`inline-flex items-center border-l px-2 py-1 text-xs font-mono font-bold transition-colors ${
                      isLooping
                        ? 'border-indigo-200/80 hover:bg-indigo-100/70 text-indigo-700 dark:border-indigo-800/80 dark:hover:bg-indigo-900/60 dark:text-indigo-300'
                        : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-indigo-400'
                    }`}
                    title={
                      language === 'vi'
                        ? `Độ trễ lặp: ${currentLoopInterval}s (nhấn để đổi: 0.5s, 1s, 1.5s, 2s, 3s)`
                        : `Loop delay: ${currentLoopInterval}s (click to cycle: 0.5s, 1s, 1.5s, 2s, 3s)`
                    }
                    aria-label={
                      language === 'vi'
                        ? `Độ trễ giữa 2 lần loop: ${currentLoopInterval} giây`
                        : `Pronunciation loop delay: ${currentLoopInterval} seconds`
                    }
                  >
                    <span>{currentLoopInterval}s</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom hint */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3.5 text-xs text-slate-400 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <RotateCw className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{t.review.flipPrompt}</span>
                  <kbd className="kbd-shortcut hidden sm:inline-block">Space</kbd>
                </span>
                <span className="hidden sm:inline-block text-slate-300 dark:text-slate-600">•</span>
                <span
                  className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayOnce('US');
                  }}
                  title={language === 'vi' ? 'Phát âm (P: US, Shift+R: UK)' : 'Play audio (P: US, Shift+R: UK)'}
                >
                  <Volume2 className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{language === 'vi' ? 'Phát âm' : 'Audio'}</span>
                  <kbd className="kbd-shortcut hidden sm:inline-block">P</kbd>
                </span>
                <span className="hidden sm:inline-block text-slate-300 dark:text-slate-600">•</span>
                <span
                  className={`flex items-center gap-1.5 cursor-pointer transition-colors ${
                    isLooping ? 'text-indigo-600 font-semibold dark:text-indigo-400' : 'hover:text-indigo-600'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleLoop();
                  }}
                  title={language === 'vi' ? 'Bật/tắt phát âm lặp lại (nghỉ 1.5s)' : 'Toggle loop pronunciation (1.5s delay)'}
                >
                  <Repeat className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{language === 'vi' ? 'Lặp lại' : 'Loop'}</span>
                  <kbd className="kbd-shortcut hidden sm:inline-block">Shift+P</kbd>
                </span>
              </div>
              <span className="text-slate-400 text-[11px] font-medium">
                {word.tags.slice(0, 2).join(' ')}
              </span>
            </div>
          </div>

          {/* BACK SIDE */}
          <div
            className={`absolute inset-0 flex flex-col justify-between p-7 backface-hidden rotate-y-180 overflow-y-auto ${
              !isFlipped ? 'pointer-events-none opacity-0 invisible select-none' : 'opacity-100 visible'
            } transition-opacity duration-150`}
            aria-hidden={!isFlipped}
          >
            {/* Top row */}
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {word.word}
                </span>
                <AudioButton
                  text={word.word}
                  size="sm"
                  showLabel={false}
                  shortcutHint="P"
                  isPlaying={isPlayingAudio}
                />
                <div className={`inline-flex items-center rounded-lg border text-[11px] font-semibold transition-all ${
                  isLooping
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLoop();
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5"
                    title={
                      language === 'vi'
                        ? `Phát âm lặp lại [Shift+P]: ${isLooping ? 'Đang BẬT' : 'Đang TẮT'}`
                        : `Loop pronunciation [Shift+P]: ${isLooping ? 'ON' : 'OFF'}`
                    }
                    aria-pressed={isLooping}
                  >
                    <Repeat className="h-3 w-3" />
                    <span>{isLooping ? (language === 'vi' ? 'Lặp: Bật' : 'Loop: On') : (language === 'vi' ? 'Lặp lại' : 'Loop')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCycleLoopInterval}
                    className={`border-l px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                      isLooping
                        ? 'border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:text-indigo-300'
                        : 'border-slate-200 text-slate-500 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400'
                    }`}
                    title={
                      language === 'vi'
                        ? `Độ trễ lặp: ${currentLoopInterval}s (nhấn để đổi)`
                        : `Loop delay: ${currentLoopInterval}s (click to cycle)`
                    }
                    aria-label={
                      language === 'vi'
                        ? `Độ trễ giữa 2 lần loop: ${currentLoopInterval} giây`
                        : `Pronunciation loop delay: ${currentLoopInterval} seconds`
                    }
                  >
                    {currentLoopInterval}s
                  </button>
                </div>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {language === 'vi' ? 'Mặt sau (Đáp án)' : 'Back Card'}
              </span>
            </div>

            {/* Content */}
            <div className="my-auto space-y-3.5 py-2">
              {/* Core Meaning */}
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 text-left dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {language === 'vi' ? 'Định nghĩa' : 'Definition'}
                </span>
                {(() => {
                  const senses = parseMultipleMeanings(word.vietnameseDefinition);
                  if (senses.length > 1) {
                    return (
                      <div className="mt-2 space-y-1.5">
                        {senses.map((sense) => (
                          <div key={sense.index} className="flex items-start gap-2">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 text-[11px] font-bold shrink-0 mt-0.5 shadow-xs">
                              {sense.index}
                            </span>
                            <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                              {sense.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <p className="mt-1 text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      {word.vietnameseDefinition}
                    </p>
                  );
                })()}
                {word.englishDefinition && (
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-emerald-200/60 pt-1.5 dark:border-emerald-900/40">
                    {word.englishDefinition}
                  </p>
                )}
              </div>

              {/* Collocations */}
              {word.collocations.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-left dark:border-slate-800 dark:bg-slate-900/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    High-yield Collocations
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                    {word.collocations.slice(0, 3).map((c, i) => (
                      <span key={i} className="text-slate-700 dark:text-slate-300">
                        <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">{c.phrase}</strong> ({c.meaningVi})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Workplace / TOEIC Example */}
              {workplaceEx && (
                <div className="rounded-xl border border-slate-200/80 p-3 text-left dark:border-slate-800 bg-white/40 dark:bg-slate-900/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Workplace Context
                    </span>
                    <AudioButton text={workplaceEx.en} size="sm" showLabel={false} />
                  </div>
                  <p className="mt-1 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                    {renderHighlightedExample(workplaceEx.en, word.word)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 italic">
                    {workplaceEx.vi}
                  </p>
                </div>
              )}

              {/* Word Family */}
              {word.wordFamily && word.wordFamily.length > 0 && (
                <div className="rounded-xl border border-slate-200/80 p-3 text-left dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
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
            <div className="flex items-center justify-center gap-3 text-center text-[11px] text-slate-400 border-t border-slate-100 pt-2 dark:border-slate-800">
              <span>{t.review.flipPrompt}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span
                className="inline-flex items-center gap-1 cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayOnce('US');
                }}
              >
                <Volume2 className="h-3 w-3 text-indigo-500" />
                <span>{language === 'vi' ? 'Phát âm' : 'Audio'}</span>
                <kbd className="kbd-shortcut">P</kbd>
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span
                className={`inline-flex items-center gap-1 cursor-pointer transition-colors ${
                  isLooping ? 'text-indigo-600 font-semibold dark:text-indigo-400' : 'hover:text-indigo-600'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleLoop();
                }}
              >
                <Repeat className="h-3 w-3 text-indigo-500" />
                <span>{language === 'vi' ? 'Lặp lại' : 'Loop'}</span>
                <kbd className="kbd-shortcut">Shift+P</kbd>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Flip requirement helper banner when unflipped */}
      {!isFlipped && (
        <div className="text-center text-xs font-medium text-amber-700 bg-amber-50/90 dark:bg-amber-950/40 dark:text-amber-300 py-2 px-3 rounded-xl border border-amber-200/80 dark:border-amber-900/60 transition-all flex items-center justify-center gap-2">
          <span>{t.review.flipToGradePrompt}</span>
        </div>
      )}

      {/* Self-grading Action Controls (FSRS 4-level rating) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        {/* Rating 1: Again */}
        <button
          type="button"
          disabled={!isFlipped || isSubmitting}
          onClick={() => onGrade(1)}
          className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-rose-700 transition-all shadow-sm dark:text-rose-300 ${
            !isFlipped || isSubmitting
              ? 'border-rose-100 bg-rose-50/30 dark:border-rose-950 dark:bg-rose-950/10 opacity-40 cursor-not-allowed'
              : 'border-rose-200 bg-rose-50/70 hover:bg-rose-100 hover:border-rose-300 active:scale-[0.98] dark:border-rose-900/60 dark:bg-rose-950/40 dark:hover:bg-rose-950/70'
          }`}
          title={isFlipped ? 'Again' : t.review.flipToGradePrompt}
        >
          <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm">
            <span>{t.review.againRating}</span>
            <kbd className="rounded bg-rose-200/80 px-1.5 py-0.5 text-[10px] font-mono dark:bg-rose-800/80 font-bold">1</kbd>
          </div>
          <span className="text-[11px] opacity-80 mt-0.5 font-semibold text-rose-800 dark:text-rose-200">
            {language === 'vi' ? preview[1].intervalTextVi : preview[1].intervalTextEn}
          </span>
        </button>

        {/* Rating 2: Hard */}
        <button
          type="button"
          disabled={!isFlipped || isSubmitting}
          onClick={() => onGrade(2)}
          className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-amber-700 transition-all shadow-sm dark:text-amber-300 ${
            !isFlipped || isSubmitting
              ? 'border-amber-100 bg-amber-50/30 dark:border-amber-950 dark:bg-amber-950/10 opacity-40 cursor-not-allowed'
              : 'border-amber-200 bg-amber-50/70 hover:bg-amber-100 hover:border-amber-300 active:scale-[0.98] dark:border-amber-900/60 dark:bg-amber-950/40 dark:hover:bg-amber-950/70'
          }`}
          title={isFlipped ? 'Hard' : t.review.flipToGradePrompt}
        >
          <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm">
            <span>{t.review.hardRating}</span>
            <kbd className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-mono dark:bg-amber-800/80 font-bold">2</kbd>
          </div>
          <span className="text-[11px] opacity-80 mt-0.5 font-semibold text-amber-800 dark:text-amber-200">
            {language === 'vi' ? preview[2].intervalTextVi : preview[2].intervalTextEn}
          </span>
        </button>

        {/* Rating 3: Good */}
        <button
          type="button"
          disabled={!isFlipped || isSubmitting}
          onClick={() => onGrade(3)}
          className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-indigo-700 transition-all shadow-sm dark:text-indigo-300 ${
            !isFlipped || isSubmitting
              ? 'border-indigo-100 bg-indigo-50/30 dark:border-indigo-950 dark:bg-indigo-950/10 opacity-40 cursor-not-allowed'
              : 'border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 hover:border-indigo-300 active:scale-[0.98] dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70'
          }`}
          title={isFlipped ? 'Good' : t.review.flipToGradePrompt}
        >
          <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm">
            <span>{t.review.goodRating}</span>
            <kbd className="rounded bg-indigo-200/80 px-1.5 py-0.5 text-[10px] font-mono dark:bg-indigo-800/80 font-bold">3</kbd>
          </div>
          <span className="text-[11px] opacity-80 mt-0.5 font-semibold text-indigo-800 dark:text-indigo-200">
            {language === 'vi' ? preview[3].intervalTextVi : preview[3].intervalTextEn}
          </span>
        </button>

        {/* Rating 4: Easy */}
        <button
          type="button"
          disabled={!isFlipped || isSubmitting}
          onClick={() => onGrade(4)}
          className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-emerald-700 transition-all shadow-sm dark:text-emerald-300 ${
            !isFlipped || isSubmitting
              ? 'border-emerald-100 bg-emerald-50/30 dark:border-emerald-950 dark:bg-emerald-950/10 opacity-40 cursor-not-allowed'
              : 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 hover:border-emerald-300 active:scale-[0.98] dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70'
          }`}
          title={isFlipped ? 'Easy' : t.review.flipToGradePrompt}
        >
          <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm">
            <span>{t.review.easyRating}</span>
            <kbd className="rounded bg-emerald-200/80 px-1.5 py-0.5 text-[10px] font-mono dark:bg-emerald-800/80 font-bold">4</kbd>
          </div>
          <span className="text-[11px] opacity-80 mt-0.5 font-semibold text-emerald-800 dark:text-emerald-200">
            {language === 'vi' ? preview[4].intervalTextVi : preview[4].intervalTextEn}
          </span>
        </button>
      </div>
    </div>
  );
};
