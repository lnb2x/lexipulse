import { describe, it, expect, vi } from 'vitest';
import { runEnrichmentPipeline } from '../src/services/enrichmentPipeline';
import * as aiModule from '../src/services/ai';
import * as dictModule from '../src/services/dictionary';
import type { AppSettings } from '../src/types/vocab';

describe('Unified Enrichment Pipeline', () => {
  const mockSettings: AppSettings = {
    theme: 'light',
    dailyGoal: 10,
    dailyReviewGoal: 20,
    geminiApiKey: 'test-api-key',
    aiApiKey: 'test-api-key',
    aiProvider: 'gemini',
    aiModel: 'gemini-2.5-flash',
    prioritizeAI: true,
  };

  it('identifies lemma and grammatical form immediately during morphology stage', async () => {
    const stages: string[] = [];

    const res = await runEnrichmentPipeline({
      query: 'went',
      settings: { ...mockSettings, aiApiKey: '' }, // AI disabled
      onStageUpdate: (update) => {
        stages.push(update.stage);
      },
    });

    expect(stages).toContain('morphology');
    expect(res.word.lemma).toBe('go');
    expect(res.word.originalInput).toBe('went');
    expect(res.word.linkedVariants).toContain('went');
    expect(res.word.formLabels?.some((l) => l.includes('Quá khứ'))).toBe(true);
  });

  it('prioritizes AI translation over dictionary and does not allow dictionary to overwrite it', async () => {
    // Mock AI returning a high quality translation
    vi.spyOn(aiModule, 'enrichWordWithAI').mockResolvedValueOnce({
      vietnameseDefinition: 'Đi (dạng quá khứ của go)',
      lemma: 'go',
      formLabels: ['Quá khứ đơn (V2)'],
      collocations: [{ phrase: 'went home', meaningVi: 'đã về nhà' }],
      wordFamily: [],
      examples: [{ en: 'She went to the meeting.', vi: 'Cô ấy đã đến cuộc họp.', context: 'general' }],
      tags: ['#TOEIC'],
    });

    // Mock Dictionary returning generic translation
    vi.spyOn(dictModule, 'lookupWord').mockResolvedValueOnce({
      id: 'dict-123',
      word: 'go',
      vietnameseDefinition: 'đi, đi lại (từ điển)',
      englishDefinition: 'to move from one place to another',
      pos: ['verb'],
      phonetics: { us: '/ɡoʊ/', uk: '/ɡəʊ/' },
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: [],
      status: 'new',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reviewMeta: {} as any,
    });

    const res = await runEnrichmentPipeline({
      query: 'went',
      settings: mockSettings,
    });

    // AI definition MUST NOT be overwritten by dictionary
    expect(res.sourceVi).toBe('ai');
    expect(res.word.vietnameseDefinition).toBe('Đi (dạng quá khứ của go)');
    // But dictionary phonetics should be merged if present
    expect(res.word.phonetics.us).toBe('/ɡoʊ/');
  });

  it('seamlessly falls back to dictionary when AI fails or throws', async () => {
    vi.spyOn(aiModule, 'enrichWordWithAI').mockRejectedValueOnce(new Error('AI network timeout'));

    vi.spyOn(dictModule, 'lookupWord').mockResolvedValueOnce({
      id: 'dict-456',
      word: 'write',
      vietnameseDefinition: 'viết, soạn thảo (từ điển)',
      englishDefinition: 'to mark letters and words',
      pos: ['verb'],
      phonetics: { us: '/raɪt/', uk: '/raɪt/' },
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: [],
      status: 'new',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reviewMeta: {} as any,
    });

    const res = await runEnrichmentPipeline({
      query: 'written',
      settings: mockSettings,
    });

    expect(res.sourceVi).toBe('dictionary');
    expect(res.word.vietnameseDefinition).toBe('viết, soạn thảo (từ điển)');
    expect(res.word.lemma).toBe('write');
    expect(res.word.originalInput).toBe('written');
  });

  it('preserves context sentence in pipeline and associates it with the word item', async () => {
    const sentence = 'The manager studies the financial report carefully.';

    vi.spyOn(aiModule, 'enrichWordWithAI').mockResolvedValueOnce({
      vietnameseDefinition: 'Nghiên cứu, xem xét kỹ lưỡng',
      lemma: 'study',
      formLabels: ['Ngôi thứ 3 số ít hiện tại đơn'],
      collocations: [],
      wordFamily: [],
      examples: [{ en: sentence, vi: 'Người quản lý nghiên cứu báo cáo tài chính một cách cẩn thận.', context: 'toeic' }],
      tags: ['#TOEIC', '#Management'],
    });

    const res = await runEnrichmentPipeline({
      query: 'studies',
      contextSentence: sentence,
      settings: mockSettings,
    });

    expect(res.word.contextSentence).toBe(sentence);
    expect(res.word.examples[0].en).toBe(sentence);
  });
});
