import { db } from './db';
import type { WordItem } from '../types/vocab';
import { createInitialReviewMeta } from './sm2';
import { warmSearchCache } from './dictionary';

export type MergePolicy = 'preserve-progress' | 'replace-progress';

export interface SaveWordOptions {
  mergePolicy?: MergePolicy;
  preferIncomingDefinitions?: boolean;
}

export interface BulkUpsertOptions {
  replaceProgress?: boolean;
  batchSize?: number;
}

/**
 * Normalizes vocabulary term for consistent lookup and indexing:
 * - trims surrounding whitespace
 * - converts to lowercase
 * - normalizes Unicode to NFC
 */
export function normalizeWordTerm(term: string): string {
  if (!term) return '';
  return term.trim().toLowerCase().normalize('NFC');
}

/**
 * Merges linguistic content between an existing database record and newly incoming data.
 * Adheres strictly to data preservation rules:
 * - 'preserve-progress' (default): Never overwrites id, createdAt, reviewMeta, history, status, or user notes.
 * - Merges user tags uniquely.
 * - 'replace-progress': Only allowed when user explicitly requests replacing study progress.
 */
export function mergeWordRecords(
  existing: WordItem,
  incoming: Partial<WordItem>,
  options: SaveWordOptions = {}
): WordItem {
  const policy = options.mergePolicy || 'preserve-progress';

  // Merge tags uniquely preserving all existing custom tags
  const existingTags = Array.isArray(existing.tags) ? existing.tags : [];
  const incomingTags = Array.isArray(incoming.tags) ? incoming.tags : [];
  const mergedTags = Array.from(new Set([...existingTags, ...incomingTags]));

  // Merge collocations uniquely by phrase
  const existingCollocations = Array.isArray(existing.collocations) ? existing.collocations : [];
  const incomingCollocations = Array.isArray(incoming.collocations) ? incoming.collocations : [];
  const collocationPhrases = new Set(existingCollocations.map((c) => c.phrase.toLowerCase()));
  const mergedCollocations = [
    ...existingCollocations,
    ...incomingCollocations.filter((c) => !collocationPhrases.has(c.phrase.toLowerCase())),
  ];

  // Merge word families uniquely by word + pos
  const existingWf = Array.isArray(existing.wordFamily) ? existing.wordFamily : [];
  const incomingWf = Array.isArray(incoming.wordFamily) ? incoming.wordFamily : [];
  const wfKeys = new Set(existingWf.map((w) => `${w.word.toLowerCase()}-${w.pos}`));
  const mergedWf = [
    ...existingWf,
    ...incomingWf.filter((w) => !wfKeys.has(`${w.word.toLowerCase()}-${w.pos}`)),
  ];

  // Merge examples uniquely by English sentence text
  const existingExamples = Array.isArray(existing.examples) ? existing.examples : [];
  const incomingExamples = Array.isArray(incoming.examples) ? incoming.examples : [];
  const exampleKeys = new Set(existingExamples.map((e) => e.en.trim().toLowerCase()));
  const mergedExamples = [
    ...existingExamples,
    ...incomingExamples.filter((e) => !exampleKeys.has(e.en.trim().toLowerCase())),
  ];

  const mergedPhonetics = {
    us: incoming.phonetics?.us || existing.phonetics?.us || '',
    uk: incoming.phonetics?.uk || existing.phonetics?.uk || '',
  };

  const vietnameseDef = incoming.vietnameseDefinition && incoming.vietnameseDefinition.trim()
    ? incoming.vietnameseDefinition
    : existing.vietnameseDefinition;

  const englishDef = incoming.englishDefinition && incoming.englishDefinition.trim()
    ? incoming.englishDefinition
    : existing.englishDefinition;

  const meanings = incoming.meanings && incoming.meanings.length > 0
    ? incoming.meanings
    : existing.meanings || [];

  const pos = incoming.pos && incoming.pos.length > 0
    ? incoming.pos
    : existing.pos || ['noun'];

  if (policy === 'replace-progress') {
    return {
      ...existing,
      ...incoming,
      id: existing.id,
      word: existing.word,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
      status: incoming.status || 'new',
      reviewMeta: incoming.reviewMeta || createInitialReviewMeta(),
      notes: incoming.notes !== undefined ? incoming.notes : existing.notes,
      tags: mergedTags,
      phonetics: mergedPhonetics,
      vietnameseDefinition: vietnameseDef,
      englishDefinition: englishDef,
      meanings,
      collocations: mergedCollocations,
      wordFamily: mergedWf,
      examples: mergedExamples,
      pos,
    };
  }

  // Default: preserve-progress
  return {
    ...existing,
    id: existing.id,
    word: existing.word,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
    // Preserve learning status & review history
    status: existing.status,
    reviewMeta: existing.reviewMeta,
    notes: existing.notes !== undefined && existing.notes !== '' ? existing.notes : incoming.notes,
    tags: mergedTags,
    // Update linguistic enrichments
    phonetics: mergedPhonetics,
    vietnameseDefinition: vietnameseDef,
    englishDefinition: englishDef,
    meanings,
    collocations: mergedCollocations,
    wordFamily: mergedWf,
    examples: mergedExamples,
    pos,
  };
}

/**
 * Finds a word in IndexedDB by normalized term.
 */
export async function findWordByTerm(term: string): Promise<WordItem | undefined> {
  const normalized = normalizeWordTerm(term);
  if (!normalized) return undefined;
  return await db.words.where('word').equals(normalized).first();
}

/**
 * Finds a word by its primary ID.
 */
export async function getWordById(id: string): Promise<WordItem | undefined> {
  if (!id) return undefined;
  return await db.words.get(id);
}

/**
 * Unified entry point for adding or updating a word in the database.
 * Completely replaces direct calls to db.words.put() from UI components.
 */
export async function saveOrUpdateWord(
  word: WordItem,
  options: SaveWordOptions = {}
): Promise<{ word: WordItem; isNew: boolean }> {
  const normalized = normalizeWordTerm(word.word);
  if (!normalized) {
    throw new Error('Word term cannot be empty');
  }

  let finalRecord: WordItem;
  let isNew = false;

  await db.transaction('rw', db.words, async () => {
    const existing = await db.words.where('word').equals(normalized).first();

    if (existing) {
      finalRecord = mergeWordRecords(existing, word, options);
      await db.words.put(finalRecord);
      isNew = false;
    } else {
      const finalId =
        word.id && word.id.trim()
          ? word.id
          : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `word-${crypto.randomUUID()}`
            : `word-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      finalRecord = {
        ...word,
        id: finalId,
        word: normalized,
        status: word.status || 'new',
        createdAt: word.createdAt && !isNaN(word.createdAt) ? word.createdAt : Date.now(),
        updatedAt: Date.now(),
        reviewMeta: word.reviewMeta || createInitialReviewMeta(),
        tags: Array.isArray(word.tags) ? word.tags : ['#Manual'],
        collocations: Array.isArray(word.collocations) ? word.collocations : [],
        wordFamily: Array.isArray(word.wordFamily) ? word.wordFamily : [],
        examples: Array.isArray(word.examples) ? word.examples : [],
        meanings: Array.isArray(word.meanings) ? word.meanings : [],
        pos: Array.isArray(word.pos) && word.pos.length > 0 ? word.pos : ['noun'],
      };
      await db.words.put(finalRecord);
      isNew = true;
    }
  });

  // Sync to memory cache
  warmSearchCache([finalRecord!]);
  return { word: finalRecord!, isNew };
}

/**
 * Bulk upserts an array of words atomically within a Dexie transaction.
 * Defaults to 'preserve-progress', ensuring existing user progress is never overwritten.
 */
export async function bulkUpsertWords(
  words: WordItem[],
  options: BulkUpsertOptions = {}
): Promise<{ added: number; updated: number; skipped: number }> {
  if (!words || words.length === 0) {
    return { added: 0, updated: 0, skipped: 0 };
  }

  const policy: MergePolicy = options.replaceProgress ? 'replace-progress' : 'preserve-progress';
  let added = 0;
  let updated = 0;
  let skipped = 0;

  await db.transaction('rw', db.words, async () => {
    // Map existing records for fast matching
    const normalizedTerms = words
      .map((w) => normalizeWordTerm(w.word))
      .filter((w) => Boolean(w));

    const existingWords = await db.words.where('word').anyOf(normalizedTerms).toArray();
    const existingMap = new Map(existingWords.map((w) => [w.word, w]));

    const recordsToPut: WordItem[] = [];

    for (const item of words) {
      const normalized = normalizeWordTerm(item.word);
      if (!normalized) {
        skipped++;
        continue;
      }

      const existing = existingMap.get(normalized);
      if (existing) {
        const merged = mergeWordRecords(existing, item, { mergePolicy: policy });
        recordsToPut.push(merged);
        existingMap.set(normalized, merged); // Update in-memory map for duplicate entries in the same batch
        updated++;
      } else {
        const finalId =
          item.id && item.id.trim()
            ? item.id
            : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? `word-${crypto.randomUUID()}`
              : `word-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        const newRecord: WordItem = {
          ...item,
          id: finalId,
          word: normalized,
          status: item.status || 'new',
          createdAt: item.createdAt && !isNaN(item.createdAt) ? item.createdAt : Date.now(),
          updatedAt: Date.now(),
          reviewMeta: item.reviewMeta || createInitialReviewMeta(),
          tags: Array.isArray(item.tags) ? item.tags : ['#Imported'],
          collocations: Array.isArray(item.collocations) ? item.collocations : [],
          wordFamily: Array.isArray(item.wordFamily) ? item.wordFamily : [],
          examples: Array.isArray(item.examples) ? item.examples : [],
          meanings: Array.isArray(item.meanings) ? item.meanings : [],
          pos: Array.isArray(item.pos) && item.pos.length > 0 ? item.pos : ['noun'],
        };
        recordsToPut.push(newRecord);
        existingMap.set(normalized, newRecord);
        added++;
      }
    }

    if (recordsToPut.length > 0) {
      await db.words.bulkPut(recordsToPut);
    }
  });

  return { added, updated, skipped };
}

/**
 * Updates user personal notes for a word.
 */
export async function updateWordNotes(id: string, notes: string): Promise<void> {
  await db.words.update(id, { notes, updatedAt: Date.now() });
}

/**
 * Updates tags for a word.
 */
export async function updateWordTags(id: string, tags: string[]): Promise<void> {
  await db.words.update(id, { tags, updatedAt: Date.now() });
}

/**
 * Deletes a word by id.
 */
export async function deleteWord(id: string): Promise<void> {
  await db.words.delete(id);
}

export interface ImportDeckOptions {
  replaceProgress?: boolean;
}

/**
 * Imports words from a JSON string.
 * Preserves user learning progress by default unless replaceProgress is explicitly enabled.
 */
export async function importDeckFromJson(
  jsonString: string,
  options: ImportDeckOptions = {}
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      throw new Error('Import data must be a JSON array of vocabulary cards');
    }

    const validItems: WordItem[] = [];
    let skipped = 0;

    for (const item of parsed) {
      if (!item.word || typeof item.word !== 'string') {
        skipped++;
        continue;
      }

      const wordLower = normalizeWordTerm(item.word);
      const wordRecord: WordItem = {
        id: item.id || `word-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        word: wordLower,
        phonetics: item.phonetics || {},
        pos: Array.isArray(item.pos) && item.pos.length > 0 ? item.pos : ['noun'],
        vietnameseDefinition: item.vietnameseDefinition || item.meaningVi || 'Chưa có định nghĩa',
        englishDefinition: item.englishDefinition || item.definition || '',
        meanings: Array.isArray(item.meanings) ? item.meanings : [],
        collocations: Array.isArray(item.collocations) ? item.collocations : [],
        wordFamily: Array.isArray(item.wordFamily) ? item.wordFamily : [],
        examples: Array.isArray(item.examples) ? item.examples : [],
        tags: Array.isArray(item.tags) ? item.tags : ['#Imported'],
        status: item.status || 'new',
        notes: item.notes || '',
        createdAt: item.createdAt || Date.now(),
        updatedAt: Date.now(),
        reviewMeta: item.reviewMeta || createInitialReviewMeta(),
      };
      validItems.push(wordRecord);
    }

    const res = await bulkUpsertWords(validItems, { replaceProgress: options.replaceProgress });
    return { imported: res.added + res.updated, skipped: skipped + res.skipped, errors };
  } catch (err: any) {
    errors.push(err.message || 'Failed to parse JSON file');
    return { imported: 0, skipped: 0, errors };
  }
}
