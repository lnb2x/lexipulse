import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, expect, it } from 'vitest';
import { db } from '../src/services/db/schema';
import { updateWord, getWordById } from '../src/services/vocabRepository';
import { migrateSingleWord } from '../src/services/quizlet/quizletMigration';
import { applyFSRSReview } from '../src/services/fsrs/fsrsService';
import { integrityWord, fixtureNow } from './dataIntegrityFixture';

beforeEach(async () => { await db.words.clear(); });

it('keeps a review committed while a content update is reading the card', async () => {
  await db.words.put(integrityWord());
  let review: Promise<unknown> | undefined;
  const onRead = (word: ReturnType<typeof integrityWord>) => {
    db.words.hook('reading').unsubscribe(onRead);
    review = Dexie.ignoreTransaction(() => db.transaction('rw', db.words, async () => {
      const fresh = await db.words.get(word.id);
      await db.words.update(word.id, {
        reviewMeta: applyFSRSReview(fresh!.reviewMeta, 3, fixtureNow + 1000).nextMeta,
      });
    }));
    return word;
  };
  db.words.hook('reading', onRead);
  try {
    await updateWord('original', { englishDefinition: 'to distribute resources' });
    await review;
    const saved = await getWordById('original');
    expect(saved?.reviewMeta.history).toHaveLength(1);
    expect(saved?.reviewMeta.fsrs?.reps).toBe(1);
    expect(saved?.englishDefinition).toBe('to distribute resources');
  } finally {
    db.words.hook('reading').unsubscribe(onRead);
  }
});

it('normalizing an older snapshot preserves the latest review and notes', async () => {
  const stale = integrityWord('original', 'allocate (v)');
  const reviewed = { ...stale, notes: 'edited in another tab', reviewMeta: applyFSRSReview(stale.reviewMeta, 3, fixtureNow + 1000).nextMeta };
  await db.words.put(reviewed);
  await migrateSingleWord(stale, { upgradeAi: false });
  const saved = await getWordById('original');
  expect(saved?.word).toBe('allocate');
  expect(saved?.reviewMeta).toEqual(reviewed.reviewMeta);
  expect(saved?.notes).toBe('edited in another tab');
});
