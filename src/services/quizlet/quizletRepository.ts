import { db } from '../db';
import type {
  QuizletReconciledWord,
  QuizletSetRecord,
  QuizletSetRef,
  WordItem,
} from '../../types/vocab';
import { bulkUpsertWords, normalizeWordTerm } from '../vocabRepository';
import { runBulkEnrichment, createUnenrichedWordItem } from '../bulkEnrichment';
import { runEnrichmentPipeline } from '../enrichmentPipeline';
import type { ParsedImportItem } from '../../utils/importParser';

/**
 * Saves or updates Quizlet set metadata in Dexie.
 */
export async function saveQuizletSetMetadata(set: QuizletSetRecord): Promise<void> {
  await db.quizletSets.put({
    ...set,
    updatedAt: Date.now(),
  });
}

/**
 * Retrieves all saved Quizlet sets ordered by updatedAt descending.
 */
export async function getAllQuizletSets(): Promise<QuizletSetRecord[]> {
  try {
    return await db.quizletSets.orderBy('updatedAt').reverse().toArray();
  } catch {
    return [];
  }
}

/**
 * Retrieves a specific Quizlet set by ID.
 */
export async function getQuizletSetById(id: string): Promise<QuizletSetRecord | undefined> {
  try {
    return await db.quizletSets.get(id);
  } catch {
    return undefined;
  }
}

/**
 * Deletes a Quizlet set record and unlinks its ID from words (without deleting the vocabulary words).
 */
export async function deleteQuizletSet(setId: string): Promise<void> {
  await db.transaction('rw', [db.quizletSets, db.words], async () => {
    await db.quizletSets.delete(setId);

    // Find all words linked to this set
    const allWords = await db.words.toArray();
    const wordsToUpdate: WordItem[] = [];

    for (const w of allWords) {
      const hasId = w.quizletSetIds && w.quizletSetIds.includes(setId);
      const hasRef = w.quizletSets && w.quizletSets.some((s) => s.id === setId);

      if (hasId || hasRef) {
        wordsToUpdate.push({
          ...w,
          quizletSetIds: w.quizletSetIds?.filter((id) => id !== setId),
          quizletSets: w.quizletSets?.filter((s) => s.id !== setId),
          updatedAt: Date.now(),
        });
      }
    }

    if (wordsToUpdate.length > 0) {
      await db.words.bulkPut(wordsToUpdate);
    }
  });
}

/**
 * Finds all words in IndexedDB that belong to a specific Quizlet set ID.
 */
export async function getWordsByQuizletSet(setId: string): Promise<WordItem[]> {
  if (!setId) return [];
  try {
    // Try fast multi-entry index lookup
    const indexedWords = await db.words.where('quizletSetIds').equals(setId).toArray();
    if (indexedWords.length > 0) {
      return indexedWords;
    }
  } catch {
    // Fallback table scan if index is updating
  }

  // Robust scan fallback
  const allWords = await db.words.toArray();
  return allWords.filter(
    (w) =>
      (w.quizletSetIds && w.quizletSetIds.includes(setId)) ||
      (w.quizletSets && w.quizletSets.some((s) => s.id === setId)) ||
      (w.tags && w.tags.includes(`#quizlet:${setId}`))
  );
}

/**
 * Idempotently links a Quizlet set reference to existing words without altering
 * their review status, FSRS parameters, or custom definitions.
 */
export async function linkWordsToQuizletSet(
  words: WordItem[],
  setRef: QuizletSetRef
): Promise<WordItem[]> {
  if (!words || words.length === 0) return [];

  const updatedWords: WordItem[] = [];

  await db.transaction('rw', db.words, async () => {
    for (const w of words) {
      const fresh = (await db.words.get(w.id)) || w;
      const existingSetIds = Array.isArray(fresh.quizletSetIds) ? fresh.quizletSetIds : [];
      const existingSets = Array.isArray(fresh.quizletSets) ? fresh.quizletSets : [];

      const hasId = existingSetIds.includes(setRef.id);
      const hasRef = existingSets.some((s) => s.id === setRef.id);

      if (!hasId || !hasRef) {
        const nextSetIds = hasId ? existingSetIds : [...existingSetIds, setRef.id];
        const nextSets = hasRef
          ? existingSets
          : [...existingSets.filter((s) => s.id !== setRef.id), setRef];

        const updated: WordItem = {
          ...fresh,
          quizletSetIds: nextSetIds,
          quizletSets: nextSets,
          updatedAt: Date.now(),
        };
        await db.words.put(updated);
        updatedWords.push(updated);
      } else {
        updatedWords.push(fresh);
      }
    }
  });

  return updatedWords;
}

/**
 * Saves new words from Quizlet into LexiPulse deck:
 * - Links to Quizlet set
 * - Preserves Quizlet definition
 * - Optionally enriches linguistic data (phonetics, collocations, examples)
 * - Guarantees zero overwrite of existing cards or learning schedules
 */
export async function saveNewQuizletWords(params: {
  items: QuizletReconciledWord[];
  setRef: QuizletSetRef;
  autoEnrich: boolean;
  tags?: string[];
  abortSignal?: AbortSignal;
  onProgress?: (progress: { current: number; total: number; word: string }) => void;
}): Promise<{ savedCount: number; savedWords: WordItem[] }> {
  const { items, setRef, autoEnrich, abortSignal, onProgress } = params;
  if (!items || items.length === 0) {
    return { savedCount: 0, savedWords: [] };
  }

  const baseTags = params.tags && params.tags.length > 0 ? params.tags : ['#Quizlet'];
  const setTag = `#quizlet:${setRef.id}`;
  const finalTags = Array.from(new Set([...baseTags, setTag]));
  const now = Date.now();

  const parsedItems: ParsedImportItem[] = items.map((item) => ({
    rawWord: item.term,
    word: item.normalizedTerm || normalizeWordTerm(item.term),
    userMeaning: item.definition,
  }));

  let savedWords: WordItem[] = [];

  const itemMap = new Map<string, QuizletReconciledWord>();
  for (const item of items) {
    itemMap.set(item.term.toLowerCase(), item);
    if (item.normalizedTerm) {
      itemMap.set(item.normalizedTerm.toLowerCase(), item);
    }
  }

  if (autoEnrich) {
    // Run enrichment pipeline with AI integration and context-preserving userMeaning
    await runBulkEnrichment(parsedItems, {
      concurrency: 2,
      timeoutMs: 12000,
      tags: finalTags,
      createdAt: now,
      abortSignal,
      lookupFn: async (w, signal) => {
        const matched = itemMap.get(w.toLowerCase());
        const userMeaning = matched?.definition;
        const pipelineResult = await runEnrichmentPipeline({
          query: w,
          userMeaning,
          signal,
        });
        return pipelineResult.word;
      },
      onProgress: (p) => {
        onProgress?.({
          current: p.current,
          total: p.total,
          word: p.currentWord,
        });
      },
    });

    // Retrieve the saved items from DB and attach Quizlet metadata & raw provenance
    const terms = items.map((i) => i.normalizedTerm || normalizeWordTerm(i.term));
    const newlyAdded = await db.words.where('word').anyOf(terms).toArray();
    const wordsWithMetadata = newlyAdded.map((w) => {
      const matched = itemMap.get(w.word.toLowerCase());
      if (!matched) return w;
      return {
        ...w,
        rawQuizletTerm: matched.rawTerm || matched.term,
        rawQuizletDefinition: matched.rawDefinition || matched.definition,
        pos: (w.pos && w.pos.length > 0) ? w.pos : (matched.extractedPos || []),
        phonetics: w.phonetics?.us ? w.phonetics : (matched.extractedIpa ? { us: matched.extractedIpa } : w.phonetics),
      };
    });
    savedWords = await linkWordsToQuizletSet(wordsWithMetadata, setRef);
  } else {
    // Fast basic unenriched import
    const unenrichedWords: WordItem[] = items.map((item) => {
      const parsedItem: ParsedImportItem = {
        rawWord: item.term,
        word: item.term,
        userMeaning: item.definition,
        userPos: item.extractedPos?.[0],
      };
      const base = createUnenrichedWordItem(parsedItem, finalTags, now, 'manual');
      return {
        ...base,
        pos: item.extractedPos || base.pos,
        phonetics: item.extractedIpa ? { us: item.extractedIpa } : base.phonetics,
        rawQuizletTerm: item.rawTerm || item.term,
        rawQuizletDefinition: item.rawDefinition || item.definition,
        quizletSetIds: [setRef.id],
        quizletSets: [setRef],
      };
    });

    await bulkUpsertWords(unenrichedWords, { replaceProgress: false });
    savedWords = unenrichedWords;
  }

  return {
    savedCount: savedWords.length,
    savedWords,
  };
}

/**
 * Updates a word with 'needs_review' status based on user's resolution choice.
 */
export async function resolveNeedsReviewWord(
  item: QuizletReconciledWord,
  choice: 'keep_existing' | 'use_quizlet' | 'merge',
  setRef: QuizletSetRef
): Promise<WordItem | undefined> {
  const normTerm = item.normalizedTerm || normalizeWordTerm(item.term);
  const existing = item.existingWord || (await db.words.where('word').equals(normTerm).first());
  if (!existing) return undefined;

  let newDefinition = existing.vietnameseDefinition;
  let isUserEdited = existing.isUserEdited;

  if (choice === 'use_quizlet') {
    newDefinition = item.definition;
    isUserEdited = true;
  } else if (choice === 'merge') {
    const existingClean = (existing.vietnameseDefinition || '').trim();
    const quizletClean = item.definition.trim();
    if (existingClean && quizletClean && existingClean !== quizletClean) {
      newDefinition = `${existingClean}; ${quizletClean}`;
    } else {
      newDefinition = quizletClean || existingClean;
    }
    isUserEdited = true;
  }

  const existingSetIds = Array.isArray(existing.quizletSetIds) ? existing.quizletSetIds : [];
  const existingSets = Array.isArray(existing.quizletSets) ? existing.quizletSets : [];

  const updated: WordItem = {
    ...existing,
    vietnameseDefinition: newDefinition,
    isUserEdited,
    quizletSetIds: Array.from(new Set([...existingSetIds, setRef.id])),
    quizletSets: [
      ...existingSets.filter((s) => s.id !== setRef.id),
      setRef,
    ],
    updatedAt: Date.now(),
  };

  await db.words.put(updated);
  return updated;
}
