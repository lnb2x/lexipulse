import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { db } from '../src/services/db/schema';
import { exportFullBackupToJson } from '../src/services/db/backup';
import { importDeckFromJson } from '../src/services/vocabRepository';
import { integrityWord } from './dataIntegrityFixture';

beforeEach(async () => { for (const table of db.tables) await table.clear(); });
it('restores separate senses with identical spelling and exact history and timestamps', async () => {
  const first = integrityWord('sense-one', 'bank');
  const second = { ...integrityWord('sense-two', 'bank'), notes: 'river bank', pos: ['verb'] };
  second.reviewMeta.history = [{ date: 1789420000000, rating: 3, interval: 7, easeFactor: 2.5, repetition: 1 }];
  await db.words.bulkPut([first, second]);
  const file = await exportFullBackupToJson();
  await db.words.clear();
  const preview = await importDeckFromJson(file, { previewOnly: true });
  expect(preview.preview?.tables.words.incoming).toBe(2);
  expect((await importDeckFromJson(file)).errors).toEqual([]);
  expect(await db.words.toArray()).toEqual([first, second]);
  expect((await importDeckFromJson(file)).errors).toEqual([]);
  expect(await db.words.count()).toBe(2);
});
