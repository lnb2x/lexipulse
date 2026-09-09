import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/services/db';
import { runFSRSMigration } from '../src/services/db/migration';
import { exportDeckToJson } from '../src/services/db/backup';
import { bulkUpsertWords } from '../src/services/vocabRepository';
import { previewFSRS, applyFSRSReview } from '../src/services/fsrs/fsrsService';
import type { WordItem } from '../src/types/vocab';

describe('FSRS Database Migration, Backup & Preview Stability', () => {
  const fixedNow = 1710000000000;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const legacyWord1: WordItem = {
    id: 'legacy-w1',
    word: 'allocate',
    pos: ['verb'],
    phonetics: { us: '/ˈæl.ə.keɪt/' },
    vietnameseDefinition: 'Phân bổ, chỉ định ngân sách',
    englishDefinition: 'To distribute resources for a specific purpose',
    meanings: [],
    collocations: [],
    wordFamily: [],
    examples: [{ en: 'We must allocate funds for marketing.', vi: 'Chúng ta phải phân bổ ngân sách cho tiếp thị.', context: 'toeic' }],
    tags: ['#TOEIC', '#Finance'],
    status: 'learning',
    createdAt: fixedNow - 30 * MS_PER_DAY,
    updatedAt: fixedNow - 5 * MS_PER_DAY,
    reviewMeta: {
      repetition: 3,
      interval: 10,
      easeFactor: 2.65,
      dueDate: fixedNow + 5 * MS_PER_DAY, // Scheduled 5 days in future
      lastReviewedDate: fixedNow - 5 * MS_PER_DAY,
      history: [
        { date: fixedNow - 25 * MS_PER_DAY, rating: 2 as const, interval: 1, easeFactor: 2.5, repetition: 1 },
        { date: fixedNow - 15 * MS_PER_DAY, rating: 2 as const, interval: 3, easeFactor: 2.5, repetition: 2 },
        { date: fixedNow - 5 * MS_PER_DAY, rating: 3 as const, interval: 10, easeFactor: 2.65, repetition: 3 },
      ],
    },
  };

  const legacyWord2New: WordItem = {
    id: 'legacy-w2-new',
    word: 'prospective',
    pos: ['adjective'],
    phonetics: { us: '/prəˈspek.tɪv/' },
    vietnameseDefinition: 'Tiềm năng, triển vọng',
    englishDefinition: 'Likely to happen or become in the future',
    meanings: [],
    collocations: [],
    wordFamily: [],
    examples: [{ en: 'Prospective clients will visit today.', vi: 'Khách hàng tiềm năng sẽ đến thăm hôm nay.', context: 'toeic' }],
    tags: ['#TOEIC'],
    status: 'new',
    createdAt: fixedNow - 1 * MS_PER_DAY,
    updatedAt: fixedNow - 1 * MS_PER_DAY,
    reviewMeta: {
      repetition: 0,
      interval: 0,
      easeFactor: 2.5,
      dueDate: fixedNow - 1 * MS_PER_DAY,
      lastReviewedDate: null,
      history: [],
    },
  };

  beforeEach(async () => {
    await db.words.clear();
    await db.words.bulkPut([{ ...legacyWord1 }, { ...legacyWord2New }]);
  });

  it('1. runFSRSMigration converts legacy records and preserves future dueDates', async () => {
    const { migratedCount, alreadyMigratedCount } = await runFSRSMigration();

    expect(migratedCount).toBe(2);
    expect(alreadyMigratedCount).toBe(0);

    const word1After = await db.words.get('legacy-w1');
    expect(word1After).toBeDefined();
    // Critical preservation: Future due date is NOT reset to today
    expect(word1After!.reviewMeta.dueDate).toBe(legacyWord1.reviewMeta.dueDate);
    expect(word1After!.reviewMeta.schedulerVersion).toBe('fsrs-v5');
    expect(word1After!.reviewMeta.fsrs).toBeDefined();
    expect(word1After!.reviewMeta.fsrs?.stability).toBeGreaterThan(0);
    expect(word1After!.reviewMeta.legacyBackup).toBeDefined();
    expect(word1After!.reviewMeta.legacyBackup?.repetition).toBe(3);

    const word2After = await db.words.get('legacy-w2-new');
    expect(word2After).toBeDefined();
    expect(word2After!.reviewMeta.schedulerVersion).toBe('fsrs-v5');
    expect(word2After!.reviewMeta.fsrs?.reps).toBe(0);
  });

  it('2. runFSRSMigration is idempotent and safe to execute repeatedly', async () => {
    // First migration
    await runFSRSMigration();
    const word1FirstPass = await db.words.get('legacy-w1');

    // Second migration
    const { migratedCount, alreadyMigratedCount } = await runFSRSMigration();
    expect(migratedCount).toBe(0);
    expect(alreadyMigratedCount).toBe(2);

    const word1SecondPass = await db.words.get('legacy-w1');
    expect(word1SecondPass).toEqual(word1FirstPass);
  });

  it('3. Backup JSON Export and Restore round-trip preserves FSRS state completely', async () => {
    // Migrate to FSRS first
    await runFSRSMigration();
    const originalWords = await db.words.toArray();

    // Export to JSON
    const exportedJson = await exportDeckToJson(originalWords);
    expect(exportedJson).toContain('"schedulerVersion": "fsrs-v5"');
    expect(exportedJson).toContain('"fsrs"');

    // Clear database
    await db.words.clear();
    expect(await db.words.count()).toBe(0);

    // Restore via bulkUpsertWords (replace-progress)
    const parsedWords: WordItem[] = JSON.parse(exportedJson);
    await bulkUpsertWords(parsedWords, { mergePolicy: 'replace-progress' });

    const restoredWords = await db.words.toArray();
    expect(restoredWords.length).toBe(2);

    const restoredW1 = await db.words.get('legacy-w1');
    expect(restoredW1).toBeDefined();
    expect(restoredW1!.reviewMeta.schedulerVersion).toBe('fsrs-v5');
    expect(restoredW1!.reviewMeta.fsrs).toBeDefined();
    expect(restoredW1!.reviewMeta.dueDate).toBe(legacyWord1.reviewMeta.dueDate);
    expect(restoredW1!.reviewMeta.legacyBackup?.easeFactor).toBe(2.65);
  });

  it('4. Scheduling preview is deterministic and stable across multiple invocations', () => {
    const meta = legacyWord1.reviewMeta;
    const preview1 = previewFSRS(meta, fixedNow, 0.90);
    const preview2 = previewFSRS(meta, fixedNow, 0.90);

    expect(preview1[1].nextDue).toBe(preview2[1].nextDue);
    expect(preview1[2].nextDue).toBe(preview2[2].nextDue);
    expect(preview1[3].nextDue).toBe(preview2[3].nextDue);
    expect(preview1[4].nextDue).toBe(preview2[4].nextDue);

    // Apply rating 4 (Easy) and verify it matches preview 4 exactly
    const executed = applyFSRSReview(meta, 4, fixedNow, 0.90, 'scheduled');
    expect(executed.nextDue).toBe(preview1[4].nextDue);
    expect(executed.nextMeta.interval).toBe(preview1[4].scheduledDays);
  });
});
