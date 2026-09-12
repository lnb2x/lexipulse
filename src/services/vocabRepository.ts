import { db } from './db';
import type { DailyStats, WordItem } from '../types/vocab';
import { createInitialReviewMeta, migrateLegacyMetaToFSRS } from './fsrs/fsrsService';
import { saveAppSettings } from './db/statsRepo';
import { warmSearchCache } from './dictionary';
import { isPlaceholderDefinition } from './quizlet/quizletNormalizer';

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
  const getCollocPhrase = (c: any) =>
    (typeof c === 'string' ? c : (c?.phrase || '')).trim().toLowerCase();
  const collocationPhrases = new Set(existingCollocations.map(getCollocPhrase));
  const mergedCollocations = [
    ...existingCollocations,
    ...incomingCollocations.filter((c) => !collocationPhrases.has(getCollocPhrase(c))),
  ];

  // Merge word families uniquely by word + pos, never repeating the term itself
  const existingWf = Array.isArray(existing.wordFamily) ? existing.wordFamily : [];
  const incomingWf = Array.isArray(incoming.wordFamily) ? incoming.wordFamily : [];
  const wfKeys = new Set(existingWf.map((w) => `${w.word.toLowerCase()}-${w.pos}`));
  const cleanWordLower = existing.word.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
  const mergedWf = [
    ...existingWf,
    ...incomingWf.filter((w) => !wfKeys.has(`${w.word.toLowerCase()}-${w.pos}`)),
  ].filter((wf) => {
    const famClean = wf.word.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
    return famClean !== cleanWordLower;
  });

  // Merge examples uniquely by English sentence text
  const existingExamples = Array.isArray(existing.examples) ? existing.examples : [];
  const incomingExamples = Array.isArray(incoming.examples) ? incoming.examples : [];
  const getExampleEn = (e: any) =>
    (typeof e === 'string' ? e : (e?.en || e?.sentence || '')).trim().toLowerCase();
  const exampleKeys = new Set(existingExamples.map(getExampleEn));
  const mergedExamples = [
    ...existingExamples,
    ...incomingExamples.filter((e) => !exampleKeys.has(getExampleEn(e))),
  ];

  const mergedPhonetics = {
    us: incoming.phonetics?.us || existing.phonetics?.us || '',
    uk: incoming.phonetics?.uk || existing.phonetics?.uk || '',
    audioUs: incoming.phonetics?.audioUs !== undefined && incoming.phonetics.audioUs !== ''
      ? incoming.phonetics.audioUs
      : existing.phonetics?.audioUs,
    audioUk: incoming.phonetics?.audioUk !== undefined && incoming.phonetics.audioUk !== ''
      ? incoming.phonetics.audioUk
      : existing.phonetics?.audioUk,
  };

  // Protect user-edited and valid AI Vietnamese definition from background/dictionary overwrite
  const isExistingUserEdited = Boolean(
    existing.isUserEdited ||
    existing.vietnameseDefinitionProvenance?.isUserEdited ||
    (typeof existing.vietnameseDefinitionProvenance === 'object' && existing.vietnameseDefinitionProvenance?.source === 'user_edit') ||
    (existing.vietnameseDefinitionProvenance as unknown) === 'user_edit'
  );
  const isIncomingUserEdited = Boolean(
    incoming.isUserEdited ||
    incoming.vietnameseDefinitionProvenance?.isUserEdited ||
    (typeof incoming.vietnameseDefinitionProvenance === 'object' && incoming.vietnameseDefinitionProvenance?.source === 'user_edit') ||
    (incoming.vietnameseDefinitionProvenance as unknown) === 'user_edit'
  );
  const isExistingAiProtected = Boolean(
    (existing.vietnameseDefinitionProvenance?.source === 'ai' || existing.source === 'ai') &&
    existing.vietnameseDefinition &&
    !isPlaceholderDefinition(existing.vietnameseDefinition)
  );
  const isIncomingAi = Boolean(
    incoming.vietnameseDefinitionProvenance?.source === 'ai' || incoming.source === 'ai'
  );
  const isIncomingPlaceholder = isPlaceholderDefinition(incoming.vietnameseDefinition);

  let vietnameseDef = existing.vietnameseDefinition;
  let mergedProvenance = existing.vietnameseDefinitionProvenance;

  // Allow overwrite if:
  // - User requested replace-progress
  // - Incoming is user-edited
  // - Existing is NOT user-edited, AND (existing is not AI-protected OR incoming is a new valid AI translation), AND incoming is not placeholder
  const canOverwriteDef = Boolean(
    policy === 'replace-progress' ||
    isIncomingUserEdited ||
    (!isExistingUserEdited && (!isExistingAiProtected || isIncomingAi) && !isIncomingPlaceholder)
  );

  if (canOverwriteDef && incoming.vietnameseDefinition && incoming.vietnameseDefinition.trim()) {
    vietnameseDef = incoming.vietnameseDefinition.trim();
    mergedProvenance = incoming.vietnameseDefinitionProvenance || (
      isIncomingUserEdited
        ? { source: 'user_edit', isUserEdited: true, createdAt: Date.now() }
        : isIncomingAi
          ? { source: 'ai', createdAt: Date.now() }
          : existing.vietnameseDefinitionProvenance
    );
  }

  const englishDef = incoming.englishDefinition && incoming.englishDefinition.trim() && !isPlaceholderDefinition(incoming.englishDefinition)
    ? incoming.englishDefinition.trim()
    : existing.englishDefinition && !isPlaceholderDefinition(existing.englishDefinition)
      ? existing.englishDefinition
      : '';

  const meanings = incoming.meanings && incoming.meanings.length > 0
    ? incoming.meanings
    : existing.meanings || [];

  const pos = incoming.pos && incoming.pos.length > 0
    ? incoming.pos
    : existing.pos || ['noun'];

  // Merge linked variants uniquely
  const existingVariants = Array.isArray(existing.linkedVariants) ? existing.linkedVariants : [];
  const incomingVariants = Array.isArray(incoming.linkedVariants) ? incoming.linkedVariants : [];
  const mergedVariants = Array.from(new Set([...existingVariants, ...incomingVariants]));

  // Merge form labels uniquely
  const existingFormLabels = Array.isArray(existing.formLabels) ? existing.formLabels : [];
  const incomingFormLabels = Array.isArray(incoming.formLabels) ? incoming.formLabels : [];
  const mergedFormLabels = Array.from(new Set([...existingFormLabels, ...incomingFormLabels]));

  const lemma = incoming.lemma || existing.lemma;
  const originalInput = incoming.originalInput || existing.originalInput;
  const contextSentence = incoming.contextSentence || existing.contextSentence;
  const inflections = incoming.inflections || existing.inflections;

  // Merge quizletSetIds uniquely
  const existingSetIds = Array.isArray(existing.quizletSetIds) ? existing.quizletSetIds : [];
  const incomingSetIds = Array.isArray(incoming.quizletSetIds) ? incoming.quizletSetIds : [];
  const mergedSetIds = Array.from(new Set([...existingSetIds, ...incomingSetIds]));

  // Merge quizletSets uniquely by set id
  const existingSets = Array.isArray(existing.quizletSets) ? existing.quizletSets : [];
  const incomingSets = Array.isArray(incoming.quizletSets) ? incoming.quizletSets : [];
  const setMap = new Map(existingSets.map((s) => [s.id, s]));
  for (const s of incomingSets) {
    setMap.set(s.id, s);
  }
  const mergedSets = Array.from(setMap.values());

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
      vietnameseDefinitionProvenance: mergedProvenance,
      englishDefinition: englishDef,
      meanings,
      collocations: mergedCollocations,
      wordFamily: mergedWf,
      examples: mergedExamples,
      pos,
      lemma,
      originalInput,
      formLabels: mergedFormLabels.length > 0 ? mergedFormLabels : undefined,
      linkedVariants: mergedVariants.length > 0 ? mergedVariants : undefined,
      contextSentence,
      inflections,
      quizletSetIds: mergedSetIds.length > 0 ? mergedSetIds : undefined,
      quizletSets: mergedSets.length > 0 ? mergedSets : undefined,
      rawQuizletTerm: incoming.rawQuizletTerm || existing.rawQuizletTerm,
      rawQuizletDefinition: incoming.rawQuizletDefinition || existing.rawQuizletDefinition,
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
    vietnameseDefinitionProvenance: mergedProvenance,
    englishDefinition: englishDef,
    meanings,
    collocations: mergedCollocations,
    wordFamily: mergedWf,
    examples: mergedExamples,
    pos,
    lemma,
    originalInput,
    formLabels: mergedFormLabels.length > 0 ? mergedFormLabels : undefined,
    linkedVariants: mergedVariants.length > 0 ? mergedVariants : undefined,
    contextSentence,
    inflections,
    quizletSetIds: mergedSetIds.length > 0 ? mergedSetIds : undefined,
    quizletSets: mergedSets.length > 0 ? mergedSets : undefined,
    rawQuizletTerm: incoming.rawQuizletTerm || existing.rawQuizletTerm,
    rawQuizletDefinition: incoming.rawQuizletDefinition || existing.rawQuizletDefinition,
  };
}

/**
 * Finds a word in IndexedDB by normalized term.
 * Optionally matches by specific POS or meaning when multiple records exist for the same term.
 */
export async function findWordByTerm(
  term: string,
  pos?: string,
  meaning?: string
): Promise<WordItem | undefined> {
  const normalized = normalizeWordTerm(term);
  if (!normalized) return undefined;

  const matches = await db.words.where('word').equals(normalized).toArray();
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  // If multiple candidates exist, match by POS if provided
  if (pos) {
    const cleanPos = pos.toLowerCase();
    const posMatch = matches.find((m) => m.pos && m.pos.some((p) => p.toLowerCase() === cleanPos));
    if (posMatch) return posMatch;
  }

  // Match by meaning if provided
  if (meaning) {
    const cleanMeaning = meaning.trim().toLowerCase();
    const meaningMatch = matches.find(
      (m) =>
        m.vietnameseDefinition &&
        (m.vietnameseDefinition.toLowerCase().includes(cleanMeaning) ||
          cleanMeaning.includes(m.vietnameseDefinition.toLowerCase()))
    );
    if (meaningMatch) return meaningMatch;
  }

  // Fallback: prefer protected AI or user-edited record
  const protectedMatch = matches.find(
    (m) =>
      m.isUserEdited ||
      m.vietnameseDefinitionProvenance?.isUserEdited ||
      m.vietnameseDefinitionProvenance?.source === 'ai'
  );
  if (protectedMatch) return protectedMatch;

  return matches[0];
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

      const cleanedEnDef = isPlaceholderDefinition(word.englishDefinition) ? '' : (word.englishDefinition || '');
      const cleanedViDef = isPlaceholderDefinition(word.vietnameseDefinition) ? '' : (word.vietnameseDefinition || '');
      const rawFamilies = Array.isArray(word.wordFamily) ? word.wordFamily : [];
      const cleanWordLower = normalized.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
      const cleanedWordFamily = rawFamilies.filter((wf) => {
        const famClean = wf.word.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
        return famClean !== cleanWordLower;
      });

      finalRecord = {
        ...word,
        id: finalId,
        word: normalized,
        englishDefinition: cleanedEnDef,
        vietnameseDefinition: cleanedViDef,
        status: word.status || 'new',
        createdAt: word.createdAt && !isNaN(word.createdAt) ? word.createdAt : Date.now(),
        updatedAt: Date.now(),
        reviewMeta: word.reviewMeta || createInitialReviewMeta(),
        tags: Array.isArray(word.tags) ? word.tags : ['#Manual'],
        collocations: Array.isArray(word.collocations) ? word.collocations : [],
        wordFamily: cleanedWordFamily,
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
 * Updates an existing word record preserving progress.
 */
export async function updateWord(id: string, updates: Partial<WordItem>): Promise<void> {
  const existing = await db.words.get(id);
  if (!existing) return;
  const merged = mergeWordRecords(existing, updates, { mergePolicy: 'preserve-progress' });
  await db.words.put(merged);
  warmSearchCache([merged]);
}

/**
 * Deletes a word by id.
 */
export async function deleteWord(id: string): Promise<void> {
  await db.words.delete(id);
}

export const saveWord = saveOrUpdateWord;

export const vocabRepository = {
  findWordByTerm,
  getWordById,
  saveWord,
  saveOrUpdateWord,
  updateWord,
  updateWordNotes,
  updateWordTags,
  deleteWord,
  bulkUpsertWords,
  importDeckFromJson,
};

export interface ImportDeckOptions {
  replaceProgress?: boolean;
}

export interface ImportDeckResult {
  imported: number;
  skipped: number;
  errors: string[];
  restoredSettings?: boolean;
  restoredDailyStats?: number;
}

/**
 * Imports words and optional backup data (settings, dailyStats) from a JSON string.
 * Supports both:
 * - Bare array of vocabulary cards: [ WordItem, ... ]
 * - Full LexiPulse backup envelope: { version, type, words, settings?, dailyStats? }
 *
 * Preserves user learning progress by default unless replaceProgress is explicitly enabled.
 * For existing modern FSRS cards, preserves exact scheduler parameters without degrading into re-estimates.
 */
export async function importDeckFromJson(
  jsonString: string,
  options: ImportDeckOptions = {}
): Promise<ImportDeckResult> {
  const errors: string[] = [];
  try {
    const parsed = JSON.parse(jsonString);
    let rawWords: any[] | null = null;
    let rawSettings: any = null;
    let rawDailyStats: any[] | null = null;

    if (Array.isArray(parsed)) {
      rawWords = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.words)) {
        rawWords = parsed.words;
      } else if (Array.isArray(parsed.deck)) {
        rawWords = parsed.deck;
      } else if (Array.isArray(parsed.vocab)) {
        rawWords = parsed.vocab;
      }

      if (parsed.settings && typeof parsed.settings === 'object') {
        rawSettings = parsed.settings;
      }
      if (Array.isArray(parsed.dailyStats)) {
        rawDailyStats = parsed.dailyStats;
      }
    }

    if (!rawWords) {
      throw new Error('Import data must be a JSON array of vocabulary cards or a valid backup envelope');
    }

    const validItems: WordItem[] = [];
    let skipped = 0;

    for (const item of rawWords) {
      if (!item || !item.word || typeof item.word !== 'string') {
        skipped++;
        continue;
      }

      const wordLower = normalizeWordTerm(item.word);
      const createdAt = item.createdAt && !isNaN(item.createdAt) ? item.createdAt : Date.now();

      // Determine reviewMeta accurately
      let reviewMeta = createInitialReviewMeta(createdAt);
      if (item.reviewMeta) {
        // If the card already has modern FSRS metadata, preserve it accurately
        if (
          item.reviewMeta.fsrs &&
          (item.reviewMeta.schedulerVersion === 'fsrs-v5' || typeof item.reviewMeta.fsrs.stability === 'number')
        ) {
          reviewMeta = {
            repetition: typeof item.reviewMeta.repetition === 'number' ? item.reviewMeta.repetition : item.reviewMeta.fsrs.reps,
            interval: typeof item.reviewMeta.interval === 'number' ? item.reviewMeta.interval : item.reviewMeta.fsrs.scheduled_days,
            easeFactor: typeof item.reviewMeta.easeFactor === 'number' ? item.reviewMeta.easeFactor : 2.5,
            dueDate: typeof item.reviewMeta.dueDate === 'number' ? item.reviewMeta.dueDate : item.reviewMeta.fsrs.due,
            lastReviewedDate: item.reviewMeta.lastReviewedDate ?? item.reviewMeta.fsrs.last_review ?? null,
            history: Array.isArray(item.reviewMeta.history) ? item.reviewMeta.history : [],
            fsrs: item.reviewMeta.fsrs,
            schedulerVersion: 'fsrs-v5',
            legacyBackup: item.reviewMeta.legacyBackup,
          };
        } else {
          // Legacy SM2 card migration
          reviewMeta = migrateLegacyMetaToFSRS(item.reviewMeta, createdAt, item.reviewMeta.dueDate);
        }
      }

      const wordRecord: WordItem = {
        id: item.id && typeof item.id === 'string' && item.id.trim()
          ? item.id.trim()
          : `word-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        word: wordLower,
        phonetics: item.phonetics && typeof item.phonetics === 'object' ? item.phonetics : {},
        pos: Array.isArray(item.pos) && item.pos.length > 0 ? item.pos : ['noun'],
        vietnameseDefinition: item.vietnameseDefinition || item.meaningVi || 'Chưa có định nghĩa',
        englishDefinition: item.englishDefinition || item.definition || '',
        meanings: Array.isArray(item.meanings) ? item.meanings : [],
        collocations: Array.isArray(item.collocations) ? item.collocations : [],
        wordFamily: Array.isArray(item.wordFamily) ? item.wordFamily : [],
        examples: Array.isArray(item.examples) ? item.examples : [],
        tags: Array.isArray(item.tags) ? item.tags : ['#Imported'],
        status: item.status || 'new',
        notes: typeof item.notes === 'string' ? item.notes : '',
        createdAt,
        updatedAt: Date.now(),
        reviewMeta,
        // Preserve rich linguistic & morphological properties
        lemma: typeof item.lemma === 'string' ? item.lemma : undefined,
        originalInput: typeof item.originalInput === 'string' ? item.originalInput : undefined,
        formLabels: Array.isArray(item.formLabels) ? item.formLabels : undefined,
        linkedVariants: Array.isArray(item.linkedVariants) ? item.linkedVariants : undefined,
        contextSentence: typeof item.contextSentence === 'string' ? item.contextSentence : undefined,
        inflections: Array.isArray(item.inflections) ? item.inflections : undefined,
        vietnameseDefinitionProvenance: item.vietnameseDefinitionProvenance && typeof item.vietnameseDefinitionProvenance === 'object'
          ? item.vietnameseDefinitionProvenance
          : undefined,
        isUserEdited: Boolean(item.isUserEdited),
        source: item.source || 'manual',
        enrichmentStatus: item.enrichmentStatus || 'completed',
        suggestions: Array.isArray(item.suggestions) ? item.suggestions : undefined,
      };
      validItems.push(wordRecord);
    }

    const res = await bulkUpsertWords(validItems, { replaceProgress: options.replaceProgress });

    let restoredSettings = false;
    if (rawSettings) {
      try {
        await saveAppSettings(rawSettings);
        restoredSettings = true;
      } catch (e: any) {
        errors.push(`Settings restoration notice: ${e.message || 'failed to restore settings'}`);
      }
    }

    let restoredDailyStats = 0;
    if (rawDailyStats && rawDailyStats.length > 0) {
      try {
        const validStats: DailyStats[] = rawDailyStats
          .filter((s: any) => s && typeof s.date === 'string' && typeof s.cardsReviewed === 'number')
          .map((s: any) => ({
            date: s.date,
            cardsReviewed: Number(s.cardsReviewed) || 0,
            streak: Number(s.streak) || 0,
            lastActiveDate: s.lastActiveDate || s.date,
          }));

        if (validStats.length > 0) {
          await db.dailyStats.bulkPut(validStats);
          restoredDailyStats = validStats.length;
        }
      } catch (e: any) {
        errors.push(`DailyStats restoration notice: ${e.message || 'failed to restore dailyStats'}`);
      }
    }

    return {
      imported: res.added + res.updated,
      skipped: skipped + res.skipped,
      errors,
      restoredSettings: restoredSettings || undefined,
      restoredDailyStats: restoredDailyStats > 0 ? restoredDailyStats : undefined,
    };
  } catch (err: any) {
    errors.push(err.message || 'Failed to parse JSON file');
    return { imported: 0, skipped: 0, errors };
  }
}



