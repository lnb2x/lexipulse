// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../src/services/db';
import { vocabRepository } from '../src/services/vocabRepository';
import type { WordItem } from '../src/types/vocab';
import { createInitialReviewMeta } from '../src/services/sm2';

describe('AI Translation Persistence & Overwrite Protection', () => {
  beforeEach(async () => {
    await db.words.clear();
  });

  it('protects existing AI translation from being overwritten by dictionary source during merge', async () => {
    const savedAiWord: WordItem = {
      id: 'word-ai-1',
      word: 'contract',
      pos: ['noun'],
      vietnameseDefinition: 'Hợp đồng, bản giao kèo có giá trị pháp lý',
      englishDefinition: 'A formal legal agreement between parties',
      meanings: [],
      collocations: [{ phrase: 'sign a contract', meaningVi: 'ký hợp đồng' }],
      wordFamily: [{ word: 'contractual', pos: 'adjective' }],
      examples: [{ en: 'They signed the contract yesterday.', vi: 'Họ đã ký hợp đồng hôm qua.', context: 'general' }],
      tags: ['#Business'],
      status: 'learning',
      createdAt: 1000,
      updatedAt: 1000,
      reviewMeta: {
        ...createInitialReviewMeta(),
        reps: 5,
        stability: 12.5,
        difficulty: 4.2,
      },
      source: 'ai',
      vietnameseDefinitionProvenance: {
        source: 'ai',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        createdAt: 1000,
      },
    };

    await db.words.put(savedAiWord);

    // Simulated incoming dictionary update with shorter/raw definition
    const dictionaryUpdate: Partial<WordItem> = {
      word: 'contract',
      pos: ['noun'],
      vietnameseDefinition: 'hợp đồng',
      englishDefinition: 'an agreement',
      source: 'online',
      vietnameseDefinitionProvenance: {
        source: 'dictionary',
      },
    };

    const { word: merged } = await vocabRepository.saveOrUpdateWord(dictionaryUpdate);

    // AI definition must be protected
    expect(merged.vietnameseDefinition).toBe('Hợp đồng, bản giao kèo có giá trị pháp lý');
    expect(merged.vietnameseDefinitionProvenance?.source).toBe('ai');
    // FSRS metadata must be preserved 100%
    expect(merged.reviewMeta.reps).toBe(5);
    expect(merged.reviewMeta.stability).toBe(12.5);
    expect(merged.id).toBe('word-ai-1');
  });

  it('protects user-edited definitions from being overwritten by any incoming translation', async () => {
    const userEditedWord: WordItem = {
      id: 'word-custom-1',
      word: 'lead',
      pos: ['noun'],
      vietnameseDefinition: 'Đầu mối kinh doanh tiềm năng (Custom edit của tôi)',
      englishDefinition: 'A prospective customer',
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: ['#Sales'],
      status: 'learning',
      createdAt: 2000,
      updatedAt: 2000,
      reviewMeta: createInitialReviewMeta(),
      vietnameseDefinitionProvenance: {
        source: 'user_edit',
        isUserEdited: true,
      },
      isUserEdited: true,
    };

    await db.words.put(userEditedWord);

    const incomingAi: Partial<WordItem> = {
      word: 'lead',
      vietnameseDefinition: 'dẫn đầu, chì',
      source: 'ai',
      vietnameseDefinitionProvenance: {
        source: 'ai',
      },
    };

    const { word: result } = await vocabRepository.saveOrUpdateWord(incomingAi);
    expect(result.vietnameseDefinition).toBe('Đầu mối kinh doanh tiềm năng (Custom edit của tôi)');
    expect(result.vietnameseDefinitionProvenance?.isUserEdited).toBe(true);
  });

  it('allows upgrading dictionary word to AI translation when explicitly requested', async () => {
    const dictWord: WordItem = {
      id: 'word-dict-1',
      word: 'execute',
      pos: ['verb'],
      vietnameseDefinition: 'thi hành',
      englishDefinition: 'carry out',
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: ['#General'],
      status: 'new',
      createdAt: 3000,
      updatedAt: 3000,
      reviewMeta: createInitialReviewMeta(),
      source: 'online',
      vietnameseDefinitionProvenance: {
        source: 'dictionary',
      },
    };

    await db.words.put(dictWord);

    // Valid AI translation arrives
    const aiTranslation: Partial<WordItem> = {
      word: 'execute',
      vietnameseDefinition: 'Thực hiện, chấp hành, ký kết hợp đồng',
      englishDefinition: 'To put into effect or carry out completely',
      source: 'ai',
      vietnameseDefinitionProvenance: {
        source: 'ai',
        provider: 'gemini',
      },
    };

    const { word: upgraded } = await vocabRepository.saveOrUpdateWord(aiTranslation);
    expect(upgraded.vietnameseDefinition).toBe('Thực hiện, chấp hành, ký kết hợp đồng');
    expect(upgraded.vietnameseDefinitionProvenance?.source).toBe('ai');
    expect(upgraded.id).toBe('word-dict-1');
  });

  it('filters out self-referencing word families and placeholder definitions during merge', async () => {
    const messyWord: Partial<WordItem> = {
      word: 'sign the contract',
      pos: ['verb'],
      vietnameseDefinition: 'ký hợp đồng',
      englishDefinition: 'Definition for "sign the contract"',
      wordFamily: [
        { word: 'sign the contract', pos: 'verb' },
        { word: 'signature', pos: 'noun' },
      ],
      tags: [],
    };

    const { word: saved } = await vocabRepository.saveOrUpdateWord(messyWord);
    expect(saved.englishDefinition).toBe('');
    expect(saved.wordFamily).toHaveLength(1);
    expect(saved.wordFamily[0].word).toBe('signature');
  });
});
