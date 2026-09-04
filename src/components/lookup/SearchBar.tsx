import { Clock, History, Lightbulb, Loader2, Search, Sparkles, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { WordItem, SpellingSuggestion } from '../../types/vocab';
import { LOCAL_KNOWLEDGE_BASE, getSpellingSuggestions } from '../../services/dictionary';
import { findFuzzyMatches } from '../../utils/fuzzySearch';

interface SearchBarProps {
  onSearch: (word: string) => void;
  isLoading: boolean;
  deckWords?: WordItem[];
}

const QUICK_RECOMMENDATIONS = ['negotiate', 'feasible', 'implement', 'compliance', 'facilitate', 'collaborate', 'perspective', 'innovative'];

const SEARCH_HISTORY_KEY = 'lexipulse_recent_searches';

interface KbItem {
  word: string;
  meaningVi: string;
  pos: string;
  source: 'builtin';
}

// Pre-computed static knowledge base items so we don't map Object.entries on every keystroke
const STATIC_LOCAL_KB_ITEMS: KbItem[] = Object.entries(LOCAL_KNOWLEDGE_BASE).map(([word, val]) => ({
  word,
  meaningVi: val.vi,
  pos: val.pos?.[0] || 'word',
  source: 'builtin' as const,
}));

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading, deckWords = [] }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [onlineFuzzySuggestions, setOnlineFuzzySuggestions] = useState<SpellingSuggestion[]>([]);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeQueryRef = useRef<string>('');

  // Pre-indexed deck map for O(1) word lookup instead of linear find/some
  const deckWordMap = useMemo(() => {
    const map = new Map<string, WordItem>();
    for (const w of deckWords) {
      map.set(w.word.trim().toLowerCase(), w);
    }
    return map;
  }, [deckWords]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced online spelling suggestions with AbortController cancellation
  useEffect(() => {
    const q = query.trim().toLowerCase();
    activeQueryRef.current = q;

    // Abort previous in-flight Datamuse request immediately
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (q.length < 3) {
      setOnlineFuzzySuggestions([]);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const results = await getSpellingSuggestions(q, deckWords, controller.signal);
        // Only update if this request wasn't aborted and matches current active query
        if (!controller.signal.aborted && activeQueryRef.current === q) {
          // Exclude exact matches that are identical to the query
          setOnlineFuzzySuggestions(results.filter((s) => s.word.toLowerCase() !== q));
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return;
        // ignore network error
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, deckWords]);

  // Save history
  const saveToHistory = (word: string) => {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) return;
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((w) => w.toLowerCase() !== trimmed)].slice(0, 8);
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch {
      // ignore
    }
  };

  // 1. Exact substring matches using deferredQuery (never blocks keystrokes)
  const exactSuggestions = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return [];

    const map = new Map<string, { word: string; meaningVi: string; pos: string; source: 'deck' | 'builtin' }>();

    // Deck words match (cap early to avoid huge scans)
    let deckMatchCount = 0;
    for (const w of deckWords) {
      const wLower = w.word.toLowerCase();
      if (wLower.includes(q)) {
        map.set(wLower, {
          word: w.word,
          meaningVi: w.vietnameseDefinition,
          pos: w.pos?.[0] || 'word',
          source: 'deck',
        });
        deckMatchCount++;
        if (deckMatchCount >= 15) break;
      }
    }

    // Built-in vocabulary match from pre-built static items
    for (const item of STATIC_LOCAL_KB_ITEMS) {
      const key = item.word.toLowerCase();
      if (key.includes(q) && !map.has(key)) {
        map.set(key, item);
      }
    }

    return Array.from(map.values())
      .sort((a, b) => {
        const aStarts = a.word.toLowerCase().startsWith(q);
        const bStarts = b.word.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.word.localeCompare(b.word);
      })
      .slice(0, 5);
  }, [deferredQuery, deckWords]);

  // 2. Fuzzy / Did-you-mean suggestions (combines instant local + online Datamuse)
  const combinedFuzzySuggestions = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (q.length < 3) return [];

    const exactWords = new Set(exactSuggestions.map((s) => s.word.toLowerCase()));
    exactWords.add(q);

    const map = new Map<string, SpellingSuggestion>();

    // Local instant fuzzy from pre-computed static items (no recreation!)
    const localKbMatches = findFuzzyMatches(q, STATIC_LOCAL_KB_ITEMS, (x) => x.word, 0.65, 4);
    for (const match of localKbMatches) {
      const wLower = match.item.word.toLowerCase();
      if (!exactWords.has(wLower)) {
        map.set(wLower, {
          word: match.item.word,
          meaningVi: match.item.meaningVi,
          pos: match.item.pos,
          source: 'builtin',
          score: match.similarity,
        });
      }
    }

    // Local instant fuzzy from deckWords
    const deckMatches = findFuzzyMatches(q, deckWords, (x) => x.word, 0.65, 4);
    for (const match of deckMatches) {
      const wLower = match.item.word.toLowerCase();
      if (!exactWords.has(wLower)) {
        map.set(wLower, {
          word: match.item.word,
          meaningVi: match.item.vietnameseDefinition,
          pos: match.item.pos?.[0] || 'word',
          source: 'deck',
          score: match.similarity,
        });
      }
    }

    // Merge online fuzzy suggestions with O(1) deck lookup
    for (const s of onlineFuzzySuggestions) {
      const wLower = s.word.toLowerCase();
      if (!exactWords.has(wLower) && !map.has(wLower)) {
        const inDeck = deckWordMap.get(wLower);
        map.set(wLower, {
          ...s,
          source: inDeck ? 'deck' : s.source,
          meaningVi: inDeck ? inDeck.vietnameseDefinition : s.meaningVi,
          pos: inDeck ? (inDeck.pos?.[0] || s.pos) : s.pos,
        });
      }
    }

    return Array.from(map.values())
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 4);
  }, [deferredQuery, exactSuggestions, deckWords, deckWordMap, onlineFuzzySuggestions]);

  // Combined list for keyboard navigation
  const allSelectableWords = useMemo(() => {
    return [
      ...exactSuggestions.map((e) => e.word),
      ...combinedFuzzySuggestions.map((f) => f.word),
    ];
  }, [exactSuggestions, combinedFuzzySuggestions]);

  const handleSelectWord = (word: string) => {
    setQuery(word);
    setIsOpen(false);
    saveToHistory(word);
    onSearch(word);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < allSelectableWords.length) {
      handleSelectWord(allSelectableWords[selectedIndex]);
      return;
    }
    if (query.trim()) {
      handleSelectWord(query.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < allSelectableWords.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allSelectableWords.length - 1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const hasSuggestions = exactSuggestions.length > 0 || combinedFuzzySuggestions.length > 0;

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl mx-auto space-y-2.5">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="pointer-events-none absolute left-3.5 text-slate-400 dark:text-slate-500">
          <Search className="h-4.5 w-4.5" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t.lookup.searchPlaceholder}
          disabled={isLoading}
          autoFocus
          className="w-full rounded-xl border border-slate-200/90 bg-white py-3 pl-11 pr-24 text-sm text-slate-900 shadow-subtle placeholder-slate-400 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-[#121824] dark:text-slate-100 dark:placeholder-slate-500"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setIsOpen(false);
              }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block mr-1 text-[10px] text-slate-400 opacity-70">
              /
            </kbd>
          )}

          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-95 disabled:opacity-40 transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{t.lookup.searching}</span>
              </>
            ) : (
              <>
                <span>{t.lookup.searchBtn}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Autocomplete & Fuzzy Suggestion Dropdown */}
      {isOpen && (hasSuggestions || (query.trim() === '' && history.length > 0)) && (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 p-1.5 shadow-dropdown backdrop-blur-md dark:border-slate-800 dark:bg-[#121824]/95 space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800/80">
          {/* 1. Exact / Substring matches */}
          {exactSuggestions.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t.lookup.instantMatches}
              </div>
              {exactSuggestions.map((item, idx) => {
                const globalIdx = idx;
                const isSelected = selectedIndex === globalIdx;
                return (
                  <button
                    key={item.word}
                    type="button"
                    onClick={() => handleSelectWord(item.word)}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{item.word}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {item.pos}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        — {item.meaningVi}
                      </span>
                    </div>
                    {item.source === 'deck' && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                        {t.lookup.inDeckBadge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 2. Fuzzy / "Có phải bạn muốn tìm:" suggestions */}
          {combinedFuzzySuggestions.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Lightbulb className="h-3.5 w-3.5" />
                <span>{t.lookup.fuzzySuggestionTitle}</span>
              </div>
              {combinedFuzzySuggestions.map((item, idx) => {
                const globalIdx = exactSuggestions.length + idx;
                const isSelected = selectedIndex === globalIdx;
                return (
                  <button
                    key={item.word}
                    type="button"
                    onClick={() => handleSelectWord(item.word)}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
                        : 'text-slate-700 hover:bg-amber-50/60 dark:text-slate-200 dark:hover:bg-amber-950/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-700 dark:text-amber-300 underline decoration-amber-300 dark:decoration-amber-600 underline-offset-2">
                        {item.word}
                      </span>
                      {item.pos && (
                        <span className="rounded bg-amber-100/70 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                          {item.pos}
                        </span>
                      )}
                      {item.meaningVi && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          — {item.meaningVi}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.source === 'deck' ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                          {t.lookup.inDeckBadge}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {t.lookup.spellingSuggestions}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* 3. Recent search history (when input is empty) */}
          {query.trim() === '' && history.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1.5">
                  <History className="h-3 w-3" /> {t.lookup.recentSearches}
                </span>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-[10px] font-normal text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {t.lookup.clearHistory}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 px-1">
                {history.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => handleSelectWord(w)}
                    className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                  >
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span>{w}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick search recommendation chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs text-slate-500 dark:text-slate-400 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 shrink-0">
          <Sparkles className="h-3 w-3 text-indigo-500" />
          {t.lookup.highYieldToeic}
        </span>
        <div className="flex gap-1.5">
          {QUICK_RECOMMENDATIONS.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => handleSelectWord(word)}
              className="rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1 font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-indigo-900 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400 shrink-0"
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
