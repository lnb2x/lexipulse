import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/services/db';
import {
  saveOrUpdateWord,
  bulkUpsertWords,
  type MergePolicy,
} from '../src/services/vocabRepository';
import { initializeDatabase, recordReviewActivity, getTodayStats } from '../src/services/db';
import type { WordItem } from '../src/types/vocab';
import { formatLocalDate } from '../utils/dateUtils';

describe('Phase 1: Data Integrity & Preservation Tests', () => {
  const originalWord: WordItem = {
    id: 'custom-word-123',
    word: 'resilience',
    phonetics: { us: '/rɪˈzɪl.jəns/', uk: '/rɪˈzɪl.jəns/' },
    pos: ['noun'],
    vietnameseDefinition: 'Khả năng phục hồi nhanh chóng',
    englishDefinition: 'The capacity to recover quickly from difficulties.',
    meanings: [],
    collocations: [{ phrase: 'demonstrate resilience', meaningVi: 'thể hiện sự kiên cường' }],
    wordFamily: [{ word: 'resilient', pos: 'adjective', meaningVi: 'kiên cường' }],
    examples: [{ en: 'She showed great resilience.', vi: 'Cô ấy đã thể hiện sự kiên cường to lớn.', context: 'general' }],
    tags: ['#MyCustomTag', '#ExamPrep'],
    status: 'learning',
    notes: 'Personal note: remember elastic band',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    reviewMeta: {
      repetition: 5,
      interval: 14,
      easeFactor: 2.7,
      dueDate: 1700000000000 + 14 * 24 * 3600 * 1000,
      lastReviewedDate: 1700000000000,
      history: [
        { date: 1700000000000 - 100000, rating: 2, interval: 1, easeFactor: 2.5, repetition: 1 },
        { date: 1700000000000 - 50000, rating: 3, interval: 6, easeFactor: 2.6, repetition: 2 },
        { date: 1700000000000, rating: 3, interval: 14, easeFactor: 2.7, repetition: 5 },
      ],
    },
  };

  beforeEach(async () => {
    await db.words.clear();
    await db.dailyStats.clear();
    await db.settingsTable.clear();
    await db.words.put({ ...originalWord });
  });

  it('1. saveOrUpdateWord preserves id, createdAt, reviewMeta, status, notes, and tags', async () => {
    // Re-save or update with enriched linguistic information
    const incomingData: Partial<WordItem> = {
      word: 'resilience',
      phonetics: { us: '/rɪˈzɪl.jəns/', uk: '/rɪˈzɪl.jəns/ updated' },
      vietnameseDefinition: 'Sức bật, khả năng phục hồi',
      englishDefinition: 'The ability to withstand adversity and bounce back.',
      examples: [
        { en: 'New example sentence.', vi: 'Ví dụ mới.', context: 'toeic' },
      ],
      // An incoming object might have default/empty reviewMeta or status
      status: 'new',
      reviewMeta: {
        repetition: 0,
        interval: 0,
        easeFactor: 2.5,
        dueDate: Date.now(),
        history: [],
      },
      notes: undefined,
      tags: ['#IncomingTag'],
    };

    const result = await saveOrUpdateWord(incomingData as WordItem, { mergePolicy: 'preserve-progress' });
    const stored = await db.words.get('custom-word-123');

    expect(stored).toBeDefined();
    expect(stored!.id).toBe('custom-word-123');
    expect(stored!.createdAt).toBe(1700000000000);
    expect(stored!.status).toBe('learning'); // Preserved
    expect(stored!.notes).toBe('Personal note: remember elastic band'); // Preserved
    expect(stored!.reviewMeta.repetition).toBe(5); // Preserved
    expect(stored!.reviewMeta.interval).toBe(14); // Preserved
    expect(stored!.reviewMeta.easeFactor).toBe(2.7); // Preserved
    expect(stored!.reviewMeta.history.length).toBe(3); // Preserved
    expect(stored!.tags).toContain('#MyCustomTag'); // User tags kept
    expect(stored!.tags).toContain('#IncomingTag'); // Merged cleanly

    // Linguistic updates should be applied
    expect(stored!.vietnameseDefinition).toBe('Sức bật, khả năng phục hồi');
  });

  it('2. Bulk import with default policy keeps learning progress', async () => {
    const bulkItems: WordItem[] = [
      {
        id: 'new-generated-id',
        word: 'resilience',
        vietnameseDefinition: 'Định nghĩa mới từ file',
        englishDefinition: 'New english definition',
        phonetics: {},
        pos: ['noun'],
        meanings: [],
        collocations: [],
        wordFamily: [],
        examples: [],
        tags: ['#BulkImported'],
        status: 'new',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reviewMeta: {
          repetition: 0,
          interval: 0,
          easeFactor: 2.5,
          dueDate: Date.now(),
          history: [],
        },
      },
    ];

    await bulkUpsertWords(bulkItems, { replaceProgress: false });
    const stored = await db.words.get('custom-word-123');

    expect(stored!.id).toBe('custom-word-123');
    expect(stored!.reviewMeta.repetition).toBe(5);
    expect(stored!.reviewMeta.interval).toBe(14);
    expect(stored!.notes).toBe('Personal note: remember elastic band');
    expect(stored!.tags).toContain('#MyCustomTag');
    expect(stored!.tags).toContain('#BulkImported');
  });

  it('3. Bulk import with replaceProgress explicitly true replaces learning progress', async () => {
    const bulkItems: WordItem[] = [
      {
        id: 'new-id',
        word: 'resilience',
        vietnameseDefinition: 'Thay thế tiến độ',
        englishDefinition: 'New def',
        phonetics: {},
        pos: ['noun'],
        meanings: [],
        collocations: [],
        wordFamily: [],
        examples: [],
        tags: ['#Replaced'],
        status: 'new',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reviewMeta: {
          repetition: 1,
          interval: 2,
          easeFactor: 2.5,
          dueDate: 1800000000000,
          history: [],
        },
      },
    ];

    await bulkUpsertWords(bulkItems, { replaceProgress: true });
    const stored = await db.words.get('custom-word-123');

    expect(stored!.reviewMeta.repetition).toBe(1);
    expect(stored!.reviewMeta.interval).toBe(2);
    expect(stored!.status).toBe('new');
  });

  it('4. JSON import with default options preserves repetition = 5, interval = 14, notes, and tags', async () => {
    const jsonPayload = JSON.stringify([
      {
        word: 'resilience',
        vietnameseDefinition: 'Định nghĩa mới từ file JSON backup',
        englishDefinition: 'Updated definition from JSON',
        status: 'new',
        reviewMeta: {
          repetition: 0,
          interval: 0,
          easeFactor: 2.5,
          dueDate: Date.now(),
          history: [],
        },
        tags: ['#FromJson'],
      },
    ]);

    const { importDeckFromJson } = await import('../src/services/db');
    const res = await importDeckFromJson(jsonPayload);

    expect(res.errors.length).toBe(0);
    expect(res.imported).toBe(1);

    const stored = await db.words.get('custom-word-123');
    expect(stored!.id).toBe('custom-word-123');
    expect(stored!.reviewMeta.repetition).toBe(5); // Preserved
    expect(stored!.reviewMeta.interval).toBe(14); // Preserved
    expect(stored!.status).toBe('learning'); // Preserved
    expect(stored!.notes).toBe('Personal note: remember elastic band'); // Preserved
    expect(stored!.tags).toContain('#MyCustomTag');
    expect(stored!.tags).toContain('#FromJson');
    expect(stored!.vietnameseDefinition).toBe('Định nghĩa mới từ file JSON backup');
  });

  it('4. Fresh database initialization has strictly 0 reviews and 0 streak, and is idempotent', async () => {
    await db.words.clear();
    await db.dailyStats.clear();
    await db.settingsTable.clear();

    // First init without demo opt-in
    await initializeDatabase({ optInDemoWords: false });

    const wordsCount = await db.words.count();
    expect(wordsCount).toBe(0);

    const todayStats = await getTodayStats();
    expect(todayStats.cardsReviewed).toBe(0);
    expect(todayStats.streak).toBe(0);

    // Run a second time (simulating React 19 StrictMode double-invoked effect)
    await initializeDatabase({ optInDemoWords: false });

    const wordsCountAfterSecondInit = await db.words.count();
    expect(wordsCountAfterSecondInit).toBe(0);

    const statsAfterSecondInit = await getTodayStats();
    expect(statsAfterSecondInit.cardsReviewed).toBe(0);
    expect(statsAfterSecondInit.streak).toBe(0);
  });

  it('5. Concurrent review activity recording does not cause race conditions or duplicate reviews', async () => {
    await db.dailyStats.clear();
    // Simulate 5 simultaneous rating submissions on the review action
    const results = await Promise.all([
      recordReviewActivity(),
      recordReviewActivity(),
      recordReviewActivity(),
    ]);

    const stats = await getTodayStats();
    expect(stats.cardsReviewed).toBe(3);
    expect(stats.streak).toBe(1);
  });
});
