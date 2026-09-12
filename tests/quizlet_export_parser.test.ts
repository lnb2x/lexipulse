import { describe, it, expect } from 'vitest';
import { parseQuizletExportText } from '../src/services/quizlet/quizletParser';

describe('Quizlet Export Text Parser & Card Swapping Tests', () => {
  it('1. Parses default Quizlet Tab-separated exported text accurately', () => {
    const rawExport = `
negotiate\tđàm phán hợp đồng
feasible\tkhả thi, có thể thực hiện được
collaborate\thợp tác làm việc
compliance\tsự tuân thủ pháp lý
    `.trim();

    const result = parseQuizletExportText(rawExport);

    expect(result.cards).toHaveLength(4);
    expect(result.cards[0]).toEqual({
      term: 'negotiate',
      definition: 'đàm phán hợp đồng',
    });
    expect(result.cards[1]).toEqual({
      term: 'feasible',
      definition: 'khả thi, có thể thực hiện được',
    });
    expect(result.cards[2]).toEqual({
      term: 'collaborate',
      definition: 'hợp tác làm việc',
    });
    expect(result.cards[3]).toEqual({
      term: 'compliance',
      definition: 'sự tuân thủ pháp lý',
    });
  });

  it('2. Correctly swaps cards when English term is in definition column (Thẻ đảo chiều)', () => {
    // In some Quizlet sets, the creator puts Vietnamese on left and English on right
    const rawExport = `
đàm phán\tnegotiate
khả thi\tfeasible
hợp tác\tcollaborate
    `.trim();

    const result = parseQuizletExportText(rawExport, { swapTermDef: true });

    expect(result.cards).toHaveLength(3);
    // After swapping: English should be term, Vietnamese should be definition
    expect(result.cards[0]).toEqual({
      term: 'negotiate',
      definition: 'đàm phán',
    });
    expect(result.cards[1]).toEqual({
      term: 'feasible',
      definition: 'khả thi',
    });
    expect(result.cards[2]).toEqual({
      term: 'collaborate',
      definition: 'hợp tác',
    });
  });

  it('3. Supports alternative separators (hyphen, colon, comma)', () => {
    const rawExport = `
contingency - kế hoạch dự phòng
implement : triển khai thi hành
"benchmark","tiêu chuẩn đánh giá"
    `.trim();

    const result = parseQuizletExportText(rawExport);

    expect(result.cards).toHaveLength(3);
    expect(result.cards[0]).toEqual({
      term: 'contingency',
      definition: 'kế hoạch dự phòng',
    });
    expect(result.cards[1]).toEqual({
      term: 'implement',
      definition: 'triển khai thi hành',
    });
    expect(result.cards[2]).toEqual({
      term: 'benchmark',
      definition: 'tiêu chuẩn đánh giá',
    });
  });

  it('4. Strips leading numbering and bullet prefixes from cards', () => {
    const rawExport = `
1. negotiate\tđàm phán
2) feasible\tkhả thi
- collaborate\thợp tác
• compliance\tsự tuân thủ
    `.trim();

    const result = parseQuizletExportText(rawExport);

    expect(result.cards).toHaveLength(4);
    expect(result.cards[0].term).toBe('negotiate');
    expect(result.cards[1].term).toBe('feasible');
    expect(result.cards[2].term).toBe('collaborate');
    expect(result.cards[3].term).toBe('compliance');
  });

  it('5. Handles empty input or malformed lines gracefully', () => {
    expect(parseQuizletExportText('').cards).toEqual([]);
    expect(parseQuizletExportText('   \n\n  ').cards).toEqual([]);
  });
});
