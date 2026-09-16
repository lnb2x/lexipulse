// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '../src/services/db/schema';
import { importDeckFromJson } from '../src/services/vocabRepository';
import { saveAppSettings, getAppSettings } from '../src/services/db/statsRepo';
import { integrityWord } from './dataIntegrityFixture';

const quota = () => { throw new DOMException('No storage left', 'QuotaExceededError'); };
beforeEach(async () => { for (const table of db.tables) await table.clear(); sessionStorage.clear(); });
afterEach(() => db.dailyStats.hook('creating').unsubscribe(quota));

it('rolls back words, settings and session key if the stats write hits quota', async () => {
  await saveAppSettings({ aiProvider: 'custom', aiApiKey: 'fixture-session-key', persistApiKey: false });
  const before = await getAppSettings();
  db.dailyStats.hook('creating', quota);
  const result = await importDeckFromJson(JSON.stringify({ type: 'lexipulse-backup', version: 1,
    words: [integrityWord()], settings: { dailyQuota: 99 },
    dailyStats: [{ date: '2026-09-15', cardsReviewed: 2, streak: 1, lastActiveDate: '2026-09-15' }],
  }));
  expect(result.imported).toBe(0);
  expect(result.errors).not.toHaveLength(0);
  expect(await db.words.count()).toBe(0);
  expect(await getAppSettings()).toEqual(before);
});

it('never imports a key from a backup or attaches the old key to a restored endpoint', async () => {
  await saveAppSettings({ aiProvider: 'custom', aiApiKey: 'fixture-session-key', persistApiKey: false });
  await importDeckFromJson(JSON.stringify({ type: 'lexipulse-backup', version: 1, words: [],
    settings: { aiProvider: 'custom', aiBaseUrl: 'https://provider.invalid', aiApiKey: 'imported-fixture-key' },
  }));
  expect((await getAppSettings()).aiApiKey).toBe('');
});
