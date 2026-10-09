import { describe, expect, it } from 'vitest';
import { getTargetLearningSense } from '../src/utils/learningSense';
import { integrityWord } from './dataIntegrityFixture';

describe('target learning sense', () => {
  it('does not reuse AI or machine output as a mandatory meaning', () => {
    const word = integrityWord('phrase', 'as soon as');
    for (const source of ['ai', 'machine', 'dictionary'] as const) {
      expect(getTargetLearningSense({ ...word, vietnameseDefinitionProvenance: { source } })).toBeUndefined();
      expect(getTargetLearningSense({ ...word, source: 'manual', vietnameseDefinitionProvenance: { source } })).toBeUndefined();
    }
    expect(getTargetLearningSense()).toBeUndefined();
  });

  it('prefers the human edit over the original Quizlet sense', () => {
    const word = { ...integrityWord(), vietnameseDefinition: '  bờ sông  ', rawQuizletDefinition: 'ngân hàng' };
    expect(getTargetLearningSense({ ...word, vietnameseDefinitionProvenance: { source: 'user_edit' } })).toBe('bờ sông');
    expect(getTargetLearningSense({ ...word, isUserEdited: true })).toBe('bờ sông');
    expect(getTargetLearningSense({ ...word, source: 'manual' })).toBe('bờ sông');
  });

  it('uses the original Quizlet meaning rather than an enriched AI paragraph', () => {
    expect(getTargetLearningSense({
      ...integrityWord(), source: 'ai', vietnameseDefinition: 'An old AI explanation',
      rawQuizletDefinition: '  thương lượng  ',
    })).toBe('thương lượng');
  });
});
