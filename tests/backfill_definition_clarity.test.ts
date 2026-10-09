import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/services/db';
import { enrichSingleWordMissingTranslations } from '../src/services/missingTranslationEnricher';
import type { AppSettings } from '../src/types/vocab';
import { integrityWord } from './dataIntegrityFixture';
import { normalizedPromiseDefinition, verbosePromiseDefinition } from './definitionClarityFixture';

const settings: AppSettings = {
  aiProvider: 'custom', aiApiKey: '', aiBaseUrl: 'https://provider.invalid', geminiApiKey: '',
  speechRate: 1, speechPitch: 1, preferredAccent: 'US', dailyQuota: 20, theme: 'dark',
};
beforeEach(async () => { await db.words.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

function respond(payload: unknown, onPrompt?: (prompt: string) => void) {
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    const request = JSON.parse(String(init.body));
    onPrompt?.(request.messages[0].content);
    return Response.json({ choices: [{ message: { content: JSON.stringify(payload) } }] });
  });
}

describe('backfill definition clarity', () => {
  it('filters embedded examples before persisting a newly translated main definition', async () => {
    const word = { ...integrityWord('backfill-promise', 'promise'), vietnameseDefinition: '' };
    await db.words.put(word);
    respond({ vietnameseDefinition: verbosePromiseDefinition });
    const result = await enrichSingleWordMissingTranslations(word, settings);
    expect(result.success).toBe(true);
    expect((await db.words.get(word.id))?.vietnameseDefinition).toBe(normalizedPromiseDefinition);
    expect(result.word.reviewMeta).toEqual(word.reviewMeta);
  });

  it('requests and saves a concise main meaning with separate usage', async () => {
    const word = { ...integrityWord('backfill', 'as soon as'), vietnameseDefinition: '', usageNoteVi: 'Ghi chú cũ.' };
    await db.words.put(word);
    let prompt = '';
    respond({ vietnameseDefinition: 'ngay khi', usageNoteVi: '  Nối các mệnh đề chỉ thời gian.  ' }, value => { prompt = value; });
    const result = await enrichSingleWordMissingTranslations(word, settings);
    expect(result.success).toBe(true);
    expect(prompt).toContain('nghĩa tương đương tiếng Việt ngắn gọn');
    expect(prompt).toContain('Không gộp giải thích ngữ pháp hoặc câu ví dụ');
    expect(result.word).toMatchObject({ vietnameseDefinition: 'ngay khi', usageNoteVi: 'Nối các mệnh đề chỉ thời gian.', reviewMeta: word.reviewMeta });
    expect((await db.words.get(word.id))?.usageNoteVi).toBe(result.word.usageNoteVi);
  });

  it('retains the existing note when only a missing example is translated', async () => {
    const word = {
      ...integrityWord('backfill', 'as soon as'), vietnameseDefinition: 'ngay khi',
      source: 'ai' as const, vietnameseDefinitionProvenance: { source: 'ai' as const },
      usageNoteVi: 'Nối các mệnh đề chỉ thời gian.',
      examples: [{ en: 'I will call you as soon as I arrive.', vi: '', context: 'general' as const }],
    };
    await db.words.put(word);
    respond({ usageNoteVi: 'Ghi chú không được yêu cầu.', examples: [{ idx: 0, vi: 'Tôi sẽ gọi bạn ngay khi tôi đến.' }] });
    const result = await enrichSingleWordMissingTranslations(word, settings);
    expect(result.word.usageNoteVi).toBe(word.usageNoteVi);
    expect(result.word.examples[0].vi).toBe('Tôi sẽ gọi bạn ngay khi tôi đến.');
    expect(result.word.reviewMeta).toEqual(word.reviewMeta);
  });

  it('clears stale usage when a replacement main definition has no valid note', async () => {
    const word = { ...integrityWord('backfill', 'as soon as'), vietnameseDefinition: '', usageNoteVi: 'Ghi chú cũ.' };
    await db.words.put(word);
    respond({ vietnameseDefinition: 'ngay khi', usageNoteVi: 42 });
    const result = await enrichSingleWordMissingTranslations(word, settings);
    expect(result.success).toBe(true);
    expect(result.word.usageNoteVi).toBeUndefined();
  });
});
