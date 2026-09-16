import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { db } from '../src/services/db/schema';
import { exportFullBackupToJson } from '../src/services/db/backup';
import { importDeckFromJson, getWordById } from '../src/services/vocabRepository';
import { integrityWord, fixtureNow } from './dataIntegrityFixture';

beforeEach(async () => { await db.words.clear(); });

it('restores Quizlet links, source text and estimated FSRS metadata from a v1 backup', async () => {
  const word = integrityWord();
  word.quizletSetIds = ['123'];
  word.quizletSets = [{ id: '123', title: 'Original set', url: 'https://quizlet.com/123/', importedAt: fixtureNow }];
  word.rawQuizletTerm = 'allocate (v)';
  word.rawQuizletDefinition = 'phân bổ /example/';
  word.reviewMeta.isEstimated = true;
  await db.words.put(word);
  const exported = JSON.parse(await exportFullBackupToJson());
  const v1 = JSON.stringify({ type: 'lexipulse-backup', version: 1, words: exported.words });
  await db.words.clear();
  expect((await importDeckFromJson(v1)).errors).toEqual([]);
  const saved = await getWordById(word.id);
  expect(saved?.quizletSetIds).toEqual(word.quizletSetIds);
  expect(saved?.quizletSets).toEqual(word.quizletSets);
  expect(saved?.rawQuizletTerm).toBe(word.rawQuizletTerm);
  expect(saved?.rawQuizletDefinition).toBe(word.rawQuizletDefinition);
  expect(saved?.reviewMeta).toEqual(word.reviewMeta);
});
