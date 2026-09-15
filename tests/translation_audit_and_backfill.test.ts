import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/services/db';
import type { WordItem } from '../src/types/vocab';
import {
  auditWordTranslation,
  isMissingOrUntranslated,
  isWordTranslationComplete,
} from '../src/utils/translationAuditor';
import { mergeWordRecords } from '../src/services/vocabRepository';
import {
  auditDeckTranslations,
  backfillMissingTranslations,
  enrichSingleWordMissingTranslations,
  createTranslationBackupSnapshot,
  restoreFromBackup,
} from '../src/services/missingTranslationEnricher';
import { saveAppSettings } from '../src/services/db/statsRepo';

describe('Translation Audit, Merging, and Backfilling Regression Suite', () => {
  beforeEach(async () => {
    await db.words.clear();
    await db.settingsTable.clear();
    vi.restoreAllMocks();

    // Default settings without AI by default
    await saveAppSettings({
      aiProvider: 'gemini',
      aiApiKey: '',
      speechRate: 1,
      speechPitch: 1,
      preferredAccent: 'US',
      dailyQuota: 20,
      theme: 'system',
      geminiApiKey: '',
    });
  });

  it('1. Thiếu nghĩa chính: phát hiện rỗng/placeholder và bổ sung nghĩa chính xác, chuyển trạng thái completed', () => {
    const wordWithEmptyMain: WordItem = {
      id: 'test-w1',
      word: 'negotiate',
      pos: ['verb'],
      phonetics: { us: '/nɪˈɡoʊʃieɪt/' },
      vietnameseDefinition: '', // empty
      englishDefinition: 'To discuss something to reach an agreement.',
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: ['#TOEIC'],
      status: 'new',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      reviewMeta: {
        repetition: 0,
        interval: 0,
        easeFactor: 2.5,
        dueDate: 1700000000000,
        lastReviewedDate: null,
        history: [],
      },
    };

    const audit1 = auditWordTranslation(wordWithEmptyMain);
    expect(audit1.isComplete).toBe(false);
    expect(audit1.missingFields).toContain('vietnameseDefinition');
    expect(audit1.details.mainDefMissing).toBe(true);

    // Test with placeholder
    const wordWithPlaceholder: WordItem = {
      ...wordWithEmptyMain,
      vietnameseDefinition: '[chưa có định nghĩa]',
    };
    const audit2 = auditWordTranslation(wordWithPlaceholder);
    expect(audit2.isComplete).toBe(false);
    expect(audit2.details.mainDefMissing).toBe(true);

    // Test with duplicated source word
    const wordWithDuplicatedSource: WordItem = {
      ...wordWithEmptyMain,
      vietnameseDefinition: 'negotiate',
    };
    const audit3 = auditWordTranslation(wordWithDuplicatedSource);
    expect(audit3.isComplete).toBe(false);
    expect(audit3.details.mainDefMissing).toBe(true);

    // Merging valid incoming definition resolves completion
    const merged = mergeWordRecords(wordWithEmptyMain, {
      vietnameseDefinition: 'Đàm phán, thương lượng',
    });
    expect(merged.vietnameseDefinition).toBe('Đàm phán, thương lượng');
    expect(isWordTranslationComplete(merged)).toBe(true);
    expect(merged.enrichmentStatus).toBe('completed');
  });

  it('2. Thiếu bản dịch mục con: phát hiện và bổ sung chính xác meanings, collocations, wordFamily, examples', async () => {
    const wordWithSubIssues: WordItem = {
      id: 'test-w2',
      word: 'funding',
      pos: ['noun'],
      phonetics: { us: '/ˈfʌndɪŋ/' },
      vietnameseDefinition: 'Tiền tài trợ, quỹ',
      englishDefinition: 'Money provided for a specific purpose.',
      meanings: [
        {
          pos: 'noun',
          englishDefinition: 'Money provided as funds.',
          vietnameseDefinition: '', // missing
        },
        {
          pos: 'verb',
          englishDefinition: 'The action of the verb fund.',
          vietnameseDefinition: '   ', // whitespace
        },
      ],
      collocations: [
        {
          phrase: 'government funding',
          meaningVi: 'cụm từ thông dụng', // placeholder
        },
        {
          phrase: 'secure funding',
          meaningVi: 'thu hút tài trợ', // valid
        },
      ],
      wordFamily: [
        {
          word: 'fund',
          pos: 'verb',
          meaningVi: undefined, // missing
        },
        {
          word: 'funder',
          pos: 'noun',
          meaningVi: 'nhà tài trợ', // valid
        },
      ],
      examples: [
        {
          en: 'The project received government funding.',
          vi: '', // missing
          context: 'workplace',
        },
      ],
      tags: ['#TOEIC'],
      status: 'learning',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      reviewMeta: {
        repetition: 2,
        interval: 3,
        easeFactor: 2.5,
        dueDate: 1700000500000,
        lastReviewedDate: 1700000000000,
        history: [],
      },
    };

    const audit = auditWordTranslation(wordWithSubIssues);
    expect(audit.isComplete).toBe(false);
    expect(audit.details.mainDefMissing).toBe(false);
    expect(audit.details.missingMeaningIndices).toEqual([0, 1]);
    expect(audit.details.missingCollocationIndices).toEqual([0]);
    expect(audit.details.missingWordFamilyIndices).toEqual([0]);
    expect(audit.details.missingExampleIndices).toEqual([0]);
    expect(audit.totalMissingItems).toBe(5);

    // Merge partial new translations without cloning same string into different meanings
    const merged = mergeWordRecords(wordWithSubIssues, {
      meanings: [
        {
          pos: 'noun',
          englishDefinition: 'Money provided as funds.',
          vietnameseDefinition: 'Khoản tiền được tài trợ',
        },
        {
          pos: 'verb',
          englishDefinition: 'The action of the verb fund.',
          vietnameseDefinition: 'Hành động cung cấp quỹ',
        },
      ],
      collocations: [
        {
          phrase: 'government funding',
          meaningVi: 'nguồn tài trợ từ chính phủ',
        },
      ],
      wordFamily: [
        {
          word: 'fund',
          pos: 'verb',
          meaningVi: 'tài trợ, cấp kinh phí',
        },
      ],
      examples: [
        {
          en: 'The project received government funding.',
          vi: 'Dự án đã nhận được kinh phí từ chính phủ.',
          context: 'workplace',
        },
      ],
    });

    // Verification: sub-senses must remain distinct and accurately enriched
    expect(merged.meanings[0].vietnameseDefinition).toBe('Khoản tiền được tài trợ');
    expect(merged.meanings[1].vietnameseDefinition).toBe('Hành động cung cấp quỹ');
    expect(merged.meanings[0].vietnameseDefinition).not.toBe(merged.meanings[1].vietnameseDefinition);

    expect(merged.collocations.find((c) => c.phrase === 'government funding')?.meaningVi).toBe(
      'nguồn tài trợ từ chính phủ'
    );
    expect(merged.collocations.find((c) => c.phrase === 'secure funding')?.meaningVi).toBe(
      'thu hút tài trợ'
    );

    expect(merged.wordFamily.find((wf) => wf.word === 'fund')?.meaningVi).toBe('tài trợ, cấp kinh phí');
    expect(merged.wordFamily.find((wf) => wf.word === 'funder')?.meaningVi).toBe('nhà tài trợ');

    expect(merged.examples[0].vi).toBe('Dự án đã nhận được kinh phí từ chính phủ.');
    expect(isWordTranslationComplete(merged)).toBe(true);
    expect(merged.enrichmentStatus).toBe('completed');
  });

  it('3. Mục trùng được bổ sung nghĩa: gộp collocations, wordFamily, examples không làm mất bản dịch mới', () => {
    const existing: WordItem = {
      id: 'test-dup-1',
      word: 'contract',
      pos: ['noun'],
      phonetics: {},
      vietnameseDefinition: 'Hợp đồng',
      englishDefinition: 'A binding agreement.',
      meanings: [
        {
          pos: 'noun',
          englishDefinition: 'A binding agreement.',
          vietnameseDefinition: '', // empty
        },
      ],
      collocations: [
        { phrase: 'sign a contract', meaningVi: '' }, // duplicate phrase missing meaning
        { phrase: 'breach a contract', meaningVi: 'vi phạm hợp đồng' },
      ],
      wordFamily: [
        { word: 'contractor', pos: 'noun', meaningVi: '' }, // duplicate missing meaning
        { word: 'contractual', pos: 'adjective', meaningVi: 'theo hợp đồng' },
      ],
      examples: [
        { en: 'They signed the contract.', vi: '' }, // duplicate missing vi
      ],
      tags: ['#Business'],
      status: 'learning',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      reviewMeta: {
        repetition: 1,
        interval: 1,
        easeFactor: 2.5,
        dueDate: 1700000000000,
        lastReviewedDate: 1700000000000,
        history: [],
      },
    };

    const incoming: Partial<WordItem> = {
      meanings: [
        {
          pos: 'noun',
          englishDefinition: 'A binding agreement.',
          vietnameseDefinition: 'Thỏa thuận mang tính ràng buộc pháp lý',
        },
      ],
      collocations: [
        { phrase: 'sign a contract', meaningVi: 'ký kết một hợp đồng' }, // new translation for duplicate phrase!
        { phrase: 'terminate a contract', meaningVi: 'chấm dứt hợp đồng' }, // new collocation
      ],
      wordFamily: [
        { word: 'contractor', pos: 'noun', meaningVi: 'nhà thầu' }, // new translation for duplicate word!
      ],
      examples: [
        { en: 'They signed the contract.', vi: 'Họ đã ký kết hợp đồng.' }, // new translation for duplicate example!
      ],
    };

    const merged = mergeWordRecords(existing, incoming);

    // Verify duplicate collocation was ENRICHED with new translation instead of being dropped!
    const signColloc = merged.collocations.find((c) => c.phrase === 'sign a contract');
    expect(signColloc).toBeDefined();
    expect(signColloc?.meaningVi).toBe('ký kết một hợp đồng');

    // Verify existing valid collocation was preserved
    const breachColloc = merged.collocations.find((c) => c.phrase === 'breach a contract');
    expect(breachColloc?.meaningVi).toBe('vi phạm hợp đồng');

    // Verify newly introduced collocation was appended
    const termColloc = merged.collocations.find((c) => c.phrase === 'terminate a contract');
    expect(termColloc?.meaningVi).toBe('chấm dứt hợp đồng');

    // Verify word family duplicate was ENRICHED
    const contractor = merged.wordFamily.find((wf) => wf.word === 'contractor');
    expect(contractor?.meaningVi).toBe('nhà thầu');
    const contractual = merged.wordFamily.find((wf) => wf.word === 'contractual');
    expect(contractual?.meaningVi).toBe('theo hợp đồng');

    // Verify example duplicate was ENRICHED
    expect(merged.examples[0].vi).toBe('Họ đã ký kết hợp đồng.');

    // Verify meaning duplicate was ENRICHED
    expect(merged.meanings[0].vietnameseDefinition).toBe('Thỏa thuận mang tính ràng buộc pháp lý');
    expect(isWordTranslationComplete(merged)).toBe(true);
  });

  it('4. Bảo vệ sửa tay (isUserEdited) và FSRS: giữ nguyên 100% dữ liệu FSRS, notes, tags và chỉnh sửa thủ công', async () => {
    const userProtectedWord: WordItem = {
      id: 'protected-fsrs-word',
      word: 'accommodate',
      pos: ['verb'],
      phonetics: { us: '/əˈkɑːmədeɪt/' },
      vietnameseDefinition: 'Chứa được, cung cấp chỗ ở (Người dùng tự dịch theo ngữ cảnh TOEIC)',
      englishDefinition: 'To provide lodging or sufficient space for.',
      isUserEdited: true,
      vietnameseDefinitionProvenance: {
        source: 'user_edit',
        isUserEdited: true,
        createdAt: 1700000000000,
      },
      meanings: [
        {
          pos: 'verb',
          englishDefinition: 'To provide space for.',
          vietnameseDefinition: '', // missing sense
        },
      ],
      collocations: [
        { phrase: 'accommodate guests', meaningVi: '' }, // missing
      ],
      wordFamily: [],
      examples: [],
      tags: ['#MySpecialTag', '#VIP'],
      notes: 'Mẹo nhớ: có 2 chữ c và 2 chữ m',
      status: 'review_needed',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      reviewMeta: {
        repetition: 5,
        interval: 42,
        easeFactor: 2.75,
        dueDate: 1799999999999,
        lastReviewedDate: 1700050000000,
        history: [
          { date: 1700000000000, rating: 3, interval: 1, easeFactor: 2.5, repetition: 1 },
          { date: 1700010000000, rating: 3, interval: 6, easeFactor: 2.6, repetition: 2 },
          { date: 1700020000000, rating: 4, interval: 15, easeFactor: 2.75, repetition: 3 },
        ],
        fsrs: {
          due: 1799999999999,
          stability: 42.5,
          difficulty: 2.8,
          elapsed_days: 10,
          scheduled_days: 42,
          reps: 5,
          lapses: 0,
          state: 2,
          last_review: 1700050000000,
        },
        schedulerVersion: 'fsrs-v5',
      },
    };

    await db.words.put(userProtectedWord);

    // Merge incoming that tries to overwrite main definition with AI
    const incomingAi: Partial<WordItem> = {
      vietnameseDefinition: 'Thích nghi, dung nạp (AI generic overwrite)',
      vietnameseDefinitionProvenance: { source: 'ai', createdAt: Date.now() },
      collocations: [{ phrase: 'accommodate guests', meaningVi: 'đón tiếp khách' }],
      meanings: [{ pos: 'verb', englishDefinition: 'To provide space for.', vietnameseDefinition: 'Cung cấp không gian cho' }],
    };

    const merged = mergeWordRecords(userProtectedWord, incomingAi);

    // Verify main definition was PROTECTED from overwrite!
    expect(merged.vietnameseDefinition).toBe(
      'Chứa được, cung cấp chỗ ở (Người dùng tự dịch theo ngữ cảnh TOEIC)'
    );
    expect(merged.isUserEdited).toBe(true);

    // Verify missing collocation and meaning were safely enriched!
    expect(merged.collocations[0].meaningVi).toBe('đón tiếp khách');
    expect(merged.meanings[0].vietnameseDefinition).toBe('Cung cấp không gian cho');

    // Verify 100% of FSRS and user data was preserved
    expect(merged.id).toBe('protected-fsrs-word');
    expect(merged.createdAt).toBe(1700000000000);
    expect(merged.tags).toContain('#MySpecialTag');
    expect(merged.tags).toContain('#VIP');
    expect(merged.notes).toBe('Mẹo nhớ: có 2 chữ c và 2 chữ m');
    expect(merged.status).toBe('review_needed');
    expect(merged.reviewMeta.interval).toBe(42);
    expect(merged.reviewMeta.dueDate).toBe(1799999999999);
    expect(merged.reviewMeta.history.length).toBe(3);
    expect(merged.reviewMeta.fsrs?.stability).toBe(42.5);
    expect(merged.reviewMeta.fsrs?.difficulty).toBe(2.8);
    expect(merged.reviewMeta.fsrs?.reps).toBe(5);
  });

  it('5. API lỗi / Chưa cấu hình: giữ nguyên dữ liệu cũ, không báo thành công giả', async () => {
    const wordNeedingEnrich: WordItem = {
      id: 'test-api-fail',
      word: 'unoccupied',
      pos: ['adjective'],
      phonetics: {},
      vietnameseDefinition: 'Còn trống',
      englishDefinition: 'Not occupied.',
      meanings: [],
      collocations: [{ phrase: 'unoccupied seat', meaningVi: '' }],
      wordFamily: [],
      examples: [],
      tags: ['#TOEIC'],
      status: 'new',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reviewMeta: { repetition: 0, interval: 0, easeFactor: 2.5, dueDate: Date.now(), lastReviewedDate: null, history: [] },
    };
    await db.words.put(wordNeedingEnrich);

    // Mock fetch to simulate network error / 500 API failure
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.reject(new Error('Network offline or API 500 error'))
    );

    const settings = {
      aiProvider: 'gemini' as const,
      aiApiKey: 'AIzaSyFakeKey12345',
      geminiApiKey: 'AIzaSyFakeKey12345',
      speechRate: 1,
      speechPitch: 1,
      preferredAccent: 'US' as const,
      dailyQuota: 20,
      theme: 'system' as const,
    };

    const res = await enrichSingleWordMissingTranslations(wordNeedingEnrich, settings);

    // Verify it reports failure honestly and does NOT report false success!
    expect(res.success).toBe(false);
    expect(res.updated).toBe(false);

    // Verify DB still contains authentic original data untouched
    const freshFromDb = await db.words.get('test-api-fail');
    expect(freshFromDb?.vietnameseDefinition).toBe('Còn trống');
    expect(freshFromDb?.collocations[0].meaningVi).toBe('');

    fetchSpy.mockRestore();
  });

  it('6. Chạy lại nhiều lần (Idempotency): không tạo từ trùng lặp hay mục con trùng lặp', async () => {
    const sampleWord: WordItem = {
      id: 'idempotent-word-1',
      word: 'allocate',
      pos: ['verb'],
      phonetics: {},
      vietnameseDefinition: 'Phân bổ',
      englishDefinition: 'To distribute resources.',
      meanings: [{ pos: 'verb', englishDefinition: 'To distribute resources.', vietnameseDefinition: '' }],
      collocations: [{ phrase: 'allocate funds', meaningVi: '' }],
      wordFamily: [{ word: 'allocation', pos: 'noun', meaningVi: '' }],
      examples: [{ en: 'We allocated the budget.', vi: '', context: 'workplace' }],
      tags: ['#Finance'],
      status: 'new',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      reviewMeta: { repetition: 0, interval: 0, easeFactor: 2.5, dueDate: 1700000000000, lastReviewedDate: null, history: [] },
    };
    await db.words.put(sampleWord);

    // Mock AI response for allocate
    const mockAiResponse = {
      meanings: [{ idx: 0, vietnameseDefinition: 'Phân chia phân bổ nguồn lực' }],
      collocations: [{ idx: 0, meaningVi: 'phân bổ ngân sách, kinh phí' }],
      wordFamily: [{ idx: 0, meaningVi: 'sự phân bổ' }],
      examples: [{ idx: 0, vi: 'Chúng tôi đã phân bổ ngân sách.' }],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockAiResponse) }] } }],
        }),
      } as any)
    );

    const settings = {
      aiProvider: 'gemini' as const,
      aiApiKey: 'AIzaSyFakeKey12345',
      geminiApiKey: 'AIzaSyFakeKey12345',
      speechRate: 1,
      speechPitch: 1,
      preferredAccent: 'US' as const,
      dailyQuota: 20,
      theme: 'system' as const,
    };

    // Run backfill pass 1
    const run1 = await enrichSingleWordMissingTranslations(sampleWord, settings);
    expect(run1.success).toBe(true);
    expect(run1.updated).toBe(true);

    const afterPass1 = await db.words.get('idempotent-word-1');
    expect(afterPass1?.collocations.length).toBe(1);
    expect(afterPass1?.wordFamily.length).toBe(1);
    expect(afterPass1?.examples.length).toBe(1);
    expect(afterPass1?.meanings.length).toBe(1);
    expect(isWordTranslationComplete(afterPass1!)).toBe(true);

    // Run backfill pass 2 (immediate re-run)
    const run2 = await enrichSingleWordMissingTranslations(afterPass1!, settings);
    expect(run2.success).toBe(true);
    expect(run2.updated).toBe(false); // Already complete, skipped!

    const afterPass2 = await db.words.get('idempotent-word-1');
    // Ensure no duplication occurred in arrays!
    expect(afterPass2?.collocations.length).toBe(1);
    expect(afterPass2?.wordFamily.length).toBe(1);
    expect(afterPass2?.examples.length).toBe(1);
    expect(afterPass2?.meanings.length).toBe(1);

    // Total words in DB remains exactly 1!
    const totalWords = await db.words.count();
    expect(totalWords).toBe(1);

    fetchSpy.mockRestore();
  });

  it('7. Sao lưu & Khôi phục snapshot an toàn', async () => {
    const wordsToBackup: WordItem[] = [
      {
        id: 'bk-1',
        word: 'revenue',
        pos: ['noun'],
        phonetics: {},
        vietnameseDefinition: 'Doanh thu',
        englishDefinition: 'Income.',
        meanings: [],
        collocations: [],
        wordFamily: [],
        examples: [],
        tags: ['#TOEIC'],
        status: 'mastered',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        reviewMeta: { repetition: 10, interval: 100, easeFactor: 2.8, dueDate: 2000000000000, lastReviewedDate: 1700000000000, history: [] },
      },
    ];

    const snapshot = await createTranslationBackupSnapshot(wordsToBackup);
    expect(snapshot.count).toBe(1);
    expect(snapshot.data[0].word).toBe('revenue');

    // Verify stored in settingsTable
    const stored = await db.settingsTable.get('translation_backup_last');
    expect(stored?.value?.words[0]?.word).toBe('revenue');

    // Test restoration
    await db.words.clear();
    expect(await db.words.count()).toBe(0);

    const restoredCount = await restoreFromBackup(stored!.value.words);
    expect(restoredCount).toBe(1);
    const restoredWord = await db.words.get('bk-1');
    expect(restoredWord?.word).toBe('revenue');
    expect(restoredWord?.status).toBe('mastered');
    expect(restoredWord?.reviewMeta.interval).toBe(100);
  });
});
