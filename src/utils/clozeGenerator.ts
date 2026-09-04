import type { ClozeQuestion, WordItem } from '../types/vocab';

/**
 * Escapes all regular expression special characters in a string.
 * Prevents crashes on words like "C++", "(paren)", "[brackets]", "cost-effective".
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

/**
 * Modern Fisher-Yates (Knuth) Shuffle algorithm.
 * Accepts an optional RNG function for deterministic testing.
 * Does not mutate the source array.
 */
export function fisherYatesShuffle<T>(array: T[], rng: () => number = Math.random): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

export interface ClozeGeneratorOptions {
  rng?: () => number;
}

const DEFAULT_FALLBACK_DISTRACTORS = [
  'facilitate',
  'preliminary',
  'substantial',
  'comprehensive',
  'implement',
  'coordinate',
  'objective',
  'initiative',
];

/**
 * Generates a high-quality Cloze Question for a given target word.
 * - Safely masks target word using escaped regex
 * - Distractor selection prioritizes:
 *   1. Same part of speech (pos)
 *   2. Similar tags/difficulty
 *   3. Distinct definition / meaning
 * - Shuffles options with Fisher-Yates algorithm
 */
export function generateClozeQuestion(
  word: WordItem,
  allWords: WordItem[],
  options: ClozeGeneratorOptions = {}
): ClozeQuestion {
  const rng = options.rng || Math.random;

  // 1. Pick best example sentence (prefer TOEIC / workplace, fallback to general or first available)
  const ex =
    word.examples.find((e) => e.context === 'toeic' || e.context === 'workplace') ||
    word.examples[0] || {
      en: `It is essential to understand how to apply ${word.word} in business.`,
      vi: `Điều quan trọng là hiểu cách áp dụng từ này trong kinh doanh.`,
      context: 'toeic',
    };

  // 2. Safely escape regex to mask target word
  const escaped = escapeRegex(word.word);
  // Match word boundary if possible, or exact string if contains non-word chars (like C++)
  const wordBoundaryRegex = /^[a-zA-Z0-9_-]+$/.test(word.word)
    ? new RegExp(`\\b${escaped}\\b`, 'gi')
    : new RegExp(escaped, 'gi');

  let maskedSentence = ex.en.replace(wordBoundaryRegex, '________');

  // Fallback for inflected forms (e.g. "negotiating", "facilitates")
  if (!maskedSentence.includes('________') && word.word.length > 3) {
    const root = escapeRegex(word.word.slice(0, -1));
    const inflectionRegex = new RegExp(`\\b${root}[a-z]*\\b`, 'gi');
    maskedSentence = ex.en.replace(inflectionRegex, '________');
  }

  // Absolute fallback if sentence didn't contain the word
  if (!maskedSentence.includes('________')) {
    maskedSentence = `The organization decided to ________ the primary initiative.`;
  }

  // 3. Select distractors
  const targetPos = new Set(word.pos || ['noun']);
  const targetTags = new Set(word.tags || []);
  const targetDef = (word.vietnameseDefinition || '').trim().toLowerCase();

  // Filter valid candidate words
  const candidates = allWords.filter(
    (w) =>
      w.word.toLowerCase() !== word.word.toLowerCase() &&
      w.vietnameseDefinition?.trim().toLowerCase() !== targetDef
  );

  // Score candidate quality for distractor fitness
  const scoredCandidates = candidates.map((w) => {
    let score = 0;
    // POS match
    if (w.pos && w.pos.some((p) => targetPos.has(p))) {
      score += 5;
    }
    // Tag match
    if (w.tags && w.tags.some((t) => targetTags.has(t))) {
      score += 2;
    }
    return { word: w.word, score };
  });

  // Sort by distractor quality score, with randomized tie-breaker
  scoredCandidates.sort((a, b) => b.score - a.score + (rng() - 0.5));

  const chosenDistractors: string[] = [];
  for (const candidate of scoredCandidates) {
    if (chosenDistractors.length >= 3) break;
    if (!chosenDistractors.includes(candidate.word)) {
      chosenDistractors.push(candidate.word);
    }
  }

  // Pad with fallback business distractors if deck is small
  for (const fallback of DEFAULT_FALLBACK_DISTRACTORS) {
    if (chosenDistractors.length >= 3) break;
    if (
      fallback.toLowerCase() !== word.word.toLowerCase() &&
      !chosenDistractors.includes(fallback)
    ) {
      chosenDistractors.push(fallback);
    }
  }

  // 4. Combine with target word and shuffle options using Fisher-Yates
  const optionsList = fisherYatesShuffle([word.word, ...chosenDistractors], rng);

  return {
    word,
    sentenceWithBlank: maskedSentence,
    targetWord: word.word,
    options: optionsList,
    contextVi: ex.vi,
    hintPos: (word.pos || ['noun']).join(', '),
    hintDefinition: word.vietnameseDefinition,
  };
}
