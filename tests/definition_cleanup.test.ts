import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/services/db/schema';
import { DEFAULT_SETTINGS } from '../src/services/db/statsRepo';
import { cleanStoredDefinitions, DEFINITION_CLEANUP_BACKUP_KEY, shortenVerboseDefinitions, withCleanDefinitions } from '../src/services/definitionCleanup';
import { enrichWordWithAI } from '../src/services/ai';
import { integrityWord } from './dataIntegrityFixture';
import { normalizedPromiseDefinition, verbosePromiseDefinition } from './definitionClarityFixture';
import type { WordItem } from '../src/types/vocab';

vi.mock('../src/services/ai', () => ({ enrichWordWithAI: vi.fn() }));
const prose = 'Cụm từ này được sử dụng để diễn tả việc một hành động xảy ra ngay lập tức sau khi một hành động khác đã hoàn thành, nhấn mạnh sự liên tiếp về thời gian giữa hai sự kiện.';
const longWord = (id = 'long'): WordItem => ({ ...integrityWord(id, 'as soon as'), vietnameseDefinition: prose });
const result = (definition: string) => ({ vietnameseDefinition: definition, examples: [], collocations: [], wordFamily: [], tags: [] });

beforeEach(async () => {
  for (const table of db.tables) await table.clear();
  vi.mocked(enrichWordWithAI).mockReset();
  await db.settingsTable.put({ key: 'appSettings', value: { ...DEFAULT_SETTINGS, aiProvider: 'custom', aiBaseUrl: 'https://provider.invalid' } });
});
afterEach(() => vi.restoreAllMocks());

describe('deck-wide definition cleanup', () => {
  it('cleans every main definition and sub-sense, backs up originals and preserves learning data', async () => {
    const words = [
      { ...integrityWord('promise', 'promise'), vietnameseDefinition: verbosePromiseDefinition, rawQuizletDefinition: verbosePromiseDefinition,
        examples: [{ en: 'She promised.', vi: 'Cô ấy đã hứa.', context: 'general' as const }], usageNoteVi: 'Ghi chú riêng.', notes: 'Ghi chú cá nhân.' },
      { ...integrityWord('bank', 'bank'), vietnameseDefinition: '(n) ngân hàng (ví dụ: Tôi tới ngân hàng.)',
        meanings: [{ pos: 'noun', englishDefinition: 'a financial institution', vietnameseDefinition: 'ngân hàng (ví dụ: The bank is closed.)' }] },
      integrityWord('concise', 'allocate'),
    ];
    await db.words.bulkPut(words);
    expect(await cleanStoredDefinitions()).toBe(2);
    const saved = await db.words.get('promise');
    expect(saved).toEqual({ ...words[0], vietnameseDefinition: normalizedPromiseDefinition, updatedAt: expect.any(Number) });
    expect((await db.words.get('bank'))?.meanings[0].vietnameseDefinition).toBe('ngân hàng');
    const backup = (await db.settingsTable.get(DEFINITION_CLEANUP_BACKUP_KEY))!.value;
    expect(backup.words).toHaveLength(2);
    expect(backup.words).toEqual(expect.arrayContaining(words.slice(0, 2)));
    expect(await cleanStoredDefinitions()).toBe(0);
    expect((await db.settingsTable.get(DEFINITION_CLEANUP_BACKUP_KEY))!.value).toEqual(backup);
    expect(await db.words.get('concise')).toEqual(words[2]);
  });

  it('rolls back all edits when the original backup cannot be saved', async () => {
    const word = { ...integrityWord(), vietnameseDefinition: verbosePromiseDefinition };
    await db.words.put(word);
    vi.spyOn(db.settingsTable, 'put').mockRejectedValueOnce(new Error('Quota exceeded'));
    await expect(cleanStoredDefinitions()).rejects.toThrow('Quota exceeded');
    expect(await db.words.get(word.id)).toEqual(word);
  });

  it('does not modify a display snapshot or substitute an example-only definition', () => {
    const word = { ...integrityWord(), vietnameseDefinition: verbosePromiseDefinition };
    expect(withCleanDefinitions(word).vietnameseDefinition).toBe(normalizedPromiseDefinition);
    expect(word.vietnameseDefinition).toBe(verbosePromiseDefinition);
    const onlyExample = { ...word, vietnameseDefinition: '(ví dụ: Anh ấy hứa.)' };
    expect(withCleanDefinitions(onlyExample)).toBe(onlyExample);
  });

  it('reports local cleanup when it is sufficient and does not call AI unnecessarily', async () => {
    await db.words.put({ ...integrityWord(), vietnameseDefinition: verbosePromiseDefinition });
    expect(await shortenVerboseDefinitions()).toMatchObject({ total: 1, processed: 1, updated: 1, failed: 0 });
    expect(enrichWordWithAI).not.toHaveBeenCalled();
  });

  it('rewrites all remaining long meanings using their existing senses and preserves other content', async () => {
    const words = [longWord('first'), longWord('second'), integrityWord('short')];
    await db.words.bulkPut(words);
    vi.mocked(enrichWordWithAI).mockResolvedValue(result('ngay khi; vừa … thì …'));
    const onProgress = vi.fn();
    expect(await shortenVerboseDefinitions({ onProgress })).toMatchObject({ total: 2, processed: 2, updated: 2, failed: 0 });
    expect(enrichWordWithAI).toHaveBeenCalledTimes(2);
    expect(enrichWordWithAI).toHaveBeenCalledWith('as soon as', 'verb', expect.objectContaining({ provider: 'custom', forceReTranslate: true }), undefined, prose);
    for (const original of words.slice(0, 2)) {
      const saved = (await db.words.get(original.id))!;
      expect(saved.vietnameseDefinition).toBe('ngay khi; vừa … thì …');
      expect(saved.reviewMeta).toEqual(original.reviewMeta);
      expect(saved.examples).toEqual(original.examples);
      expect(saved.vietnameseDefinitionProvenance?.source).toBe('ai');
    }
    expect(await db.words.get('short')).toEqual(words[2]);
    expect((await db.settingsTable.get(DEFINITION_CLEANUP_BACKUP_KEY))!.value.words).toEqual(words.slice(0, 2));
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ processed: 2, currentWord: '' }));
  });

  it('preserves concurrent content edits and never resurrects a deleted word', async () => {
    const words = [longWord('edit'), longWord('delete')];
    await db.words.bulkPut(words);
    vi.mocked(enrichWordWithAI).mockImplementationOnce(async () => {
      await db.words.update('edit', { vietnameseDefinition: 'ngay khi (nghĩa tự sửa)', isUserEdited: true });
      return result('ngay khi');
    }).mockImplementationOnce(async () => {
      await db.words.delete('delete');
      return result('ngay khi');
    });
    expect(await shortenVerboseDefinitions()).toMatchObject({ total: 2, skipped: 2, updated: 0 });
    expect((await db.words.get('edit'))?.vietnameseDefinition).toBe('ngay khi (nghĩa tự sửa)');
    expect(await db.words.get('delete')).toBeUndefined();
  });

  it('keeps the latest FSRS changes while saving a rewritten meaning', async () => {
    const word = longWord();
    await db.words.put(word);
    vi.mocked(enrichWordWithAI).mockImplementation(async () => {
      await db.words.update(word.id, { 'reviewMeta.dueDate': 123456, tags: ['#NewTag'] });
      return result('ngay khi');
    });
    expect(await shortenVerboseDefinitions()).toMatchObject({ updated: 1 });
    const saved = (await db.words.get(word.id))!;
    expect(saved.reviewMeta.dueDate).toBe(123456);
    expect(saved.tags).toEqual(['#NewTag']);
  });

  it('cancels in-flight results without saving them and retains failures for retry', async () => {
    const word = longWord();
    await db.words.put(word);
    const controller = new AbortController();
    vi.mocked(enrichWordWithAI).mockImplementation(async () => { controller.abort(); return result('ngay khi'); });
    expect(await shortenVerboseDefinitions({ signal: controller.signal })).toMatchObject({ cancelled: true, updated: 0 });
    expect(await db.words.get(word.id)).toEqual(word);
    vi.mocked(enrichWordWithAI).mockResolvedValue(result(prose));
    expect(await shortenVerboseDefinitions()).toMatchObject({ failed: 1, updated: 0 });
    expect(await db.words.get(word.id)).toEqual(word);
  });
});
