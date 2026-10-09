import { afterEach, describe, expect, it, vi } from 'vitest';
import { enrichWordWithAI } from '../src/services/ai';
import { buildAICacheKey, clearAICache } from '../src/services/ai/aiCache';
import { normalizedPromiseDefinition, verbosePromiseDefinition } from './definitionClarityFixture';

afterEach(() => {
  clearAICache();
  vi.unstubAllGlobals();
});

const config = { provider: 'custom' as const, apiKey: '', baseUrl: 'https://provider.invalid' };

describe('AI definition clarity contract', () => {
  it('filters verbose provider output while retaining the separate bilingual example and usage note', async () => {
    const example = { en: 'She promised to finish on time.', vi: 'Cô ấy hứa sẽ hoàn thành đúng hạn.', context: 'workplace' };
    vi.stubGlobal('fetch', async () => Response.json({ choices: [{ message: { content: JSON.stringify({
      vietnameseDefinition: verbosePromiseDefinition, usageNoteVi: 'promise to do something', examples: [example],
    }) } }] }));
    const result = await enrichWordWithAI('promise', 'verb', config);
    expect(result?.vietnameseDefinition).toBe(normalizedPromiseDefinition);
    expect(result?.examples).toEqual([example]);
    expect(result?.usageNoteVi).toBe('promise to do something');
  });

  it.each([
    { word: 'as soon as', pos: 'phrase', definition: 'ngay khi; vừa … thì …', contextSentence: undefined },
    { word: 'implement', pos: 'verb', definition: 'thực hiện; triển khai', contextSentence: undefined },
    { word: 'plant', pos: 'noun', definition: '1. cây; thực vật; 2. nhà máy', contextSentence: undefined },
    { word: 'bank', pos: 'noun', definition: 'bờ sông', contextSentence: 'The canoe reached the bank.' },
  ])('requests direct meanings and separate usage notes for $word', async ({ word, pos, definition, contextSentence }) => {
    let prompt = '';
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      prompt = body.messages.find((message: { role: string }) => message.role === 'user').content;
      return Response.json({ choices: [{ message: { content: JSON.stringify({
        vietnameseDefinition: definition,
        usageNoteVi: '  Ghi chú cách dùng riêng.  ',
      }) } }] });
    }));

    const result = await enrichWordWithAI(word, pos, config, contextSentence);

    expect(prompt).toContain(`Analyze the English word or phrase "${word}"`);
    expect(prompt).toContain('must begin with direct, natural Vietnamese equivalents');
    expect(prompt).toContain('Do not put grammar explanations');
    expect(prompt).toContain('Put any necessary grammar or usage explanation in "usageNoteVi"');
    expect(prompt).toContain('Put full bilingual sentences only in "examples"');
    expect(prompt).not.toContain('Comprehensive, precise Vietnamese definition');
    if (contextSentence) {
      expect(prompt).toContain(`Sentence context: "${contextSentence}"`);
      expect(prompt).toContain('meaning fitting this sentence context');
      expect(prompt).toContain('first example in "examples" MUST be this exact sentence');
    } else {
      expect(prompt).toContain('number its primary meanings as concise Vietnamese equivalents');
    }
    expect(result?.vietnameseDefinition).toBe(definition);
    expect(result?.usageNoteVi).toBe('Ghi chú cách dùng riêng.');
  });

  it('gives the phrase in the reported issue accurate meaning and usage guidance', async () => {
    let prompt = '';
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      prompt = body.messages.find((message: { role: string }) => message.role === 'user').content;
      return Response.json({ choices: [{ message: { content: JSON.stringify({
        vietnameseDefinition: 'ngay khi; vừa … thì …',
        usageNoteVi: 'Liên từ chỉ thời gian.',
        examples: [{
          en: 'As soon as he arrived, we started the meeting.',
          vi: 'Ngay khi anh ấy đến, chúng tôi bắt đầu cuộc họp.',
          context: 'general',
        }],
      }) } }] });
    });

    const result = await enrichWordWithAI('as soon as', 'phrase', config);
    expect(prompt).toContain('"vietnameseDefinition": "ngay khi; vừa … thì …"');
    expect(prompt).toContain('It introduces a time clause, not a conditional clause');
    expect(prompt).toContain('Translate "as soon as possible" as "sớm nhất có thể"');
    expect(result?.examples[0]?.vi).toBe('Ngay khi anh ấy đến, chúng tôi bắt đầu cuộc họp.');
    expect(result?.usageNoteVi).toBe('Liên từ chỉ thời gian.');
  });

  it('uses the revised cache contract consistently for both call signatures', () => {
    const legacyKey = buildAICacheKey('bank', undefined, 'custom', 'model', 'noun', config.baseUrl);
    const objectKey = buildAICacheKey({ word: 'bank', provider: 'custom', model: 'model', pos: 'noun', baseUrl: config.baseUrl });
    expect(legacyKey).toBe(objectKey);
    expect(objectKey).toMatch(/^ai:v5:/);
    expect(objectKey).not.toBe(buildAICacheKey({
      word: 'bank', provider: 'custom', model: 'model', pos: 'noun', baseUrl: config.baseUrl, schemaVersion: 'v4',
    }));
  });
});
