import { describe, it, expect } from 'vitest';
import { validateAndNormalizeAIResponse } from '../src/services/ai';

describe('AI Runtime Schema Validation & Normalization', () => {
  it('correctly validates and normalizes a well-formed AI response', () => {
    const raw = {
      ipaUs: '/ˈkɒn.trækt/',
      ipaUk: '/ˈkɒn.trækt/',
      vietnameseDefinition: 'Hợp đồng, thỏa thuận pháp lý',
      usageNoteVi: '  Thường dùng với động từ sign hoặc renew.  ',
      collocations: [
        { phrase: 'sign a contract', meaningVi: 'ký hợp đồng' },
        { phrase: 'breach of contract', meaningVi: 'vi phạm hợp đồng' },
      ],
      wordFamily: [
        { word: 'contractor', pos: 'noun', meaningVi: 'nhà thầu' },
        { word: 'contractual', pos: 'adjective', meaningVi: 'theo hợp đồng' },
      ],
      examples: [
        { en: 'They signed the contract yesterday.', vi: 'Họ đã ký hợp đồng hôm qua.', context: 'general' },
        { en: 'The vendor fulfilled all terms in the contract.', vi: 'Nhà cung cấp hoàn thành mọi điều khoản trong hợp đồng.', context: 'toeic' },
      ],
      tags: ['TOEIC', '#Business'],
    };

    const result = validateAndNormalizeAIResponse(raw);
    expect(result).not.toBeNull();
    expect(result?.vietnameseDefinition).toBe('Hợp đồng, thỏa thuận pháp lý');
    expect(result?.usageNoteVi).toBe('Thường dùng với động từ sign hoặc renew.');
    expect(result?.ipaUs).toBe('/ˈkɒn.trækt/');
    expect(result?.collocations).toHaveLength(2);
    expect(result?.wordFamily).toHaveLength(2);
    expect(result?.examples).toHaveLength(2);
    expect(result?.tags).toEqual(['#TOEIC', '#Business']);
  });

  it('rejects null, primitive, or objects missing vietnameseDefinition', () => {
    expect(validateAndNormalizeAIResponse(null)).toBeNull();
    expect(validateAndNormalizeAIResponse('invalid json string')).toBeNull();
    expect(validateAndNormalizeAIResponse(42)).toBeNull();
    expect(validateAndNormalizeAIResponse({})).toBeNull();
    expect(validateAndNormalizeAIResponse({ vietnameseDefinition: '' })).toBeNull();
    expect(validateAndNormalizeAIResponse({ vietnameseDefinition: 12345 })).toBeNull();
  });

  it('filters out malformed items in arrays without crashing', () => {
    const raw = {
      vietnameseDefinition: 'Thương lượng',
      collocations: [
        null,
        'invalid collocation string',
        { phrase: 'negotiate terms', meaningVi: 'thương lượng các điều khoản' },
        { phrase: 'incomplete', meaningVi: null },
      ],
      wordFamily: [
        { word: 'negotiation', pos: 'noun' },
        { word: '', pos: 'verb' },
        { invalid: true },
      ],
      examples: [
        { en: 'Valid sentence.', vi: 'Câu hợp lệ.', context: 'toeic' },
        { en: 'Missing vi.' },
        { vi: 'Thiếu en.' },
      ],
      tags: ['   ', 123, 'Procurement'],
    };

    const result = validateAndNormalizeAIResponse(raw);
    expect(result).not.toBeNull();
    expect(result?.collocations).toHaveLength(1);
    expect(result?.collocations[0].phrase).toBe('negotiate terms');
    expect(result?.wordFamily).toHaveLength(1);
    expect(result?.wordFamily[0].word).toBe('negotiation');
    expect(result?.examples).toHaveLength(1);
    expect(result?.examples[0].context).toBe('toeic');
    expect(result?.tags).toEqual(['#Procurement']);
  });

  it.each([undefined, null, 42, {}, [], '', '   '])('ignores an absent or malformed optional usage note: %j', (usageNoteVi) => {
    const result = validateAndNormalizeAIResponse({ vietnameseDefinition: 'ngay khi', usageNoteVi });
    expect(result?.vietnameseDefinition).toBe('ngay khi');
    expect(result?.usageNoteVi).toBeUndefined();
  });

  it('preserves legitimate definitions without truncating or guessing their meaning', () => {
    const vietnameseDefinition = '1. cây; thực vật; 2. nhà máy, cơ sở sản xuất; 3. trồng, gieo; 4. đặt hoặc cài vào một vị trí';
    const result = validateAndNormalizeAIResponse({ vietnameseDefinition });
    expect(result?.vietnameseDefinition).toBe(vietnameseDefinition);
  });
});
