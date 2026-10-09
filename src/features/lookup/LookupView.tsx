import React from 'react';
import { ArrowRight, Lightbulb } from 'lucide-react';
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
  onSearch: (word: string, contextSentence?: string) => void;
  onSaveToDeck: (word: WordItem) => void;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  searchContextSentence?: string;
  onSearchContextSentenceChange?: (cs: string) => void;
  showSearchContextInput?: boolean;
  onShowSearchContextInputChange?: (show: boolean) => void;
  onReTranslateWithAI?: (word: WordItem) => Promise<void> | void;
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
  searchQuery,
  onSearchQueryChange,
  searchContextSentence,
  onSearchContextSentenceChange,
  showSearchContextInput,
  onShowSearchContextInputChange,
  onReTranslateWithAI,
}) => {
  const { language, t } = useLanguage();

  return (
    <div className="lookup-workspace">
      <div className="study-page-heading">
        <div>
          <h1>{language === 'vi' ? 'Tra cứu từ vựng' : 'Dictionary'}</h1>
          <p>{language === 'vi' ? 'Hiểu nghĩa, nghe phát âm và lưu từ để luyện tập.' : 'Explore meanings, hear pronunciation and save words to practice.'}</p>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar
        onSearch={onSearch}
        isLoading={isSearching}
        deckWords={allWords}
        query={searchQuery}
        onQueryChange={onSearchQueryChange}
        contextSentence={searchContextSentence}
        onContextSentenceChange={onSearchContextSentenceChange}
        showContextInput={showSearchContextInput}
        onShowContextInputChange={onShowSearchContextInputChange}
      />

      {/* Error state */}
      {searchError && (
        <div
          role="alert"
          aria-live="polite"
          className="content-surface dictionary-notice max-w-md mx-auto p-3.5 text-center text-xs font-semibold text-rose-700 dark:text-rose-300"
        >
          {searchError}
        </div>
      )}

      {/* Typo / Spelling Correction Prompt */}
      {searchTypoInfo && (
        <div className="content-surface dictionary-notice p-5 space-y-4 animate-fade-in">
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
              <div className="dictionary-context relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      {searchTypoInfo.suggestions[0].word}
                    </span>
                    {searchTypoInfo.suggestions[0].pos && (
                      <span className="dictionary-label px-2 py-0.5 text-[10px] font-semibold">
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
                  data-glass
                  onClick={() => onSearch(searchTypoInfo.suggestions[0].word)}
                  className="glass-button glass-prominent inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold shrink-0"
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
                        data-glass
                        onClick={() => onSearch(s.word)}
                        className="glass-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                      >
                        <span className="font-semibold">
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
          onReTranslateWithAI={onReTranslateWithAI}
          deckWords={allWords}
        />
      )}
    </div>
  );
};
