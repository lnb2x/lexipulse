// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { db } from '../src/services/db/schema';
import { migrateTodayWords } from '../src/services/quizlet/quizletMigration';
import { integrityWord } from './dataIntegrityFixture';
import { formatLocalDate } from '../src/utils/dateUtils';

afterEach(() => vi.restoreAllMocks());
it('does not normalize any card when the recovery backup cannot be stored', async () => {
  await db.words.clear();
  const word = integrityWord('original', 'allocate (v)');
  await db.words.put(word);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Storage full', 'QuotaExceededError');
  });
  await expect(migrateTodayWords({ targetDate: formatLocalDate(word.createdAt), upgradeToAi: false }))
    .rejects.toThrow('normalization_backup_unavailable');
  expect(await db.words.get(word.id)).toEqual(word);
});
