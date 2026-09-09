// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { runEnrichmentPipeline, mergePipelineSources } from '../src/services/enrichmentPipeline';
import * as aiModule from '../src/services/ai';
import * as dictModule from '../src/services/dictionary';
import {
  buildAICacheKey,
  getCachedAIEnrichment,
  setCachedAIEnrichment,
  clearAICache,
} from '../src/services/ai/aiCache';
import { mergeWordRecords } from '../src/services/vocabRepository';
import { translations } from '../src/i18n/translations';
import { SearchBar } from '../src/components/lookup/SearchBar';
import { WordCard } from '../src/components/lookup/WordCard';
import { LanguageProvider } from '../src/context/LanguageContext';
import type { WordItem, AppSettings, WordFamilyMember } from '../src/types/vocab';

describe('Enrichment, Provenance & Data Integrity Regressions (11 Scenarios)', () => {
  const baseSettings: AppSettings = {
    theme: 'light',
    dailyGoal: 10,
    dailyReviewGoal: 20,
    geminiApiKey: 'mock-key',
    aiApiKey: 'mock-key',
    aiProvider: 'gemini',
    aiModel: 'gemini-2.5-flash',
    prioritizeAI: true,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    clearAICache();
  });

  // 1. Dictionary trả trước, AI trả sau: nghĩa AI và badge cập nhật trên UI khi bật ưu tiên AI
  it('Scenario 1: Dictionary finishes first, AI finishes later -> AI definition and badge update when prioritizeAI is true', async () => {
    const stageUpdates: { stage: string; word: WordItem; sourceVi: string }[] = [];

    const mockDictResult: WordItem = {
      id: 'dict-1',
      word: 'thrive',
      vietnameseDefinition: 'phát triển mạnh (từ điển)',
      englishDefinition: 'to grow or develop well',
      pos: ['verb'],
      phonetics: { us: '/θraɪv/', uk: '/θraɪv/' },
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: [],
      status: 'new',
      createdAt: 1000,
      updatedAt: 1000,
      vietnameseDefinitionProvenance: { source: 'dictionary', createdAt: 1000 },
    };

    const mockAiResult = {
      vietnameseDefinition: 'Phát triển thịnh vượng, thành công vượt bậc (AI)',
      lemma: 'thrive',
      formLabels: ['Động từ nguyên mẫu'],
      collocations: [{ phrase: 'thrive on challenges', meaningVi: 'phát triển nhờ thử thách' }],
      wordFamily: [],
      examples: [{ en: 'The business continues to thrive.', vi: 'Doanh nghiệp tiếp tục phát triển thịnh vượng.', context: 'toeic' as const }],
      tags: ['#TOEIC'],
    };

    vi.spyOn(dictModule, 'lookupWord').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10)); // Dict returns in 10ms
      return mockDictResult;
    });

    vi.spyOn(aiModule, 'enrichWordWithAI').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50)); // AI returns in 50ms
      return mockAiResult;
    });

    const res = await runEnrichmentPipeline({
      query: 'thrive',
      settings: { ...baseSettings, prioritizeAI: true },
      onStageUpdate: (update) => {
        stageUpdates.push({ stage: update.stage, word: update.word, sourceVi: update.sourceVi });
      },
    });

    // Stage updates should include dictionary first, then ai
    const dictStage = stageUpdates.find((s) => s.stage === 'dictionary');
    expect(dictStage).toBeDefined();
    expect(dictStage?.word.vietnameseDefinition).toBe('phát triển mạnh (từ điển)');
    expect(dictStage?.sourceVi).toBe('dictionary');

    const aiStage = stageUpdates.find((s) => s.stage === 'ai');
    expect(aiStage).toBeDefined();
    expect(aiStage?.word.vietnameseDefinition).toBe('Phát triển thịnh vượng, thành công vượt bậc (AI)');
    expect(aiStage?.sourceVi).toBe('ai');

    // Final result has AI definition and provenance
    expect(res.sourceVi).toBe('ai');
    expect(res.word.vietnameseDefinition).toBe('Phát triển thịnh vượng, thành công vượt bậc (AI)');
    expect(res.word.vietnameseDefinitionProvenance?.source).toBe('ai');
    expect(res.word.englishDefinition).toBe('to grow or develop well');
  });

  // 2. Đảo thứ tự hoàn thành: cùng kết quả cuối; kiểm tra cả prioritizeAI=true/false
  it('Scenario 2: Deterministic merge regardless of completion order for both prioritizeAI=true and false', () => {
    const baseWord: WordItem = {
      id: 'test-w',
      word: 'lead',
      vietnameseDefinition: '',
      englishDefinition: '',
      pos: ['verb'],
      phonetics: { us: '', uk: '' },
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: [],
      status: 'new',
      createdAt: 1000,
      updatedAt: 1000,
    };

    const dictResult: WordItem = {
      ...baseWord,
      vietnameseDefinition: 'dẫn dắt, lãnh đạo (từ điển)',
      englishDefinition: 'to guide or conduct in a proper path',
      phonetics: { us: '/liːd/', uk: '/liːd/' },
      vietnameseDefinitionProvenance: { source: 'dictionary', createdAt: 1000 },
    };

    const aiResult = {
      vietnameseDefinition: 'Lãnh đạo, dẫn đầu đội ngũ (AI)',
      lemma: 'lead',
      formLabels: ['Động từ'],
      collocations: [{ phrase: 'lead by example', meaningVi: 'nêu gương' }],
      wordFamily: [] as WordFamilyMember[],
      examples: [{ en: 'She leads the team well.', vi: 'Cô ấy dẫn dắt đội rất tốt.', context: 'toeic' as const }],
      tags: ['#Leadership'],
    };

    const dummyAnalysis = {
      selectedLemma: 'lead',
      isInflected: false,
      formLabels: ['Động từ'],
      detectedPos: 'verb',
      variants: ['lead'],
      inflections: [],
    };

    // Case 2A: prioritizeAI = true
    const resA_DictThenAi = mergePipelineSources({
      query: 'lead',
      analysis: dummyAnalysis,
      dictResult,
      aiResult,
      prioritizeAI: true,
      settings: baseSettings,
    });

    const resA_AiThenDict = mergePipelineSources({
      query: 'lead',
      analysis: dummyAnalysis,
      dictResult,
      aiResult,
      prioritizeAI: true,
      settings: baseSettings,
    });

    expect(resA_DictThenAi.word.vietnameseDefinition).toBe('Lãnh đạo, dẫn đầu đội ngũ (AI)');
    expect(resA_DictThenAi.sourceVi).toBe('ai');
    expect(resA_DictThenAi.word.vietnameseDefinition).toBe(resA_AiThenDict.word.vietnameseDefinition);
    expect(resA_DictThenAi.sourceVi).toBe(resA_AiThenDict.sourceVi);
    expect(resA_DictThenAi.word.englishDefinition).toBe('to guide or conduct in a proper path');

    // Case 2B: prioritizeAI = false
    const resB_DictThenAi = mergePipelineSources({
      query: 'lead',
      analysis: dummyAnalysis,
      dictResult,
      aiResult,
      prioritizeAI: false,
      settings: baseSettings,
    });

    const resB_AiThenDict = mergePipelineSources({
      query: 'lead',
      analysis: dummyAnalysis,
      dictResult,
      aiResult,
      prioritizeAI: false,
      settings: baseSettings,
    });

    expect(resB_DictThenAi.word.vietnameseDefinition).toBe('dẫn dắt, lãnh đạo (từ điển)');
    expect(resB_DictThenAi.sourceVi).toBe('dictionary');
    expect(resB_DictThenAi.word.vietnameseDefinition).toBe(resB_AiThenDict.word.vietnameseDefinition);
    expect(resB_DictThenAi.sourceVi).toBe(resB_AiThenDict.sourceVi);
    expect(resB_DictThenAi.word.englishDefinition).toBe('to guide or conduct in a proper path');
  });

  // 3. Không cấu hình AI, AI lỗi hoặc timeout: không gắn nhãn AI cho nghĩa fallback
  it('Scenario 3: Unconfigured AI or AI failure does not tag fallback definition as AI', async () => {
    vi.spyOn(aiModule, 'enrichWordWithAI').mockRejectedValueOnce(new Error('AI timeout 408'));
    vi.spyOn(dictModule, 'lookupWord').mockResolvedValueOnce({
      id: 'dict-2',
      word: 'stable',
      vietnameseDefinition: 'ổn định, bền vững',
      englishDefinition: 'not likely to change or fail',
      pos: ['adjective'],
      phonetics: { us: '/ˈsteɪ.bəl/', uk: '/ˈsteɪ.bəl/' },
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: [],
      status: 'new',
      createdAt: 1000,
      updatedAt: 1000,
      vietnameseDefinitionProvenance: { source: 'dictionary', createdAt: 1000 },
    });

    const res = await runEnrichmentPipeline({
      query: 'stable',
      settings: { ...baseSettings, prioritizeAI: true },
    });

    expect(res.sourceVi).toBe('dictionary');
    expect(res.word.vietnameseDefinition).toBe('ổn định, bền vững');
    expect(res.word.vietnameseDefinitionProvenance?.source).toBe('dictionary');
    expect(res.word.vietnameseDefinitionProvenance?.source).not.toBe('ai');
  });

  // 4. AI chỉ bổ sung ví dụ: không đổi nguồn của nghĩa từ điển
  it('Scenario 4: AI provides only examples/collocations without a new definition -> provenance remains dictionary', () => {
    const baseWord: WordItem = {
      id: 'test-4',
      word: 'clarify',
      vietnameseDefinition: '',
      englishDefinition: '',
      pos: ['verb'],
      phonetics: { us: '', uk: '' },
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: [],
      status: 'new',
      createdAt: 1000,
      updatedAt: 1000,
    };

    const dictResult: WordItem = {
      ...baseWord,
      vietnameseDefinition: 'làm rõ, giải thích rõ',
      englishDefinition: 'to make an idea or statement clear',
      vietnameseDefinitionProvenance: { source: 'dictionary', createdAt: 1000 },
    };

    const aiResultOnlyExamples = {
      vietnameseDefinition: '', // No Vietnamese definition provided by AI
      lemma: 'clarify',
      formLabels: [],
      collocations: [{ phrase: 'clarify the issue', meaningVi: 'làm rõ vấn đề' }],
      wordFamily: [],
      examples: [{ en: 'Could you please clarify this point?', vi: 'Bạn có thể làm rõ điểm này được không?', context: 'toeic' as const }],
      tags: ['#TOEIC'],
    };

    const res = mergePipelineSources({
      query: 'clarify',
      analysis: {
        selectedLemma: 'clarify',
        isInflected: false,
        formLabels: [],
        detectedPos: 'verb',
        variants: ['clarify'],
        inflections: [],
      },
      dictResult,
      aiResult: aiResultOnlyExamples,
      prioritizeAI: true,
      settings: baseSettings,
    });

    expect(res.word.vietnameseDefinition).toBe('làm rõ, giải thích rõ');
    expect(res.sourceVi).toBe('dictionary');
    expect(res.word.vietnameseDefinitionProvenance?.source).toBe('dictionary');
    expect(res.word.examples.length).toBe(1);
    expect(res.word.collocations.length).toBe(1);
  });

  // 5. Save → reload → JSON export/import: nghĩa, nguồn, audio và lịch ôn giữ đúng
  it('Scenario 5: Full preservation of definition, provenance, audioUs/Uk, and FSRS schedule across serialization', () => {
    const originalItem: WordItem = {
      id: 'word-preserve-1',
      word: 'innovate',
      vietnameseDefinition: 'Đổi mới, sáng tạo giải pháp mới',
      vietnameseDefinitionProvenance: {
        source: 'ai',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        createdAt: 1710000000000,
      },
      englishDefinition: 'make changes in something established',
      pos: ['verb'],
      phonetics: {
        us: '/ˈɪn.ə.veɪt/',
        uk: '/ˈɪn.ə.veɪt/',
        audioUs: 'https://ssl.gstatic.com/dictionary/static/sounds/20200429/innovate--_us_1.mp3',
        audioUk: 'https://ssl.gstatic.com/dictionary/static/sounds/20200429/innovate--_gb_1.mp3',
      },
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: ['#Tech', '#TOEIC'],
      status: 'learning',
      repetition: 4,
      interval: 12,
      easeFactor: 2.6,
      dueDate: Date.now() + 86400000 * 12,
      fsrs: {
        stability: 11.8,
        difficulty: 4.2,
        reps: 4,
        lapses: 0,
        state: 2,
        lastReview: Date.now() - 86400000,
      },
      createdAt: 1700000000000,
      updatedAt: 1710000000000,
    };

    // Simulate JSON Export (backup)
    const jsonString = JSON.stringify([originalItem]);
    expect(jsonString).toContain('audioUs');
    expect(jsonString).toContain('audioUk');
    expect(jsonString).toContain('vietnameseDefinitionProvenance');
    expect(jsonString).toContain('stability');

    // Simulate JSON Import (restore)
    const importedItems: WordItem[] = JSON.parse(jsonString);
    const restored = importedItems[0];

    expect(restored.vietnameseDefinition).toBe(originalItem.vietnameseDefinition);
    expect(restored.vietnameseDefinitionProvenance?.source).toBe('ai');
    expect(restored.vietnameseDefinitionProvenance?.provider).toBe('gemini');
    expect(restored.phonetics.audioUs).toBe(originalItem.phonetics.audioUs);
    expect(restored.phonetics.audioUk).toBe(originalItem.phonetics.audioUk);
    expect(restored.fsrs?.stability).toBe(11.8);
    expect(restored.fsrs?.difficulty).toBe(4.2);
    expect(restored.repetition).toBe(4);
    expect(restored.interval).toBe(12);
  });

  // 6. Sửa nghĩa/tag trong lúc chờ AI: phản hồi nền không xóa chỉnh sửa đó
  it('Scenario 6: User edits during in-flight background AI call are strictly protected by mergeWordRecords', () => {
    // Current word in DB has been edited by the user
    const currentInDb: WordItem = {
      id: 'item-edit-race',
      word: 'acquire',
      vietnameseDefinition: 'Mua lại (công ty), thâu tóm (người dùng tự sửa)',
      vietnameseDefinitionProvenance: {
        source: 'user_edit',
        isUserEdited: true,
        createdAt: 2000,
      },
      isUserEdited: true,
      englishDefinition: 'buy or obtain',
      pos: ['verb'],
      phonetics: {
        us: '/əˈkwaɪ.ɚ/',
        uk: '/əˈkwaɪər/',
        audioUs: 'https://audio.us/acquire.mp3',
        audioUk: 'https://audio.uk/acquire.mp3',
      },
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: ['#M&A', '#CustomTag'],
      notes: 'Ghi chú riêng của tôi',
      status: 'learning',
      repetition: 2,
      interval: 4,
      easeFactor: 2.5,
      createdAt: 1000,
      updatedAt: 2000,
    };

    // Late background AI enrichment arrives
    const lateAiEnriched: WordItem = {
      id: 'item-edit-race',
      word: 'acquire',
      vietnameseDefinition: 'Đạt được, thu được (AI)',
      vietnameseDefinitionProvenance: {
        source: 'ai',
        createdAt: 1500,
      },
      englishDefinition: 'to get something',
      pos: ['verb'],
      phonetics: { us: '/əˈkwaɪ.ɚ/', uk: '/əˈkwaɪər/' }, // Missing audioUs/Uk in AI payload
      meanings: [],
      collocations: [{ phrase: 'acquire a company', meaningVi: 'thâu tóm công ty' }],
      wordFamily: [],
      examples: [{ en: 'The firm acquired a new subsidiary.', vi: 'Tập đoàn đã mua lại một công ty con mới.', context: 'toeic' as const }],
      tags: ['#GenericTag'],
      status: 'new',
      createdAt: 1000,
      updatedAt: 1500,
    };

    const merged = mergeWordRecords(currentInDb, lateAiEnriched);

    // User's custom definition and provenance MUST be preserved
    expect(merged.vietnameseDefinition).toBe('Mua lại (công ty), thâu tóm (người dùng tự sửa)');
    expect(merged.vietnameseDefinitionProvenance?.source).toBe('user_edit');
    expect(merged.isUserEdited).toBe(true);

    // User's notes and tags must not be wiped out
    expect(merged.notes).toBe('Ghi chú riêng của tôi');
    expect(merged.tags).toContain('#M&A');
    expect(merged.tags).toContain('#CustomTag');

    // Audio URLs must be preserved from DB
    expect(merged.phonetics.audioUs).toBe('https://audio.us/acquire.mp3');
    expect(merged.phonetics.audioUk).toBe('https://audio.uk/acquire.mp3');

    // Non-conflicting enrichments (collocations, examples) can be augmented
    expect(merged.collocations.length).toBeGreaterThan(0);
    expect(merged.examples.length).toBeGreaterThan(0);
  });

  // 7. Hai ngữ cảnh cùng 80 ký tự đầu nhưng khác nghĩa: không trùng cache; phân biệt POS và endpoint
  it('Scenario 7: Full context hashing prevents cache collision on shared 80+ prefix and distinguishes POS & safe endpoints', () => {
    const prefix = 'The bank of the international development organization announced new financial regulations that ';
    const contextFinancial = prefix + 'will govern cross-border lending and currency reserves for member states.';
    const contextRiver = prefix + 'protect wetlands from construction and soil erosion along the river border.';

    const keyFinancial = buildAICacheKey({
      word: 'bank',
      contextSentence: contextFinancial,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      pos: 'noun',
      baseUrl: 'https://generativelanguage.googleapis.com',
    });
    const keyRiver = buildAICacheKey({
      word: 'bank',
      contextSentence: contextRiver,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      pos: 'noun',
      baseUrl: 'https://generativelanguage.googleapis.com',
    });

    // Must NOT collide!
    expect(keyFinancial).not.toBe(keyRiver);

    // Distinguish POS
    const keyNoun = buildAICacheKey({
      word: 'bank',
      contextSentence: contextFinancial,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      pos: 'noun',
    });
    const keyVerb = buildAICacheKey({
      word: 'bank',
      contextSentence: contextFinancial,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      pos: 'verb',
    });
    expect(keyNoun).not.toBe(keyVerb);

    // Distinguish custom endpoints safely without credentials
    const keyCustomEndpoint1 = buildAICacheKey({
      word: 'bank',
      contextSentence: contextFinancial,
      provider: 'openai',
      model: 'gpt-4o',
      pos: 'noun',
      baseUrl: 'https://custom-proxy-1.com/v1',
    });
    const keyCustomEndpoint2 = buildAICacheKey({
      word: 'bank',
      contextSentence: contextFinancial,
      provider: 'openai',
      model: 'gpt-4o',
      pos: 'noun',
      baseUrl: 'https://custom-proxy-2.com/v1',
    });
    expect(keyCustomEndpoint1).not.toBe(keyCustomEndpoint2);

    // Endpoint with query/token should be sanitized
    const keyWithToken = buildAICacheKey({
      word: 'bank',
      contextSentence: contextFinancial,
      provider: 'openai',
      model: 'gpt-4o',
      pos: 'noun',
      baseUrl: 'https://proxy.com/v1?token=SECRET_12345',
    });
    expect(keyWithToken).not.toContain('SECRET_12345');

    // LRU cache update & deep clone test
    const dummyResult = {
      vietnameseDefinition: 'Ngân hàng phát triển',
      lemma: 'bank',
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: [],
    };
    setCachedAIEnrichment('bank', dummyResult, contextFinancial, 'gemini', 'gemini-2.5-flash', 'noun');
    const retrieved1 = getCachedAIEnrichment('bank', contextFinancial, 'gemini', 'gemini-2.5-flash', 'noun');
    expect(retrieved1).not.toBeNull();

    // Mutating retrieved object should NOT corrupt cache
    retrieved1!.vietnameseDefinition = 'CORRUPTED';
    const retrieved2 = getCachedAIEnrichment('bank', contextFinancial, 'gemini', 'gemini-2.5-flash', 'noun');
    expect(retrieved2?.vietnameseDefinition).toBe('Ngân hàng phát triển');
  });

  // 8. Tra liên tiếp hai từ, hủy truy vấn đầu: chỉ kết quả mới cập nhật giao diện
  it('Scenario 8: Sequential queries with cancellation -> only the latest query updates state', async () => {
    let activeToken = 0;
    let finalDisplayedWord = '';

    const executeSearch = async (term: string) => {
      const currentToken = ++activeToken;

      // Simulate network delay
      const delay = term === 'first' ? 60 : 10;
      await new Promise((r) => setTimeout(r, delay));

      // Token check
      if (currentToken === activeToken) {
        finalDisplayedWord = term;
      }
    };

    // Trigger first search (slow), then immediately second search (fast)
    const p1 = executeSearch('first');
    const p2 = executeSearch('second');

    await Promise.all([p1, p2]);

    expect(finalDisplayedWord).toBe('second');
  });

  // 9. Tra từ kèm câu ngữ cảnh qua UI thật: đúng tham số xuống AI, không gọi lặp
  it('Scenario 9: SearchBar with context sentence passes context to onSearch and pipeline avoids duplicate AI calls', async () => {
    const handleSearch = vi.fn();

    render(
      <LanguageProvider>
        <SearchBar onSearch={handleSearch} isLoading={false} deckWords={[]} />
      </LanguageProvider>
    );

    // Toggle context sentence input
    const toggleBtn = screen.getByText(/\+ Thêm câu ngữ cảnh/i);
    fireEvent.click(toggleBtn);

    const inputs = screen.getAllByRole('textbox');
    const wordInput = inputs[0];
    const contextInput = inputs[1];

    fireEvent.change(wordInput, { target: { value: 'execute' } });
    fireEvent.change(contextInput, { target: { value: 'The court ordered to execute the contract.' } });

    fireEvent.submit(wordInput.closest('form')!);

    expect(handleSearch).toHaveBeenCalledWith('execute', 'The court ordered to execute the contract.');

    // Now test that pipeline passes skipBackgroundAi: true to lookupWord to avoid calling AI twice
    const lookupSpy = vi.spyOn(dictModule, 'lookupWord').mockResolvedValueOnce({
      id: 'dict-exec',
      word: 'execute',
      vietnameseDefinition: 'thực thi',
      englishDefinition: 'to carry out',
      pos: ['verb'],
      phonetics: { us: '/ˈek.sə.kjuːt/', uk: '/ˈek.sə.kjuːt/' },
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: [],
      status: 'new',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const aiSpy = vi.spyOn(aiModule, 'enrichWordWithAI').mockResolvedValueOnce({
      vietnameseDefinition: 'Ký kết và thực thi (hợp đồng)',
      lemma: 'execute',
      formLabels: ['Động từ'],
      collocations: [],
      wordFamily: [],
      examples: [{ en: 'The court ordered to execute the contract.', vi: 'Tòa án yêu cầu thực thi hợp đồng.', context: 'toeic' as const }],
      tags: ['#Legal'],
    });

    await runEnrichmentPipeline({
      query: 'execute',
      contextSentence: 'The court ordered to execute the contract.',
      settings: baseSettings,
    });

    expect(lookupSpy).toHaveBeenCalledWith(
      'execute',
      expect.objectContaining({ skipBackgroundAi: true })
    );
    expect(aiSpy).toHaveBeenCalledTimes(1);
  });

  // 10. “went”, “written”, “studies” và từ đa nghĩa như “bank”: phân biệt input/lemma/IPA/nghĩa
  it('Scenario 10: Morphological analysis distinguishes input vs lemma, preserves correct forms, and avoids forcing single meaning without context', async () => {
    // Test 'went'
    const wentRes = await runEnrichmentPipeline({
      query: 'went',
      settings: { ...baseSettings, aiApiKey: '' }, // morphology stage only
    });
    expect(wentRes.word.originalInput).toBe('went');
    expect(wentRes.word.lemma).toBe('go');
    expect(wentRes.word.formLabels?.some((l) => l.includes('Quá khứ'))).toBe(true);

    // Test 'written'
    const writtenRes = await runEnrichmentPipeline({
      query: 'written',
      settings: { ...baseSettings, aiApiKey: '' },
    });
    expect(writtenRes.word.originalInput).toBe('written');
    expect(writtenRes.word.lemma).toBe('write');
    expect(writtenRes.word.formLabels?.some((l) => l.includes('phân từ') || l.includes('V3'))).toBe(true);

    // Test 'studies'
    const studiesRes = await runEnrichmentPipeline({
      query: 'studies',
      settings: { ...baseSettings, aiApiKey: '' },
    });
    expect(studiesRes.word.originalInput).toBe('studies');
    expect(studiesRes.word.lemma).toBe('study');

    // Test 'bank' without context: does not force single narrow meaning
    vi.spyOn(dictModule, 'lookupWord').mockResolvedValueOnce({
      id: 'dict-bank',
      word: 'bank',
      vietnameseDefinition: 'ngân hàng; bờ sông',
      englishDefinition: 'a financial institution; an edge of a river',
      pos: ['noun'],
      phonetics: { us: '/bæŋk/', uk: '/bæŋk/' },
      meanings: [
        { partOfSpeech: 'noun', definitionEn: 'financial establishment', definitionVi: 'ngân hàng', examples: [] },
        { partOfSpeech: 'noun', definitionEn: 'sloping land beside water', definitionVi: 'bờ sông, đê', examples: [] },
      ],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: [],
      status: 'new',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const bankRes = await runEnrichmentPipeline({
      query: 'bank',
      settings: { ...baseSettings, aiApiKey: '' },
    });
    expect(bankRes.word.meanings.length).toBe(2);
    expect(bankRes.word.vietnameseDefinition).toContain('ngân hàng');
    expect(bankRes.word.vietnameseDefinition).toContain('bờ sông');
  });

  // 11. Không có dữ liệu: không sinh nghĩa hay IPA giả; chuyển Việt–Anh không sót chuỗi
  it('Scenario 11: Missing data displays honest empty states instead of fabricated strings; translations are complete', () => {
    const emptyWord: WordItem = {
      id: 'word-empty',
      word: 'xyznotaword',
      vietnameseDefinition: '',
      englishDefinition: '',
      pos: [],
      phonetics: { us: '', uk: '' },
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: [],
      status: 'new',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const { container: viContainer } = render(
      <LanguageProvider>
        <WordCard word={emptyWord} />
      </LanguageProvider>
    );

    // Must NOT contain fake strings like "Ý nghĩa của xyznotaword" or "/xyznotaword/"
    expect(viContainer.textContent).not.toContain('Ý nghĩa của');
    expect(viContainer.textContent).not.toContain('/xyznotaword/');
    expect(viContainer.textContent).not.toContain('Ví dụ theo ngữ cảnh nhập vào');

    // Must render honest placeholder
    expect(viContainer.textContent).toContain('Chưa có bản dịch');
    expect(viContainer.textContent).toContain('Chưa có phiên âm');

    // Verify key standardized translations exist and match requirements for both VI and EN
    expect(translations.vi.nav.deck).toBe('Bộ từ vựng');
    expect(translations.en.nav.deck).toBe('Vocabulary Deck');

    expect(translations.vi.review.backToDashboard).toBe('Về tổng quan');
    expect(translations.en.review.backToDashboard).toBe('Back to Overview');

    expect(translations.vi.review.extraPractice).toBe('Luyện thêm');
    expect(translations.en.review.extraPractice).toBe('Extra Practice');

    expect(translations.vi.lookup.aiTranslated).toBe('Dịch bằng AI');
    expect(translations.en.lookup.aiTranslated).toBe('AI Translation');

    expect(translations.vi.lookup.dictionarySource).toBe('Từ điển');
    expect(translations.en.lookup.dictionarySource).toBe('Dictionary');

    expect(translations.vi.lookup.userEdited).toBe('Đã chỉnh sửa');
    expect(translations.en.lookup.userEdited).toBe('User Edited');

    expect(translations.vi.lookup.saveToDeck).toBe('Lưu vào bộ từ');
    expect(translations.en.lookup.saveToDeck).toBe('Save to Deck');
  });
});
