import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { db } from '../src/services/db/schema';
import { importDeckFromJson, saveOrUpdateWord, getWordById } from '../src/services/vocabRepository';
import { applyFSRSReview } from '../src/services/fsrs/fsrsService';
import { integrityWord, fixtureNow } from './dataIntegrityFixture';

beforeEach(async () => { await db.words.clear(); });

it('keeps both terms and original history when an import collides with an existing ID', async () => {
  const old = integrityWord();
  old.reviewMeta = applyFSRSReview(old.reviewMeta, 3, fixtureNow + 1000).nextMeta;
  await db.words.put(old);
  const incoming = JSON.stringify([integrityWord(old.id, 'beta'), integrityWord(old.id, 'gamma')]);
  expect((await importDeckFromJson(incoming)).imported).toBe(2);
  expect((await getWordById(old.id))?.reviewMeta).toEqual(old.reviewMeta);
  expect((await getWordById(old.id))?.word).toBe('allocate');
  expect(await db.words.count()).toBe(3);
  await importDeckFromJson(incoming);
  expect(await db.words.count()).toBe(3);
});

it('saving a new term with an occupied ID allocates a different ID', async () => {
  await db.words.put(integrityWord());
  const saved = await saveOrUpdateWord(integrityWord('original', 'beta'));
  expect(saved.word.id).not.toBe('original');
  expect((await getWordById('original'))?.word).toBe('allocate');
});
