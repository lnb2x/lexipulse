import { describe, it, expect } from 'vitest';
import {
  reconcileQuizletWithDeck,
  areDefinitionsCompatible,
  normalizeDefinitionText,
} from '../src/services/quizlet/quizletReconciler';
import type { QuizletCardItem, WordItem } from '../src/types/vocab';
import { createInitialReviewMeta } from '../src/services/fsrs/fsrsService';

describe('Quizlet Deck Reconciliation Tests', () => {
  const mockDeck: WordItem[] = [
    {
      id: 'w-1',
      word: 'negotiate',
      pos: ['verb'],
      phonetics: { us: '/nəˈɡoʊ.ʃi.eɪt/' },
      vietnameseDefinition: 'đàm phán hợp đồng',
      englishDefinition: 'To discuss something in order to reach an agreement.',
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: ['#Business'],
      status: 'learning',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      reviewMeta: createInitialReviewMeta(),
    },
    {
      id: 'w-2',
      word: 'bank',
      pos: ['noun'],
      phonetics: { us: '/bæŋk/' },
      vietnameseDefinition: 'ngân hàng tài chính',
      englishDefinition: 'A financial institution.',
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: ['#Finance'],
      status: 'mastered',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      reviewMeta: createInitialReviewMeta(),
    },
    {
      id: 'w-3',
      word: 'run',
      pos: ['verb'],
      phonetics: { us: '/rʌn/' },
      vietnameseDefinition: 'chạy bộ',
      englishDefinition: 'To move fast using feet.',
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: ['#Daily'],
      status: 'learning',
      lemma: 'run',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      reviewMeta: createInitialReviewMeta(),
    },
  ];

  it('1. Correctly classifies New, Existing, and Needs Review (different meaning)', () => {
    const quizletCards: QuizletCardItem[] = [
      // 1. Brand new word
      { term: 'feasible', definition: 'khả thi' },
      // 2. Existing word with essentially compatible definition
      { term: 'negotiate', definition: 'đàm phán' },
      // 3. Same word but noticeably different definition -> Needs Review
      { term: 'bank', definition: 'bờ sông, đê điều' },
    ];

    const { items, summary } = reconcileQuizletWithDeck(quizletCards, mockDeck);

    expect(summary.totalUnique).toBe(3);
    expect(summary.newCount).toBe(1);
    expect(summary.existingCount).toBe(1);
    expect(summary.needsReviewCount).toBe(1);

    const feasible = items.find((i) => i.normalizedTerm === 'feasible');
    expect(feasible?.status).toBe('new');
    expect(feasible?.selected).toBe(true);

    const negotiate = items.find((i) => i.normalizedTerm === 'negotiate');
    expect(negotiate?.status).toBe('existing');

    const bank = items.find((i) => i.normalizedTerm === 'bank');
    expect(bank?.status).toBe('needs_review');
    expect(bank?.existingDefinition).toBe('ngân hàng tài chính');
    expect(bank?.definition).toBe('bờ sông, đê điều');
  });

  it('2. Deduplicates internal duplicate records within the imported batch (Loại bản ghi trùng trong nguồn nhập)', () => {
    const quizletCards: QuizletCardItem[] = [
      { term: 'collaborate', definition: 'hợp tác' },
      { term: 'collaborate', definition: 'hợp tác làm việc' }, // Duplicate term in batch
      { term: '  COLLABORATE  ', definition: 'hợp tác' }, // Duplicate after casing & trim
      { term: 'innovative', definition: 'sáng tạo đột phá' },
    ];

    const { items, summary } = reconcileQuizletWithDeck(quizletCards, mockDeck);

    expect(items).toHaveLength(2); // Only 'collaborate' and 'innovative'
    expect(summary.duplicatesInBatch).toBe(2);
    expect(items[0].normalizedTerm).toBe('collaborate');
    expect(items[1].normalizedTerm).toBe('innovative');
  });

  it('3. Normalizes Unicode NFC, casing, and whitespace for comparison while preserving display string', () => {
    // Unicode decomposed: 'h' + 'o' + acute accent vs composed 'h' + 'ó'
    const decomposedWord = 'Resi\u0301lience'; // R + e + s + i + combining acute + lience
    const composedExisting: WordItem = {
      ...mockDeck[0],
      word: 'resilience',
      vietnameseDefinition: 'khả năng phục hồi',
    };

    const quizletCards: QuizletCardItem[] = [
      { term: '  Resilience  ', definition: 'sức bật phục hồi' },
    ];

    const { items } = reconcileQuizletWithDeck(quizletCards, [composedExisting]);
    expect(items).toHaveLength(1);
    // Preserves original casing for display
    expect(items[0].term).toBe('Resilience');
    // Normalized term used for matching
    expect(items[0].normalizedTerm).toBe('resilience');
  });

  it('4. Does NOT automatically merge different words just because they share a lemma (Không tự động gộp lemma)', () => {
    // Deck has "run", Quizlet has "running". They are different grammatical words and must NOT be merged!
    const quizletCards: QuizletCardItem[] = [
      { term: 'running', definition: 'sự chạy đua, hoạt động chạy' },
    ];

    const { items, summary } = reconcileQuizletWithDeck(quizletCards, mockDeck);

    expect(summary.newCount).toBe(1);
    expect(items[0].status).toBe('new');
    expect(items[0].normalizedTerm).toBe('running');
  });

  it('5. Correctly matches existing words in deck after cleaning parentheses from Quizlet term (founder (n) -> founder)', () => {
    const deckWithFounder: WordItem[] = [
      ...mockDeck,
      {
        id: 'w-founder',
        word: 'founder',
        pos: ['noun'],
        vietnameseDefinition: 'người sáng lập',
        meanings: [],
        collocations: [],
        wordFamily: [],
        examples: [],
        tags: [],
        status: 'learning',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        reviewMeta: createInitialReviewMeta(),
      },
      {
        id: 'w-take-into-account',
        word: 'take into account',
        pos: ['verb'],
        vietnameseDefinition: 'tính đến, xem xét',
        meanings: [],
        collocations: [],
        wordFamily: [],
        examples: [],
        tags: [],
        status: 'learning',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        reviewMeta: createInitialReviewMeta(),
      },
    ];

    const quizletCards: QuizletCardItem[] = [
      // founder (n) -> cleans to "founder" -> matches deck w-founder
      { term: 'founder (n)', definition: 'người sáng lập' },
      // take (something) into account (vp) -> cleans to "take into account" -> matches deck
      { term: 'take (something) into account (vp)', definition: 'tính đến, xem xét' },
    ];

    const { items, summary } = reconcileQuizletWithDeck(quizletCards, deckWithFounder);

    expect(summary.newCount).toBe(0);
    expect(summary.existingCount).toBe(2);

    const founder = items.find((i) => i.normalizedTerm === 'founder');
    expect(founder?.status).toBe('existing');
    expect(founder?.term).toBe('founder');
    expect(founder?.rawTerm).toBe('founder (n)');
    expect(founder?.existingWord?.id).toBe('w-founder');

    const takeIntoAccount = items.find((i) => i.normalizedTerm === 'take into account');
    expect(takeIntoAccount?.status).toBe('existing');
    expect(takeIntoAccount?.term).toBe('take into account');
    expect(takeIntoAccount?.rawTerm).toBe('take (something) into account (vp)');
    expect(takeIntoAccount?.existingWord?.id).toBe('w-take-into-account');
  });

  it('6. Deduplicates batch items that become identical after cleaning parentheses', () => {
    const quizletCards: QuizletCardItem[] = [
      { term: 'international tax preparation', definition: 'chuẩn bị thuế quốc tế' },
      // Same term once (np) is removed!
      { term: 'international tax preparation (np)', definition: 'chuẩn bị thuế quốc tế' },
    ];

    const { items, summary } = reconcileQuizletWithDeck(quizletCards, mockDeck);

    expect(items).toHaveLength(1);
    expect(summary.duplicatesInBatch).toBe(1);
    expect(items[0].term).toBe('international tax preparation');
    expect(items[0].status).toBe('new');
  });

  it('7. Marks term as invalid and not selectable when term becomes empty after cleaning', () => {
    const quizletCards: QuizletCardItem[] = [
      // Only parentheses -> empty term after clean
      { term: '(n)', definition: 'danh từ không có từ vựng' },
      { term: '(something)', definition: 'nghĩa của từ rỗng' },
      // Valid card
      { term: 'founder (n)', definition: 'người sáng lập' },
    ];

    const { items, summary } = reconcileQuizletWithDeck(quizletCards, mockDeck);

    expect(summary.invalidCount).toBe(2);
    expect(summary.newCount).toBe(1);

    const invalidItem1 = items.find((i) => i.rawTerm === '(n)');
    expect(invalidItem1?.status).toBe('invalid');
    expect(invalidItem1?.selected).toBe(false);
    expect(invalidItem1?.invalidReason).toBeDefined();

    const invalidItem2 = items.find((i) => i.rawTerm === '(something)');
    expect(invalidItem2?.status).toBe('invalid');
    expect(invalidItem2?.selected).toBe(false);

    const validItem = items.find((i) => i.term === 'founder');
    expect(validItem?.status).toBe('new');
    expect(validItem?.selected).toBe(true);
  });

  it('splits comma-separated Quizlet alternatives into separate words with their shared definition', () => {
    const { items, summary } = reconcileQuizletWithDeck([
      { term: 'go down, decrease, drop off', rawTerm: 'go down, decrease, drop off (phr.v)', definition: 'giảm xuống' },
    ], []);

    expect(items.map((item) => item.term)).toEqual(['go down', 'decrease', 'drop off']);
    expect(items.map((item) => item.definition)).toEqual(['giảm xuống', 'giảm xuống', 'giảm xuống']);
    expect(items.map((item) => item.rawTerm)).toEqual(Array(3).fill('go down, decrease, drop off (phr.v)'));
    expect(items[2].extractedPos).toEqual(['verb']);
    expect(summary.newCount).toBe(3);
  });

  it('keeps commas inside parentheses together and deduplicates split terms against the deck and batch', () => {
    const { items, summary } = reconcileQuizletWithDeck([
      { term: 'bank (n, v), decrease, , bank', definition: 'giảm' },
      { term: 'decrease', definition: 'giảm' },
    ], mockDeck);

    expect(items.map((item) => item.term)).toEqual(['bank', 'decrease']);
    expect(items[0].status).toBe('needs_review');
    expect(items[0].extractedPos).toEqual(['noun', 'verb']);
    expect(items[1].status).toBe('new');
    expect(summary.duplicatesInBatch).toBe(2);
  });
});
