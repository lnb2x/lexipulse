// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/services/db';
import type { WordItem } from '../src/types/vocab';
import { createInitialReviewMeta } from '../src/services/sm2';
import {
  checkNeedsNormalization,
  checkNeedsAiUpgrade,
  migrateSingleWord,
  migrateAndNormalizeExistingDeck,
} from '../src/services/quizlet/quizletMigration';

describe('Quizlet Migration & Deck Normalization', () => {
  beforeEach(async () => {
    await db.words.clear();
  });

  it('correctly flags cards that need normalization', () => {
    const wordWithPos: WordItem = {
      id: 'w-1',
      word: 'sign the contract (v)',
      pos: [],
      phonetics: {},
      vietnameseDefinition: 'ký hợp đồng',
      englishDefinition: '',
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: [],
      status: 'new',
      createdAt: 1,
      updatedAt: 1,
      reviewMeta: createInitialReviewMeta(),
    };
    expect(checkNeedsNormalization(wordWithPos)).toBe(true);

    const wordWithIpaInDef: WordItem = {
      ...wordWithPos,
      word: 'branch',
      vietnameseDefinition: '/bræntʃ/ - cành cây',
    };
    expect(checkNeedsNormalization(wordWithIpaInDef)).toBe(true);

    const wordWithPlaceholder: WordItem = {
      ...wordWithPos,
      word: 'ladder',
      englishDefinition: 'Definition for "ladder"',
    };
    expect(checkNeedsNormalization(wordWithPlaceholder)).toBe(true);

    const wordWithSelfFamily: WordItem = {
      ...wordWithPos,
      word: 'equipment',
      wordFamily: [{ word: 'equipment', pos: 'noun' }],
    };
    expect(checkNeedsNormalization(wordWithSelfFamily)).toBe(true);

    const cleanWord: WordItem = {
      ...wordWithPos,
      word: 'agreement',
      pos: ['noun'],
      phonetics: { us: '/əˈɡriːmənt/' },
      vietnameseDefinition: 'sự đồng ý, hợp đồng',
      englishDefinition: 'harmony or accordance in opinion or feeling',
      wordFamily: [{ word: 'agree', pos: 'verb' }],
    };
    expect(checkNeedsNormalization(cleanWord)).toBe(false);
  });

  it('migrates a single word safely, preserving FSRS metrics, ID, and deck links', async () => {
    const unnormalizedWord: WordItem = {
      id: 'custom-card-999',
      word: 'sign the contract (v)',
      pos: [],
      phonetics: {},
      vietnameseDefinition: '/saɪn ðə ˈkɒntrækt/ - ký hợp đồng',
      englishDefinition: 'Definition for "sign the contract (v)"',
      meanings: [],
      collocations: [],
      wordFamily: [{ word: 'sign the contract (v)', pos: 'verb' }],
      examples: [],
      tags: ['#TOEIC', '#Unit1'],
      notes: 'Ghi chú học tập quan trọng',
      status: 'learning',
      createdAt: 1234567,
      updatedAt: 1234567,
      quizletSetIds: ['set-101'],
      reviewMeta: {
        ...createInitialReviewMeta(),
        dueDate: 999999999,
        stability: 18.5,
        difficulty: 3.8,
        reps: 7,
        lapses: 1,
        state: 2,
      },
    };

    await db.words.put(unnormalizedWord);

    const result = await migrateSingleWord(unnormalizedWord, { upgradeAi: false });

    expect(result.normalized).toBe(true);
    expect(result.updatedWord.id).toBe('custom-card-999');
    expect(result.updatedWord.word).toBe('sign the contract');
    expect(result.updatedWord.pos).toEqual(['verb']);
    expect(result.updatedWord.phonetics.us).toBe('/saɪn ðə ˈkɒntrækt/');
    expect(result.updatedWord.vietnameseDefinition).toBe('ký hợp đồng');
    expect(result.updatedWord.englishDefinition).toBe('');
    expect(result.updatedWord.wordFamily).toEqual([]);
    expect(result.updatedWord.rawQuizletTerm).toBe('sign the contract (v)');
    expect(result.updatedWord.quizletSetIds).toEqual(['set-101']);
    expect(result.updatedWord.notes).toBe('Ghi chú học tập quan trọng');
    expect(result.updatedWord.tags).toEqual(['#TOEIC', '#Unit1']);

    // Critical: FSRS preservation
    expect(result.updatedWord.reviewMeta.dueDate).toBe(999999999);
    expect(result.updatedWord.reviewMeta.stability).toBe(18.5);
    expect(result.updatedWord.reviewMeta.difficulty).toBe(3.8);
    expect(result.updatedWord.reviewMeta.reps).toBe(7);
    expect(result.updatedWord.reviewMeta.lapses).toBe(1);
    expect(result.updatedWord.reviewMeta.state).toBe(2);

    // Verify persisted in DB
    const persisted = await db.words.get('custom-card-999');
    expect(persisted?.word).toBe('sign the contract');
    expect(persisted?.pos).toEqual(['verb']);
    expect(persisted?.reviewMeta.stability).toBe(18.5);
  });

  it('is idempotent: running deck migration twice skips already normalized items', async () => {
    const word1: WordItem = {
      id: 'w-1',
      word: 'apple (n)',
      pos: [],
      phonetics: {},
      vietnameseDefinition: 'quả táo',
      englishDefinition: '',
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: [],
      status: 'new',
      createdAt: 1,
      updatedAt: 1,
      reviewMeta: createInitialReviewMeta(),
    };

    await db.words.put(word1);

    // First migration
    const res1 = await migrateAndNormalizeExistingDeck({ upgradeToAi: false });
    expect(res1.total).toBe(1);
    expect(res1.normalizedCount).toBe(1);
    expect(res1.skippedCount).toBe(0);

    // Second migration
    const res2 = await migrateAndNormalizeExistingDeck({ upgradeToAi: false });
    expect(res2.total).toBe(1);
    expect(res2.normalizedCount).toBe(0);
    expect(res2.skippedCount).toBe(1);
  });

  it('inspectTodayWordsScope correctly filters by createdAt in local timezone and isolates unreliable dates', async () => {
    const { inspectTodayWordsScope } = await import('../src/services/quizlet/quizletMigration');
    const { formatLocalDate, parseLocalDateToTimestamp } = await import('../src/utils/dateUtils');

    const todayDateStr = formatLocalDate();
    const todayTimestamp = parseLocalDateToTimestamp(todayDateStr, 'noon');
    const yesterdayTimestamp = todayTimestamp - 24 * 60 * 60 * 1000;

    const wordToday: WordItem = {
      id: 'w-today-1',
      word: 'sign the contract (v)',
      pos: [],
      phonetics: {},
      vietnameseDefinition: 'ký hợp đồng',
      englishDefinition: '',
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: [],
      status: 'new',
      createdAt: todayTimestamp,
      updatedAt: todayTimestamp,
      reviewMeta: createInitialReviewMeta(),
    };

    const wordYesterday: WordItem = {
      ...wordToday,
      id: 'w-yesterday-1',
      word: 'negotiate (v)',
      createdAt: yesterdayTimestamp,
      updatedAt: todayTimestamp, // even if updated today, must not be scoped!
    };

    const wordMissingDate: WordItem = {
      ...wordToday,
      id: 'w-missing-date',
      word: 'deadline',
      createdAt: 0 as any, // invalid/missing timestamp
    };

    await db.words.bulkPut([wordToday, wordYesterday, wordMissingDate]);

    const scope = await inspectTodayWordsScope(todayDateStr);
    expect(scope.date).toBe(todayDateStr);
    expect(scope.totalDeckWords).toBe(3);
    expect(scope.todayWords.length).toBe(1);
    expect(scope.todayWords[0].id).toBe('w-today-1');
    expect(scope.unreliableDateWords.length).toBe(1);
    expect(scope.unreliableDateWords[0].id).toBe('w-missing-date');
  });

  it('migrateTodayWords only normalizes today words, leaving yesterday words completely untouched', async () => {
    const { migrateTodayWords } = await import('../src/services/quizlet/quizletMigration');
    const { formatLocalDate, parseLocalDateToTimestamp } = await import('../src/utils/dateUtils');

    const todayDateStr = formatLocalDate();
    const todayTimestamp = parseLocalDateToTimestamp(todayDateStr, 'noon');
    const yesterdayTimestamp = todayTimestamp - 24 * 60 * 60 * 1000;

    const wordToday: WordItem = {
      id: 'w-today-norm',
      word: 'take off (v)',
      pos: [],
      phonetics: {},
      vietnameseDefinition: '/teɪk ɒf/ cất cánh',
      englishDefinition: 'Definition for "take off (v)"',
      meanings: [],
      collocations: [],
      wordFamily: [{ word: 'take off (v)', pos: 'verb' }],
      examples: [],
      tags: ['#TodayTag'],
      status: 'new',
      createdAt: todayTimestamp,
      updatedAt: todayTimestamp,
      reviewMeta: {
        ...createInitialReviewMeta(),
        stability: 12.4,
        difficulty: 4.1,
      },
    };

    const wordYesterday: WordItem = {
      id: 'w-yesterday-untouched',
      word: 'land (v)',
      pos: [],
      phonetics: {},
      vietnameseDefinition: '/lænd/ hạ cánh',
      englishDefinition: '',
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: ['#YesterdayTag'],
      status: 'learning',
      createdAt: yesterdayTimestamp,
      updatedAt: yesterdayTimestamp,
      reviewMeta: {
        ...createInitialReviewMeta(),
        stability: 45.0,
      },
    };

    await db.words.bulkPut([wordToday, wordYesterday]);

    const result = await migrateTodayWords({
      targetDate: todayDateStr,
      upgradeToAi: false,
    });

    expect(result.date).toBe(todayDateStr);
    expect(result.totalToday).toBe(1);
    expect(result.normalizedCount).toBe(1);
    expect(result.backupKey).toContain(`lexipulse_backup_today_${todayDateStr}`);

    // Verify today's word was normalized
    const updatedToday = await db.words.get('w-today-norm');
    expect(updatedToday?.word).toBe('take off');
    expect(updatedToday?.pos).toEqual(['verb']);
    expect(updatedToday?.phonetics.us).toBe('/teɪk ɒf/');
    expect(updatedToday?.vietnameseDefinition).toBe('cất cánh');
    expect(updatedToday?.englishDefinition).toBe('');
    expect(updatedToday?.wordFamily).toEqual([]);
    expect(updatedToday?.createdAt).toBe(todayTimestamp);
    expect(updatedToday?.reviewMeta.stability).toBe(12.4);

    // Verify yesterday's word was completely untouched
    const untouchedYesterday = await db.words.get('w-yesterday-untouched');
    expect(untouchedYesterday?.word).toBe('land (v)');
    expect(untouchedYesterday?.vietnameseDefinition).toBe('/lænd/ hạ cánh');
    expect(untouchedYesterday?.createdAt).toBe(yesterdayTimestamp);
    expect(untouchedYesterday?.reviewMeta.stability).toBe(45.0);
  });

  it('migrateTodayWords detects collisions and tags with #can-xem-xet-trung without deleting', async () => {
    const { migrateTodayWords } = await import('../src/services/quizlet/quizletMigration');
    const { formatLocalDate, parseLocalDateToTimestamp } = await import('../src/utils/dateUtils');

    const todayDateStr = formatLocalDate();
    const todayTimestamp = parseLocalDateToTimestamp(todayDateStr, 'noon');

    // Existing word already in deck
    const existingWord: WordItem = {
      id: 'existing-apple',
      word: 'apple',
      pos: ['noun'],
      phonetics: { us: '/ˈæpl/' },
      vietnameseDefinition: 'quả táo',
      englishDefinition: '',
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: ['#Existing'],
      status: 'learning',
      createdAt: 1000,
      updatedAt: 1000,
      reviewMeta: createInitialReviewMeta(),
    };

    // Today's word that would normalize to "apple"
    const collidingTodayWord: WordItem = {
      id: 'today-apple-tagged',
      word: 'apple (n)',
      pos: [],
      phonetics: {},
      vietnameseDefinition: 'trái táo',
      englishDefinition: '',
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: ['#Unit1'],
      status: 'new',
      createdAt: todayTimestamp,
      updatedAt: todayTimestamp,
      reviewMeta: createInitialReviewMeta(),
    };

    await db.words.bulkPut([existingWord, collidingTodayWord]);

    const result = await migrateTodayWords({
      targetDate: todayDateStr,
      upgradeToAi: false,
    });

    expect(result.conflictCount).toBe(1);
    expect(result.conflicts[0].word).toBe('apple (n)');

    // Existing word remains unchanged
    const stillExisting = await db.words.get('existing-apple');
    expect(stillExisting?.word).toBe('apple');

    // Colliding word was tagged and preserved without deleting
    const preservedColliding = await db.words.get('today-apple-tagged');
    expect(preservedColliding?.tags).toContain('#can-xem-xet-trung');
    expect(preservedColliding?.word).toBe('apple (n)');
  });
});
