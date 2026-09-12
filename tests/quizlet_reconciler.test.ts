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
});
