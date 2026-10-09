// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../src/services/db';
import { vocabRepository } from '../src/services/vocabRepository';
import type { WordItem } from '../src/types/vocab';
import { createInitialReviewMeta } from '../src/services/sm2';
import { exportFullBackupToJson } from '../src/services/db/backup';

function usageWord(overrides: Partial<WordItem> = {}): WordItem {
  return {
    id: 'word-as-soon-as', word: 'as soon as', pos: ['conjunction'],
    vietnameseDefinition: 'ngay khi; vừa… thì…', usageNoteVi: 'Nối hai mệnh đề, diễn tả việc thứ hai xảy ra ngay sau việc thứ nhất.',
    englishDefinition: 'immediately after something happens', phonetics: {},
    meanings: [], collocations: [], wordFamily: [], examples: [], tags: ['#TOEIC'],
    notes: 'Ghi chú cá nhân', status: 'learning', createdAt: 1000, updatedAt: 2000,
    reviewMeta: { ...createInitialReviewMeta(), repetition: 5, history: [{ date: 1500, rating: 3, interval: 2, easeFactor: 2.5, repetition: 1 }] },
    source: 'ai', vietnameseDefinitionProvenance: { source: 'ai', provider: 'groq' },
    ...overrides,
  };
}

describe('AI Translation Persistence & Overwrite Protection', () => {
  beforeEach(async () => {
    await db.words.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the usage note with a protected AI meaning during dictionary enrichment', async () => {
    const original = usageWord();
    await db.words.put(original);
    const { word: merged } = await vocabRepository.saveOrUpdateWord({
      word: original.word, vietnameseDefinition: 'khi', usageNoteVi: 'Ghi chú cho nghĩa khác',
      vietnameseDefinitionProvenance: { source: 'dictionary' },
    });
    expect(merged.vietnameseDefinition).toBe(original.vietnameseDefinition);
    expect(merged.usageNoteVi).toBe(original.usageNoteVi);
    expect(merged.reviewMeta).toEqual(original.reviewMeta);
    expect(merged.notes).toBe(original.notes);
  });

  it('replaces the usage note with a new AI meaning and clears it when an AI refresh explicitly has no usage', async () => {
    const original = usageWord();
    await db.words.put(original);
    const { word: refreshed } = await vocabRepository.saveOrUpdateWord({
      word: original.word, vietnameseDefinition: 'ngay sau khi', usageNoteVi: '  Dùng để nói hai việc xảy ra liên tiếp.  ',
      vietnameseDefinitionProvenance: { source: 'ai' },
    });
    expect(refreshed.usageNoteVi).toBe('Dùng để nói hai việc xảy ra liên tiếp.');
    expect(refreshed.reviewMeta).toEqual(original.reviewMeta);
    const { word: withoutUsage } = await vocabRepository.saveOrUpdateWord({
      word: original.word, vietnameseDefinition: refreshed.vietnameseDefinition,
      usageNoteVi: undefined,
      vietnameseDefinitionProvenance: { source: 'ai' },
    });
    expect(withoutUsage.usageNoteVi).toBeUndefined();
  });

  it('preserves the usage note during a partial AI update that repeats the existing meaning', async () => {
    const original = usageWord();
    await db.words.put(original);
    const { word: enriched } = await vocabRepository.saveOrUpdateWord({
      word: original.word, vietnameseDefinition: original.vietnameseDefinition,
      vietnameseDefinitionProvenance: original.vietnameseDefinitionProvenance,
      examples: [{ en: 'I will call as soon as I arrive.', vi: 'Tôi sẽ gọi ngay khi tôi đến.', context: 'general' }],
    });
    expect(enriched.vietnameseDefinition).toBe(original.vietnameseDefinition);
    expect(enriched.usageNoteVi).toBe(original.usageNoteVi);
    expect(enriched.examples[0].vi).toBe('Tôi sẽ gọi ngay khi tôi đến.');
    expect(enriched.reviewMeta).toEqual(original.reviewMeta);
  });

  it('preserves usage for a protected user meaning and clears it when the user changes that meaning', async () => {
    const original = usageWord({ isUserEdited: true, vietnameseDefinitionProvenance: { source: 'user_edit', isUserEdited: true } });
    await db.words.put(original);
    const { word: protectedWord } = await vocabRepository.saveOrUpdateWord({
      word: original.word, vietnameseDefinition: 'khi', usageNoteVi: 'Ghi chú AI',
      vietnameseDefinitionProvenance: { source: 'ai' },
    });
    expect(protectedWord.usageNoteVi).toBe(original.usageNoteVi);
    const { word: edited } = await vocabRepository.saveOrUpdateWord({
      word: original.word, vietnameseDefinition: 'ngay lập tức sau khi',
      vietnameseDefinitionProvenance: { source: 'user_edit', isUserEdited: true },
    });
    expect(edited.usageNoteVi).toBeUndefined();
    expect(edited.notes).toBe(original.notes);
  });

  it('round-trips the optional usage note and review progress through a full backup', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const original = usageWord();
    await vocabRepository.saveOrUpdateWord(original);
    const backup = await exportFullBackupToJson();
    await db.words.clear();
    const restored = await vocabRepository.importDeckFromJson(backup);
    expect(restored.errors).toEqual([]);
    const saved = await db.words.get(original.id);
    expect(saved?.usageNoteVi).toBe(original.usageNoteVi);
    expect(saved?.reviewMeta).toEqual(original.reviewMeta);
    expect(saved?.notes).toBe(original.notes);
  });

  it('accepts old backup cards without usage and rejects a malformed usage note', async () => {
    const legacy = usageWord({ usageNoteVi: undefined });
    const valid = await vocabRepository.importDeckFromJson(JSON.stringify([legacy]));
    expect(valid.errors).toEqual([]);
    expect((await db.words.get(legacy.id))?.usageNoteVi).toBeUndefined();
    const invalid = await vocabRepository.importDeckFromJson(JSON.stringify([{ ...legacy, usageNoteVi: 42 }]));
    expect(invalid.skipped).toBe(1);
    expect(invalid.errors[0]).toContain('usageNoteVi');
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
