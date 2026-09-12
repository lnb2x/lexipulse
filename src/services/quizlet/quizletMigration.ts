import { db } from '../db';
import type { WordItem } from '../../types/vocab';
import {
  normalizeQuizletCard,
  isPlaceholderDefinition,
} from './quizletNormalizer';
import { runEnrichmentPipeline } from '../enrichmentPipeline';
import { isAiAvailable } from '../ai';
import { formatLocalDate } from '../../utils/dateUtils';

export interface MigrationProgress {
  total: number;
  processed: number;
  normalizedCount: number;
  aiUpgradedCount: number;
  skippedCount: number;
  failedCount: number;
  currentWord: string;
}

export interface MigrationOptions {
  deckWords?: WordItem[];
  upgradeToAi?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: MigrationProgress) => void;
}

export interface MigrationResult {
  total: number;
  processed: number;
  normalizedCount: number;
  aiUpgradedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ word: string; error: string }>;
}

/**
 * Detects whether a word record needs term/definition normalization.
 */
export function checkNeedsNormalization(word: WordItem): boolean {
  // 1. Check if word term has parenthetical POS like (v), (n), (adj), etc.
  if (/\((?:v|n|adj|adv|phr|prep|conj|pron|num|int|c|u|v\.?|n\.?|adj\.?)\)/i.test(word.word)) {
    return true;
  }

  // 2. Check if definition has embedded IPA /.../
  const def = word.vietnameseDefinition || '';
  if (def && (/\/[^/]{2,}\//.test(def) || /\[[^\]]{2,}\]/.test(def))) {
    return true;
  }

  // 3. Check if englishDefinition has placeholder text
  if (isPlaceholderDefinition(word.englishDefinition)) {
    return true;
  }

  // 4. Check if vietnameseDefinition has placeholder text
  if (isPlaceholderDefinition(word.vietnameseDefinition)) {
    return true;
  }

  // 5. Check if wordFamily repeats the word itself
  if (
    word.wordFamily &&
    word.wordFamily.some(
      (f) => f.word.toLowerCase().trim() === word.word.toLowerCase().trim()
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Detects whether a word record needs AI translation upgrade.
 */
export function checkNeedsAiUpgrade(word: WordItem): boolean {
  // If already user-edited, do NOT overwrite with AI
  if (word.vietnameseDefinitionProvenance?.isUserEdited) {
    return false;
  }

  // If already has valid AI translation, do NOT re-translate
  if (
    word.vietnameseDefinition &&
    word.vietnameseDefinitionProvenance?.source === 'ai'
  ) {
    return false;
  }

  // Needs AI upgrade if it only has dictionary, manual, or quizlet definition
  return true;
}

/**
 * Migrates a single WordItem safely:
 * - Preserves id, reviewMeta (all FSRS metrics), createdAt, quizletSetIds, quizletSets, tags, notes
 * - Normalizes term, extracts POS, extracts IPA from definition
 * - Strips placeholders and self-referencing word families
 * - Upgrades to AI translation if requested, preserving learning sense
 * - Only writes to DB if changes were verified
 */
export async function migrateSingleWord(
  word: WordItem,
  options?: { upgradeAi?: boolean; signal?: AbortSignal }
): Promise<{ updatedWord: WordItem; normalized: boolean; aiUpgraded: boolean }> {
  let hasNormalization = false;
  let hasAiUpgrade = false;

  const currentDef = word.vietnameseDefinition || '';
  const normResult = normalizeQuizletCard(word.word, currentDef);

  let cleanWord = word.word;
  let rawQuizletTerm = word.rawQuizletTerm;
  let rawQuizletDef = word.rawQuizletDefinition;

  // 1. Term & POS normalization
  let partOfSpeech = word.pos || [];
  if (normResult.word !== word.word) {
    cleanWord = normResult.word;
    rawQuizletTerm = rawQuizletTerm || word.word;
    hasNormalization = true;
    if (normResult.pos.length > 0) {
      partOfSpeech = Array.from(new Set([...partOfSpeech, ...normResult.pos]));
    }
  }

  // 2. IPA extraction from definition
  let phonetics = { ...(word.phonetics || {}) };
  let cleanDef = normResult.definition;
  if (normResult.extractedIpa && !phonetics.us) {
    phonetics.us = normResult.extractedIpa;
    hasNormalization = true;
  }

  // 3. Placeholder removal
  let englishDefinition = word.englishDefinition || '';
  if (isPlaceholderDefinition(englishDefinition)) {
    englishDefinition = '';
    hasNormalization = true;
  }

  let vietnameseDefinition = cleanDef || word.vietnameseDefinition;
  if (isPlaceholderDefinition(vietnameseDefinition)) {
    vietnameseDefinition = '';
    hasNormalization = true;
  }

  // 4. Word family self-repetition cleanup
  let wordFamily = (word.wordFamily || []).filter((item) => {
    const famClean = normalizeQuizletCard(item.word, '').word.toLowerCase().trim();
    return famClean !== cleanWord.toLowerCase().trim();
  });
  if (wordFamily.length !== (word.wordFamily?.length || 0)) {
    hasNormalization = true;
  }

  let baseUpdated: WordItem = {
    ...word,
    word: cleanWord,
    pos: partOfSpeech,
    phonetics,
    englishDefinition,
    vietnameseDefinition,
    wordFamily,
    rawQuizletTerm,
    rawQuizletDefinition: rawQuizletDef || (word.rawQuizletTerm ? currentDef : undefined),
    updatedAt: Date.now(),
  };

  // 5. AI translation upgrade if requested and available
  const aiReady = await isAiAvailable();
  const canUpgradeAi =
    options?.upgradeAi &&
    aiReady &&
    checkNeedsAiUpgrade(baseUpdated);

  if (canUpgradeAi) {
    try {
      const userMeaning =
        baseUpdated.vietnameseDefinition ||
        baseUpdated.rawQuizletDefinition;

      const pipelineResult = await runEnrichmentPipeline({
        query: cleanWord,
        userMeaning,
        signal: options?.signal,
      });

      if (
        pipelineResult.word &&
        pipelineResult.word.vietnameseDefinitionProvenance?.source === 'ai' &&
        pipelineResult.word.vietnameseDefinition
      ) {
        // Merge AI enriched data while strictly preserving ID and FSRS state
        baseUpdated = {
          ...baseUpdated,
          vietnameseDefinition: pipelineResult.word.vietnameseDefinition,
          vietnameseDefinitionProvenance: pipelineResult.word.vietnameseDefinitionProvenance,
          englishDefinition: pipelineResult.word.englishDefinition || baseUpdated.englishDefinition,
          phonetics: {
            ...baseUpdated.phonetics,
            ...(pipelineResult.word.phonetics || {}),
          },
          collocations:
            pipelineResult.word.collocations && pipelineResult.word.collocations.length > 0
              ? pipelineResult.word.collocations
              : baseUpdated.collocations,
          wordFamily:
            pipelineResult.word.wordFamily && pipelineResult.word.wordFamily.length > 0
              ? pipelineResult.word.wordFamily.filter(
                  (f) => f.word.toLowerCase().trim() !== cleanWord.toLowerCase().trim()
                )
              : baseUpdated.wordFamily,
          examples:
            pipelineResult.word.examples && pipelineResult.word.examples.length > 0
              ? pipelineResult.word.examples
              : baseUpdated.examples,
          updatedAt: Date.now(),
        };
        hasAiUpgrade = true;
      }
    } catch {
      // On AI failure: keep cleanly normalized record, do not fail migration
    }
  }

  // Save safely to database
  if (hasNormalization || hasAiUpgrade) {
    await db.words.put(baseUpdated);
  }

  return {
    updatedWord: baseUpdated,
    normalized: hasNormalization,
    aiUpgraded: hasAiUpgrade,
  };
}

/**
 * Migrates and normalizes the deck safely:
 * - Scans words and checks for normalization or AI upgrade needs
 * - Preserves 100% of FSRS reviewMeta, IDs, history, and user edits
 * - Reports progress after each item
 * - Idempotent and resumable
 */
export async function migrateAndNormalizeExistingDeck(
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const allWords = options.deckWords || (await db.words.toArray());
  const total = allWords.length;
  const signal = options.signal;
  const upgradeToAi = options.upgradeToAi !== undefined ? options.upgradeToAi : await isAiAvailable();

  let processed = 0;
  let normalizedCount = 0;
  let aiUpgradedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const errors: Array<{ word: string; error: string }> = [];

  for (const word of allWords) {
    if (signal?.aborted) break;

    const needsNorm = checkNeedsNormalization(word);
    const needsAi = upgradeToAi && checkNeedsAiUpgrade(word);

    if (!needsNorm && !needsAi) {
      skippedCount++;
      processed++;
      options.onProgress?.({
        total,
        processed,
        normalizedCount,
        aiUpgradedCount,
        skippedCount,
        failedCount,
        currentWord: word.word,
      });
      continue;
    }

    try {
      const res = await migrateSingleWord(word, {
        upgradeAi: upgradeToAi,
        signal,
      });

      if (res.normalized) normalizedCount++;
      if (res.aiUpgraded) aiUpgradedCount++;
      if (!res.normalized && !res.aiUpgraded) skippedCount++;
    } catch (err: unknown) {
      failedCount++;
      errors.push({
        word: word.word,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    processed++;
    options.onProgress?.({
      total,
      processed,
      normalizedCount,
      aiUpgradedCount,
      skippedCount,
      failedCount,
      currentWord: word.word,
    });
  }

  return {
    total,
    processed,
    normalizedCount,
    aiUpgradedCount,
    skippedCount,
    failedCount,
    errors,
  };
}

export interface ScopeInspectionResult {
  date: string;
  totalDeckWords: number;
  todayWords: WordItem[];
  unreliableDateWords: WordItem[];
}

/**
 * Inspects deck words added on targetDate (defaults to today in user's local timezone).
 * Strictly filters by createdAt timestamp; lists any cards with missing/unreliable dates separately.
 */
export async function inspectTodayWordsScope(targetDate?: string): Promise<ScopeInspectionResult> {
  const allWords = await db.words.toArray();
  const dateToFilter = targetDate || formatLocalDate();

  const todayWords: WordItem[] = [];
  const unreliableDateWords: WordItem[] = [];

  for (const w of allWords) {
    if (typeof w.createdAt !== 'number' || isNaN(w.createdAt) || w.createdAt <= 0) {
      unreliableDateWords.push(w);
      continue;
    }
    const localDate = formatLocalDate(w.createdAt);
    if (localDate === dateToFilter) {
      todayWords.push(w);
    }
  }

  return {
    date: dateToFilter,
    totalDeckWords: allWords.length,
    todayWords,
    unreliableDateWords,
  };
}

export interface TodayMigrationOptions {
  targetDate?: string;
  upgradeToAi?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: MigrationProgress) => void;
}

export interface TodayWordExample {
  id: string;
  wordBefore: string;
  wordAfter: string;
  posBefore: string[];
  posAfter: string[];
  ipaBefore?: string;
  ipaAfter?: string;
  defBefore: string;
  defAfter: string;
  aiUpgraded: boolean;
}

export interface TodayMigrationResult {
  date: string;
  totalWordsInDeck: number;
  totalToday: number;
  unreliableDateCount: number;
  unreliableDateWords: Array<{ id: string; word: string }>;
  normalizedCount: number;
  aiUpgradedCount: number;
  keptIntactCount: number;
  failedCount: number;
  conflictCount: number;
  conflicts: Array<{ word: string; conflictWithId: string }>;
  errors: Array<{ word: string; error: string }>;
  examplesBeforeAfter: TodayWordExample[];
  backupKey: string;
}

/**
 * Migrates and normalizes ONLY the words added today:
 * - Scoped strictly to createdAt matching today in local timezone
 * - Backs up scope records prior to modifying
 * - Checks term collisions; never deletes or force-merges upon collision
 * - Normalizes POS (e.g. "sign the contract (v)" -> "sign the contract" + pos: ["verb"])
 * - Extracts IPA from definition without cutting text at commas, semicolons, slashes, or newlines
 * - Removes placeholders and self-referencing word families
 * - Upgrades to AI translation if available, preserving learning sense
 * - Preserves IDs, createdAt, deck links, and 100% of FSRS state
 * - Idempotent and resumable
 */
export async function migrateTodayWords(
  options: TodayMigrationOptions = {}
): Promise<TodayMigrationResult> {
  const scope = await inspectTodayWordsScope(options.targetDate);
  const { date, totalDeckWords, todayWords, unreliableDateWords } = scope;
  const totalToday = todayWords.length;
  const signal = options.signal;
  const upgradeToAi = options.upgradeToAi !== undefined ? options.upgradeToAi : await isAiAvailable();

  // 1. Safe backup of today's target words before mutation
  const backupKey = `lexipulse_backup_today_${date}_${Date.now()}`;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(backupKey, JSON.stringify(todayWords));
    }
  } catch (err) {
    console.warn('Could not store full backup in localStorage:', err);
  }

  let processed = 0;
  let normalizedCount = 0;
  let aiUpgradedCount = 0;
  let keptIntactCount = 0;
  let failedCount = 0;
  const conflicts: Array<{ word: string; conflictWithId: string }> = [];
  const errors: Array<{ word: string; error: string }> = [];
  const examplesBeforeAfter: TodayWordExample[] = [];

  // Build lookup of all words in deck by normalized term for collision detection
  const allWords = await db.words.toArray();
  const wordMap = new Map<string, WordItem>();
  for (const w of allWords) {
    wordMap.set(w.word.toLowerCase().trim(), w);
  }

  for (const word of todayWords) {
    if (signal?.aborted) break;

    const normCandidate = normalizeQuizletCard(word.word, word.vietnameseDefinition || '');
    const cleanTermCandidate = normCandidate.word.toLowerCase().trim();

    // Check collision: if changing term results in an existing record in DB with different id
    if (cleanTermCandidate !== word.word.toLowerCase().trim()) {
      const existingCollision = wordMap.get(cleanTermCandidate);
      if (existingCollision && existingCollision.id !== word.id) {
        // Flag collision, do NOT delete or force-merge
        conflicts.push({
          word: word.word,
          conflictWithId: existingCollision.id,
        });
        // Tag word as requiring review without deleting
        const taggedWord: WordItem = {
          ...word,
          tags: Array.from(new Set([...word.tags, '#can-xem-xet-trung'])),
          updatedAt: Date.now(),
        };
        await db.words.put(taggedWord);
        keptIntactCount++;
        processed++;
        options.onProgress?.({
          total: totalToday,
          processed,
          normalizedCount,
          aiUpgradedCount,
          skippedCount: keptIntactCount,
          failedCount,
          currentWord: word.word,
        });
        continue;
      }
    }

    const needsNorm = checkNeedsNormalization(word);
    const needsAi = upgradeToAi && checkNeedsAiUpgrade(word);

    if (!needsNorm && !needsAi) {
      keptIntactCount++;
      processed++;
      options.onProgress?.({
        total: totalToday,
        processed,
        normalizedCount,
        aiUpgradedCount,
        skippedCount: keptIntactCount,
        failedCount,
        currentWord: word.word,
      });
      continue;
    }

    try {
      const res = await migrateSingleWord(word, {
        upgradeAi: upgradeToAi,
        signal,
      });

      if (res.normalized) normalizedCount++;
      if (res.aiUpgraded) aiUpgradedCount++;
      if (!res.normalized && !res.aiUpgraded) keptIntactCount++;

      // Record before/after diff for reporting
      examplesBeforeAfter.push({
        id: word.id,
        wordBefore: word.word,
        wordAfter: res.updatedWord.word,
        posBefore: word.pos,
        posAfter: res.updatedWord.pos,
        ipaBefore: word.phonetics?.us,
        ipaAfter: res.updatedWord.phonetics?.us,
        defBefore: word.vietnameseDefinition,
        defAfter: res.updatedWord.vietnameseDefinition,
        aiUpgraded: res.aiUpgraded,
      });

      // Update in-memory lookup map
      wordMap.set(res.updatedWord.word.toLowerCase().trim(), res.updatedWord);
    } catch (err: unknown) {
      failedCount++;
      errors.push({
        word: word.word,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    processed++;
    options.onProgress?.({
      total: totalToday,
      processed,
      normalizedCount,
      aiUpgradedCount,
      skippedCount: keptIntactCount,
      failedCount,
      currentWord: word.word,
    });
  }

  return {
    date,
    totalWordsInDeck: totalDeckWords,
    totalToday,
    unreliableDateCount: unreliableDateWords.length,
    unreliableDateWords: unreliableDateWords.map((w) => ({ id: w.id, word: w.word })),
    normalizedCount,
    aiUpgradedCount,
    keptIntactCount,
    failedCount,
    conflictCount: conflicts.length,
    conflicts,
    errors,
    examplesBeforeAfter,
    backupKey,
  };
}
