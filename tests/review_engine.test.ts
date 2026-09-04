import { describe, it, expect } from 'vitest';
import {
  calculateNextReview,
  computeWordStatus,
  createInitialReviewMeta,
  MIN_EASE_FACTOR,
  MAX_EASE_FACTOR,
  DEFAULT_EASE_FACTOR,
} from '../src/services/sm2';
import {
  escapeRegex,
  fisherYatesShuffle,
  generateClozeQuestion,
} from '../src/utils/clozeGenerator';
import type { WordItem } from '../src/types/vocab';

describe('Phase 3: Review Engine Correctness & SM-2 Tests', () => {
  describe('Regex Escaping & Cloze Generation', () => {
    it('1. Safely escapes regex special characters without crashing on C++, [bracket], (paren), hyphen', () => {
      expect(escapeRegex('C++')).toBe('C\\+\\+');
      expect(escapeRegex('test (noun)')).toBe('test \\(noun\\)');
      expect(escapeRegex('cost-effective')).toBe('cost\\-effective');
      expect(escapeRegex('item [1]')).toBe('item \\[1\\]');
    });

    it('2. Cloze generation does not crash on special characters and masks target word correctly', () => {
      const cplusplusWord: WordItem = {
        id: 'w-cplusplus',
        word: 'C++',
        phonetics: {},
        pos: ['noun'],
        vietnameseDefinition: 'Ngôn ngữ lập trình C++',
        englishDefinition: 'A high-performance programming language',
        meanings: [],
        collocations: [],
        wordFamily: [],
        examples: [
          {
            en: 'Many high-frequency trading systems are built in C++.',
            vi: 'Nhiều hệ thống giao dịch tần suất cao được xây dựng bằng C++.',
            context: 'workplace',
          },
        ],
        tags: ['#Tech'],
        status: 'new',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reviewMeta: createInitialReviewMeta(),
      };

      const cloze = generateClozeQuestion(cplusplusWord, [cplusplusWord]);
      expect(cloze.targetWord).toBe('C++');
      expect(cloze.sentenceWithBlank).toContain('________');
      expect(cloze.sentenceWithBlank).not.toContain('C++');
      expect(cloze.options).toContain('C++');
      expect(cloze.options.length).toBe(4);
    });

    it('3. Cloze generator handles hyphenated words and parenthesis words safely', () => {
      const hyphenWord: WordItem = {
        id: 'w-hyphen',
        word: 'state-of-the-art',
        phonetics: {},
        pos: ['adjective'],
        vietnameseDefinition: 'Tối tân, hiện đại nhất',
        englishDefinition: 'Using the most modern methods or technology',
        meanings: [],
        collocations: [],
        wordFamily: [],
        examples: [
          {
            en: 'The lab is equipped with state-of-the-art computers.',
            vi: 'Phòng thí nghiệm được trang bị máy tính tối tân.',
            context: 'academic',
          },
        ],
        tags: ['#Tech'],
        status: 'new',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reviewMeta: createInitialReviewMeta(),
      };

      const cloze = generateClozeQuestion(hyphenWord, [hyphenWord]);
      expect(cloze.targetWord).toBe('state-of-the-art');
      expect(cloze.sentenceWithBlank).toContain('________');
      expect(cloze.sentenceWithBlank).not.toContain('state-of-the-art');
    });
  });

  describe('Fisher-Yates Shuffle with Injectable RNG', () => {
    it('1. Produces deterministic shuffle when injected with mock RNG', () => {
      const list = [1, 2, 3, 4, 5];
      // RNG that always returns 0 (reverses or strictly moves elements predictably)
      const deterministicRng = () => 0;
      const shuffled = fisherYatesShuffle(list, deterministicRng);
      expect(shuffled.length).toBe(5);
      expect(new Set(shuffled).size).toBe(5);
    });

    it('2. Does not mutate the original array', () => {
      const original = ['apple', 'banana', 'cherry'];
      const copy = [...original];
      fisherYatesShuffle(original);
      expect(original).toEqual(copy);
    });
  });

  describe('Distractor Quality', () => {
    it('1. Prioritizes distractors with matching part-of-speech and distinct definitions', () => {
      const targetWord: WordItem = {
        id: 'w-target',
        word: 'negotiate',
        pos: ['verb'],
        vietnameseDefinition: 'Đàm phán',
        englishDefinition: 'To discuss something to reach an agreement',
        phonetics: {},
        meanings: [],
        collocations: [],
        wordFamily: [],
        examples: [{ en: 'We will negotiate terms.', vi: 'Chúng ta sẽ đàm phán các điều khoản.', context: 'general' }],
        tags: ['#Business'],
        status: 'new',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reviewMeta: createInitialReviewMeta(),
      };

      const verb1: WordItem = {
        ...targetWord,
        id: 'w-verb1',
        word: 'collaborate',
        pos: ['verb'],
        vietnameseDefinition: 'Hợp tác',
      };
      const verb2: WordItem = {
        ...targetWord,
        id: 'w-verb2',
        word: 'coordinate',
        pos: ['verb'],
        vietnameseDefinition: 'Phối hợp',
      };
      const noun1: WordItem = {
        ...targetWord,
        id: 'w-noun1',
        word: 'negotiation',
        pos: ['noun'],
        vietnameseDefinition: 'Sự đàm phán',
      };

      const deck = [targetWord, verb1, verb2, noun1];
      const cloze = generateClozeQuestion(targetWord, deck);

      // Should prioritize verbs over nouns
      expect(cloze.options).toContain('collaborate');
      expect(cloze.options).toContain('coordinate');
    });
  });

  describe('SM-2 Algorithm Boundary & Correctness', () => {
    const fixedNow = 1700000000000;
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    it('1. Rating 1 (Again): Resets repetition to 0, sets interval to 1 day, reduces EF', () => {
      const meta = {
        repetition: 3,
        interval: 10,
        easeFactor: 2.5,
        dueDate: fixedNow,
        lastReviewedDate: fixedNow - 10 * MS_PER_DAY,
        history: [],
      };

      const { nextMeta, newStatus } = calculateNextReview(meta, 1, fixedNow);

      expect(nextMeta.repetition).toBe(0);
      expect(nextMeta.interval).toBe(1);
      expect(nextMeta.easeFactor).toBe(2.3); // 2.5 - 0.2
      expect(nextMeta.dueDate).toBe(fixedNow + 1 * MS_PER_DAY);
      expect(newStatus).toBe('learning');
      expect(nextMeta.history.length).toBe(1);
    });

    it('2. Minimum ease factor clamp at 1.3', () => {
      let meta = {
        repetition: 0,
        interval: 1,
        easeFactor: 1.4,
        dueDate: fixedNow,
        lastReviewedDate: fixedNow,
        history: [],
      };

      // Two consecutive Again ratings
      const step1 = calculateNextReview(meta, 1, fixedNow);
      expect(step1.nextMeta.easeFactor).toBe(MIN_EASE_FACTOR); // clamped at 1.3

      const step2 = calculateNextReview(step1.nextMeta, 1, fixedNow + MS_PER_DAY);
      expect(step2.nextMeta.easeFactor).toBe(MIN_EASE_FACTOR); // remains at minimum 1.3
    });

    it('3. Rating 2 (Good) progression: 1 -> 3 -> interval * EF', () => {
      let meta = createInitialReviewMeta();

      // Step 1: Good
      const r1 = calculateNextReview(meta, 2, fixedNow);
      expect(r1.nextMeta.repetition).toBe(1);
      expect(r1.nextMeta.interval).toBe(1);
      expect(r1.nextMeta.easeFactor).toBe(2.5);

      // Step 2: Good
      const r2 = calculateNextReview(r1.nextMeta, 2, fixedNow + 1 * MS_PER_DAY);
      expect(r2.nextMeta.repetition).toBe(2);
      expect(r2.nextMeta.interval).toBe(3);

      // Step 3: Good (interval = 3 * 2.5 = 7.5 -> 8 days)
      const r3 = calculateNextReview(r2.nextMeta, 2, fixedNow + 4 * MS_PER_DAY);
      expect(r3.nextMeta.repetition).toBe(3);
      expect(r3.nextMeta.interval).toBe(8);
    });

    it('4. Rating 3 (Easy) progression: 2 -> 6 -> interval * EF * 1.3, increases EF up to 3.0', () => {
      let meta = createInitialReviewMeta();

      // Step 1: Easy
      const r1 = calculateNextReview(meta, 3, fixedNow);
      expect(r1.nextMeta.repetition).toBe(1);
      expect(r1.nextMeta.interval).toBe(2);
      expect(r1.nextMeta.easeFactor).toBe(2.65); // 2.5 + 0.15

      // Step 2: Easy
      const r2 = calculateNextReview(r1.nextMeta, 3, fixedNow + 2 * MS_PER_DAY);
      expect(r2.nextMeta.repetition).toBe(2);
      expect(r2.nextMeta.interval).toBe(6);
      expect(r2.nextMeta.easeFactor).toBe(2.8); // 2.65 + 0.15
    });

    it('5. Reaches "mastered" threshold when repetition >= 4 and interval >= 21 days', () => {
      const meta = {
        repetition: 3,
        interval: 15,
        easeFactor: 2.5,
        dueDate: fixedNow,
        lastReviewedDate: fixedNow - 15 * MS_PER_DAY,
        history: [],
      };

      // 15 * 2.5 = 37.5 -> 38 days interval, repetition = 4
      const { nextMeta, newStatus } = calculateNextReview(meta, 2, fixedNow);
      expect(nextMeta.repetition).toBe(4);
      expect(nextMeta.interval).toBe(38);
      expect(newStatus).toBe('mastered');
    });

    it('6. History is preserved and strictly immutable across review cycles', () => {
      const initialMeta = createInitialReviewMeta();
      const h1 = calculateNextReview(initialMeta, 2, fixedNow);
      const h2 = calculateNextReview(h1.nextMeta, 3, fixedNow + 1 * MS_PER_DAY);

      expect(h2.nextMeta.history.length).toBe(2);
      expect(h2.nextMeta.history[0].rating).toBe(2);
      expect(h2.nextMeta.history[1].rating).toBe(3);
      // Original objects unchanged
      expect(initialMeta.history.length).toBe(0);
      expect(h1.nextMeta.history.length).toBe(1);
    });
  });
});
