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
  applyFSRSReview,
  previewFSRS,
  migrateLegacyMetaToFSRS,
} from '../src/services/fsrs/fsrsService';
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

  describe('FSRS Spaced Repetition Engine Correctness & Dynamics', () => {
    const fixedNow = 1700000000000;
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    it('1. Rating 1 (Again): Triggers short-term relearning step without corrupting history', () => {
      const initialMeta = createInitialReviewMeta(fixedNow);
      const { nextMeta, newStatus } = calculateNextReview(initialMeta, 1, fixedNow);

      expect(newStatus).toBe('learning');
      expect(nextMeta.fsrs).toBeDefined();
      expect(nextMeta.history.length).toBe(1);
      expect(nextMeta.history[0].rating).toBe(1);
      // Rating 1 enters short-term relearning (due within minutes, not jumping days ahead)
      expect(nextMeta.dueDate).toBeLessThan(fixedNow + MS_PER_DAY);
      expect(nextMeta.dueDate).toBeGreaterThanOrEqual(fixedNow);
    });

    it('2. 4-Rating Progression (Again, Hard, Good, Easy): Easy gives a significantly larger interval leap than Good/Hard', () => {
      const initialMeta = createInitialReviewMeta(fixedNow);

      const preview = previewFSRS(initialMeta, fixedNow, 0.90);
      expect(preview[1]).toBeDefined(); // Again
      expect(preview[2]).toBeDefined(); // Hard
      expect(preview[3]).toBeDefined(); // Good
      expect(preview[4]).toBeDefined(); // Easy

      // Easy nextDue must be strictly greater than Good, which is >= Hard, which is > Again
      expect(preview[4].nextDue).toBeGreaterThan(preview[3].nextDue);
      expect(preview[3].nextDue).toBeGreaterThanOrEqual(preview[2].nextDue);
      expect(preview[2].nextDue).toBeGreaterThan(preview[1].nextDue);

      // Easy scheduled interval is multi-day even on first review, avoiding annoying premature repeats
      expect(preview[4].scheduledDays).toBeGreaterThanOrEqual(2);
    });

    it('3. Reaches "mastered" threshold when repetition >= 4 and interval >= 21 days', () => {
      const masteredCardMeta = {
        ...createInitialReviewMeta(fixedNow),
        repetition: 4,
        interval: 25,
        dueDate: fixedNow + 25 * MS_PER_DAY,
        fsrs: {
          due: fixedNow + 25 * MS_PER_DAY,
          stability: 25,
          difficulty: 3,
          elapsed_days: 20,
          scheduled_days: 25,
          reps: 4,
          lapses: 0,
          state: 2, // Review state
          last_review: fixedNow,
        },
      };

      const status = computeWordStatus(masteredCardMeta);
      expect(status).toBe('mastered');
    });

    it('4. History is preserved and strictly immutable across review cycles', () => {
      const initialMeta = createInitialReviewMeta(fixedNow);
      const h1 = calculateNextReview(initialMeta, 3, fixedNow); // Good
      const h2 = calculateNextReview(h1.nextMeta, 4, fixedNow + 3 * MS_PER_DAY); // Easy

      expect(h2.nextMeta.history.length).toBe(2);
      expect(h2.nextMeta.history[0].rating).toBe(3);
      expect(h2.nextMeta.history[1].rating).toBe(4);
      // Original objects unchanged
      expect(initialMeta.history.length).toBe(0);
      expect(h1.nextMeta.history.length).toBe(1);
    });

    it('5. Cram Mode (Extra Practice): Does NOT alter scheduled dueDate or SRS memory model', () => {
      const scheduledMeta = createInitialReviewMeta(fixedNow);
      const scheduledResult = applyFSRSReview(scheduledMeta, 3, fixedNow, 0.90, 'scheduled');

      const originalDueDate = scheduledResult.nextMeta.dueDate;
      const originalHistoryLen = scheduledResult.nextMeta.history.length;

      // Now do a cram review
      const cramResult = applyFSRSReview(scheduledResult.nextMeta, 4, fixedNow + 1000, 0.90, 'cram');

      // Due date and history must NOT be mutated by cram session
      expect(cramResult.nextMeta.dueDate).toBe(originalDueDate);
      expect(cramResult.nextMeta.history.length).toBe(originalHistoryLen);
    });

    it('6. Preview consistency: previewFSRS matches applyFSRSReview exactly at the same timestamp', () => {
      const meta = createInitialReviewMeta(fixedNow);
      const preview = previewFSRS(meta, fixedNow, 0.90);
      const executed = applyFSRSReview(meta, 3, fixedNow, 0.90, 'scheduled');

      expect(executed.nextDue).toBe(preview[3].nextDue);
      expect(executed.nextMeta.interval).toBe(preview[3].scheduledDays);
    });

    it('7. Lossless Migration: Preserves existing dueDate and legacy backup for rollback safety', () => {
      const targetFutureDue = fixedNow + 14 * MS_PER_DAY;
      const legacyMeta = {
        repetition: 3,
        interval: 10,
        easeFactor: 2.5,
        dueDate: targetFutureDue,
        lastReviewedDate: fixedNow - 10 * MS_PER_DAY,
        history: [
          { date: fixedNow - 14 * MS_PER_DAY, rating: 2 as const, interval: 1, easeFactor: 2.5, repetition: 1 },
          { date: fixedNow - 10 * MS_PER_DAY, rating: 3 as const, interval: 3, easeFactor: 2.65, repetition: 2 },
        ],
      };

      const migrated = migrateLegacyMetaToFSRS(legacyMeta, fixedNow - 20 * MS_PER_DAY, targetFutureDue);

      // Must preserve existing target future dueDate so cards do not all become due today
      expect(migrated.dueDate).toBe(targetFutureDue);
      expect(migrated.schedulerVersion).toBe('fsrs-v5');
      expect(migrated.legacyBackup).toBeDefined();
      expect(migrated.legacyBackup?.easeFactor).toBe(2.5);
      expect(migrated.legacyBackup?.repetition).toBe(3);

      // Idempotency: Running migration again must produce the exact same object
      const secondMigration = migrateLegacyMetaToFSRS(migrated);
      expect(secondMigration).toBe(migrated);
    });

    it('8. Desired Retention parameter affects interval scaling predictably', () => {
      const meta = createInitialReviewMeta(fixedNow);

      // High retention (95%) needs more frequent reviews (shorter interval)
      const highRetentionPreview = previewFSRS(meta, fixedNow, 0.95);
      // Lower retention (80%) can tolerate longer intervals
      const lowRetentionPreview = previewFSRS(meta, fixedNow, 0.80);

      expect(lowRetentionPreview[3].scheduledDays).toBeGreaterThanOrEqual(
        highRetentionPreview[3].scheduledDays
      );
    });
  });
});
