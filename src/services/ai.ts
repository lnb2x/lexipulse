import type { AIProvider, CollocationItem, ExampleItem, WordFamilyItem } from '../types/vocab';

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
 */
let activeAIRequests = 0;
const aiQueue: Array<() => void> = [];

async function acquireAISlot(): Promise<void> {
  if (activeAIRequests < 2) {
    activeAIRequests++;
    return;
  }
  return new Promise<void>((resolve) => {
    aiQueue.push(() => {
      activeAIRequests++;
      resolve();
    });
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
function extractJsonFromResponse(rawText: string): any {
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
            messages: [
              {
                role: 'system',
                content: 'You are a test assistant. Always reply strictly in raw JSON without formatting.',
              },
              { role: 'user', content: testPrompt },
            ],
            temperature: 0.1,
            max_tokens: 80,
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
      message: `Kết nối thành công với ${providerInfo.name} (${model}) trong ${latencyMs}ms!`,
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
 * Enrich word definition, collocations, word family, and workplace examples via AI.
 */
export async function enrichWordWithAI(
  word: string,
  pos: string,
  config: AIRequestConfig
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

  const prompt = `You are an expert English linguist and TOEIC/IELTS instructor. Analyze the English word or phrase "${word}" (primary part of speech: ${pos}).
Respond ONLY with a valid JSON object matching this exact TypeScript structure:
{
  "ipaUs": "Standard US IPA pronunciation enclosed in slashes (e.g. '/ˈflɔːr.əl əˈreɪndʒ.mənt/' or '/puːl/')",
  "ipaUk": "Standard UK IPA pronunciation enclosed in slashes (e.g. '/ˈflɔː.rəl əˈreɪndʒ.mənt/' or '/puːl/')",
  "vietnameseDefinition": "Comprehensive, precise Vietnamese definition. IMPORTANT: For words or phrases with multiple distinct meanings (especially polysemous words like 'pool' which means 1. hồ bơi; 2. nhóm người, lực lượng sẵn có/nhân tài; 3. quỹ chung/góp vốn; or 'plant' = 1. thực vật; 2. nhà máy; or 'board' = 1. bảng; 2. ban quản trị/hội đồng; 3. lên tàu/xe), you MUST list all major primary senses clearly numbered: '1. [Nghĩa 1]; 2. [Nghĩa 2]; 3. [Nghĩa 3 nếu có]'",
  "collocations": [
    {"phrase": "common collocation 1", "meaningVi": "nghĩa tiếng Việt 1"},
    {"phrase": "workplace/TOEIC collocation 2", "meaningVi": "nghĩa tiếng Việt 2"},
    {"phrase": "collocation 3 (illustrating second meaning if polysemous)", "meaningVi": "nghĩa tiếng Việt 3"}
  ],
  "wordFamily": [
    {"word": "derived_word_1", "pos": "noun/verb/adjective/adverb", "meaningVi": "nghĩa tiếng Việt"},
    {"word": "derived_word_2", "pos": "noun/verb/adjective/adverb", "meaningVi": "nghĩa tiếng Việt"}
  ],
  "examples": [
    {
      "en": "A clear general English sentence using '${word}'.",
      "vi": "Dịch tiếng Việt câu thông dụng.",
      "context": "general"
    },
    {
      "en": "A realistic workplace or TOEIC context sentence using '${word}' (illustrating business or talent/resource meaning if applicable).",
      "vi": "Dịch tiếng Việt câu ngữ cảnh TOEIC công sở.",
      "context": "toeic"
    }
  ],
  "tags": ["#TOEIC", "#Business", "#HighYield"]
}
Do not include markdown code block fences like \`\`\`json. Return raw JSON strictly.`;

  await acquireAISlot();
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
    return parsed;
  } catch (err) {
    console.warn(`[AI Enrichment] ${provider} failed for "${word}":`, err);
    return null;
  } finally {
    releaseAISlot();
  }
}
