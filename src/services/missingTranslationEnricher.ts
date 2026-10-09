import { db } from './db';
import type { WordItem, AppSettings } from '../types/vocab';
import { getAppSettings } from './db/statsRepo';
import { auditWordTranslation, isMissingOrUntranslated, isWordTranslationComplete, type WordTranslationAudit } from '../utils/translationAuditor';
import { mergeWordRecords } from './vocabRepository';
import { WORD_LRU_CACHE } from './dictionary/cache';
import { AI_PROVIDERS } from './ai';
import { groqPoolManager } from './ai/groqPoolManager';
import { translateToVietnamese } from './dictionary/adapters/translation';
import { normalizeVietnameseDefinition } from '../utils/definitionUtils';

export interface BackfillProgress {
  total: number;
  current: number;
  succeeded: number;
  failed: number;
  skipped: number;
  currentWord: string;
}

export interface BackfillOptions {
  words?: WordItem[];
  concurrency?: number;
  maxRetries?: number;
  signal?: AbortSignal;
  onProgress?: (progress: BackfillProgress) => void;
}

export interface BackfillResult {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  cancelled: boolean;
  backupTimestamp: number;
  untranslatedItems: Array<{ word: string; reason: string }>;
}

export interface DeckTranslationAuditSummary {
  totalWords: number;
  wordsWithIssuesCount: number;
  missingMainDefCount: number;
  missingMeaningCount: number;
  missingCollocationCount: number;
  missingWordFamilyCount: number;
  missingExampleCount: number;
  affectedWords: Array<{ word: WordItem; audit: WordTranslationAudit }>;
}

/**
 * Scans the entire deck (or provided words) and returns detailed statistics on missing translations.
 */
export async function auditDeckTranslations(deckWords?: WordItem[]): Promise<DeckTranslationAuditSummary> {
  const words = deckWords || (await db.words.toArray());
  const affectedWords: Array<{ word: WordItem; audit: WordTranslationAudit }> = [];

  let missingMainDefCount = 0;
  let missingMeaningCount = 0;
  let missingCollocationCount = 0;
  let missingWordFamilyCount = 0;
  let missingExampleCount = 0;

  for (const w of words) {
    const audit = auditWordTranslation(w);
    if (!audit.isComplete) {
      affectedWords.push({ word: w, audit });
      if (audit.details.mainDefMissing) missingMainDefCount++;
      missingMeaningCount += audit.details.missingMeaningIndices.length;
      missingCollocationCount += audit.details.missingCollocationIndices.length;
      missingWordFamilyCount += audit.details.missingWordFamilyIndices.length;
      missingExampleCount += audit.details.missingExampleIndices.length;
    }
  }

  return {
    totalWords: words.length,
    wordsWithIssuesCount: affectedWords.length,
    missingMainDefCount,
    missingMeaningCount,
    missingCollocationCount,
    missingWordFamilyCount,
    missingExampleCount,
    affectedWords,
  };
}

/**
 * Creates an atomic backup snapshot of affected words before modification.
 * Stores in IndexedDB settingsTable and returns the snapshot object.
 */
export async function createTranslationBackupSnapshot(words: WordItem[]): Promise<{ timestamp: number; count: number; data: WordItem[] }> {
  const timestamp = Date.now();
  const snapshotData = words.map((w) => JSON.parse(JSON.stringify(w)));
  try {
    await db.settingsTable.put({
      key: 'translation_backup_last',
      value: {
        timestamp,
        count: snapshotData.length,
        words: snapshotData,
      },
    });
  } catch (err) {
    console.warn('[MissingTranslationEnricher] Could not persist backup to settingsTable:', err);
  }

  return {
    timestamp,
    count: snapshotData.length,
    data: snapshotData,
  };
}

/**
 * Exports words snapshot as a downloadable JSON string.
 */
export function exportBackupAsJson(words: WordItem[]): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: 'LexiPulse Translation Backup',
    version: '1.0',
    count: words.length,
    words,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Restores words from a backup snapshot.
 */
export async function restoreFromBackup(backupWords: WordItem[]): Promise<number> {
  if (!Array.isArray(backupWords) || backupWords.length === 0) return 0;
  await db.transaction('rw', db.words, async () => {
    await db.words.bulkPut(backupWords);
  });
  for (const w of backupWords) {
    if (w.word) {
      WORD_LRU_CACHE.set(w.word.toLowerCase(), w);
    }
  }
  return backupWords.length;
}

interface AIResponseStructure {
  vietnameseDefinition?: string;
  usageNoteVi?: string;
  meanings?: Array<{ idx: number; vietnameseDefinition: string }>;
  collocations?: Array<{ idx: number; meaningVi: string }>;
  wordFamily?: Array<{ idx: number; meaningVi: string }>;
  examples?: Array<{ idx: number; vi: string }>;
}

/**
 * Calls AI provider with a specialized prompt to translate ONLY the missing parts.
 * Explicitly instructs the AI to translate each distinct sense separately and never
 * replicate the same definition across different meanings.
 */
async function callAiForMissingParts(
  word: WordItem,
  settings: AppSettings,
  missing: {
    needMainDef: boolean;
    meanings: Array<{ idx: number; pos: string; englishDefinition: string }>;
    collocations: Array<{ idx: number; phrase: string }>;
    wordFamily: Array<{ idx: number; word: string; pos: string }>;
    examples: Array<{ idx: number; en: string; context: string }>;
  },
  signal?: AbortSignal
): Promise<AIResponseStructure | null> {
  const provider = settings.aiProvider || 'gemini';
  const providerInfo = AI_PROVIDERS[provider] || AI_PROVIDERS.gemini;
  const apiKey = (settings.aiApiKey || settings.geminiApiKey || '').trim();
  const baseUrl = (settings.aiBaseUrl || providerInfo.defaultBaseUrl).replace(/\/+$/, '');
  const model = settings.aiModel || providerInfo.defaultModel;

  if (provider !== 'custom' && apiKey.length < 5) {
    return null;
  }

  const instructions = [
    `Bạn là một chuyên gia ngôn ngữ học Anh - Việt và giảng viên luyện thi TOEIC/IELTS cao cấp.`,
    `Nhiệm vụ của bạn là bổ sung bản dịch tiếng Việt cho các mục còn thiếu của từ vựng "${word.word}".`,
    `TỪ LOẠI CHÍNH: ${word.pos ? word.pos.join(', ') : 'noun'}.`,
    ``,
    `CÁC YÊU CẦU BẮT BUỘC:`,
    `1. Đối với meanings con: Dịch CHÍNH XÁC từng định nghĩa tiếng Anh sang tiếng Việt tương ứng. MỖI NGHĨA CON PHẢI CÓ BẢN DỊCH KHÁC NHAU phản ánh đúng sắc thái ngữ nghĩa của định nghĩa tiếng Anh đó. TUYỆT ĐỐI KHÔNG sao chép một nghĩa tiếng Việt giống hệt cho các nghĩa con khác nhau!`,
    `2. Đối với wordFamily (họ từ): Dịch chính xác theo đúng từ loại (POS) của từ con đó (danh từ dịch dạng danh từ, động từ dịch dạng hành động, tính từ dịch tính chất).`,
    `3. Đối với collocations: Dịch tự nhiên, chính xác ngữ cảnh công sở, văn phòng, giao tiếp thông dụng.`,
    `4. Đối với ví dụ (examples): Dịch câu trọn vẹn, đúng thì và văn phong tự nhiên.`,
    `5. KHÔNG tạo thêm mục mới ngoài danh sách được yêu cầu. Chỉ dịch đúng các mục có chỉ số (idx) dưới đây.`,
    ``,
    `DANH SÁCH MỤC CẦN DỊCH:`,
  ];

  if (missing.needMainDef) {
    instructions.push(`- Nghĩa chính (vietnameseDefinition) cho từ "${word.word}" (POS: ${word.pos?.join(', ') || 'noun'}).`);
    instructions.push(`- vietnameseDefinition phải bắt đầu bằng nghĩa tương đương tiếng Việt ngắn gọn, tự nhiên. Đánh số các nghĩa phổ biến khác nhau khi cần. Không gộp giải thích ngữ pháp hoặc câu ví dụ vào nghĩa chính.`);
    instructions.push(`- Nghĩa chính nên tối đa 30 từ tiếng Việt; bỏ nhãn từ loại như "Danh từ:". Ví dụ promise: "lời hứa; hứa, cam kết; tiềm năng, triển vọng". Câu ví dụ chỉ nằm trong examples.`);
    instructions.push(`- Đưa cách dùng cần thiết vào usageNoteVi bằng tiếng Việt ngắn gọn, chính xác; để rỗng nếu không cần. Ví dụ: as soon as = ngay khi; vừa … thì … (chỉ thời gian).`);
  }

  if (missing.meanings.length > 0) {
    instructions.push(`- Danh sách meanings con cần dịch:`);
    missing.meanings.forEach((m) => {
      instructions.push(`  * [idx: ${m.idx}] (POS: ${m.pos}): "${m.englishDefinition}"`);
    });
  }

  if (missing.collocations.length > 0) {
    instructions.push(`- Danh sách collocations cần dịch:`);
    missing.collocations.forEach((c) => {
      instructions.push(`  * [idx: ${c.idx}]: "${c.phrase}"`);
    });
  }

  if (missing.wordFamily.length > 0) {
    instructions.push(`- Danh sách word family cần dịch:`);
    missing.wordFamily.forEach((wf) => {
      instructions.push(`  * [idx: ${wf.idx}]: "${wf.word}" (${wf.pos})`);
    });
  }

  if (missing.examples.length > 0) {
    instructions.push(`- Danh sách examples cần dịch:`);
    missing.examples.forEach((ex) => {
      instructions.push(`  * [idx: ${ex.idx}] (Context: ${ex.context}): "${ex.en}"`);
    });
  }

  instructions.push(
    ``,
    `Trả về DUY NHẤT một JSON hợp lệ có cấu trúc:`,
    `{`,
    missing.needMainDef ? `  "vietnameseDefinition": "nghĩa tiếng Việt chính",` : '',
    missing.needMainDef ? `  "usageNoteVi": "cách dùng ngắn gọn hoặc chuỗi rỗng",` : '',
    missing.meanings.length > 0 ? `  "meanings": [{"idx": number, "vietnameseDefinition": "nghĩa tiếng Việt"}],` : '',
    missing.collocations.length > 0 ? `  "collocations": [{"idx": number, "meaningVi": "nghĩa tiếng Việt"}],` : '',
    missing.wordFamily.length > 0 ? `  "wordFamily": [{"idx": number, "meaningVi": "nghĩa tiếng Việt"}],` : '',
    missing.examples.length > 0 ? `  "examples": [{"idx": number, "vi": "bản dịch câu tiếng Việt"}],` : '',
    `}`,
    `Không bọc trong markdown \`\`\`json. Trả về JSON thuần túy.`
  );

  const prompt = instructions.filter(Boolean).join('\n');

  try {
    let rawText = '';
    if (provider === 'gemini') {
      const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal,
      });
      if (!res.ok) return null;
      const json = await res.json();
      rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (provider === 'claude') {
      const endpoint = `${baseUrl}/messages`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal,
      });
      if (!res.ok) return null;
      const json = await res.json();
      rawText = json.content?.[0]?.text || '';
    } else if (provider === 'groq') {
      // Groq Multi-Model Pool
      const poolResponse = await groqPoolManager.executeChatCompletion({
        apiKey,
        baseUrl,
        modelPool: settings.groqModelPool,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        signal,
        timeoutMs: 12000,
      });
      rawText = poolResponse.choices?.[0]?.message?.content || '';
    } else {
      // OpenAI / DeepSeek / OpenRouter / Custom
      const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
        headers['X-Title'] = 'LexiPulse Translation Enricher';
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          response_format: providerInfo.isOpenAICompatible ? { type: 'json_object' } : undefined,
          temperature: 0.3,
        }),
        signal,
      });
      if (!res.ok) return null;
      const json = await res.json();
      rawText = json.choices?.[0]?.message?.content || '';
    }

    if (!rawText) return null;

    // Clean markdown fences if any
    const cleanJsonStr = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const parsed: AIResponseStructure = JSON.parse(cleanJsonStr);
    return parsed;
  } catch (err) {
    return null;
  }
}

/**
 * Fallback translation using translation adapter for missing parts.
 */
async function fallbackTranslateMissingParts(
  word: WordItem,
  missing: {
    needMainDef: boolean;
    meanings: Array<{ idx: number; pos: string; englishDefinition: string }>;
    collocations: Array<{ idx: number; phrase: string }>;
    wordFamily: Array<{ idx: number; word: string; pos: string }>;
    examples: Array<{ idx: number; en: string; context: string }>;
  },
  signal?: AbortSignal
): Promise<AIResponseStructure> {
  const result: AIResponseStructure = {
    meanings: [],
    collocations: [],
    wordFamily: [],
    examples: [],
  };

  // Main def
  if (missing.needMainDef && !signal?.aborted) {
    try {
      const tr = await translateToVietnamese(word.word, 2000, signal);
      if (tr && !isMissingOrUntranslated(tr, word.word)) {
        result.vietnameseDefinition = tr;
      }
    } catch {}
  }

  // Meanings
  for (const m of missing.meanings) {
    if (signal?.aborted) break;
    try {
      const tr = await translateToVietnamese(m.englishDefinition, 2000, signal);
      if (tr && !isMissingOrUntranslated(tr, m.englishDefinition)) {
        result.meanings!.push({ idx: m.idx, vietnameseDefinition: tr });
      }
    } catch {}
  }

  // Collocations
  for (const c of missing.collocations) {
    if (signal?.aborted) break;
    try {
      const tr = await translateToVietnamese(c.phrase, 2000, signal);
      if (tr && !isMissingOrUntranslated(tr, c.phrase)) {
        result.collocations!.push({ idx: c.idx, meaningVi: tr });
      }
    } catch {}
  }

  // WordFamily
  for (const wf of missing.wordFamily) {
    if (signal?.aborted) break;
    try {
      const tr = await translateToVietnamese(wf.word, 2000, signal);
      if (tr && !isMissingOrUntranslated(tr, wf.word)) {
        result.wordFamily!.push({ idx: wf.idx, meaningVi: tr });
      }
    } catch {}
  }

  // Examples
  for (const ex of missing.examples) {
    if (signal?.aborted) break;
    try {
      const tr = await translateToVietnamese(ex.en, 2500, signal);
      if (tr && !isMissingOrUntranslated(tr, ex.en)) {
        result.examples!.push({ idx: ex.idx, vi: tr });
      }
    } catch {}
  }

  return result;
}

/**
 * Enriches missing translations for a single WordItem safely:
 * - Reads latest database record before saving (atomic read-merge-write)
 * - Preserves all user edits and FSRS metadata
 * - Only fills missing fields, never overwrites valid existing data
 */
export async function enrichSingleWordMissingTranslations(
  word: WordItem,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<{ success: boolean; word: WordItem; updated: boolean; reason?: string }> {
  // 1. Audit current word
  const audit = auditWordTranslation(word);
  if (audit.isComplete) {
    return { success: true, word, updated: false };
  }

  // 2. Prepare items needing translation
  const isUserEdited = Boolean(
    word.isUserEdited ||
    word.vietnameseDefinitionProvenance?.isUserEdited ||
    (typeof word.vietnameseDefinitionProvenance === 'object' && word.vietnameseDefinitionProvenance?.source === 'user_edit')
  );

  const needMainDef = !isUserEdited && audit.details.mainDefMissing;

  const meaningsToTranslate: Array<{ idx: number; pos: string; englishDefinition: string }> = [];
  if (Array.isArray(word.meanings)) {
    audit.details.missingMeaningIndices.forEach((idx) => {
      const m = word.meanings[idx];
      if (m && (m.englishDefinition || m.pos)) {
        meaningsToTranslate.push({
          idx,
          pos: m.pos || 'pos',
          englishDefinition: m.englishDefinition || '',
        });
      }
    });
  }

  const collocationsToTranslate: Array<{ idx: number; phrase: string }> = [];
  if (Array.isArray(word.collocations)) {
    audit.details.missingCollocationIndices.forEach((idx) => {
      const c = word.collocations[idx];
      if (c && c.phrase) {
        collocationsToTranslate.push({ idx, phrase: c.phrase });
      }
    });
  }

  const wordFamilyToTranslate: Array<{ idx: number; word: string; pos: string }> = [];
  if (Array.isArray(word.wordFamily)) {
    audit.details.missingWordFamilyIndices.forEach((idx) => {
      const wf = word.wordFamily[idx];
      if (wf && wf.word) {
        wordFamilyToTranslate.push({ idx, word: wf.word, pos: wf.pos || 'pos' });
      }
    });
  }

  const examplesToTranslate: Array<{ idx: number; en: string; context: string }> = [];
  if (Array.isArray(word.examples)) {
    audit.details.missingExampleIndices.forEach((idx) => {
      const ex = word.examples[idx];
      if (ex && ex.en) {
        examplesToTranslate.push({ idx, en: ex.en, context: ex.context || 'general' });
      }
    });
  }

  const missingBundle = {
    needMainDef,
    meanings: meaningsToTranslate,
    collocations: collocationsToTranslate,
    wordFamily: wordFamilyToTranslate,
    examples: examplesToTranslate,
  };

  // 3. Obtain translations via AI or fallback
  let translations: AIResponseStructure | null = null;
  const isAiConfigured = settings.aiProvider === 'custom' || (settings.aiApiKey && settings.aiApiKey.trim().length >= 5);

  if (isAiConfigured && !signal?.aborted) {
    translations = await callAiForMissingParts(word, settings, missingBundle, signal);
  }

  // If AI was not configured or call returned null, try translation fallback
  if (!translations && !signal?.aborted) {
    translations = await fallbackTranslateMissingParts(word, missingBundle, signal);
  }

  if (!translations || signal?.aborted) {
    return {
      success: false,
      word,
      updated: false,
      reason: 'Không thể kết nối máy chủ AI hoặc dịch thuật để lấy bản dịch mới.',
    };
  }

  // Count valid newly translated items
  const validMainDef = needMainDef && translations.vietnameseDefinition && !isMissingOrUntranslated(translations.vietnameseDefinition, word.word)
    ? normalizeVietnameseDefinition(translations.vietnameseDefinition) || undefined
    : undefined;

  const validMeanings = (translations.meanings || []).filter((m) => m && m.vietnameseDefinition && !isMissingOrUntranslated(m.vietnameseDefinition));
  const validCollocations = (translations.collocations || []).filter((c) => c && c.meaningVi && !isMissingOrUntranslated(c.meaningVi));
  const validWordFamily = (translations.wordFamily || []).filter((wf) => wf && wf.meaningVi && !isMissingOrUntranslated(wf.meaningVi));
  const validExamples = (translations.examples || []).filter((ex) => ex && ex.vi && !isMissingOrUntranslated(ex.vi));

  const totalNewTranslations =
    (validMainDef ? 1 : 0) +
    validMeanings.length +
    validCollocations.length +
    validWordFamily.length +
    validExamples.length;

  if (totalNewTranslations === 0) {
    return {
      success: false,
      word,
      updated: false,
      reason: 'Không thể lấy bản dịch mới từ AI hoặc từ điển. Dữ liệu cũ được giữ nguyên an toàn.',
    };
  }

  // 4. Construct incoming patch with ONLY the newly translated fields
  const updatedMeanings = word.meanings ? [...word.meanings] : [];
  for (const item of validMeanings) {
    if (typeof item.idx === 'number' && updatedMeanings[item.idx]) {
      updatedMeanings[item.idx] = {
        ...updatedMeanings[item.idx],
        vietnameseDefinition: item.vietnameseDefinition.trim(),
      };
    }
  }

  const updatedCollocations = word.collocations ? [...word.collocations] : [];
  for (const item of validCollocations) {
    if (typeof item.idx === 'number' && updatedCollocations[item.idx]) {
      updatedCollocations[item.idx] = {
        ...updatedCollocations[item.idx],
        meaningVi: item.meaningVi.trim(),
      };
    }
  }

  const updatedWordFamily = word.wordFamily ? [...word.wordFamily] : [];
  for (const item of validWordFamily) {
    if (typeof item.idx === 'number' && updatedWordFamily[item.idx]) {
      updatedWordFamily[item.idx] = {
        ...updatedWordFamily[item.idx],
        meaningVi: item.meaningVi.trim(),
      };
    }
  }

  const updatedExamples = word.examples ? [...word.examples] : [];
  for (const item of validExamples) {
    if (typeof item.idx === 'number' && updatedExamples[item.idx]) {
      updatedExamples[item.idx] = {
        ...updatedExamples[item.idx],
        vi: item.vi.trim(),
      };
    }
  }

  let finalMainDef = word.vietnameseDefinition;
  let finalProvenance = word.vietnameseDefinitionProvenance;
  if (validMainDef) {
    finalMainDef = validMainDef;
    finalProvenance = {
      source: isAiConfigured ? 'ai' : 'dictionary',
      provider: isAiConfigured ? (settings.aiProvider || 'gemini') : undefined,
      createdAt: Date.now(),
    };
  }

  const patch: Partial<WordItem> = {
    vietnameseDefinition: finalMainDef,
    ...(validMainDef ? {
      usageNoteVi: typeof translations.usageNoteVi === 'string'
        ? translations.usageNoteVi.trim() || undefined
        : undefined,
    } : {}),
    vietnameseDefinitionProvenance: finalProvenance,
    meanings: updatedMeanings,
    collocations: updatedCollocations,
    wordFamily: updatedWordFamily,
    examples: updatedExamples,
  };

  // 5. Atomic Read-Merge-Write from Database to protect against concurrent user edits
  let finalSavedWord: WordItem = word;
  await db.transaction('rw', db.words, async () => {
    const latestInDb = await db.words.get(word.id);
    const baseRecord = latestInDb || word;
    finalSavedWord = mergeWordRecords(baseRecord, patch, { mergePolicy: 'preserve-progress' });
    await db.words.put(finalSavedWord);
  });

  // 6. Update in-memory LRU cache
  if (finalSavedWord.word) {
    WORD_LRU_CACHE.set(finalSavedWord.word.toLowerCase(), finalSavedWord);
  }

  const afterAudit = auditWordTranslation(finalSavedWord);
  return {
    success: true,
    word: finalSavedWord,
    updated: true,
    reason: afterAudit.isComplete ? undefined : `Đã bổ sung một phần; còn ${afterAudit.totalMissingItems} mục chưa hoàn thành.`,
  };
}

/**
 * Orchestrates batch backfilling of missing translations across the deck.
 * Implements bounded concurrency (default 2), AbortSignal cancellation,
 * bounded retries with backoff, pre-execution backup, and throttled UI updates.
 */
export async function backfillMissingTranslations(options: BackfillOptions = {}): Promise<BackfillResult> {
  const wordsToAudit = options.words || (await db.words.toArray());
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 4));
  const maxRetries = options.maxRetries ?? 2;
  const signal = options.signal;
  const settings = await getAppSettings();

  // 1. Identify words needing backfill
  const itemsToEnrich: WordItem[] = [];
  for (const w of wordsToAudit) {
    if (!isWordTranslationComplete(w)) {
      itemsToEnrich.push(w);
    }
  }

  const total = itemsToEnrich.length;
  if (total === 0) {
    return {
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      cancelled: false,
      backupTimestamp: Date.now(),
      untranslatedItems: [],
    };
  }

  // 2. Pre-execution backup of affected records
  const backup = await createTranslationBackupSnapshot(itemsToEnrich);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let cancelled = false;
  const untranslatedItems: Array<{ word: string; reason: string }> = [];

  const reportProgress = (currentWord: string) => {
    options.onProgress?.({
      total,
      current: processed,
      succeeded,
      failed,
      skipped,
      currentWord,
    });
  };

  let currentIndex = 0;

  async function worker() {
    while (currentIndex < itemsToEnrich.length) {
      if (signal?.aborted) {
        cancelled = true;
        break;
      }

      const item = itemsToEnrich[currentIndex++];
      if (!item) break;

      reportProgress(item.word);

      let attempts = 0;
      let outcome: { success: boolean; word: WordItem; updated: boolean; reason?: string } = {
        success: false,
        word: item,
        updated: false,
      };

      while (attempts <= maxRetries && !signal?.aborted) {
        attempts++;
        try {
          outcome = await enrichSingleWordMissingTranslations(item, settings, signal);
          if (outcome.success) break;
        } catch (err: any) {
          outcome = {
            success: false,
            word: item,
            updated: false,
            reason: err instanceof Error ? err.message : String(err),
          };
        }

        if (attempts <= maxRetries && !signal?.aborted) {
          await new Promise((r) => setTimeout(r, 600 * attempts));
        }
      }

      if (signal?.aborted) {
        cancelled = true;
        break;
      }

      processed++;

      if (outcome.success && outcome.updated) {
        succeeded++;
      } else if (!outcome.success) {
        failed++;
        untranslatedItems.push({
          word: item.word,
          reason: outcome.reason || 'Không thể dịch trường còn thiếu.',
        });
      } else {
        skipped++;
      }

      reportProgress(item.word);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  reportProgress('');

  return {
    total,
    processed,
    succeeded,
    failed,
    skipped,
    cancelled: cancelled || Boolean(signal?.aborted),
    backupTimestamp: backup.timestamp,
    untranslatedItems,
  };
}
