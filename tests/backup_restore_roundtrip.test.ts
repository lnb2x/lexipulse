import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/services/db';
import {
  exportDeckToJson,
  exportFullBackupToJson,
  importDeckFromJson,
  saveAppSettings,
  getAppSettings,
  type BackupEnvelope,
} from '../src/services/db';
import type { WordItem, AppSettings, DailyStats } from '../src/types/vocab';

describe('Reliability Audit: Backup Export/Import & Round-Trip Restoration', () => {
  const sampleWords: WordItem[] = [
    {
      id: 'word-1-learning',
      word: 'perseverance',
      phonetics: { us: '/ˌpɜː.səˈvɪə.rəns/', uk: '/ˌpɜː.sɪˈvɪə.rəns/', audioUs: 'https://example.com/audio.mp3' },
      pos: ['noun'],
      vietnameseDefinition: 'Tính kiên trì, sự bền chí',
      englishDefinition: 'Persistence in doing something despite difficulty or delay in achieving success.',
      meanings: [
        {
          pos: 'noun',
          englishDefinition: 'Persistence in doing something despite difficulty.',
          vietnameseDefinition: 'Sự kiên trì',
        },
      ],
      collocations: [
        { phrase: 'remarkable perseverance', meaningVi: 'sự kiên trì phi thường' },
        { phrase: 'through sheer perseverance', meaningVi: 'nhờ sự kiên trì tuyệt đối' },
      ],
      wordFamily: [
        { word: 'persevere', pos: 'verb', meaningVi: 'kiên trì' },
        { word: 'persevering', pos: 'adjective', meaningVi: 'bền bỉ' },
      ],
      examples: [
        {
          en: 'Through hard work and perseverance, he succeeded.',
          vi: 'Nhờ làm việc chăm chỉ và kiên trì, anh ấy đã thành công.',
          context: 'general',
        },
        {
          en: 'Perseverance is essential to pass the certification.',
          vi: 'Sự kiên trì là cần thiết để vượt qua kỳ thi chứng chỉ.',
          context: 'toeic',
        },
      ],
      tags: ['#Advanced', '#TOEIC', '#Motivation'],
      notes: 'Remember the story of Robert the Bruce',
      status: 'learning',
      createdAt: 1710000000000,
      updatedAt: 1710500000000,
      reviewMeta: {
        repetition: 4,
        interval: 12,
        easeFactor: 2.7,
        dueDate: 1710000000000 + 12 * 86400000,
        lastReviewedDate: 1710500000000,
        history: [
          { date: 1710100000000, rating: 2, interval: 1, easeFactor: 2.5, repetition: 1 },
          { date: 1710200000000, rating: 3, interval: 3, easeFactor: 2.6, repetition: 2 },
          { date: 1710500000000, rating: 4, interval: 12, easeFactor: 2.7, repetition: 4 },
        ],
        fsrs: {
          due: 1710000000000 + 12 * 86400000,
          stability: 12.4,
          difficulty: 4.8,
          elapsed_days: 3,
          scheduled_days: 12,
          reps: 4,
          lapses: 0,
          state: 2, // State.Review
          last_review: 1710500000000,
        },
        schedulerVersion: 'fsrs-v5',
      },
      lemma: 'perseverance',
      originalInput: 'Perseverances',
      formLabels: ['noun, plural'],
      linkedVariants: ['persevere', 'persevering'],
      contextSentence: 'Their perseverance paid off.',
      inflections: [{ form: 'perseverances', label: 'plural' }],
      vietnameseDefinitionProvenance: {
        source: 'user_edit',
        isUserEdited: true,
        createdAt: 1710000000000,
      },
      isUserEdited: true,
      source: 'manual',
      enrichmentStatus: 'completed',
    },
    {
      id: 'word-2-mastered',
      word: 'benchmark',
      phonetics: { us: '/ˈbentʃ.mɑːrk/', uk: '/ˈbentʃ.mɑːk/' },
      pos: ['noun', 'verb'],
      vietnameseDefinition: 'Tiêu chuẩn đối sánh',
      englishDefinition: 'A standard or point of reference against which things may be compared.',
      meanings: [],
      collocations: [{ phrase: 'set a benchmark', meaningVi: 'đặt ra chuẩn mực' }],
      wordFamily: [],
      examples: [{ en: 'This score sets the benchmark.', vi: 'Điểm số này đặt ra tiêu chuẩn.', context: 'general' }],
      tags: ['#Business', '#TOEIC'],
      status: 'mastered',
      createdAt: 1709000000000,
      updatedAt: 1709900000000,
      reviewMeta: {
        repetition: 8,
        interval: 45,
        easeFactor: 2.9,
        dueDate: 1709000000000 + 45 * 86400000,
        lastReviewedDate: 1709900000000,
        history: [],
        fsrs: {
          due: 1709000000000 + 45 * 86400000,
          stability: 45.0,
          difficulty: 3.2,
          elapsed_days: 15,
          scheduled_days: 45,
          reps: 8,
          lapses: 0,
          state: 2,
          last_review: 1709900000000,
        },
        schedulerVersion: 'fsrs-v5',
      },
    },
  ];

  const sampleSettings: Partial<AppSettings> = {
    theme: 'dark',
    speechRate: 1.1,
    speechPitch: 0.9,
    preferredAccent: 'UK',
    dailyQuota: 25,
    prioritizeAI: false,
    aiProvider: 'groq',
    aiModel: 'llama-3.3-70b-versatile',
    aiApiKey: 'secret-api-key-to-sanitize',
    geminiApiKey: 'secret-gemini-key',
  };

  const sampleDailyStats: DailyStats[] = [
    {
      date: '2026-09-08',
      cardsReviewed: 15,
      streak: 5,
      lastActiveDate: '2026-09-08',
    },
    {
      date: '2026-09-09',
      cardsReviewed: 22,
      streak: 6,
      lastActiveDate: '2026-09-09',
    },
    {
      date: '2026-09-10',
      cardsReviewed: 10,
      streak: 7,
      lastActiveDate: '2026-09-10',
    },
  ];

  beforeEach(async () => {
    await db.words.clear();
    await db.settingsTable.clear();
    await db.dailyStats.clear();
  });

  it('1. JSON export -> database clear -> JSON import faithfully restores words, review progress, tags, examples, collocations, settings, and dailyStats', async () => {
    // 1. Seed complete database
    await db.words.bulkAdd(sampleWords);
    await saveAppSettings(sampleSettings);
    await db.dailyStats.bulkPut(sampleDailyStats);

    expect(await db.words.count()).toBe(2);
    expect(await db.dailyStats.count()).toBe(3);
    const initialSettings = await getAppSettings();
    expect(initialSettings.dailyQuota).toBe(25);
    expect(initialSettings.preferredAccent).toBe('UK');

    // 2. Perform Full JSON Export
    const exportedJson = await exportFullBackupToJson();
    expect(typeof exportedJson).toBe('string');

    // Verify envelope format and safety
    const parsedEnvelope: BackupEnvelope = JSON.parse(exportedJson);
    expect(parsedEnvelope.type).toBe('lexipulse-backup');
    expect(parsedEnvelope.version).toBe(1);
    expect(Array.isArray(parsedEnvelope.words)).toBe(true);
    expect(parsedEnvelope.words.length).toBe(2);
    expect(parsedEnvelope.settings).toBeDefined();
    expect(parsedEnvelope.settings?.dailyQuota).toBe(25);
    // Crucial: API keys must be sanitized in exported backup
    expect(parsedEnvelope.settings?.aiApiKey).toBe('');
    expect(parsedEnvelope.settings?.geminiApiKey).toBe('');
    expect(parsedEnvelope.dailyStats?.length).toBe(3);

    // 3. Clear the entire database
    await db.words.clear();
    await db.settingsTable.clear();
    await db.dailyStats.clear();

    expect(await db.words.count()).toBe(0);
    expect(await db.dailyStats.count()).toBe(0);
    expect(await db.settingsTable.count()).toBe(0);

    // 4. Perform JSON Import into completely empty database
    const importResult = await importDeckFromJson(exportedJson);

    expect(importResult.errors.length).toBe(0);
    expect(importResult.imported).toBe(2);
    expect(importResult.restoredSettings).toBe(true);
    expect(importResult.restoredDailyStats).toBe(3);

    // 5. Verify WORDS restoration
    const restoredWords = await db.words.toArray();
    expect(restoredWords.length).toBe(2);

    const w1 = await db.words.get('word-1-learning');
    expect(w1).toBeDefined();
    expect(w1!.word).toBe('perseverance');
    expect(w1!.status).toBe('learning');
    expect(w1!.notes).toBe('Remember the story of Robert the Bruce');
    expect(w1!.createdAt).toBe(1710000000000);

    // 6. Verify REVIEW PROGRESS restoration (FSRS parameters & history)
    expect(w1!.reviewMeta).toBeDefined();
    expect(w1!.reviewMeta.repetition).toBe(4);
    expect(w1!.reviewMeta.interval).toBe(12);
    expect(w1!.reviewMeta.easeFactor).toBe(2.7);
    expect(w1!.reviewMeta.dueDate).toBe(1710000000000 + 12 * 86400000);
    expect(w1!.reviewMeta.history.length).toBe(3);
    expect(w1!.reviewMeta.fsrs).toBeDefined();
    expect(w1!.reviewMeta.fsrs!.stability).toBe(12.4);
    expect(w1!.reviewMeta.fsrs!.difficulty).toBe(4.8);
    expect(w1!.reviewMeta.fsrs!.state).toBe(2);
    expect(w1!.reviewMeta.fsrs!.reps).toBe(4);

    // 7. Verify TAGS restoration
    expect(w1!.tags).toEqual(expect.arrayContaining(['#Advanced', '#TOEIC', '#Motivation']));

    // 8. Verify EXAMPLES restoration
    expect(w1!.examples.length).toBe(2);
    expect(w1!.examples[0].en).toBe('Through hard work and perseverance, he succeeded.');
    expect(w1!.examples[1].context).toBe('toeic');

    // 9. Verify COLLOCATIONS & WORD FAMILY restoration
    expect(w1!.collocations.length).toBe(2);
    expect(w1!.collocations[0].phrase).toBe('remarkable perseverance');
    expect(w1!.collocations[0].meaningVi).toBe('sự kiên trì phi thường');
    expect(w1!.wordFamily.length).toBe(2);
    expect(w1!.wordFamily[0].word).toBe('persevere');

    // 10. Verify RICH LINGUISTIC & PROVENANCE restoration
    expect(w1!.lemma).toBe('perseverance');
    expect(w1!.originalInput).toBe('Perseverances');
    expect(w1!.formLabels).toEqual(['noun, plural']);
    expect(w1!.linkedVariants).toEqual(['persevere', 'persevering']);
    expect(w1!.contextSentence).toBe('Their perseverance paid off.');
    expect(w1!.inflections?.length).toBe(1);
    expect(w1!.vietnameseDefinitionProvenance?.source).toBe('user_edit');
    expect(w1!.vietnameseDefinitionProvenance?.isUserEdited).toBe(true);
    expect(w1!.isUserEdited).toBe(true);

    // 11. Verify SETTINGS restoration
    const restoredSettings = await getAppSettings();
    expect(restoredSettings.dailyQuota).toBe(25);
    expect(restoredSettings.preferredAccent).toBe('UK');
    expect(restoredSettings.theme).toBe('dark');
    expect(restoredSettings.speechRate).toBe(1.1);
    expect(restoredSettings.aiProvider).toBe('groq');
    expect(restoredSettings.aiModel).toBe('llama-3.3-70b-versatile');

    // 12. Verify DAILY STATS restoration
    const restoredStats = await db.dailyStats.toArray();
    expect(restoredStats.length).toBe(3);
    const day3 = await db.dailyStats.get('2026-09-10');
    expect(day3).toBeDefined();
    expect(day3!.streak).toBe(7);
    expect(day3!.cardsReviewed).toBe(10);
  });

  it('2. Backward compatibility: restores from legacy bare array of WordItem[]', async () => {
    const legacyArrayJson = JSON.stringify([
      {
        id: 'legacy-card-1',
        word: 'scrutinize',
        phonetics: { us: '/ˈskruː.tɪ.naɪz/' },
        pos: ['verb'],
        vietnameseDefinition: 'Xem xét kỹ lưỡng',
        englishDefinition: 'Examine or inspect closely and thoroughly.',
        tags: ['#LegacyTag'],
        status: 'learning',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        // Legacy SM2 format without fsrs object
        reviewMeta: {
          repetition: 3,
          interval: 6,
          easeFactor: 2.6,
          dueDate: 1700000000000 + 6 * 86400000,
          lastReviewedDate: 1700000000000,
          history: [
            { date: 1700000000000 - 50000, rating: 2, interval: 1, easeFactor: 2.5, repetition: 1 },
            { date: 1700000000000, rating: 3, interval: 6, easeFactor: 2.6, repetition: 3 },
          ],
        },
      },
    ]);

    const res = await importDeckFromJson(legacyArrayJson);
    expect(res.errors.length).toBe(0);
    expect(res.imported).toBe(1);

    const card = await db.words.get('legacy-card-1');
    expect(card).toBeDefined();
    expect(card!.word).toBe('scrutinize');
    expect(card!.tags).toContain('#LegacyTag');
    // FSRS migration should have automatically migrated legacy card smoothly
    expect(card!.reviewMeta.schedulerVersion).toBe('fsrs-v5');
    expect(card!.reviewMeta.fsrs).toBeDefined();
    expect(card!.reviewMeta.dueDate).toBe(1700000000000 + 6 * 86400000);
  });

  it('3. exportDeckToJson with words subset returns bare array for external tool compatibility', async () => {
    const words: WordItem[] = [sampleWords[0]];
    const exportedJson = await exportDeckToJson(words);
    const parsed = JSON.parse(exportedJson);

    // When a subset is provided, returns array directly
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].word).toBe('perseverance');
  });

  it('4. Handles corrupted JSON and non-vocabulary JSON gracefully', async () => {
    const invalidJson = '{ this is not valid json }';
    const res1 = await importDeckFromJson(invalidJson);
    expect(res1.imported).toBe(0);
    expect(res1.errors.length).toBeGreaterThan(0);

    const nonVocabJson = JSON.stringify({ greeting: 'hello world' });
    const res2 = await importDeckFromJson(nonVocabJson);
    expect(res2.imported).toBe(0);
    expect(res2.errors.length).toBeGreaterThan(0);
    expect(res2.errors[0]).toContain('vocabulary cards');
  });

  it('5. Skips empty words and handles duplicate words in same import batch gracefully', async () => {
    const batchWithDuplicates = JSON.stringify([
      { word: '' },
      { word: '   ' },
      { word: 'resilient', vietnameseDefinition: 'kiên cường (bản 1)' },
      { word: 'RESILIENT', vietnameseDefinition: 'kiên cường (bản cập nhật)' },
    ]);

    const res = await importDeckFromJson(batchWithDuplicates);
    expect(res.imported).toBe(2); // 1 added + 1 updated
    expect(res.skipped).toBe(2);

    const stored = await db.words.where('word').equals('resilient').toArray();
    expect(stored.length).toBe(1);
    expect(stored[0].vietnameseDefinition).toBe('kiên cường (bản cập nhật)');
  });
});
