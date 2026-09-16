import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { expect, it } from 'vitest';
import { db } from '../src/services/db/schema';
import { runFSRSMigration } from '../src/services/db/migration';
import { exportFullBackupToJson } from '../src/services/db/backup';
import { importDeckFromJson } from '../src/services/vocabRepository';
import { integrityWord, fixtureNow } from './dataIntegrityFixture';
import { translations } from '../src/i18n/translations';

it('opens a populated v1 database, migrates twice, then roundtrips v2 without losing history', async () => {
  db.close(); await Dexie.delete('LexiPulseDB');
  const legacy = new Dexie('LexiPulseDB');
  legacy.version(1).stores({ words: 'id, word, status, createdAt, updatedAt, *tags, [status+reviewMeta.dueDate]', dailyStats: 'date, streak', settingsTable: 'key' });
  const word = integrityWord();
  word.notes = 'keep my original note';
  word.reviewMeta = { repetition: 2, interval: 7, easeFactor: 2.5, dueDate: fixtureNow + 86400000,
    lastReviewedDate: fixtureNow - 86400000, history: [
      { date: fixtureNow - 2 * 86400000, rating: 2, interval: 1, easeFactor: 2.5, repetition: 1 },
      { date: fixtureNow - 86400000, rating: 3, interval: 7, easeFactor: 2.5, repetition: 2 },
    ] };
  await legacy.table('words').put(word);
  await legacy.table('dailyStats').put({ date: '2026-09-14', cardsReviewed: 11, streak: 5, lastActiveDate: '2026-09-14' });
  await legacy.table('settingsTable').put({ key: 'appSettings', value: { dailyQuota: 25 } });
  legacy.close(); await db.open();
  expect(db.verno).toBe(4);
  expect(await db.words.get(word.id)).toEqual(word);
  await runFSRSMigration();
  const migrated = await db.words.get(word.id);
  expect(migrated?.reviewMeta.legacyBackup).toEqual(word.reviewMeta);
  expect(migrated?.reviewMeta.dueDate).toBe(word.reviewMeta.dueDate);
  await runFSRSMigration();
  expect(await db.words.get(word.id)).toEqual(migrated);
  const backup = await exportFullBackupToJson();
  for (const table of db.tables) await table.clear();
  expect((await importDeckFromJson(backup)).errors).toEqual([]);
  const restored = await db.words.get(word.id);
  expect(restored?.reviewMeta).toEqual(migrated?.reviewMeta);
  expect(restored?.notes).toBe(word.notes);
  expect((await db.dailyStats.get('2026-09-14'))?.cardsReviewed).toBe(11);
  expect((await db.settingsTable.get('appSettings'))?.value.dailyQuota).toBe(25);
});

it('keeps Vietnamese and English translation leaf keys identical', () => {
  const keys = (object: object, prefix = ''): string[] => Object.entries(object)
    .flatMap(([key, value]) => value && typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`]);
  expect(keys(translations.vi).sort()).toEqual(keys(translations.en).sort());
});
