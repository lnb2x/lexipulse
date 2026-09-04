import React from 'react';
import { ArrowRight, Lightbulb, Sparkles } from 'lucide-react';
import { SearchBar } from '../../components/lookup/SearchBar';
import { WordCard } from '../../components/lookup/WordCard';
import { useLanguage } from '../../context/LanguageContext';
import type { SpellingSuggestion, WordItem } from '../../types/vocab';

export interface LookupViewProps {
  lookupResult: WordItem | null;
  isSearching: boolean;
  searchError: string | null;
  searchTypoInfo: {
    query: string;
    suggestions: SpellingSuggestion[];
  } | null;
  allWords: WordItem[];
  isWordInDeck: (word: string) => boolean;
  onSearch: (word: string) => void;
  onSaveToDeck: (word: WordItem) => void;
}

export const LookupView: React.FC<LookupViewProps> = ({
  lookupResult,
  isSearching,
  searchError,
  searchTypoInfo,
  allWords,
  isWordInDeck,
  onSearch,
  onSaveToDeck,
}) => {
  const { language, t } = useLanguage();

  return (
    <div className="space-y-7 animate-fade-in">
      {/* Hero Text */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
          {language === 'vi' ? 'Công cụ tra từ thông minh' : 'Intelligent Linguistic Engine'}
        </span>
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t.lookup.title}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          {t.lookup.subtitle}
        </p>
      </div>

      {/* Search Bar */}
      <SearchBar onSearch={onSearch} isLoading={isSearching} deckWords={allWords} />

      {/* Error state */}
      {searchError && (
        <div
          role="alert"
          aria-live="polite"
          className="max-w-md mx-auto rounded-xl border border-rose-200/80 bg-rose-50/80 p-3.5 text-center text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {searchError}
        </div>
      )}

      {/* Typo / Spelling Correction Prompt */}
      {searchTypoInfo && (
        <div className="max-w-2xl mx-auto rounded-2xl border border-amber-200/80 bg-amber-50/70 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20 space-y-4 animate-fade-in">
          {/* Header Notice */}
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                {t.lookup.noExactMatchFor}{' '}
                <span className="underline decoration-amber-400 decoration-wavy underline-offset-4">
                  "{searchTypoInfo.query}"
                </span>
              </h3>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                {searchTypoInfo.suggestions.length > 0
                  ? t.lookup.didYouMean
                  : language === 'vi'
                  ? 'Hãy kiểm tra lại chính tả hoặc thử một từ khóa khác.'
                  : 'Please check your spelling or try another keyword.'}
              </p>
            </div>
          </div>

          {/* Primary Recommendation Action Card */}
          {searchTypoInfo.suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200/90 bg-white/95 p-4 shadow-sm transition-all hover:border-indigo-300 dark:border-amber-900/70 dark:bg-slate-900/90">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {searchTypoInfo.suggestions[0].word}
                    </span>
                    {searchTypoInfo.suggestions[0].pos && (
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300">
                        {searchTypoInfo.suggestions[0].pos}
                      </span>
                    )}
                    {isWordInDeck(searchTypoInfo.suggestions[0].word) && (
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300">
                        {t.lookup.inDeckBadge}
                      </span>
                    )}
                  </div>
                  {searchTypoInfo.suggestions[0].meaningVi && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {searchTypoInfo.suggestions[0].meaningVi}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onSearch(searchTypoInfo.suggestions[0].word)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-95 transition-all shrink-0"
                >
                  <span>
                    {language === 'vi'
                      ? `Tra cứu "${searchTypoInfo.suggestions[0].word}"`
                      : `Lookup "${searchTypoInfo.suggestions[0].word}"`}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Secondary Suggestions (Chips) */}
              {searchTypoInfo.suggestions.length > 1 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800/80 dark:text-amber-400/80">
                    {t.lookup.spellingSuggestions}:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {searchTypoInfo.suggestions.slice(1, 5).map((s) => (
                      <button
                        key={s.word}
                        type="button"
                        onClick={() => onSearch(s.word)}
                        className="group inline-flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:text-indigo-600 dark:border-amber-900/60 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-indigo-600 dark:hover:text-indigo-400"
                      >
                        <span className="font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {s.word}
                        </span>
                        {s.pos && <span className="text-[10px] text-slate-400">({s.pos})</span>}
                        {s.meaningVi && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[120px] truncate">
                            — {s.meaningVi}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Word Card */}
      {lookupResult && (
        <WordCard
          word={lookupResult}
          onSaveToDeck={onSaveToDeck}
          isAlreadyInDeck={isWordInDeck(lookupResult.word)}
          onLookupWord={onSearch}
          deckWords={allWords}
        />
      )}
    </div>
  );
};
