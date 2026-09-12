import type {
  QuizletCardItem,
  QuizletReconciledWord,
  WordItem,
} from '../../types/vocab';
import { normalizeWordTerm } from '../vocabRepository';
import { normalizeQuizletCard } from './quizletNormalizer';

export interface ReconciliationSummary {
  newCount: number;
  existingCount: number;
  needsReviewCount: number;
  totalUnique: number;
  duplicatesInBatch: number;
}

export interface ReconciliationResult {
  items: QuizletReconciledWord[];
  summary: ReconciliationSummary;
}

/**
 * Normalizes definition text for comparison:
 * - Trims whitespace
 * - Converts to lowercase
 * - Normalizes Unicode to NFC
 * - Removes leading/trailing punctuation
 */
export function normalizeDefinitionText(def: string): string {
  if (!def) return '';
  return def
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/^[\s,;.:\-–—]+|[\s,;.:\-–—]+$/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Checks if two definitions are compatible/equivalent:
 * - Exact match after normalization
 * - One definition contains the other completely
 * - One is empty
 */
export function areDefinitionsCompatible(defA: string, defB: string): boolean {
  const normA = normalizeDefinitionText(defA);
  const normB = normalizeDefinitionText(defB);

  if (!normA || !normB) return true;
  if (normA === normB) return true;

  // If one contains the other (e.g. "đàm phán" vs "đàm phán hợp đồng")
  if (normA.includes(normB) || normB.includes(normA)) {
    return true;
  }

  return false;
}

/**
 * Reconciles Quizlet cards with the existing deck in LexiPulse:
 * - Normalizes term/POS/IPA using normalizeQuizletCard
 * - Strips duplicates in batch (keeps first appearance)
 * - Compares with existing deck by exact normalized term (does NOT auto-merge across lemmas)
 * - Classifies into: 'new' | 'existing' | 'needs_review'
 */
export function reconcileQuizletWithDeck(
  quizletCards: QuizletCardItem[],
  deckWords: WordItem[]
): ReconciliationResult {
  // Build lookup map of existing words in deck by exact normalized term
  const deckMap = new Map<string, WordItem>();
  for (const w of deckWords) {
    const norm = normalizeWordTerm(w.word);
    if (norm && !deckMap.has(norm)) {
      deckMap.set(norm, w);
    }
  }

  const seenInBatch = new Set<string>();
  const items: QuizletReconciledWord[] = [];
  let duplicatesInBatch = 0;

  for (const card of quizletCards) {
    const rawCardTerm = card.term || '';
    const rawCardDef = card.definition || '';
    if (!rawCardTerm.trim()) continue;

    const norm = normalizeQuizletCard(rawCardTerm, rawCardDef);
    const cleanTerm = norm.word;
    if (!cleanTerm) continue;

    const normalizedTerm = normalizeWordTerm(cleanTerm);
    if (!normalizedTerm) continue;

    // Deduplicate within the imported batch
    if (seenInBatch.has(normalizedTerm)) {
      duplicatesInBatch++;
      continue;
    }
    seenInBatch.add(normalizedTerm);

    const cleanDefinition = norm.definition;
    const normalizedDefinition = normalizeDefinitionText(cleanDefinition);
    const existing = deckMap.get(normalizedTerm);

    if (!existing) {
      // 1. New word (Chưa có)
      items.push({
        term: cleanTerm,
        normalizedTerm,
        definition: cleanDefinition,
        normalizedDefinition,
        status: 'new',
        selected: true, // Selected by default for easy import
        extractedPos: norm.pos.length > 0 ? norm.pos : undefined,
        extractedIpa: norm.extractedIpa || undefined,
        rawTerm: norm.rawWord,
        rawDefinition: norm.rawDefinition,
      });
    } else {
      // Word already exists in deck -> check definition compatibility
      const existingDef = existing.vietnameseDefinition || '';
      const isCompatible = areDefinitionsCompatible(cleanDefinition, existingDef);

      if (isCompatible) {
        // 2. Existing word with matching definition (Đã có)
        items.push({
          term: cleanTerm,
          normalizedTerm,
          definition: cleanDefinition,
          normalizedDefinition,
          status: 'existing',
          selected: false,
          extractedPos: norm.pos.length > 0 ? norm.pos : existing.pos,
          extractedIpa: norm.extractedIpa || existing.phonetics?.us,
          rawTerm: norm.rawWord,
          rawDefinition: norm.rawDefinition,
          existingWord: existing,
          existingDefinition: existingDef,
        });
      } else {
        // 3. Same word but different meaning -> Needs review (Cần kiểm tra)
        items.push({
          term: cleanTerm,
          normalizedTerm,
          definition: cleanDefinition,
          normalizedDefinition,
          status: 'needs_review',
          selected: false,
          extractedPos: norm.pos.length > 0 ? norm.pos : existing.pos,
          extractedIpa: norm.extractedIpa || existing.phonetics?.us,
          rawTerm: norm.rawWord,
          rawDefinition: norm.rawDefinition,
          existingWord: existing,
          existingDefinition: existingDef,
          resolutionChoice: 'keep_existing',
        });
      }
    }
  }

  const newCount = items.filter((i) => i.status === 'new').length;
  const existingCount = items.filter((i) => i.status === 'existing').length;
  const needsReviewCount = items.filter((i) => i.status === 'needs_review').length;

  return {
    items,
    summary: {
      newCount,
      existingCount,
      needsReviewCount,
      totalUnique: items.length,
      duplicatesInBatch,
    },
  };
}
