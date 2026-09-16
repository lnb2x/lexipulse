import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { db } from '../src/services/db/schema';
import { importDeckFromJson } from '../src/services/vocabRepository';
import { exportFullBackupToJson } from '../src/services/db/backup';
import { integrityWord } from './dataIntegrityFixture';
import { backupChecksum } from '../src/services/db/backupEnvelope';

beforeEach(async () => { for (const table of db.tables) await table.clear(); });
const incoming = () => JSON.stringify({ type: 'lexipulse-backup', version: 1, words: [integrityWord('incoming', 'beta')],
  settings: { dailyQuota: 77 }, dailyStats: [{ date: '2026-09-15', cardsReviewed: 8, streak: 2 }] });

it('previews the diff without writing any table', async () => {
  await db.words.put(integrityWord());
  const result = await importDeckFromJson(incoming(), { previewOnly: true });
  expect(await db.words.count()).toBe(1);
  expect(await db.dailyStats.count()).toBe(0);
  expect(result.preview?.tables.words.added).toBe(1);
  expect(result.preview?.recoveryBackup).toContain('checksum');
});

it('restores only selected tables', async () => {
  await importDeckFromJson(incoming(), { tables: ['words'] });
  expect(await db.words.count()).toBe(1);
  expect(await db.settingsTable.count()).toBe(0);
  expect(await db.dailyStats.count()).toBe(0);
});

it('requires a current recovery snapshot for replace and keeps unselected tables', async () => {
  await db.words.put(integrityWord('incoming', 'beta'));
  const file = await exportFullBackupToJson();
  await db.words.clear();
  await db.words.put(integrityWord());
  await db.dailyStats.put({ date: '2026-09-15', cardsReviewed: 20, streak: 5, lastActiveDate: '2026-09-15' });
  const rejected = await importDeckFromJson(file, { mode: 'replace', tables: ['words', 'quizletSets'] });
  expect(rejected.errors.join(' ')).toContain('recovery');
  expect(await db.words.get('original')).toBeDefined();
  const preview = await importDeckFromJson(file, { mode: 'replace', previewOnly: true, tables: ['words', 'quizletSets'] });
  expect(preview.preview?.tables.words.removed).toBe(1);
  const restored = await importDeckFromJson(file, { mode: 'replace', tables: ['words', 'quizletSets'], recoveryBackup: preview.preview?.recoveryBackup });
  expect(restored.errors).toEqual([]);
  expect(await db.words.get('original')).toBeUndefined();
  expect((await db.dailyStats.get('2026-09-15'))?.cardsReviewed).toBe(20);
});

it('blocks a stale preview after another tab changes a record', async () => {
  await db.words.put(integrityWord());
  const recoveryBackup = await exportFullBackupToJson();
  await db.words.update('original', { notes: 'new note' });
  const result = await importDeckFromJson(incoming(), { recoveryBackup });
  expect(result.errors.join(' ')).toContain('stale');
  expect(await db.words.count()).toBe(1);
});

it('refuses replacement if a selected set record is damaged', async () => {
  await db.words.put(integrityWord());
  const recoveryBackup = await exportFullBackupToJson();
  const payload = JSON.parse(recoveryBackup);
  delete payload.checksum;
  payload.quizletSets = [{ id: 'broken', title: { invalid: true } }];
  const file = JSON.stringify({ ...payload, checksum: { algorithm: 'SHA-256', value: await backupChecksum(payload) } });
  const result = await importDeckFromJson(file, { mode: 'replace', recoveryBackup });
  expect(result.imported).toBe(0);
  expect(result.errors.join(' ')).toContain('replace_rejected_records');
  expect(await db.words.get('original')).toEqual(integrityWord());
});

it('counts distinct case-sensitive primary keys in the replacement preview', async () => {
  const empty = await exportFullBackupToJson();
  await db.words.bulkPut([integrityWord('Card', 'alpha'), integrityWord('card', 'beta')]);
  const preview = await importDeckFromJson(empty, { previewOnly: true, mode: 'replace' });
  expect(preview.preview?.tables.words.current).toBe(2);
  expect(preview.preview?.tables.words.removed).toBe(2);
});
