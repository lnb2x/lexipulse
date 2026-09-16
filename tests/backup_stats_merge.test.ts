import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { db } from '../src/services/db/schema';
import { importDeckFromJson } from '../src/services/vocabRepository';

const date = '2026-09-15';
const backup = JSON.stringify({ type: 'lexipulse-backup', version: 1, words: [], dailyStats: [{ date, cardsReviewed: 2, streak: 1, lastActiveDate: date }] });
beforeEach(async () => { await db.dailyStats.clear(); });

it('merge preserves an active local day and is idempotent', async () => {
  await db.dailyStats.put({ date, cardsReviewed: 20, streak: 5, lastActiveDate: date });
  await importDeckFromJson(backup);
  await importDeckFromJson(backup);
  expect((await db.dailyStats.get(date))?.cardsReviewed).toBe(20);
  expect((await db.dailyStats.get(date))?.streak).toBe(5);
});

it('restores a missing or initialized empty day without adding counts twice', async () => {
  await db.dailyStats.put({ date, cardsReviewed: 0, streak: 0, lastActiveDate: date });
  await importDeckFromJson(backup);
  await importDeckFromJson(backup);
  expect((await db.dailyStats.get(date))?.cardsReviewed).toBe(2);
});

it('explicit progress replacement may restore the older count', async () => {
  await db.dailyStats.put({ date, cardsReviewed: 20, streak: 5, lastActiveDate: date });
  await importDeckFromJson(backup, { replaceProgress: true });
  expect((await db.dailyStats.get(date))?.cardsReviewed).toBe(2);
});
