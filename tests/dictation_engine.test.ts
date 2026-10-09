import { describe, it, expect } from 'vitest';
import {
  alignDictationStrings,
  calculateDictationRating,
  cleanPunctuationForComparison,
  findNextHintTargetIndex,
  normalizeDictationInput,
} from '../src/utils/dictationDiff';

describe('Dictation Diff & Alignment Algorithm', () => {
  describe('Text Normalization & Punctuation Cleanup', () => {
    it('normalizes Unicode NFC correctly (e.g. café, tiếng Việt)', () => {
      // Decomposed cafe (cafe + combining acute accent) vs precomposed café
      const decomposed = 'cafe\u0301';
      const precomposed = 'café';
      expect(normalizeDictationInput(decomposed)).toBe(precomposed);
    });

    it('normalizes curly quotes to standard quotes and trims whitespace', () => {
      expect(normalizeDictationInput('  “hello”  ‘world’  ')).toBe('"hello" \'world\'');
      expect(normalizeDictationInput('don’t   worry')).toBe("don't worry");
    });

    it('cleans mobile auto-inserted trailing period when target has no period', () => {
      expect(cleanPunctuationForComparison('apple.', 'apple')).toBe('apple');
      expect(cleanPunctuationForComparison('apple,', 'apple')).toBe('apple');
    });

    it('preserves trailing period when target legitimately has one', () => {
      expect(cleanPunctuationForComparison('etc.', 'etc.')).toBe('etc.');
    });

    it('preserves hyphens and accents in meaningful vocabulary', () => {
      expect(cleanPunctuationForComparison('state-of-the-art', 'state-of-the-art')).toBe(
        'state-of-the-art'
      );
      expect(cleanPunctuationForComparison('résumé', 'résumé')).toBe('résumé');
    });
  });

  describe('Sequence Alignment Diff', () => {
    it('handles exact match correctly', () => {
      const res = alignDictationStrings('apple', 'apple');
      expect(res.isExactMatch).toBe(true);
      expect(res.editDistance).toBe(0);
      expect(res.correctCount).toBe(5);
      expect(res.tokens.every((t) => t.status === 'correct')).toBe(true);
    });

    it('handles missing character: "aple" vs "apple" preserves correct alignment for other characters', () => {
      // The user prompt example:
      // "Ví dụ: đáp án 'apple', nhập 'aple' thì đánh dấu một vị trí thiếu, giữ các ký tự còn lại là đúng."
      const res = alignDictationStrings('aple', 'apple');
      expect(res.isExactMatch).toBe(false);
      expect(res.editDistance).toBe(1);
      expect(res.missingCount).toBe(1);
      expect(res.correctCount).toBe(4);

      // Check alignment: 'a', 'p', [missing 'p'], 'l', 'e'
      expect(res.tokens.map((t) => t.status)).toEqual([
        'correct',
        'correct',
        'missing',
        'correct',
        'correct',
      ]);
      expect(res.tokens[2].targetChar).toBe('p');
      expect(res.tokens[2].targetIndex).toBe(2);
    });

    it('handles extra character: "applle" vs "apple"', () => {
      const res = alignDictationStrings('applle', 'apple');
      expect(res.isExactMatch).toBe(false);
      expect(res.editDistance).toBe(1);
      expect(res.extraCount).toBe(1);
      expect(res.correctCount).toBe(5);

      const extraToken = res.tokens.find((t) => t.status === 'extra');
      expect(extraToken).toBeDefined();
      expect(extraToken?.inputChar).toBe('l');
    });

    it('handles wrong character: "apxle" vs "apple"', () => {
      const res = alignDictationStrings('apxle', 'apple');
      expect(res.isExactMatch).toBe(false);
      expect(res.editDistance).toBe(1);
      expect(res.wrongCount).toBe(1);
      expect(res.correctCount).toBe(4);

      const wrongToken = res.tokens.find((t) => t.status === 'wrong');
      expect(wrongToken).toBeDefined();
      expect(wrongToken?.inputChar).toBe('x');
      expect(wrongToken?.targetChar).toBe('p');
    });

    it('handles accent mismatch as wrong character: "cafe" vs "café"', () => {
      const res = alignDictationStrings('cafe', 'café');
      expect(res.isExactMatch).toBe(false);
      expect(res.wrongCount).toBe(1);
      expect(res.correctCount).toBe(3);
      expect(res.tokens[3].status).toBe('wrong');
      expect(res.tokens[3].inputChar).toBe('e');
      expect(res.tokens[3].targetChar).toBe('é');
    });

    it('handles multi-word phrases with spaces: "look forward to" vs "look foward to"', () => {
      const res = alignDictationStrings('look foward to', 'look forward to');
      expect(res.isExactMatch).toBe(false);
      expect(res.missingCount).toBe(1); // missing 'r' in forward
      const missingToken = res.tokens.find((t) => t.status === 'missing');
      expect(missingToken?.targetChar).toBe('r');
    });
  });

  describe('Progressive Hint Discovery', () => {
    it('finds the first error position for progressive hint', () => {
      const res = alignDictationStrings('aple', 'apple');
      const revealed = new Set<number>();
      const hint = findNextHintTargetIndex(res.tokens, revealed);

      expect(hint).not.toBeNull();
      expect(hint?.targetChar).toBe('p');
      expect(hint?.targetIndex).toBe(2);

      // Once revealed, finding next returns null if no other errors exist
      revealed.add(hint!.targetIndex);
      const nextHint = findNextHintTargetIndex(res.tokens, revealed);
      expect(nextHint).toBeNull();
    });
  });

  describe('Memory Retention Scoring & FSRS v5 Mapping', () => {
    it('1. Correct on first attempt without hints -> Easy (4)', () => {
      const rating = calculateDictationRating(
        {
          firstAttemptCorrect: true,
          firstAttemptEditDistance: 0,
          incorrectSubmissionCount: 0,
          hintsUsedCount: 0,
          revealedAnswer: false,
          audioPlayCount: 1,
        },
        5
      );
      expect(rating).toBe(4);
    });

    it('2. Multiple audio replays before first submission do NOT penalize score', () => {
      const rating = calculateDictationRating(
        {
          firstAttemptCorrect: true,
          firstAttemptEditDistance: 0,
          incorrectSubmissionCount: 0,
          hintsUsedCount: 0,
          revealedAnswer: false,
          audioPlayCount: 6, // Listened 6 times
        },
        5
      );
      expect(rating).toBe(4); // Still Easy (4)!
    });

    it('3. Minor error self-corrected without hints -> Good (3)', () => {
      const rating = calculateDictationRating(
        {
          firstAttemptCorrect: false,
          firstAttemptEditDistance: 1, // missed 1 char
          incorrectSubmissionCount: 1, // failed once, then succeeded
          hintsUsedCount: 0,
          revealedAnswer: false,
          audioPlayCount: 2,
        },
        5
      );
      expect(rating).toBe(3); // Good (3)!
    });

    it('4. Needed hint to succeed -> Hard (2)', () => {
      const rating = calculateDictationRating(
        {
          firstAttemptCorrect: false,
          firstAttemptEditDistance: 1,
          incorrectSubmissionCount: 1,
          hintsUsedCount: 1, // user requested letter hint
          revealedAnswer: false,
          audioPlayCount: 2,
        },
        5
      );
      expect(rating).toBe(2); // Hard (2)!
    });

    it('5. Failed multiple times (>= 2 checks) before succeeding without hints -> Hard (2)', () => {
      const rating = calculateDictationRating(
        {
          firstAttemptCorrect: false,
          firstAttemptEditDistance: 1,
          incorrectSubmissionCount: 3, // failed 3 times
          hintsUsedCount: 0,
          revealedAnswer: false,
          audioPlayCount: 2,
        },
        5
      );
      expect(rating).toBe(2); // Hard (2)!
    });

    it('6. Revealed answer -> Again (1), even if typed subsequently', () => {
      const rating = calculateDictationRating(
        {
          firstAttemptCorrect: false,
          firstAttemptEditDistance: 3,
          incorrectSubmissionCount: 1,
          hintsUsedCount: 0,
          revealedAnswer: true, // Clicked "Xem đáp án"
          audioPlayCount: 3,
        },
        5
      );
      expect(rating).toBe(1); // Again (1)!
    });
  });
});
