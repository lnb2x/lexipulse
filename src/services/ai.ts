import type { AIProvider, CollocationItem, ExampleItem, WordFamilyItem, InflectionItem } from '../types/vocab';
import { getCachedAIEnrichment, setCachedAIEnrichment } from './ai/aiCache';
import {
  analyzeWordMorphologyWithAI,
  type AIMorphologyResult,
  validateAIMorphologyResult,
  setCachedMorphology,
  SUSPICIOUS_TRUNCATED_STEMS,
} from './ai/aiMorphology';

import { getAppSettings } from './db/statsRepo';

export { analyzeWordMorphologyWithAI, validateAIMorphologyResult, type AIMorphologyResult };

export async function isAiAvailable(): Promise<boolean> {
  try {
    const s = await getAppSettings();
    const key = (s.aiApiKey || s.geminiApiKey || '').trim();
    return s.aiProvider === 'custom' || key.length >= 5;
  } catch {
    return false;
  }
}

export interface AIProviderConfig {
  id: AIProvider;
  name: string;
  defaultBaseUrl: string;
  defaultModel: string;
  models: string[];
  placeholder: string;
  docUrl: string;
  isOpenAICompatible: boolean;
  description: string;
}

export const AI_PROVIDERS: Record<AIProvider, AIProviderConfig> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    placeholder: 'AIzaSy...',
    docUrl: 'https://aistudio.google.com/app/apikey',
    isOpenAICompatible: false,
    description: 'Miễn phí, tốc độ cao và tối ưu cho giáo dục & ngôn ngữ.',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    placeholder: 'sk-proj-...',
    docUrl: 'https://platform.openai.com/api-keys',
    isOpenAICompatible: true,
    description: 'Độ chính xác học thuật cao, văn phong ngữ cảnh chuẩn xác.',
  },
  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-20241022',
    models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
    placeholder: 'sk-ant-api03-...',
    docUrl: 'https://console.anthropic.com/settings/keys',
    isOpenAICompatible: false,
    description: 'Văn phong tự nhiên, phân tích từ vựng và ví dụ sắc sảo.',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    placeholder: 'sk-...',
    docUrl: 'https://platform.deepseek.com/api_keys',
    isOpenAICompatible: true,
    description: 'Chi phí siêu tiết kiệm với năng lực suy luận và ngôn ngữ mạnh mẽ.',
  },
  groq: {
    id: 'groq',
    name: 'Groq (Ultra-Fast)',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    placeholder: 'gsk_...',
    docUrl: 'https://console.groq.com/keys',
    isOpenAICompatible: true,
    description: 'Tốc độ phản hồi tức thì với tier miễn phí hào phóng.',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-2.5-flash',
    models: [
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
      'anthropic/claude-3.5-haiku',
    ],
    placeholder: 'sk-or-v1-...',
    docUrl: 'https://openrouter.ai/keys',
    isOpenAICompatible: true,
    description: 'Cổng kết nối thống nhất truy cập hơn 200+ mô hình AI.',
  },
  custom: {
    id: 'custom',
    name: 'Tùy chỉnh / Ollama / Local',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    models: ['llama3', 'mistral', 'qwen2.5', 'phi3'],
    placeholder: 'Tùy chọn cho local API...',
    docUrl: 'https://ollama.com/',
    isOpenAICompatible: true,
    description: 'Tương thích mọi endpoint chuẩn OpenAI (Ollama, LM Studio, vLLM, proxy cá nhân).',
  },
};

export interface AIEnrichmentResult {
  ipaUs?: string;
  ipaUk?: string;
  vietnameseDefinition: string;
  collocations: CollocationItem[];
  wordFamily: WordFamilyItem[];
  examples: ExampleItem[];
  tags: string[];
  lemma?: string;
  pos?: string[];
  formLabels?: string[];
  inflections?: InflectionItem[];
}

export interface AIRequestConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Concurrency limiter for background AI requests (max 2 concurrent)
 * Drops aborted requests immediately from the waiting queue.
 */
let activeAIRequests = 0;
const aiQueue: Array<() => void> = [];

async function acquireAISlot(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  if (activeAIRequests < 2) {
    activeAIRequests++;
    return;
  }
  return new Promise<void>((resolve, reject) => {
    let onAbort: (() => void) | undefined;
    const task = () => {
      if (onAbort && signal) {
        signal.removeEventListener('abort', onAbort);
      }
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      activeAIRequests++;
      resolve();
    };

    if (signal) {
      onAbort = () => {
        const idx = aiQueue.indexOf(task);
        if (idx !== -1) {
          aiQueue.splice(idx, 1);
        }
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }

    aiQueue.push(task);
  });
}

function releaseAISlot(): void {
  activeAIRequests--;
  if (aiQueue.length > 0) {
    const next = aiQueue.shift();
    next?.();
  }
}

/**
 * Fetch helper with timeout and combined AbortSignal for AI requests
 */
async function fetchWithTimeoutAI(
  url: string,
  options: RequestInit = {},
  timeoutMs = 8000,
  externalSignal?: AbortSignal
): Promise<Response> {
  if (externalSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException(`AI request timeout of ${timeoutMs}ms exceeded`, 'TimeoutError'));
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort(externalSignal?.reason || new DOMException('Aborted by user', 'AbortError'));
  };

  if (externalSignal) {
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

/**
 * Robust JSON extraction helper that safely strips markdown code blocks or conversational text.
 */
function extractJsonFromResponse(rawText: string): unknown {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // Look for first '{' and last '}'
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonSubstr = cleaned.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonSubstr);
    }
    throw new Error('No valid JSON object found in response');
  }
}

/**
 * Validates and normalizes raw JSON data from AI models against our strict schema.
 * Replaces any/unknown with typed, sanitised structures.
 */
export function validateAndNormalizeAIResponse(data: unknown, queriedWord?: string): AIEnrichmentResult | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Vietnamese definition is mandatory
  const rawVi = typeof obj.vietnameseDefinition === 'string' ? obj.vietnameseDefinition.trim() : '';
  if (!rawVi) {
    return null;
  }

  // IPA pronunciations
  const ipaUs = typeof obj.ipaUs === 'string' && obj.ipaUs.trim() ? obj.ipaUs.trim() : undefined;
  const ipaUk = typeof obj.ipaUk === 'string' && obj.ipaUk.trim() ? obj.ipaUk.trim() : undefined;

  // Collocations
  const collocations: CollocationItem[] = [];
  if (Array.isArray(obj.collocations)) {
    for (const item of obj.collocations) {
      if (item && typeof item === 'object') {
        const c = item as Record<string, unknown>;
        const phrase = typeof c.phrase === 'string' ? c.phrase.trim() : '';
        const meaningVi = typeof c.meaningVi === 'string' ? c.meaningVi.trim() : '';
        if (phrase && meaningVi) {
          collocations.push({ phrase, meaningVi });
        }
      }
    }
  }

  // Word family - never repeat queried word itself
  const wordFamily: WordFamilyItem[] = [];
  const lowerQuery = (queriedWord || '').trim().toLowerCase();
  if (Array.isArray(obj.wordFamily)) {
    for (const item of obj.wordFamily) {
      if (item && typeof item === 'object') {
        const wf = item as Record<string, unknown>;
        const word = typeof wf.word === 'string' ? wf.word.trim().toLowerCase() : '';
        const pos = typeof wf.pos === 'string' ? wf.pos.trim().toLowerCase() : 'noun';
        const meaningVi = typeof wf.meaningVi === 'string' ? wf.meaningVi.trim() : undefined;
        if (word && (!lowerQuery || word !== lowerQuery)) {
          wordFamily.push({ word, pos, meaningVi });
        }
      }
    }
  }

  // Examples
  const examples: ExampleItem[] = [];
  if (Array.isArray(obj.examples)) {
    for (const item of obj.examples) {
      if (item && typeof item === 'object') {
        const ex = item as Record<string, unknown>;
        const en = typeof ex.en === 'string' ? ex.en.trim() : '';
        const vi = typeof ex.vi === 'string' ? ex.vi.trim() : '';
        const rawCtx = typeof ex.context === 'string' ? ex.context : 'general';
        const context: 'general' | 'toeic' | 'workplace' | 'academic' =
          rawCtx === 'workplace' || rawCtx === 'toeic' || rawCtx === 'academic' || rawCtx === 'general'
            ? (rawCtx as 'general' | 'toeic' | 'workplace' | 'academic')
            : 'general';
        if (en && vi) {
          examples.push({ en, vi, context });
        }
      }
    }
  }

  // Tags
  const tags: string[] = [];
  if (Array.isArray(obj.tags)) {
    for (const t of obj.tags) {
      if (typeof t === 'string' && t.trim()) {
        const cleanTag = t.trim().startsWith('#') ? t.trim() : `#${t.trim()}`;
        if (!tags.includes(cleanTag)) {
          tags.push(cleanTag);
        }
      }
    }
  }

  // Lemma validation (Strict English morphology)
  let lemma = typeof obj.lemma === 'string' && obj.lemma.trim() ? obj.lemma.trim().toLowerCase() : undefined;
  if (lemma) {
    if (!/^[a-zA-Z]+(-[a-zA-Z]+)*$/.test(lemma) || lemma.length > 45) {
      lemma = undefined;
    } else if (SUSPICIOUS_TRUNCATED_STEMS.has(lemma)) {
      lemma = SUSPICIOUS_TRUNCATED_STEMS.get(lemma);
    }
  }

  // Part of speech from AI
  const posList: string[] = [];
  if (Array.isArray(obj.pos)) {
    for (const p of obj.pos) {
      if (typeof p === 'string' && p.trim()) {
        posList.push(p.trim().toLowerCase());
      }
    }
  } else if (typeof obj.pos === 'string' && obj.pos.trim()) {
    posList.push(obj.pos.trim().toLowerCase());
  }

  // Form labels
  const formLabels: string[] = [];
  if (Array.isArray(obj.formLabels)) {
    for (const f of obj.formLabels) {
      if (typeof f === 'string' && f.trim()) {
        formLabels.push(f.trim());
      }
    }
  }

  // Inflections
  const inflections: Array<{ form: string; label: string }> = [];
  if (Array.isArray(obj.inflections)) {
    for (const inf of obj.inflections) {
      if (inf && typeof inf === 'object') {
        const item = inf as Record<string, unknown>;
        const form = typeof item.form === 'string' ? item.form.trim() : '';
        const label = typeof item.label === 'string' ? item.label.trim() : '';
        if (form && label) {
          inflections.push({ form, label });
        }
      }
    }
  }

  return {
    ipaUs,
    ipaUk,
    vietnameseDefinition: rawVi,
    collocations,
    wordFamily,
    examples,
    tags: tags.length > 0 ? tags : ['#TOEIC', '#AIEnriched'],
    lemma,
    pos: posList.length > 0 ? posList : undefined,
    formLabels: formLabels.length > 0 ? formLabels : undefined,
    inflections: inflections.length > 0 ? inflections : undefined,
  };
}

/**
 * Format Base URL cleanly without trailing slashes.
 */
function normalizeBaseUrl(url: string): string {
  let trimmed = url.trim().replace(/\/+$/, '');
  return trimmed;
}

/**
 * Test connection to the selected AI provider.
 */
export async function testAIConnection(
  config: AIRequestConfig
): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const startTime = Date.now();
  const provider = config.provider || 'gemini';
  const providerInfo = AI_PROVIDERS[provider] || AI_PROVIDERS.gemini;
  const apiKey = config.apiKey?.trim() || '';
  const model = config.model?.trim() || providerInfo.defaultModel;
  const baseUrl = normalizeBaseUrl(config.baseUrl || providerInfo.defaultBaseUrl);

  if (provider !== 'custom' && !apiKey) {
    return {
      success: false,
      message: `Vui lòng nhập API Key cho ${providerInfo.name}!`,
    };
  }

  try {
    const testPrompt = 'Respond strictly with this JSON: {"status":"connected"}';

    if (provider === 'gemini') {
      const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetchWithTimeoutAI(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: testPrompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        },
        config.timeoutMs || 7000,
        config.signal
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errMsg = errorData.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        return { success: false, message: `Lỗi kết nối Gemini: ${errMsg}` };
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Không nhận được phản hồi từ Gemini.');
    } else if (provider === 'claude') {
      const endpoint = `${baseUrl}/messages`;
      const res = await fetchWithTimeoutAI(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model,
            max_tokens: 100,
            messages: [{ role: 'user', content: testPrompt }],
          }),
        },
        config.timeoutMs || 7000,
        config.signal
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errMsg = errorData.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        return { success: false, message: `Lỗi kết nối Claude: ${errMsg}` };
      }

      const data = await res.json();
      const text = data.content?.[0]?.text;
      if (!text) throw new Error('Không nhận được phản hồi từ Claude.');
    } else {
      // OpenAI-compatible endpoint (OpenAI, DeepSeek, Groq, OpenRouter, Custom)
      const endpoint = baseUrl.endsWith('/chat/completions')
        ? baseUrl
        : `${baseUrl}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'LexiPulse English Vocabulary';
      }

      const res = await fetchWithTimeoutAI(
        endpoint,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: testPrompt }],
            max_tokens: 50,
          }),
        },
        config.timeoutMs || 7000,
        config.signal
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errMsg = errorData.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        return { success: false, message: `Lỗi kết nối ${providerInfo.name}: ${errMsg}` };
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error(`Không nhận được phản hồi từ ${providerInfo.name}.`);
    }

    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      message: `Kết nối thành công tới ${providerInfo.name} (${model}) trong ${latencyMs}ms!`,
      latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Không thể kết nối tới máy chủ AI.',
    };
  }
}

/**
 * Enrich word definition, collocations, word family, inflections, and workplace examples via AI.
 * Context-aware and cached.
 */
export async function enrichWordWithAI(
  word: string,
  pos: string,
  config: AIRequestConfig,
  contextSentence?: string,
  userMeaning?: string
): Promise<AIEnrichmentResult | null> {
  const provider = config.provider || 'gemini';
  const providerInfo = AI_PROVIDERS[provider] || AI_PROVIDERS.gemini;
  const apiKey = config.apiKey?.trim() || '';
  const model = config.model?.trim() || providerInfo.defaultModel;
  const baseUrl = normalizeBaseUrl(config.baseUrl || providerInfo.defaultBaseUrl);

  // Require API key for cloud providers
  if (provider !== 'custom' && (!apiKey || apiKey.length < 5)) {
    return null;
  }

  // Check cache first (differentiating word, context, provider, model, pos, and endpoint)
  const cached = getCachedAIEnrichment(word, contextSentence, provider, model, pos, baseUrl);
  if (cached) {
    return cached;
  }

  const meaningPrompt = userMeaning?.trim()
    ? `\nTARGET LEARNING SENSE: "${userMeaning.trim()}".
CRITICAL SENSE REQUIREMENT:
- The user is specifically learning this vocabulary item with the meaning: "${userMeaning.trim()}".
- The "vietnameseDefinition" MUST prioritize and match this exact intended meaning. Do not replace it with an unrelated alternate sense.
- Collocations and examples should reflect this intended sense.\n`
    : '';

  const contextPrompt = contextSentence?.trim()
    ? `\nSentence context: "${contextSentence.trim()}".
CRITICAL CONTEXT REQUIREMENT:
- Determine the specific meaning and inflection form of "${word}" in this sentence.
- The "vietnameseDefinition" MUST prioritize the meaning fitting this sentence context.
- The first example in "examples" MUST be this exact sentence, with its precise Vietnamese translation preserving tense and tone.\n`
    : `\nCRITICAL REQUIREMENT:
- If "${word}" is polysemous (e.g. pool, plant, board, address), clearly number and explain its primary meanings (1. [Nghĩa 1]; 2. [Nghĩa 2]). Do not falsely claim only a single meaning exists.\n`;

  const prompt = `You are an expert English linguist and TOEIC/IELTS instructor. Analyze the English word or phrase "${word}" (primary part of speech: ${pos}).
${meaningPrompt}
${contextPrompt}
CRITICAL MORPHOLOGY REQUIREMENT:
- Determine the canonical dictionary lemma of "${word}".
- Do NOT perform naive stemming. Do NOT simply delete suffixes such as "-ing", "-ed", "-s", "-es", "-er", "-est".
- Recover the correct dictionary headword using English morphology (e.g. "postponing" -> "postpone", "making" -> "make", "running" -> "run", "studies" -> "study", "went" -> "go", "written" -> "write", "children" -> "child").
- If "${word}" is already in canonical dictionary form, set "lemma" to "${word}".
- For verbs, return the infinitive/base form without 'to'.
- For plural nouns, return singular form.
- For irregular forms, resolve the actual dictionary lemma.
- Never invent a word.
- Identify the grammatical form of "${word}" in "formLabels" (e.g. ["Hiện tại phân từ (V-ing)"] or ["Quá khứ đơn (V2)"] or ["Danh từ số nhiều"]).
- Provide an inflection overview in "inflections" (e.g. V1, V2, V3, V-ing, Plural).

CRITICAL WORD FAMILY REQUIREMENT:
- "wordFamily" must ONLY contain distinct, derived words (e.g. for "contract", word family could be "contractor", "contractual").
- Do NOT include "${word}" itself in "wordFamily".
- If no distinct derived forms exist (especially for multi-word phrases or idioms), return an empty array [].

Respond ONLY with a valid JSON object matching this exact TypeScript structure:
{
  "lemma": "base dictionary form",
  "formLabels": ["e.g. Quá khứ đơn (V2)"],
  "inflections": [
    {"form": "base_or_inflected_word", "label": "V1 / V2 / V3 / V-ing / Plural"}
  ],
  "ipaUs": "Standard US IPA pronunciation enclosed in slashes (e.g. '/wɛnt/' or '/ɡoʊ/')",
  "ipaUk": "Standard UK IPA pronunciation enclosed in slashes",
  "vietnameseDefinition": "Comprehensive, precise Vietnamese definition. If context was provided, highlight the contextual meaning first.",
  "collocations": [
    {"phrase": "common collocation 1", "meaningVi": "nghĩa tiếng Việt 1"},
    {"phrase": "workplace/TOEIC collocation 2", "meaningVi": "nghĩa tiếng Việt 2"}
  ],
  "wordFamily": [
    {"word": "derived_word_1", "pos": "noun/verb/adjective/adverb", "meaningVi": "nghĩa tiếng Việt"}
  ],
  "examples": [
    {
      "en": "Context or general English sentence.",
      "vi": "Dịch tiếng Việt chuẩn xác.",
      "context": "general"
    },
    {
      "en": "Realistic workplace or TOEIC sentence.",
      "vi": "Dịch tiếng Việt ngữ cảnh công sở.",
      "context": "toeic"
    }
  ],
  "tags": ["#TOEIC", "#Business"]
}
Do not include markdown code block fences like \`\`\`json. Return raw JSON strictly.`;

  await acquireAISlot(config.signal);
  try {
    let rawText = '';

    if (provider === 'gemini') {
      const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetchWithTimeoutAI(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        },
        config.timeoutMs || 8000,
        config.signal
      );
      if (!res.ok) return null;
      const data = await res.json();
      rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (provider === 'claude') {
      const endpoint = `${baseUrl}/messages`;
      const res = await fetchWithTimeoutAI(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
          }),
        },
        config.timeoutMs || 8000,
        config.signal
      );
      if (!res.ok) return null;
      const data = await res.json();
      rawText = data.content?.[0]?.text || '';
    } else {
      // OpenAI, DeepSeek, Groq, OpenRouter, Custom
      const endpoint = baseUrl.endsWith('/chat/completions')
        ? baseUrl
        : `${baseUrl}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'LexiPulse English Vocabulary';
      }

      const res = await fetchWithTimeoutAI(
        endpoint,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: 'You are a professional linguist and TOEIC teacher. Always respond strictly in valid JSON without markdown code block fences.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
          }),
        },
        config.timeoutMs || 8000,
        config.signal
      );
      if (!res.ok) return null;
      const data = await res.json();
      rawText = data.choices?.[0]?.message?.content || '';
    }

    if (!rawText) return null;
    const parsed = extractJsonFromResponse(rawText);
    const normalized = validateAndNormalizeAIResponse(parsed, word);
    if (normalized) {
      setCachedAIEnrichment(word, normalized, contextSentence, provider, model, pos, baseUrl);
      if (normalized.lemma) {
        setCachedMorphology(
          word,
          {
            original: word,
            lemma: normalized.lemma,
            pos,
            form: normalized.formLabels?.[0] || 'inflected',
            is_inflected: normalized.lemma.toLowerCase() !== word.toLowerCase(),
            confidence: 0.98,
            alternatives: [],
          },
          contextSentence
        );
      }
    }
    return normalized;
  } catch (err) {
    console.warn(`[AI Enrichment] ${provider} failed for "${word}":`, err);
    return null;
  } finally {
    releaseAISlot();
  }
}
