import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { db } from '../src/services/db/schema';
import { importDeckFromJson } from '../src/services/vocabRepository';
import { integrityWord } from './dataIntegrityFixture';

beforeEach(async () => { await db.words.clear(); });

it('imports the good record and reports a malformed nested record by index', async () => {
  const result = await importDeckFromJson(JSON.stringify([
    integrityWord(), { ...integrityWord('bad', 'broken'), vietnameseDefinition: { bad: true } },
  ]));
  expect(result.imported).toBe(1);
  expect(result.skipped).toBe(1);
  expect(result.errors[0]).toContain('words[1]');
  expect(await db.words.count()).toBe(1);
});

it('rejects invalid FSRS state without dropping or rewriting its history', async () => {
  const word = integrityWord();
  word.reviewMeta.fsrs!.state = 99;
  const result = await importDeckFromJson(JSON.stringify([word]));
  expect(result.skipped).toBe(1);
  expect(await db.words.count()).toBe(0);
});

it('rejects unsupported envelopes before any write', async () => {
  const result = await importDeckFromJson(JSON.stringify({ type: 'other-app', version: 99, words: [integrityWord()] }));
  expect(result.imported).toBe(0);
  expect(result.errors).not.toHaveLength(0);
  expect(await db.words.count()).toBe(0);
});
