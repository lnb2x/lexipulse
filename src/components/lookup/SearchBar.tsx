import { Clock, History, Loader2, Search, Sparkles, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { WordItem } from '../../types/vocab';
import { LOCAL_KNOWLEDGE_BASE } from '../../services/dictionary';

interface SearchBarProps {
  onSearch: (word: string) => void;
  isLoading: boolean;
  deckWords?: WordItem[];
}

const QUICK_RECOMMENDATIONS = ['negotiate', 'feasible', 'implement', 'compliance', 'facilitate', 'collaborate', 'perspective', 'innovative'];

const SEARCH_HISTORY_KEY = 'lexipulse_recent_searches';

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading, deckWords = [] }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const wrapperRef = useRef<HTMLDivElement>(null);

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

  // Build ultra-fast instant suggestion list
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const map = new Map<string, { word: string; meaningVi: string; pos: string; source: 'deck' | 'builtin' }>();

    // 1. Deck words match
    for (const w of deckWords) {
      const wLower = w.word.toLowerCase();
      if (wLower.includes(q)) {
        map.set(wLower, {
          word: w.word,
          meaningVi: w.vietnameseDefinition,
          pos: w.pos?.[0] || 'word',
          source: 'deck',
        });
      }
    }

    // 2. Built-in vocabulary match
    for (const [key, data] of Object.entries(LOCAL_KNOWLEDGE_BASE)) {
      if (key.toLowerCase().includes(q) && !map.has(key)) {
        map.set(key, {
          word: key,
          meaningVi: data.vi,
          pos: data.pos?.[0] || 'word',
          source: 'builtin',
        });
      }
    }

    // Sort: exact matches or startsWith first
    return Array.from(map.values())
      .sort((a, b) => {
        const aStarts = a.word.toLowerCase().startsWith(q);
        const bStarts = b.word.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.word.localeCompare(b.word);
      })
      .slice(0, 6);
  }, [query, deckWords]);

  const handleSelectWord = (word: string) => {
    setQuery(word);
    setIsOpen(false);
    saveToHistory(word);
    onSearch(word);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      handleSelectWord(suggestions[selectedIndex].word);
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
      setSelectedIndex((prev) => (prev + 1 < suggestions.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl mx-auto space-y-3">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="pointer-events-none absolute left-4 text-slate-400">
          <Search className="h-5 w-5" />
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
          className="w-full rounded-2xl border border-slate-200/90 bg-white py-4 pl-12 pr-28 text-base text-slate-900 shadow-lg shadow-slate-100 placeholder-slate-400 transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-100 dark:shadow-none dark:placeholder-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
        />

        <div className="absolute right-3 flex items-center gap-1.5">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setIsOpen(false);
              }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
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

      {/* Instant Autocomplete Suggestions / Recent History Dropdown */}
      {isOpen && (suggestions.length > 0 || (query.trim() === '' && history.length > 0)) && (
        <div className="absolute left-0 right-0 top-14 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95">
          {/* Autocomplete items */}
          {suggestions.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t.lookup.instantMatches}
              </div>
              {suggestions.map((item, idx) => (
                <button
                  key={item.word}
                  type="button"
                  onClick={() => handleSelectWord(item.word)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    selectedIndex === idx
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
              ))}
            </div>
          )}

          {/* Recent search history (when input is empty) */}
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
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs text-slate-500 dark:text-slate-400">
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
