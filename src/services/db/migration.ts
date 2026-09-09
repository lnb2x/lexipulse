import { db } from './schema';
import { migrateLegacyMetaToFSRS, computeWordStatus } from '../fsrs/fsrsService';
import type { WordItem } from '../../types/vocab';

/**
 * Idempotently migrates all words in IndexedDB to the FSRS scheduler.
 * - Replays valid historical ratings using semantic mapping (old 1->Again, old 2->Good, old 3->Easy).
 * - Preserves existing dueDate to avoid sudden mass-due spikes.
 * - Stores legacyBackup for audit and safe rollback.
 * - Replayable without side effects or duplicates.
 */
export async function runFSRSMigration(): Promise<{ migratedCount: number; alreadyMigratedCount: number }> {
  let migratedCount = 0;
  let alreadyMigratedCount = 0;

  await db.transaction('rw', db.words, async () => {
    const allWords = await db.words.toArray();
    const wordsToUpdate: WordItem[] = [];

    for (const word of allWords) {
      // Check if already migrated to FSRS
      if (word.reviewMeta?.schedulerVersion === 'fsrs-v5' && word.reviewMeta.fsrs) {
        alreadyMigratedCount++;
        continue;
      }

      const existingMeta = word.reviewMeta || {
        repetition: 0,
        interval: 0,
        easeFactor: 2.5,
        dueDate: word.createdAt,
        lastReviewedDate: null,
        history: [],
      };

      const newMeta = migrateLegacyMetaToFSRS(
        existingMeta,
        word.createdAt,
        existingMeta.dueDate
      );

      const newStatus = computeWordStatus(newMeta);

      wordsToUpdate.push({
        ...word,
        reviewMeta: newMeta,
        status: newStatus,
        updatedAt: Date.now(),
      });

      migratedCount++;
    }

    if (wordsToUpdate.length > 0) {
      await db.words.bulkPut(wordsToUpdate);
    }
  });

  return { migratedCount, alreadyMigratedCount };
}
