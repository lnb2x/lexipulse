import type { WordItem } from '../types/vocab';
import { isPlaceholderDefinition } from '../services/quizlet/quizletNormalizer';

export interface WordTranslationAudit {
  isComplete: boolean;
  missingFields: Array<'vietnameseDefinition' | 'meanings' | 'examples' | 'collocations' | 'wordFamily'>;
  details: {
    mainDefMissing: boolean;
    missingMeaningIndices: number[];
    missingExampleIndices: number[];
    missingCollocationIndices: number[];
    missingWordFamilyIndices: number[];
  };
  totalMissingItems: number;
  sampleIssues: string[];
}

const KNOWN_PLACEHOLDERS = new Set<string>([
  'cụm từ thông dụng',
  'cum tu thong dung',
  '[chưa có định nghĩa]',
  'chưa có định nghĩa',
  'chua co dinh nghia',
  '[chưa có nghĩa]',
  'chưa có nghĩa',
  'chua co nghia',
  '[chưa có bản dịch]',
  'chưa có bản dịch',
  'chua co ban dich',
  'không có nghĩa',
  'khong co nghia',
  'n/a',
  'na',
  'none',
  'undefined',
  'null',
  '...',
  '-',
  '--',
]);

/**
 * Checks if a Vietnamese translation text is missing, empty, a placeholder,
 * or suspiciously untranslated (e.g. duplicating English source text).
 *
 * NOTE: Lack of Vietnamese diacritics alone is NEVER used as a criteria.
 */
export function isMissingOrUntranslated(text?: string | null, sourceEn?: string | null): boolean {
  if (text === undefined || text === null) return true;
  const trimmed = text.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();

  // 1. Direct match with known placeholders
  if (KNOWN_PLACEHOLDERS.has(lower)) return true;

  // 2. Quizlet placeholder regexes
  if (isPlaceholderDefinition(trimmed)) return true;

  // 3. Trailing/leading ellipsis placeholders or generic symbols
  if (/^(\.\.\.|\?|!|\/|\\)+$/.test(trimmed)) return true;
  if (/^(placeholder|todo|tbd)\b/i.test(lower)) return true;

  // 4. Untranslated: Exact match with source English term/phrase/sentence
  if (sourceEn) {
    const cleanSource = sourceEn.trim().toLowerCase();
    if (cleanSource && lower === cleanSource) {
      return true;
    }
  }

  return false;
}

/**
 * Audits a WordItem against all 5 required fields:
 * - vietnameseDefinition (main definition)
 * - meanings[].vietnameseDefinition (for items with englishDefinition)
 * - examples[].vi (for items with en)
 * - collocations[].meaningVi (for items with phrase)
 * - wordFamily[].meaningVi (for items with word)
 *
 * CRITICAL RULES:
 * - Only requires translations for items that have source content!
 * - Never requires filling empty arrays or inventing non-existent items.
 * - Does NOT reject valid unaccented Vietnamese.
 */
export function auditWordTranslation(word: WordItem): WordTranslationAudit {
  const missingFields: Array<'vietnameseDefinition' | 'meanings' | 'examples' | 'collocations' | 'wordFamily'> = [];
  const missingMeaningIndices: number[] = [];
  const missingExampleIndices: number[] = [];
  const missingCollocationIndices: number[] = [];
  const missingWordFamilyIndices: number[] = [];
  const sampleIssues: string[] = [];

  // 1. Main vietnameseDefinition
  const mainDefMissing = isMissingOrUntranslated(word.vietnameseDefinition, word.word);
  if (mainDefMissing) {
    missingFields.push('vietnameseDefinition');
    sampleIssues.push(`Nghĩa chính trống hoặc chưa dịch: "${word.vietnameseDefinition || ''}"`);
  }

  // 2. meanings[].vietnameseDefinition
  if (Array.isArray(word.meanings) && word.meanings.length > 0) {
    word.meanings.forEach((m, idx) => {
      // Only require translation if there is source englishDefinition or POS
      if (m && (m.englishDefinition || m.pos)) {
        if (isMissingOrUntranslated(m.vietnameseDefinition, m.englishDefinition)) {
          missingMeaningIndices.push(idx);
          if (sampleIssues.length < 3) {
            sampleIssues.push(`Nghĩa con [${idx + 1}] (${m.pos || 'pos'}) thiếu tiếng Việt: "${m.englishDefinition || ''}"`);
          }
        }
      }
    });
    if (missingMeaningIndices.length > 0) {
      missingFields.push('meanings');
    }
  }

  // 3. examples[].vi
  if (Array.isArray(word.examples) && word.examples.length > 0) {
    word.examples.forEach((ex, idx) => {
      // Only require translation if there is source English sentence
      if (ex && ex.en && ex.en.trim().length > 0) {
        if (isMissingOrUntranslated(ex.vi, ex.en)) {
          missingExampleIndices.push(idx);
          if (sampleIssues.length < 3) {
            sampleIssues.push(`Ví dụ [${idx + 1}] thiếu tiếng Việt: "${ex.en}"`);
          }
        }
      }
    });
    if (missingExampleIndices.length > 0) {
      missingFields.push('examples');
    }
  }

  // 4. collocations[].meaningVi
  if (Array.isArray(word.collocations) && word.collocations.length > 0) {
    word.collocations.forEach((col, idx) => {
      // Only require translation if there is a phrase
      if (col && col.phrase && col.phrase.trim().length > 0) {
        if (isMissingOrUntranslated(col.meaningVi, col.phrase)) {
          missingCollocationIndices.push(idx);
          if (sampleIssues.length < 3) {
            sampleIssues.push(`Cụm từ [${idx + 1}] "${col.phrase}" thiếu nghĩa tiếng Việt`);
          }
        }
      }
    });
    if (missingCollocationIndices.length > 0) {
      missingFields.push('collocations');
    }
  }

  // 5. wordFamily[].meaningVi
  if (Array.isArray(word.wordFamily) && word.wordFamily.length > 0) {
    word.wordFamily.forEach((wf, idx) => {
      // Only require translation if there is a target word
      if (wf && wf.word && wf.word.trim().length > 0) {
        if (isMissingOrUntranslated(wf.meaningVi, wf.word)) {
          missingWordFamilyIndices.push(idx);
          if (sampleIssues.length < 3) {
            sampleIssues.push(`Họ từ [${idx + 1}] "${wf.word}" (${wf.pos || 'pos'}) thiếu nghĩa tiếng Việt`);
          }
        }
      }
    });
    if (missingWordFamilyIndices.length > 0) {
      missingFields.push('wordFamily');
    }
  }

  const totalMissingItems =
    (mainDefMissing ? 1 : 0) +
    missingMeaningIndices.length +
    missingExampleIndices.length +
    missingCollocationIndices.length +
    missingWordFamilyIndices.length;

  return {
    isComplete: totalMissingItems === 0,
    missingFields,
    details: {
      mainDefMissing,
      missingMeaningIndices,
      missingExampleIndices,
      missingCollocationIndices,
      missingWordFamilyIndices,
    },
    totalMissingItems,
    sampleIssues,
  };
}

/**
 * Returns true if a word's translations are 100% complete across all populated fields.
 */
export function isWordTranslationComplete(word: WordItem): boolean {
  return auditWordTranslation(word).isComplete;
}
