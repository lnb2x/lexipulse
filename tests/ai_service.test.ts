import { describe, it, expect, beforeEach } from 'vitest';
import { validateAndNormalizeAIResponse } from '../src/services/ai';
import {
  buildAICacheKey,
  getCachedAIEnrichment,
  setCachedAIEnrichment,
  clearAICache,
} from '../src/services/ai/aiCache';

describe('AI Cache & Response Validation', () => {
  beforeEach(() => {
    clearAICache();
  });

  it('generates safe cache key without leaking api key or tokens', () => {
    const key1 = buildAICacheKey('went', 'I went home', 'gemini', 'gemini-2.5-flash');
    expect(key1).toContain('went');
    expect(key1).toContain('gemini-2.5-flash');
    expect(key1).not.toContain('AIzaSy');
    expect(key1).not.toContain('sk-');

    // whitespace differences in context should produce same key
    const key2 = buildAICacheKey('went', '  I   went   home  ', 'gemini', 'gemini-2.5-flash');
    expect(key1).toBe(key2);
  });

  it('stores and retrieves cached enrichment result', () => {
    const mockResult = {
      vietnameseDefinition: 'Đi (quá khứ của go)',
      lemma: 'go',
      formLabels: ['Quá khứ đơn (V2)'],
      collocations: [],
      wordFamily: [],
      examples: [{ en: 'I went home.', vi: 'Tôi đã về nhà.', context: 'general' as const }],
      tags: ['#TOEIC'],
    };

    setCachedAIEnrichment('went', mockResult, 'I went home', 'gemini', 'gemini-2.5-flash');
    const cached = getCachedAIEnrichment('went', 'I went home', 'gemini', 'gemini-2.5-flash');
    expect(cached).not.toBeNull();
    expect(cached?.lemma).toBe('go');
    expect(cached?.vietnameseDefinition).toBe('Đi (quá khứ của go)');
  });

  it('validates and normalizes AI json correctly without inventing fake data', () => {
    const raw = {
      lemma: 'write',
      formLabels: ['Quá khứ phân từ (V3)'],
      inflections: [{ form: 'written', label: 'V3' }],
      ipaUs: '/ˈrɪt.ən/',
      vietnameseDefinition: 'Được viết, soạn thảo',
      collocations: [{ phrase: 'written confirmation', meaningVi: 'xác nhận bằng văn bản' }],
      wordFamily: [{ word: 'writer', pos: 'noun', meaningVi: 'nhà văn' }],
      examples: [{ en: 'Please submit a written notice.', vi: 'Vui lòng nộp thông báo bằng văn bản.', context: 'toeic' }],
      tags: ['TOEIC'],
    };

    const res = validateAndNormalizeAIResponse(raw);
    expect(res).not.toBeNull();
    expect(res?.lemma).toBe('write');
    expect(res?.formLabels).toEqual(['Quá khứ phân từ (V3)']);
    expect(res?.inflections).toEqual([{ form: 'written', label: 'V3' }]);
    expect(res?.ipaUs).toBe('/ˈrɪt.ən/');
    expect(res?.ipaUk).toBeUndefined(); // Should be undefined, NOT a fabricated string!
    expect(res?.tags).toEqual(['#TOEIC']);
  });

  it('rejects payload missing vietnameseDefinition', () => {
    const invalid = {
      lemma: 'write',
      ipaUs: '/raɪt/',
    };
    expect(validateAndNormalizeAIResponse(invalid)).toBeNull();
  });
});
