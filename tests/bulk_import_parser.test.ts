import { describe, it, expect } from 'vitest';
import { parseBulkImportInput, type ParseImportResult } from '../src/utils/importParser';

describe('Phase 2: Pure Bulk Import Parser', () => {
  it('1. Preserves hyphenated words without incorrectly splitting hyphens', () => {
    const input = `
      cost-effective
      well-known
      state-of-the-art
      up-to-date
    `;

    const result: ParseImportResult = parseBulkImportInput(input);

    expect(result.items.length).toBe(4);
    expect(result.items.map((i) => i.word)).toEqual([
      'cost-effective',
      'well-known',
      'state-of-the-art',
      'up-to-date',
    ]);
    // None should have meaning parsed from their hyphens
    expect(result.items[0].userMeaning).toBeUndefined();
    expect(result.items[1].userMeaning).toBeUndefined();
    expect(result.items[2].userMeaning).toBeUndefined();
    expect(result.items[3].userMeaning).toBeUndefined();
  });

  it('2. Correctly splits "word - meaning" when separated by space-hyphen-space', () => {
    const input = `
      cost-effective - có hiệu quả về mặt chi phí
      well-known : nổi tiếng, được nhiều người biết đến
      up-to-date - cập nhật mới nhất
    `;

    const result = parseBulkImportInput(input);

    expect(result.items.length).toBe(3);
    expect(result.items[0].word).toBe('cost-effective');
    expect(result.items[0].userMeaning).toBe('có hiệu quả về mặt chi phí');

    expect(result.items[1].word).toBe('well-known');
    expect(result.items[1].userMeaning).toBe('nổi tiếng, được nhiều người biết đến');

    expect(result.items[2].word).toBe('up-to-date');
    expect(result.items[2].userMeaning).toBe('cập nhật mới nhất');
  });

  it('3. Supports tab-separated (TSV) and properly quoted CSV lines', () => {
    const input = [
      'take into account\txem xét, lưu ý đến',
      '"bear in mind","ghi nhớ điều gì đó"',
      '"high-yield, fast-paced","lợi suất cao và nhịp độ nhanh"',
    ].join('\n');

    const result = parseBulkImportInput(input);

    expect(result.items.length).toBe(3);
    expect(result.items[0].word).toBe('take into account');
    expect(result.items[0].userMeaning).toBe('xem xét, lưu ý đến');

    expect(result.items[1].word).toBe('bear in mind');
    expect(result.items[1].userMeaning).toBe('ghi nhớ điều gì đó');

    expect(result.items[2].word).toBe('high-yield, fast-paced');
    expect(result.items[2].userMeaning).toBe('lợi suất cao và nhịp độ nhanh');
  });

  it('4. Cleans bullet numbers, symbols and normalizes whitespace & Unicode', () => {
    const input = `
      1.  collaborate
      2)   coordinate
      -  communicate
      •  disseminate
    `;

    const result = parseBulkImportInput(input);

    expect(result.items.length).toBe(4);
    expect(result.items.map((i) => i.word)).toEqual([
      'collaborate',
      'coordinate',
      'communicate',
      'disseminate',
    ]);
  });

  it('5. Deduplicates within batch and against existing deck', () => {
    const existingDeck = new Set(['negotiate', 'feasible']);
    const input = `
      negotiate
      resilience
      resilience
      RESILIENCE
      feasible
      innovate
    `;

    const result = parseBulkImportInput(input, { existingDeckWords: existingDeck });

    expect(result.items.length).toBe(2); // 'resilience' and 'innovate'
    expect(result.items.map((i) => i.word)).toEqual(['resilience', 'innovate']);
    expect(result.duplicatesInBatch).toBe(2);
    expect(result.duplicatesWithDeck).toBe(2);
  });
});
