import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { db } from '../src/services/db/schema';
import { exportFullBackupToJson } from '../src/services/db/backup';
import { importDeckFromJson } from '../src/services/vocabRepository';
import { WORD_LRU_CACHE, warmSearchCache } from '../src/services/dictionary/cache';
import { integrityWord } from './dataIntegrityFixture';

it('invalidates saved-card lookup cache after replacement commits', async () => {
  for (const table of db.tables) await table.clear();
  const empty = await exportFullBackupToJson();
  const word = integrityWord();
  await db.words.put(word); warmSearchCache([word]);
  const recoveryBackup = await exportFullBackupToJson();
  expect(WORD_LRU_CACHE.get(word.word)?.id).toBe(word.id);
  const result = await importDeckFromJson(empty, { mode: 'replace', recoveryBackup });
  expect(result.errors).toEqual([]);
  expect(await db.words.count()).toBe(0);
  expect(WORD_LRU_CACHE.get(word.word)).toBeUndefined();
});
