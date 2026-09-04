import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useState } from 'react';
import { db } from '../services/db';
import { warmSearchCache } from '../services/dictionary';
import { createInitialReviewMeta } from '../services/sm2';
import type { FilterOptions, WordItem } from '../types/vocab';
import { formatLocalDate } from '../utils/dateUtils';
import { findFuzzyMatches } from '../utils/fuzzySearch';

export function useVocabulary() {
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => {
    setRevision((r) => r + 1);
  }, []);

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    search: '',
    tags: [],
    status: 'all',
    sortBy: 'urgency',
    sortDirection: 'asc',
  });

  // Query all words reactively from Dexie with revision dependency
  const allWords = useLiveQuery(async () => {
    return await db.words.toArray();
  }, [revision]) || [];

  // Extract all unique tags with count
  const allTags = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of allWords) {
      for (const t of w.tags) {
        const normalized = t.startsWith('#') ? t : `#${t}`;
        map.set(normalized, (map.get(normalized) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [allWords]);

  // Extract all unique creation dates with count (formatted in user's local timezone)
  const availableDates = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of allWords) {
      const d = formatLocalDate(w.createdAt);
      map.set(d, (map.get(d) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allWords]);

  // Filter and sort words
  const { filteredWords, isFuzzyMatch } = useMemo(() => {
    let result = [...allWords];
    let isFuzzy = false;

    // Search filter (word, definition, collocations)
    if (filterOptions.search.trim()) {
      const q = filterOptions.search.trim().toLowerCase();
      result = result.filter((w) => {
        return (
          w.word.toLowerCase().includes(q) ||
          w.vietnameseDefinition.toLowerCase().includes(q) ||
          w.englishDefinition.toLowerCase().includes(q) ||
          w.tags.some((t) => t.toLowerCase().includes(q)) ||
          w.collocations.some((c) => c.phrase.toLowerCase().includes(q) || c.meaningVi.toLowerCase().includes(q))
        );
      });

      // If exact search yields 0 results and query is at least 2 chars, try fuzzy search on deck words
      if (result.length === 0 && q.length >= 2) {
        const fuzzyMatches = findFuzzyMatches(q, allWords, (w) => w.word, 0.60, 10);
        if (fuzzyMatches.length > 0) {
          result = fuzzyMatches.map((m) => m.item);
          isFuzzy = true;
        }
      }
    }

    // Status filter
    if (filterOptions.status !== 'all') {
      result = result.filter((w) => w.status === filterOptions.status);
    }

    // Date filter (createdDate 'YYYY-MM-DD' in user's local timezone)
    if (filterOptions.createdDate) {
      result = result.filter((w) => {
        const d = formatLocalDate(w.createdAt);
        return d === filterOptions.createdDate;
      });
    }

    // Tags filter (must match any of selected tags)
    if (filterOptions.tags.length > 0) {
      result = result.filter((w) =>
        filterOptions.tags.some((selectedTag) =>
          w.tags.some((t) => t.toLowerCase() === selectedTag.toLowerCase())
        )
      );
    }

    // Sort (preserve fuzzy relevance ordering if fuzzy, otherwise apply user sort)
    if (!isFuzzy) {
      result.sort((a, b) => {
        let comparison = 0;
        if (filterOptions.sortBy === 'urgency') {
          // Due date ascending: overdue cards first
          comparison = a.reviewMeta.dueDate - b.reviewMeta.dueDate;
        } else if (filterOptions.sortBy === 'date_added') {
          // Newest created first
          comparison = b.createdAt - a.createdAt;
        } else if (filterOptions.sortBy === 'alpha') {
          // Alphabetical A-Z
          comparison = a.word.localeCompare(b.word);
        } else if (filterOptions.sortBy === 'repetition') {
          comparison = a.reviewMeta.repetition - b.reviewMeta.repetition;
        }

        return filterOptions.sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    return { filteredWords: result, isFuzzyMatch: isFuzzy };
  }, [allWords, filterOptions]);

  // Summary counts
  const stats = useMemo(() => {
    const now = Date.now();
    let dueCount = 0;
    let newCount = 0;
    let learningCount = 0;
    let masteredCount = 0;

    for (const w of allWords) {
      if (w.status === 'mastered') masteredCount++;
      else if (w.status === 'new') newCount++;
      else if (w.status === 'learning') learningCount++;

      if (w.reviewMeta.dueDate <= now) dueCount++;
    }

    return {
      total: allWords.length,
      due: dueCount,
      new: newCount,
      learning: learningCount,
      mastered: masteredCount,
    };
  }, [allWords]);

  // Operations
  const addWord = async (word: WordItem): Promise<boolean> => {
    const normalizedWord = word.word.trim().toLowerCase();
    if (!normalizedWord) return false;

    const existing = await db.words.where('word').equals(normalizedWord).first();
    let isNew = false;

    if (existing) {
      await db.words.put({
        ...existing,
        ...word,
        id: existing.id,
        word: normalizedWord,
        updatedAt: Date.now(),
      });
      isNew = false;
    } else {
      let finalId = word.id;
      if (!finalId || (await db.words.get(finalId))) {
        finalId = `word-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      }

      await db.words.put({
        ...word,
        id: finalId,
        word: normalizedWord,
        status: word.status || 'new',
        createdAt: word.createdAt && !isNaN(word.createdAt) ? word.createdAt : Date.now(),
        updatedAt: Date.now(),
        reviewMeta: word.reviewMeta || createInitialReviewMeta(),
      });
      isNew = true;
    }

    warmSearchCache([word]);
    refresh();
    return isNew;
  };

  const updateWord = async (word: WordItem): Promise<void> => {
    const normalizedWord = word.word.trim().toLowerCase();
    await db.words.put({
      ...word,
      word: normalizedWord,
      updatedAt: Date.now(),
    });
    warmSearchCache([word]);
    refresh();
  };

  const deleteWord = async (id: string): Promise<void> => {
    await db.words.delete(id);
    refresh();
  };

  const isWordInDeck = (word: string): boolean => {
    return allWords.some((w) => w.word.toLowerCase() === word.trim().toLowerCase());
  };

  return {
    allWords,
    filteredWords,
    words: filteredWords,
    isFuzzyMatch,
    loading: false,
    refresh,
    allTags,
    availableDates,
    stats,
    filterOptions,
    setFilterOptions,
    addWord,
    updateWord,
    deleteWord,
    isWordInDeck,
  };
}
