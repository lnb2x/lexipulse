import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { db } from '../src/services/db/schema';
import { exportFullBackupToJson } from '../src/services/db/backup';
import { importDeckFromJson } from '../src/services/vocabRepository';
import { backupChecksum } from '../src/services/db/backupEnvelope';
import { integrityWord, fixtureNow } from './dataIntegrityFixture';

beforeEach(async () => { for (const table of db.tables) await table.clear(); });

it('snapshots all four tables and restores Quizlet sets and extra settings', async () => {
  await db.words.put(integrityWord());
  await db.quizletSets.put({ id: '123', title: 'Set one', url: 'https://quizlet.com/123/', createdAt: fixtureNow, updatedAt: fixtureNow });
  await db.settingsTable.bulkPut([{ key: 'custom', value: { enabled: true } }, { key: 'appSettings', value: { aiApiKey: 'fixture-secret', geminiApiKey: 'fixture-secret' } }]);
  const json = await exportFullBackupToJson();
  const backup = JSON.parse(json);
  expect(backup.version).toBe(2);
  expect(backup.schemaVersion).toBe(4);
  expect(backup.checksum.algorithm).toBe('SHA-256');
  expect(backup.quizletSets).toHaveLength(1);
  expect(backup.settingsTable).toHaveLength(2);
  expect(json).not.toContain('fixture-secret');
  for (const table of db.tables) await table.clear();
  expect((await importDeckFromJson(json)).errors).toEqual([]);
  expect((await db.quizletSets.get('123'))?.title).toBe('Set one');
  expect((await db.settingsTable.get('custom'))?.value).toEqual({ enabled: true });
});

it('rejects a changed payload before writing any table', async () => {
  await db.words.put(integrityWord());
  const backup = JSON.parse(await exportFullBackupToJson());
  backup.words[0].word = 'tampered';
  await db.words.clear();
  const result = await importDeckFromJson(JSON.stringify(backup));
  expect(result.errors.join(' ')).toContain('checksum');
  expect(await db.words.count()).toBe(0);
});

it('restores authoritative settingsTable without the compatibility alias', async () => {
  await db.settingsTable.put({ key: 'appSettings', value: { dailyQuota: 37 } });
  const payload = JSON.parse(await exportFullBackupToJson());
  delete payload.settings; delete payload.checksum;
  payload.settingsTable.push({ key: 'extra', value: { aiApiKey: 'fixture-secret' } });
  const file = JSON.stringify({ ...payload, checksum: { algorithm: 'SHA-256', value: await backupChecksum(payload) } });
  await db.settingsTable.clear();
  expect((await importDeckFromJson(file)).errors).toEqual([]);
  expect((await db.settingsTable.get('appSettings'))?.value.dailyQuota).toBe(37);
  expect((await db.settingsTable.get('extra'))?.value.aiApiKey).toBe('');
});
