import { BookmarkCheck, ExternalLink, Loader2, Plus, Sparkles, Volume2 } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { playPronunciation } from '../../services/audio';
import type { WordFamilyItem, WordItem } from '../../types/vocab';

interface WordFamilyInteractiveProps {
  wordFamily: WordFamilyItem[];
  currentWord?: string;
  deckWords?: WordItem[];
  onLookupWord?: (word: string) => void;
  onSelectDeckWord?: (word: WordItem) => void;
  onAddWordToDeck?: (word: string) => Promise<void> | void;
  compact?: boolean;
  showHint?: boolean;
  className?: string;
}

export const WordFamilyInteractive: React.FC<WordFamilyInteractiveProps> = ({
  wordFamily,
  currentWord,
  deckWords = [],
  onLookupWord,
  onSelectDeckWord,
  onAddWordToDeck,
  compact = false,
  showHint = true,
  className = '',
}) => {
  const { language, t } = useLanguage();
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const [addingWord, setAddingWord] = useState<string | null>(null);

  const getPosBadgeStyle = (pos: string) => {
    const p = pos.toLowerCase();
    if (p.includes('noun') || p === 'n') {
      return {
        bg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/80',
        label: language === 'vi' ? 'danh từ' : 'noun',
        short: 'n.',
      };
    }
    if (p.includes('verb') || p === 'v') {
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80',
        label: language === 'vi' ? 'động từ' : 'verb',
        short: 'v.',
      };
    }
    if (p.includes('adj') || p.includes('adjective')) {
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/80',
        label: language === 'vi' ? 'tính từ' : 'adj',
        short: 'adj.',
      };
    }
    if (p.includes('adv') || p.includes('adverb')) {
      return {
        bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/80',
        label: language === 'vi' ? 'trạng từ' : 'adv',
        short: 'adv.',
      };
    }
    return {
      bg: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
      label: pos,
      short: pos,
    };
  };

  const handlePlayAudio = async (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    if (playingWord) return;

    setPlayingWord(word);
    try {
      await playPronunciation(word, 'US');
    } catch (err) {
      console.warn('Audio playback error:', err);
    } finally {
      setPlayingWord(null);
    }
  };

  const handleQuickAdd = async (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    if (!onAddWordToDeck || addingWord) return;
    setAddingWord(word);
    try {
      await onAddWordToDeck(word);
    } catch (err) {
      console.error('Failed to quick add word family item:', err);
    } finally {
      setAddingWord(null);
    }
  };

  const handleWordClick = (wf: WordFamilyItem) => {
    const inDeckWord = deckWords.find((w) => w.word.toLowerCase() === wf.word.toLowerCase());

    if (inDeckWord && onSelectDeckWord) {
      onSelectDeckWord(inDeckWord);
      return;
    }

    if (onLookupWord) {
      onLookupWord(wf.word);
    }
  };

  if (!wordFamily || wordFamily.length === 0) {
    return (
      <div className={`text-xs text-slate-400 italic ${className}`}>
        {t.lookup.noWordFamily}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Interactive Helper Hint */}
      {showHint && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-indigo-500" />
            {t.lookup.wordFamilyHint}
          </span>
          <span className="hidden sm:inline text-[10px] text-slate-400">
            {wordFamily.length} {language === 'vi' ? 'dạng từ' : 'forms'}
          </span>
        </div>
      )}

      {/* Word Family Pills Container */}
      <div className="flex flex-wrap gap-2">
        {wordFamily.map((wf, idx) => {
          const isCurrent =
            !!currentWord && wf.word.toLowerCase() === currentWord.toLowerCase();
          const inDeckWord = deckWords.find(
            (w) => w.word.toLowerCase() === wf.word.toLowerCase()
          );
          const isInDeck = !!inDeckWord;
          const posInfo = getPosBadgeStyle(wf.pos);
          const isAudioPlaying = playingWord === wf.word;
          const meaning = wf.meaningVi || inDeckWord?.vietnameseDefinition;

          return (
            <div
              key={`${wf.word}-${idx}`}
              onClick={() => handleWordClick(wf)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleWordClick(wf);
                }
              }}
              title={
                isCurrent
                  ? `${wf.word} (${posInfo.label}) - ${t.lookup.currentWordBadge}${meaning ? ` : ${meaning}` : ''}`
                  : `${t.lookup.lookupWordFamily}: "${wf.word}" (${posInfo.label})${meaning ? ` - ${meaning}` : ''}`
              }
              className={`group relative flex items-center gap-1.5 rounded-xl border transition-all duration-200 cursor-pointer select-none max-w-full ${
                compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-xs'
              } ${
                isCurrent
                  ? 'border-indigo-400 bg-indigo-50/80 font-bold text-indigo-900 shadow-sm ring-2 ring-indigo-200/50 dark:border-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-900/30'
                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 dark:border-slate-700/80 dark:bg-slate-800/80 dark:hover:border-indigo-500 dark:hover:bg-slate-800'
              }`}
            >
              {/* Part of Speech Mini Badge */}
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0 ${posInfo.bg}`}
              >
                {compact ? posInfo.short : posInfo.label}
              </span>

              {/* Word Text */}
              <span
                className={`font-medium shrink-0 ${
                  isCurrent
                    ? 'text-indigo-900 dark:text-indigo-200 font-bold'
                    : 'text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-300'
                }`}
              >
                {wf.word}
              </span>

              {/* Vietnamese Meaning Preview */}
              {meaning && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal truncate min-w-0 shrink max-w-[90px] sm:max-w-[120px] md:max-w-[85px] lg:max-w-[130px] hidden sm:inline">
                  • {meaning}
                </span>
              )}

              {/* In-Deck Indicator Badge */}
              {isInDeck && (
                <span
                  className="flex items-center gap-0.5 rounded-md bg-emerald-100/80 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shrink-0"
                  title={language === 'vi' ? 'Đã lưu trong Deck' : 'Saved in Deck'}
                >
                  <BookmarkCheck className="h-2.5 w-2.5" />
                  <span className="hidden sm:inline">Deck</span>
                </span>
              )}

              {/* Quick Add Button if not in deck */}
              {!isInDeck && onAddWordToDeck && !isCurrent && (
                <button
                  type="button"
                  onClick={(e) => handleQuickAdd(e, wf.word)}
                  disabled={addingWord === wf.word}
                  title={language === 'vi' ? `Thêm "${wf.word}" vào Deck` : `Add "${wf.word}" to Deck`}
                  className="ml-0.5 flex items-center gap-0.5 rounded-md border border-indigo-200 bg-indigo-50/90 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-all active:scale-95 shrink-0"
                >
                  {addingWord === wf.word ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <Plus className="h-2.5 w-2.5" />
                  )}
                  <span>{language === 'vi' ? 'Thêm' : 'Add'}</span>
                </button>
              )}

              {/* Audio Pronunciation Button */}
              <button
                type="button"
                onClick={(e) => handlePlayAudio(e, wf.word)}
                disabled={isAudioPlaying}
                title={`${t.lookup.pronounceWordFamily} "${wf.word}"`}
                className={`ml-0.5 rounded-md p-1 transition-all hover:scale-110 active:scale-95 shrink-0 ${
                  isAudioPlaying
                    ? 'bg-indigo-100 text-indigo-700 animate-pulse dark:bg-indigo-900 dark:text-indigo-300'
                    : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 dark:hover:text-indigo-400'
                }`}
              >
                <Volume2 className={`h-3.5 w-3.5 ${isAudioPlaying ? 'animate-bounce' : ''}`} />
              </button>

              {/* Quick Search Arrow indicator */}
              {!isCurrent && (
                <span
                  className="text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-indigo-500 transition-all duration-150 shrink-0"
                  title={`${t.lookup.lookupWordFamily}: "${wf.word}"`}
                >
                  <ExternalLink className="h-3 w-3" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
