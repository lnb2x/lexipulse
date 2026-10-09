import { describe, expect, it } from 'vitest';
import { mergePipelineSources } from '../src/services/enrichmentPipeline';
import { analyzeMorphology } from '../src/services/morphology/lemmatizer';
import { integrityWord } from './dataIntegrityFixture';

const query = 'as soon as';
const aiResult = {
  vietnameseDefinition: 'ngay khi; vừa … thì …',
  usageNoteVi: 'Diễn tả việc xảy ra ngay sau một việc khác.',
  examples: [{ en: 'I will call you as soon as I arrive.', vi: 'Tôi sẽ gọi bạn ngay khi tôi đến nơi.', context: 'general' as const }],
  collocations: [], wordFamily: [], tags: [],
};
const dictResult = { ...integrityWord('phrase', query), vietnameseDefinition: 'ngay khi', usageNoteVi: 'Ghi chú cũ từ từ điển.' };

describe('pipeline definition and usage', () => {
  it('keeps the new AI meaning, usage and examples in separate fields', () => {
    const { word } = mergePipelineSources({ query, analysis: analyzeMorphology(query), aiResult, dictResult, prioritizeAI: true });
    expect(word.vietnameseDefinition).toBe(aiResult.vietnameseDefinition);
    expect(word.usageNoteVi).toBe(aiResult.usageNoteVi);
    expect(word.examples[0]).toEqual(aiResult.examples[0]);
  });

  it('associates usage with the preferred dictionary definition', () => {
    const { word } = mergePipelineSources({ query, analysis: analyzeMorphology(query), aiResult, dictResult, prioritizeAI: false });
    expect(word.vietnameseDefinition).toBe(dictResult.vietnameseDefinition);
    expect(word.usageNoteVi).toBe(dictResult.usageNoteVi);
  });

  it('does not attach an old usage note when new AI omits it', () => {
    const { usageNoteVi: _omitted, ...legacyResult } = aiResult;
    const { word } = mergePipelineSources({ query, analysis: analyzeMorphology(query), aiResult: legacyResult, dictResult, prioritizeAI: true });
    expect(word.usageNoteVi).toBeUndefined();
  });
});
