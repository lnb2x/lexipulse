import { db } from './db';
import { validateBackupWord, validateSupplementalTables } from './db/backupValidation';
import { sanitizeBackupSettings, verifyBackupEnvelope } from './db/backupEnvelope';
import { BACKUP_TABLES, assertRecoverySnapshot, readRecoverySnapshot, buildBackupPreview, type BackupTableName, type BackupPreview } from './db/backupPlan';
import type { DailyStats, EnrichmentStatus, MeaningItem, WordItem } from '../types/vocab';
import { createInitialReviewMeta, migrateLegacyMetaToFSRS } from './fsrs/fsrsService';
import { saveAppSettings } from './db/statsRepo';
import { warmSearchCache } from './dictionary';
import { WORD_LRU_CACHE, SUGGESTION_CACHE } from './dictionary/cache';
import { isPlaceholderDefinition } from './quizlet/quizletNormalizer';
import { isMissingOrUntranslated, isWordTranslationComplete } from '../utils/translationAuditor';
import { getStudyAttempts } from './studyProgress';
import type { StudyAttempt } from '../types/study';

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

async function allocateWordId(preferred: string | undefined, occupied: Set<string>) {
  let id = preferred?.trim();
  if (!id || occupied.has(id)) {
    do {
      id = `word-${crypto.randomUUID()}`;
    } while (occupied.has(id) || await db.words.get(id));
  }
  occupied.add(id);
  return id;
}

/**
 * Merges linguistic content between an existing database record and newly incoming data.
 * Adheres strictly to data preservation rules:
 * - 'preserve-progress' (default): Never overwrites id, createdAt, reviewMeta, history, status, or user notes.
 * - Merges user tags uniquely.
 * - 'replace-progress': Only allowed when user explicitly requests replacing study progress.
 * - Enriches missing translations on duplicate items (collocations, wordFamily, examples, meanings)
 *   without losing new translations or overwriting valid existing translations.
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

  // Merge collocations uniquely by phrase, enriching missing translations on duplicate phrases
  const existingCollocations = Array.isArray(existing.collocations) ? existing.collocations : [];
  const incomingCollocations = Array.isArray(incoming.collocations) ? incoming.collocations : [];
  const getCollocPhrase = (c: any) =>
    (typeof c === 'string' ? c : (c?.phrase || '')).trim().toLowerCase();

  const incomingCollocMap = new Map<string, any>();
  for (const c of incomingCollocations) {
    const key = getCollocPhrase(c);
    if (key && !incomingCollocMap.has(key)) {
      incomingCollocMap.set(key, c);
    }
  }

  const mergedCollocations = existingCollocations.map((c) => {
    const key = getCollocPhrase(c);
    const inc = incomingCollocMap.get(key);
    if (inc) {
      incomingCollocMap.delete(key);
      const existingMissing = isMissingOrUntranslated(c.meaningVi, c.phrase);
      const incHasMeaning = !isMissingOrUntranslated(inc.meaningVi, inc.phrase);
      if (existingMissing && incHasMeaning) {
        return {
          ...c,
          meaningVi: inc.meaningVi.trim(),
          example: c.example || inc.example,
        };
      }
    }
    return c;
  });

  for (const inc of incomingCollocMap.values()) {
    mergedCollocations.push(inc);
  }

  // Merge word families uniquely by word + pos, enriching missing translations on duplicate word items
  const existingWf = Array.isArray(existing.wordFamily) ? existing.wordFamily : [];
  const incomingWf = Array.isArray(incoming.wordFamily) ? incoming.wordFamily : [];
  const cleanWordLower = existing.word.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
  const getWfKey = (w: any) => `${(w.word || '').trim().toLowerCase()}-${(w.pos || '').trim().toLowerCase()}`;

  const incomingWfMap = new Map<string, any>();
  for (const w of incomingWf) {
    const key = getWfKey(w);
    if (key && !incomingWfMap.has(key)) {
      incomingWfMap.set(key, w);
    }
  }

  const mergedWf = existingWf.map((w) => {
    const key = getWfKey(w);
    const inc = incomingWfMap.get(key);
    if (inc) {
      incomingWfMap.delete(key);
      const existingMissing = isMissingOrUntranslated(w.meaningVi, w.word);
      const incHasMeaning = !isMissingOrUntranslated(inc.meaningVi, inc.word);
      if (existingMissing && incHasMeaning) {
        return {
          ...w,
          meaningVi: inc.meaningVi.trim(),
        };
      }
    }
    return w;
  });

  for (const inc of incomingWfMap.values()) {
    mergedWf.push(inc);
  }

  // Filter out any self-referencing word family item
  const cleanMergedWf = mergedWf.filter((wf) => {
    const famClean = wf.word.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
    return famClean !== cleanWordLower;
  });

  // Merge examples uniquely by English sentence text, enriching missing translations on duplicate examples
  const existingExamples = Array.isArray(existing.examples) ? existing.examples : [];
  const incomingExamples = Array.isArray(incoming.examples) ? incoming.examples : [];
  const getExampleEn = (e: any) =>
    (typeof e === 'string' ? e : (e?.en || e?.sentence || '')).trim().toLowerCase();

  const incomingExMap = new Map<string, any>();
  for (const e of incomingExamples) {
    const key = getExampleEn(e);
    if (key && !incomingExMap.has(key)) {
      incomingExMap.set(key, e);
    }
  }

  const mergedExamples = existingExamples.map((e) => {
    const key = getExampleEn(e);
    const inc = incomingExMap.get(key);
    if (inc) {
      incomingExMap.delete(key);
      const existingMissing = isMissingOrUntranslated(e.vi, e.en);
      const incHasMeaning = !isMissingOrUntranslated(inc.vi, inc.en);
      if (existingMissing && incHasMeaning) {
        return {
          ...e,
          vi: inc.vi.trim(),
          context: e.context || inc.context || 'general',
        };
      }
    }
    return e;
  });

  for (const inc of incomingExMap.values()) {
    mergedExamples.push(inc);
  }

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
    !isMissingOrUntranslated(existing.vietnameseDefinition, existing.word)
  );
  const isIncomingAi = Boolean(
    incoming.vietnameseDefinitionProvenance?.source === 'ai' || incoming.source === 'ai'
  );
  const isIncomingPlaceholder = isMissingOrUntranslated(incoming.vietnameseDefinition, existing.word);

  let vietnameseDef = existing.vietnameseDefinition;
  let usageNoteVi = existing.usageNoteVi;
  let mergedProvenance = existing.vietnameseDefinitionProvenance;

  // Allow overwrite if:
  // - User requested replace-progress
  // - Incoming is user-edited
  // - Existing is missing/placeholder and incoming has valid translation
  // - Existing is NOT user-edited, AND (existing is not AI-protected OR incoming is a new valid AI translation), AND incoming is not placeholder
  const isExistingDefMissing = isMissingOrUntranslated(existing.vietnameseDefinition, existing.word);
  const isIncomingDefValid = incoming.vietnameseDefinition && !isMissingOrUntranslated(incoming.vietnameseDefinition, existing.word);

  const canOverwriteDef = Boolean(
    policy === 'replace-progress' ||
    isIncomingUserEdited ||
    (isExistingDefMissing && isIncomingDefValid) ||
    (!isExistingUserEdited && (!isExistingAiProtected || isIncomingAi) && !isIncomingPlaceholder)
  );

  if (canOverwriteDef && incoming.vietnameseDefinition && incoming.vietnameseDefinition.trim()) {
    vietnameseDef = incoming.vietnameseDefinition.trim();
    if (Object.prototype.hasOwnProperty.call(incoming, 'usageNoteVi')) {
      usageNoteVi = incoming.usageNoteVi?.trim() || undefined;
    } else if (vietnameseDef !== existing.vietnameseDefinition) {
      usageNoteVi = undefined;
    }
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

  // Merge meanings: enrich missing translations on duplicate/matching meanings
  const existingMeanings = Array.isArray(existing.meanings) ? existing.meanings : [];
  const incomingMeanings = Array.isArray(incoming.meanings) ? incoming.meanings : [];
  let mergedMeanings: MeaningItem[] = [];

  if (existingMeanings.length === 0) {
    mergedMeanings = [...incomingMeanings];
  } else if (incomingMeanings.length === 0) {
    mergedMeanings = [...existingMeanings];
  } else {
    const incomingUsed = new Set<number>();
    mergedMeanings = existingMeanings.map((em, idx) => {
      let matchedIdx = -1;
      if (em.englishDefinition) {
        matchedIdx = incomingMeanings.findIndex(
          (im, i) => !incomingUsed.has(i) &&
            im.englishDefinition &&
            im.englishDefinition.trim().toLowerCase() === em.englishDefinition.trim().toLowerCase()
        );
      }
      if (matchedIdx === -1 && idx < incomingMeanings.length && !incomingUsed.has(idx)) {
        if (!em.pos || !incomingMeanings[idx].pos || em.pos === incomingMeanings[idx].pos) {
          matchedIdx = idx;
        }
      }

      if (matchedIdx !== -1) {
        incomingUsed.add(matchedIdx);
        const im = incomingMeanings[matchedIdx];
        const existingMissing = isMissingOrUntranslated(em.vietnameseDefinition, em.englishDefinition);
        const incHasVi = !isMissingOrUntranslated(im.vietnameseDefinition, im.englishDefinition);
        return {
          ...em,
          vietnameseDefinition: existingMissing && incHasVi ? im.vietnameseDefinition?.trim() : em.vietnameseDefinition,
          synonyms: Array.from(new Set([...(em.synonyms || []), ...(im.synonyms || [])])),
          antonyms: Array.from(new Set([...(em.antonyms || []), ...(im.antonyms || [])])),
          example: em.example || im.example,
        };
      }
      return em;
    });

    incomingMeanings.forEach((im, idx) => {
      if (!incomingUsed.has(idx)) {
        const isDuplicate = mergedMeanings.some(
          (m) =>
            m.englishDefinition &&
            im.englishDefinition &&
            m.englishDefinition.trim().toLowerCase() === im.englishDefinition.trim().toLowerCase()
        );
        if (!isDuplicate) {
          mergedMeanings.push(im);
        }
      }
    });
  }

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

  // Determine enrichmentStatus accurately based on translation completeness
  const candidateStatus = incoming.enrichmentStatus || existing.enrichmentStatus || 'pending';
  let mergedEnrichmentStatus: EnrichmentStatus;
  if (candidateStatus === 'manual' || candidateStatus === 'failed') {
    mergedEnrichmentStatus = candidateStatus;
  } else {
    const tempWord = {
      ...existing,
      vietnameseDefinition: vietnameseDef,
      meanings: mergedMeanings,
      collocations: mergedCollocations,
      wordFamily: cleanMergedWf,
      examples: mergedExamples,
    };
    mergedEnrichmentStatus = isWordTranslationComplete(tempWord as WordItem) ? 'completed' : 'pending';
  }

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
      usageNoteVi,
      vietnameseDefinitionProvenance: mergedProvenance,
      englishDefinition: englishDef,
      meanings: mergedMeanings,
      collocations: mergedCollocations,
      wordFamily: cleanMergedWf,
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
      enrichmentStatus: mergedEnrichmentStatus,
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
    usageNoteVi,
    vietnameseDefinitionProvenance: mergedProvenance,
    englishDefinition: englishDef,
    meanings: mergedMeanings,
    collocations: mergedCollocations,
    wordFamily: cleanMergedWf,
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
    enrichmentStatus: mergedEnrichmentStatus,
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
      const occupied = new Set<string>();
      if (word.id?.trim() && await db.words.get(word.id.trim())) occupied.add(word.id.trim());
      const finalId = await allocateWordId(word.id, occupied);

      const cleanedEnDef = isPlaceholderDefinition(word.englishDefinition) ? '' : (word.englishDefinition || '');
      const cleanedViDef = isPlaceholderDefinition(word.vietnameseDefinition) ? '' : (word.vietnameseDefinition || '');
      const rawFamilies = Array.isArray(word.wordFamily) ? word.wordFamily : [];
      const cleanWordLower = normalized.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
      const cleanedWordFamily = rawFamilies.filter((wf) => {
        const famClean = wf.word.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
        return famClean !== cleanWordLower;
      });

      const draftRecord: WordItem = {
        ...word,
        id: finalId,
        word: normalized,
        englishDefinition: cleanedEnDef,
        vietnameseDefinition: cleanedViDef,
        usageNoteVi: word.usageNoteVi?.trim() || undefined,
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

      const initialStatus =
        word.enrichmentStatus === 'manual' || word.enrichmentStatus === 'failed'
          ? word.enrichmentStatus
          : isWordTranslationComplete(draftRecord)
            ? 'completed'
            : (word.enrichmentStatus || 'pending');

      finalRecord = {
        ...draftRecord,
        enrichmentStatus: initialStatus,
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
    const requestedIds = words.map(w => w.id?.trim()).filter(Boolean);
    const occupied = new Set((await db.words.bulkGet(requestedIds))
      .filter((word): word is WordItem => Boolean(word)).map(word => word.id));

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
        const finalId = await allocateWordId(item.id, occupied);

        const draftRecord: WordItem = {
          ...item,
          id: finalId,
          word: normalized,
          usageNoteVi: item.usageNoteVi?.trim() || undefined,
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

        const initialStatus =
          item.enrichmentStatus === 'manual' || item.enrichmentStatus === 'failed'
            ? item.enrichmentStatus
            : isWordTranslationComplete(draftRecord)
              ? 'completed'
              : (item.enrichmentStatus || 'pending');

        const newRecord: WordItem = {
          ...draftRecord,
          enrichmentStatus: initialStatus,
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
  const merged = await db.transaction('rw', db.words, async () => {
    const existing = await db.words.get(id);
    if (!existing) return;
    const next = mergeWordRecords(existing, updates, { mergePolicy: 'preserve-progress' });
    await db.words.put(next);
    return next;
  });
  if (merged) warmSearchCache([merged]);
}

/** Apply normalization only to content that has not changed since it was read. */
export async function commitNormalizedContent(snapshot: WordItem, normalized: WordItem) {
  return db.transaction('rw', db.words, async () => {
    const fresh = await db.words.get(snapshot.id);
    if (!fresh) return undefined; // Never resurrect a deleted card.
    const fields = [
      'word', 'pos', 'phonetics', 'englishDefinition', 'vietnameseDefinition', 'usageNoteVi',
      'wordFamily', 'collocations', 'examples', 'vietnameseDefinitionProvenance',
      'rawQuizletTerm', 'rawQuizletDefinition', 'enrichmentStatus',
    ] as const;
    const changes = Object.fromEntries(fields
      .filter(key => JSON.stringify(fresh[key]) === JSON.stringify(snapshot[key]) &&
        (key !== 'usageNoteVi' || fresh.vietnameseDefinition === snapshot.vietnameseDefinition))
      .map(key => [key, normalized[key]]));
    if (changes.word && changes.word !== fresh.word) {
      const collision = await db.words.where('word').equals(String(changes.word)).first();
      if (collision && collision.id !== fresh.id) delete changes.word;
    }
    const updated = { ...fresh, ...changes, updatedAt: Date.now() };
    await db.words.put(updated);
    return updated;
  });
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
  tables?: BackupTableName[];
  mode?: 'merge' | 'replace';
  previewOnly?: boolean;
  recoveryBackup?: string;
}

export interface ImportDeckResult {
  imported: number;
  skipped: number;
  errors: string[];
  restoredSettings?: boolean;
  restoredDailyStats?: number;
  preview?: BackupPreview;
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
  let sessionBefore: string | null = null;
  let sessionTouched = false;
  try {
    const parsed = JSON.parse(jsonString);
    await verifyBackupEnvelope(parsed, db.verno);
    errors.push(...validateSupplementalTables(parsed));
    const selected = new Set(options.tables ?? BACKUP_TABLES);
    if (!selected.size || [...selected].some(name => !BACKUP_TABLES.includes(name))) throw new Error('invalid_table_selection');
    const replace = options.mode === 'replace';
    if (replace && (parsed.version !== 2 || [...selected].some(name => !Array.isArray(parsed[name])))) {
      throw new Error('replace_requires_complete_v2_tables');
    }
    if (replace && selected.has('words') !== selected.has('quizletSets')) throw new Error('replace_words_and_sets_together');
    const recovery = options.recoveryBackup ? await readRecoverySnapshot(options.recoveryBackup) : undefined;
    if (replace && !options.previewOnly && !recovery) throw new Error('complete_recovery_backup_required');
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

      if (parsed.version === 2 && Array.isArray(parsed.settingsTable)) {
        rawSettings = parsed.settingsTable.find((row: { key: string }) => row.key === 'appSettings')?.value ?? null;
      } else if (parsed.settings && typeof parsed.settings === 'object') {
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

    const backupIds = new Set<string>();
    for (const [index, item] of rawWords.entries()) {
      const invalidField = validateBackupWord(item) || (parsed.version === 2 &&
        (typeof item.id !== 'string' || !item.id.trim() || backupIds.has(item.id) ||
          ['phonetics', 'pos', 'vietnameseDefinition', 'englishDefinition', 'meanings', 'collocations',
            'wordFamily', 'examples', 'tags', 'status', 'createdAt', 'updatedAt', 'reviewMeta'].some(key => item[key] === undefined))
          ? 'id or required backup field' : undefined);
      if (parsed.version === 2 && !invalidField) backupIds.add(item.id);
      if (invalidField) {
        skipped++;
        errors.push(`words[${index}]: invalid ${invalidField}`);
        continue;
      }
      try {
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
            isEstimated: item.reviewMeta.isEstimated,
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
        usageNoteVi: item.usageNoteVi?.trim() || undefined,
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
        quizletSetIds: item.quizletSetIds,
        quizletSets: item.quizletSets,
        rawQuizletTerm: item.rawQuizletTerm,
        rawQuizletDefinition: item.rawQuizletDefinition,
      };
      validItems.push(parsed.version === 2 ? { ...item, reviewMeta } : wordRecord);
      } catch {
        skipped++;
        errors.push(`words[${index}]: invalid review or content data`);
      }
    }

    if (options.previewOnly) {
      return { imported: 0, skipped, errors, preview: await buildBackupPreview(validItems, parsed, replace) };
    }
    if (!selected.has('settingsTable')) rawSettings = null;
    if (rawSettings && typeof sessionStorage !== 'undefined') {
      sessionBefore = sessionStorage.getItem('lexipulse_session_ai_key');
      sessionTouched = true;
    }
    const result = await db.transaction('rw', db.tables, async () => {
    if (recovery) await assertRecoverySnapshot(recovery);
    if (replace) {
      if (skipped > 0 || errors.length > 0) throw new Error('replace_rejected_records');
      for (const name of selected) await db.table(name).clear();
    }
    const restoreWords = selected.has('words') ? validItems : [];
    const res = { added: 0, updated: 0, skipped: 0 };
    if (parsed.version === 2) {
      // Backups identify cards by ID; equal spelling can represent separate senses.
      for (const item of restoreWords) {
        const current = await db.words.get(item.id);
        if (current && normalizeWordTerm(current.word) !== normalizeWordTerm(item.word)) {
          errors.push('words: conflicting card id');
          res.skipped++;
          continue;
        }
        await db.words.put(current
          ? mergeWordRecords(current, item, { mergePolicy: options.replaceProgress ? 'replace-progress' : 'preserve-progress' })
          : item);
        if (current) res.updated++;
        else res.added++;
      }
    } else {
      Object.assign(res, await bulkUpsertWords(restoreWords, { replaceProgress: options.replaceProgress || replace }));
    }

    if (parsed.version === 2) {
      for (const [index, set] of (selected.has('quizletSets') ? parsed.quizletSets : []).entries()) {
        if (!set || typeof set.id !== 'string' || typeof set.title !== 'string' || typeof set.url !== 'string' ||
            !Number.isFinite(set.createdAt) || !Number.isFinite(set.updatedAt)) {
          errors.push(`quizletSets[${index}]: invalid record`);
          continue;
        }
        if (!await db.quizletSets.get(set.id)) await db.quizletSets.put(set);
      }
      for (const [index, row] of (selected.has('settingsTable') ? parsed.settingsTable ?? [] : []).entries()) {
        if (!row || typeof row.key !== 'string' || !('value' in row)) {
          errors.push(`settingsTable[${index}]: invalid record`);
          continue;
        }
        if (['studySession', 'toeicSession', 'lastBackupDownload'].includes(row.key)) continue;
        if (row.key === 'studyAttempts') {
          const existingAttempts = await getStudyAttempts();
          const byId = new Map(existingAttempts.map(a => [a.id, a]));
          for (const attempt of row.value as StudyAttempt[]) if (!byId.has(attempt.id)) byId.set(attempt.id, attempt);
          await db.settingsTable.put({ key: row.key, value: [...byId.values()] });
        } else if (row.key !== 'appSettings' && !await db.settingsTable.get(row.key)) await db.settingsTable.put(sanitizeBackupSettings(row));
      }
    }

    let restoredSettings = false;
    if (rawSettings) {
      try {
        await saveAppSettings({ ...rawSettings, aiApiKey: '', geminiApiKey: '' });
        restoredSettings = true;
      } catch (e: any) {
        throw new Error(`Settings restoration failed: ${e.message || 'write failed'}`);
      }
    }

    let restoredDailyStats = 0;
    if (selected.has('dailyStats') && rawDailyStats && rawDailyStats.length > 0) {
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
          await db.transaction('rw', db.dailyStats, async () => {
            for (const incoming of validStats) {
              const current = await db.dailyStats.get(incoming.date);
              if (options.replaceProgress || !current || current.cardsReviewed === 0) {
                await db.dailyStats.put(incoming);
                restoredDailyStats++;
              }
            }
          });
        }
      } catch (e: any) {
        throw new Error(`DailyStats restoration failed: ${e.message || 'write failed'}`);
      }
    }

    return {
      imported: res.added + res.updated,
      skipped: skipped + res.skipped,
      errors,
      restoredSettings: restoredSettings || undefined,
      restoredDailyStats: restoredDailyStats > 0 ? restoredDailyStats : undefined,
    };
    });
    if (selected.has('words')) {
      WORD_LRU_CACHE.clear();
      SUGGESTION_CACHE.clear();
    }
    return result;
  } catch (err: any) {
    if (sessionTouched) {
      try {
        if (sessionBefore === null) sessionStorage.removeItem('lexipulse_session_ai_key');
        else sessionStorage.setItem('lexipulse_session_ai_key', sessionBefore);
      } catch { /* Browser storage policy may also deny restoring the session. */ }
    }
    errors.push(err.message || 'Failed to parse JSON file');
    return { imported: 0, skipped: 0, errors };
  }
}



