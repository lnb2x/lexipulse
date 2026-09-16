import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { db } from '../src/services/db/schema';
import { createUnenrichedWordItem } from '../src/services/bulkEnrichment';
import { saveNewQuizletWords, getWordsByQuizletSet } from '../src/services/quizlet/quizletRepository';

afterEach(() => vi.unstubAllGlobals());
it('persists raw Quizlet source after auto-enrichment while retaining a reviewed card', async () => {
  await db.words.clear(); await db.settingsTable.clear();
  vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }));
  const existing = createUnenrichedWordItem({ rawWord: 'negotiate', word: 'negotiate', userMeaning: 'thương lượng' }, [], Date.now(), 'manual');
  existing.notes = 'keep my note';
  existing.reviewMeta.history = [{ date: 1700000000000, rating: 3, interval: 12, easeFactor: 2.5, repetition: 4 }];
  await db.words.put(existing);
  const result = await saveNewQuizletWords({
    autoEnrich: true,
    setRef: { id: '123456', title: 'Fixture', url: 'https://quizlet.com/123456/fixture/', importedAt: Date.now() },
    items: [{ term: 'negotiate', normalizedTerm: 'negotiate', definition: 'thương lượng', normalizedDefinition: 'thương lượng',
      rawTerm: 'negotiate (v)', rawDefinition: 'thương lượng [source]', selected: true, status: 'new' }],
  });
  const [saved] = await getWordsByQuizletSet('123456');
  expect(result.savedCount).toBe(1);
  expect(saved.rawQuizletTerm).toBe('negotiate (v)');
  expect(saved.rawQuizletDefinition).toBe('thương lượng [source]');
  expect(saved.reviewMeta).toEqual(existing.reviewMeta);
  expect(saved.notes).toBe(existing.notes);
});
