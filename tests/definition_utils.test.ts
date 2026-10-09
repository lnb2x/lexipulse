import { describe, expect, it } from 'vitest';
import { normalizeVietnameseDefinition } from '../src/utils/definitionUtils';
import { getLearnMeaning, createLearnState, getLearnQuestion } from '../src/services/adaptiveLearning';
import { integrityWord } from './dataIntegrityFixture';
import { concisePromiseMeaning, normalizedPromiseDefinition, verbosePromiseDefinition } from './definitionClarityFixture';

describe('concise Vietnamese definitions', () => {
  it('removes the examples in the reported promise definition without losing its three senses', () => {
    expect(normalizeVietnameseDefinition(verbosePromiseDefinition)).toBe(normalizedPromiseDefinition);
    const word = { ...integrityWord('promise', 'promise'), vietnameseDefinition: verbosePromiseDefinition };
    expect(getLearnMeaning(word)).toBe(concisePromiseMeaning);
    expect(word.vietnameseDefinition).toBe(verbosePromiseDefinition);
  });

  it.each([
    ['lời hứa (ví dụ: "Anh ấy (trưởng nhóm) đã hứa"); hứa', 'lời hứa; hứa'],
    ['bờ (sông); ngân hàng', 'bờ (sông); ngân hàng'],
    ['1. ngân hàng (tài chính); 2. bờ sông (địa lý)', '1. ngân hàng (tài chính); 2. bờ sông (địa lý)'],
    ['(động từ) hứa. Ví dụ: Cô ấy hứa sẽ đến.', 'hứa'],
    ['1. hứa. Ví dụ: Cô ấy hứa. 2. tiềm năng (Example: It shows promise.)', '1. hứa; 2. tiềm năng'],
    ['ngay khi; vừa … thì …', 'ngay khi; vừa … thì …'],
    ['(n) lời hứa; (v) hứa (VD: Tôi đã hứa.)', 'lời hứa; hứa'],
    ['- ngân hàng (ví dụ “Ngân hàng đã đóng cửa.”)\n- bờ sông', 'ngân hàng; bờ sông'],
    ['nghĩa (chưa đóng ngoặc', 'nghĩa (chưa đóng ngoặc'],
    ['', ''],
  ])('normalizes %s while preserving useful qualifiers', (raw, expected) => {
    expect(normalizeVietnameseDefinition(raw)).toBe(expected);
    expect(normalizeVietnameseDefinition(expected)).toBe(expected);
  });

  it('uses the same compact meanings to avoid choices differing only by example text', () => {
    const first = { ...integrityWord('first', 'promise'), vietnameseDefinition: 'lời hứa (ví dụ: Anh ấy đã hứa.)' };
    const second = { ...integrityWord('second', 'pledge'), vietnameseDefinition: 'lời hứa' };
    expect(getLearnQuestion(createLearnState([first, second]))?.type).toBe('write');
  });

  it('falls back when a legacy definition contains only an example', () => {
    const word = { ...integrityWord(), vietnameseDefinition: '(ví dụ: Anh ấy hứa.)', englishDefinition: 'a commitment' };
    expect(getLearnMeaning(word)).toBe('a commitment');
  });
});
