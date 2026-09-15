/**
 * Groq Model Registry & Dynamic Multi-Model Pool Configuration
 * Connects directly to GET https://api.groq.com/openai/v1/models using the user's API Key.
 * Filters out non-chat / specialized models (Whisper STT, Orpheus/TTS, Guard, Prompt Guard, Embeddings).
 * Accurately analyzes capability constraints (JSON mode, tools, vision, context window).
 * Isolates Compound models which do not support OpenAI JSON mode.
 * Provides caching, fallback resilience, and safe configuration migration.
 */

export interface GroqModelCapability {
  id: string;
  displayName: string;
  contextWindow: number;
  supportsJson: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  description: string;
  tier: 'production' | 'preview' | 'community' | 'compound' | 'custom';
  isCompound?: boolean;
  active?: boolean;
  ownedBy?: string;
}

export interface GroqRawModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  active?: boolean;
  context_window?: number;
}

/**
 * Current seed models matching official Groq Console reference models.
 * Used as high-quality initial seed when offline or prior to first live API synchronization.
 */
export const GROQ_SEED_MODELS: Record<string, GroqModelCapability> = {
  'openai/gpt-oss-120b': {
    id: 'openai/gpt-oss-120b',
    displayName: 'GPT OSS 120B (OpenAI)',
    contextWindow: 131072,
    supportsJson: true,
    supportsTools: true,
    supportsVision: false,
    description: 'Model mã nguồn mở cỡ lớn của OpenAI trên Groq, tối ưu cho suy luận phức tạp và xử lý đa tác vụ.',
    tier: 'production',
    isCompound: false,
  },
  'openai/gpt-oss-20b': {
    id: 'openai/gpt-oss-20b',
    displayName: 'GPT OSS 20B (OpenAI)',
    contextWindow: 131072,
    supportsJson: true,
    supportsTools: true,
    supportsVision: false,
    description: 'Model OpenAI hiệu năng cao, cân bằng hoàn hảo giữa tốc độ cực nhanh và độ chính xác ngôn ngữ.',
    tier: 'production',
    isCompound: false,
  },
  'qwen/qwen3.6-27b': {
    id: 'qwen/qwen3.6-27b',
    displayName: 'Qwen 3.6 27B',
    contextWindow: 131072,
    supportsJson: true,
    supportsTools: true,
    supportsVision: false,
    description: 'Thế hệ Qwen 3.6 tối ưu suy luận đa ngữ, phân tích từ vựng và ngữ cảnh ngữ nghĩa sâu sắc.',
    tier: 'production',
    isCompound: false,
  },
  'qwen/qwen3.8-27b': {
    id: 'qwen/qwen3.8-27b',
    displayName: 'Qwen 3.8 27B',
    contextWindow: 131072,
    supportsJson: true,
    supportsTools: true,
    supportsVision: false,
    description: 'Phiên bản Qwen 3.8 nâng cấp năng lực dịch thuật, định dạng JSON và trích xuất cấu trúc.',
    tier: 'production',
    isCompound: false,
  },
  'groq/compound': {
    id: 'groq/compound',
    displayName: 'Compound (Agentic AI)',
    contextWindow: 131072,
    supportsJson: false, // Groq Compound agentic models do not support response_format: json_object
    supportsTools: true,
    supportsVision: false,
    description: 'Hệ thống AI đa tác tử tích hợp công cụ (Web search, Code execution). Không hỗ trợ JSON mode của LexiPulse.',
    tier: 'compound',
    isCompound: true,
  },
  'groq/compound-mini': {
    id: 'groq/compound-mini',
    displayName: 'Compound Mini (Agentic AI)',
    contextWindow: 131072,
    supportsJson: false, // Groq Compound agentic models do not support response_format: json_object
    supportsTools: true,
    supportsVision: false,
    description: 'Phiên bản Compound gọn nhẹ cho luồng tra cứu nhanh. Không hỗ trợ JSON mode của LexiPulse.',
    tier: 'compound',
    isCompound: true,
  },
  'llama-3.3-70b-versatile': {
    id: 'llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B Versatile',
    contextWindow: 131072,
    supportsJson: true,
    supportsTools: true,
    supportsVision: false,
    description: 'Model mạnh mẽ của Meta cho suy luận, ngữ nghĩa và ngôn ngữ học thuật.',
    tier: 'production',
    isCompound: false,
  },
  'llama-3.1-8b-instant': {
    id: 'llama-3.1-8b-instant',
    displayName: 'Llama 3.1 8B Instant',
    contextWindow: 131072,
    supportsJson: true,
    supportsTools: true,
    supportsVision: false,
    description: 'Tốc độ cực nhanh (>750 tokens/s) với chi phí thấp và giới hạn RPM cao.',
    tier: 'production',
    isCompound: false,
  },
  'mixtral-8x7b-32768': {
    id: 'mixtral-8x7b-32768',
    displayName: 'Mixtral 8x7B (MoE 32k)',
    contextWindow: 32768,
    supportsJson: true,
    supportsTools: false,
    supportsVision: false,
    description: 'Kiến trúc Mixture of Experts của Mistral AI cho dịch thuật và phân tích đa ngữ.',
    tier: 'production',
    isCompound: false,
  },
  'llama-3.2-11b-vision-preview': {
    id: 'llama-3.2-11b-vision-preview',
    displayName: 'Llama 3.2 11B Vision',
    contextWindow: 131072,
    supportsJson: true,
    supportsTools: true,
    supportsVision: true,
    description: 'Model đa phương thức hỗ trợ nhận diện hình ảnh và văn bản.',
    tier: 'preview',
    isCompound: false,
  },
};

/**
 * Storage key for persisting live fetched Groq models cache
 */
export const GROQ_MODELS_CACHE_KEY = 'lexipulse_groq_models_cache_v2';

export interface GroqModelsCachePayload {
  timestamp: number;
  models: GroqModelCapability[];
  rawCount: number;
}

/**
 * In-memory cache map for fast runtime synchronous access
 */
let inMemoryModelsCache: Map<string, GroqModelCapability> | null = null;

/**
 * Checks if a model is a specialized non-chat model that must be excluded from the chat/JSON pool.
 * Specifically filters out:
 * - Speech-to-text / Audio (whisper-*, distil-whisper-*)
 * - Text-to-speech (orpheus, tts, speech)
 * - Moderation / Safeguard / Prompt Guard (llama-guard-*, prompt-guard-*)
 * - Embeddings (bge-*, embed-*)
 */
export function isSpecializedNonChatModel(id: string, ownedBy?: string): boolean {
  const lower = id.toLowerCase().trim();
  const ownerLower = (ownedBy || '').toLowerCase().trim();

  // 1. Audio / Speech-to-text / Text-to-speech
  if (
    lower.includes('whisper') ||
    lower.includes('audio') ||
    lower.includes('tts') ||
    lower.includes('stt') ||
    lower.includes('orpheus') ||
    ownerLower.includes('whisper')
  ) {
    return true;
  }

  // 2. Safeguard / Content Moderation / Prompt Guard
  if (
    lower.includes('guard') ||
    lower.includes('safeguard') ||
    lower.includes('moderation') ||
    lower.includes('prompt-guard')
  ) {
    return true;
  }

  // 3. Embeddings / Vector models
  if (
    lower.includes('embed') ||
    lower.includes('bge') ||
    lower.includes('similarity')
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if a model belongs to the Groq Compound agentic family.
 */
export function isCompoundModel(id: string): boolean {
  const lower = id.toLowerCase().trim();
  return lower.includes('compound') || lower.startsWith('groq/compound');
}

/**
 * Derives a clean, human-friendly display name from a raw model ID.
 */
export function formatModelDisplayName(id: string): string {
  if (GROQ_SEED_MODELS[id]?.displayName) {
    return GROQ_SEED_MODELS[id].displayName;
  }

  const parts = id.split('/');
  const rawName = parts[parts.length - 1];
  const org = parts.length > 1 ? parts[0].toUpperCase() : '';

  const cleaned = rawName
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return org ? `${cleaned} (${org})` : cleaned;
}

/**
 * Derives appropriate capabilities for an unknown model returned from Groq API.
 */
export function deriveModelCapability(raw: GroqRawModel): GroqModelCapability {
  const id = raw.id;
  if (GROQ_SEED_MODELS[id]) {
    return {
      ...GROQ_SEED_MODELS[id],
      isCompound: Boolean(GROQ_SEED_MODELS[id].isCompound),
      active: raw.active !== false,
      ownedBy: raw.owned_by,
    };
  }

  const lower = id.toLowerCase();
  const isComp = isCompoundModel(id);
  const supportsVision = lower.includes('vision') || lower.includes('-vl') || lower.includes('omni');

  let contextWindow = raw.context_window || 131072;
  if (!raw.context_window) {
    if (lower.includes('32k') || lower.includes('32768')) contextWindow = 32768;
    else if (lower.includes('8k') || lower.includes('8192')) contextWindow = 8192;
    else if (lower.includes('16k')) contextWindow = 16384;
  }

  let tier: GroqModelCapability['tier'] = 'production';
  if (isComp) tier = 'compound';
  else if (lower.includes('preview')) tier = 'preview';
  else if (lower.includes('community')) tier = 'community';

  return {
    id,
    displayName: formatModelDisplayName(id),
    contextWindow,
    supportsJson: !isComp, // Compound agentic models do not support OpenAI JSON mode
    supportsTools: true,
    supportsVision,
    description: isComp
      ? 'Hệ thống Groq Compound Agentic AI. Không hỗ trợ response_format: json_object.'
      : `Model ${id} trên hạ tầng LPU Groq.`,
    tier,
    isCompound: Boolean(isComp),
    active: raw.active !== false,
    ownedBy: raw.owned_by,
  };
}

/**
 * Filters and validates raw models from GET /openai/v1/models response:
 * - Drops inactive models
 * - Drops specialized non-chat models (audio, guard, embeddings)
 * - Identifies Compound models and disables JSON mode compatibility for them
 */
export function filterGroqChatModels(rawModels: GroqRawModel[]): GroqModelCapability[] {
  if (!Array.isArray(rawModels)) return [];

  const capabilities: GroqModelCapability[] = [];

  for (const raw of rawModels) {
    if (!raw || typeof raw.id !== 'string') continue;
    const id = raw.id.trim();
    if (!id) continue;

    // Filter out deactivated models
    if (raw.active === false) continue;

    // Filter out specialized non-chat models
    if (isSpecializedNonChatModel(id, raw.owned_by)) continue;

    const cap = deriveModelCapability(raw);
    capabilities.push(cap);
  }

  // Sort: Production & non-compound first, then by display name
  return capabilities.sort((a, b) => {
    if (a.isCompound && !b.isCompound) return 1;
    if (!a.isCompound && b.isCompound) return -1;
    if (a.tier === 'production' && b.tier !== 'production') return -1;
    if (a.tier !== 'production' && b.tier === 'production') return 1;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Loads cached models from localStorage or returns seed models.
 */
export function getCachedGroqModels(): GroqModelCapability[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(GROQ_MODELS_CACHE_KEY);
      if (raw) {
        const parsed: GroqModelsCachePayload = JSON.parse(raw);
        if (Array.isArray(parsed.models) && parsed.models.length > 0) {
          return parsed.models;
        }
      }
    } catch {
      // Ignore localStorage parse error
    }
  }

  return Object.values(GROQ_SEED_MODELS);
}

/**
 * Saves fetched models to localStorage and updates in-memory cache.
 */
export function saveCachedGroqModels(models: GroqModelCapability[], rawCount = models.length): void {
  inMemoryModelsCache = new Map(models.map((m) => [m.id, m]));

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const payload: GroqModelsCachePayload = {
        timestamp: Date.now(),
        models,
        rawCount,
      };
      localStorage.setItem(GROQ_MODELS_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage write quota error
    }
  }
}

/**
 * Resets in-memory cache to force reloading from storage or seed (used in tests).
 */
export function resetGroqModelsCacheForTesting(): void {
  inMemoryModelsCache = null;
}

/**
 * Returns available Groq models map for fast lookups.
 */
export function getCachedGroqModelsMap(): Record<string, GroqModelCapability> {
  if (!inMemoryModelsCache) {
    const cachedList = getCachedGroqModels();
    inMemoryModelsCache = new Map(cachedList.map((m) => [m.id, m]));
    // Ensure all seed models exist as base fallback
    for (const [id, seed] of Object.entries(GROQ_SEED_MODELS)) {
      if (!inMemoryModelsCache.has(id)) {
        inMemoryModelsCache.set(id, seed);
      }
    }
  }

  const res: Record<string, GroqModelCapability> = {};
  for (const [id, cap] of inMemoryModelsCache.entries()) {
    res[id] = cap;
  }
  return res;
}

/**
 * Retrieves the capability descriptor for any given model ID.
 */
export function getModelCapability(id: string): GroqModelCapability {
  const map = getCachedGroqModelsMap();
  if (map[id]) return map[id];

  if (GROQ_SEED_MODELS[id]) return GROQ_SEED_MODELS[id];

  return deriveModelCapability({ id, active: true });
}

/**
 * Gets all currently available Groq chat models from cache / seed.
 */
export function getAvailableGroqModels(): GroqModelCapability[] {
  const map = getCachedGroqModelsMap();
  return Object.values(map);
}

/**
 * Fetches live active models from GET https://api.groq.com/openai/v1/models.
 * Uses the user's configured API Key and optional baseUrl.
 *
 * Resilience policy:
 * - If successful: updates cache, updates in-memory registry, returns fresh models.
 * - If failed: preserves existing valid cache, reports clear human-readable error, DOES NOT wipe saved data.
 */
export interface FetchLiveGroqModelsOptions {
  apiKey?: string;
  baseUrl?: string;
  signal?: AbortSignal;
}

export interface FetchLiveGroqModelsResult {
  success: boolean;
  models: GroqModelCapability[];
  error?: string;
  fromCache: boolean;
  timestamp: number;
}

export async function fetchLiveGroqModels(
  options: FetchLiveGroqModelsOptions
): Promise<FetchLiveGroqModelsResult> {
  const cleanKey = (options.apiKey || '').trim();
  const currentCached = getAvailableGroqModels();

  if (!cleanKey) {
    return {
      success: false,
      models: currentCached,
      error: 'Vui lòng nhập Groq API Key để làm mới danh sách model từ tài khoản của bạn.',
      fromCache: true,
      timestamp: Date.now(),
    };
  }

  const base = (options.baseUrl || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
  const endpoint = base.endsWith('/models') ? base : `${base}/models`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
      },
      signal: options.signal,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      return {
        success: false,
        models: currentCached,
        error: `Lỗi kết nối Groq API: ${msg}. Đang giữ danh sách model đã lưu gần nhất.`,
        fromCache: true,
        timestamp: Date.now(),
      };
    }

    const data = await res.json();
    const rawList: GroqRawModel[] = Array.isArray(data.data) ? data.data : [];

    const filtered = filterGroqChatModels(rawList);

    if (filtered.length === 0) {
      return {
        success: false,
        models: currentCached,
        error: 'API Groq không trả về model chat hợp lệ nào. Đang giữ danh sách gần nhất.',
        fromCache: true,
        timestamp: Date.now(),
      };
    }

    // Save newly verified models into cache
    saveCachedGroqModels(filtered, rawList.length);

    return {
      success: true,
      models: filtered,
      fromCache: false,
      timestamp: Date.now(),
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err;
    }
    return {
      success: false,
      models: currentCached,
      error: `Không thể kết nối tới Groq API (${err.message || 'Lỗi mạng'}). Đang giữ danh sách model gần nhất.`,
      fromCache: true,
      timestamp: Date.now(),
    };
  }
}

/**
 * Migration helper for saved configurations:
 * - Retains models that are still valid.
 * - Flags and removes deprecated / unavailable models from the active execution pool.
 * - Alerts when no valid models remain.
 */
export interface GroqPoolMigrationResult {
  validPool: string[];
  removedModels: string[];
  needsAttention: boolean;
}

export function migrateGroqPoolConfig(
  savedPool: string[] | undefined,
  availableModels: GroqModelCapability[] = getAvailableGroqModels()
): GroqPoolMigrationResult {
  const availableIds = new Set(availableModels.map((m) => m.id));
  const rawPool = Array.isArray(savedPool) ? savedPool : [];

  const validPool: string[] = [];
  const removedModels: string[] = [];

  for (const item of rawPool) {
    const trimmed = (item || '').trim();
    if (!trimmed) continue;

    if (availableIds.has(trimmed)) {
      if (!validPool.includes(trimmed)) {
        validPool.push(trimmed);
      }
    } else {
      if (!removedModels.includes(trimmed)) {
        removedModels.push(trimmed);
      }
    }
  }

  return {
    validPool,
    removedModels,
    needsAttention: validPool.length === 0,
  };
}

/**
 * Selects recommended default models from the currently available models.
 * Excludes Compound models (which do not support JSON mode).
 * Prioritizes high capability and fast inference.
 */
export function getRecommendedGroqModelPool(
  availableModels: GroqModelCapability[] = getAvailableGroqModels()
): string[] {
  // Only select models that support JSON mode and are not Compound
  const eligible = availableModels.filter((m) => m.supportsJson && !m.isCompound);

  if (eligible.length === 0) {
    // If no strict json models found, take any non-compound model
    const nonCompound = availableModels.filter((m) => !m.isCompound);
    return nonCompound.slice(0, 2).map((m) => m.id);
  }

  // Preferred priority list based on user's Groq Console models and fast production models
  const priorityOrder = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.6-27b',
    'qwen/qwen3.8-27b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
  ];

  const selected: string[] = [];
  const eligibleMap = new Map(eligible.map((m) => [m.id, m]));

  for (const pref of priorityOrder) {
    if (eligibleMap.has(pref)) {
      selected.push(pref);
      if (selected.length >= 3) break;
    }
  }

  if (selected.length > 0) {
    return selected;
  }

  // Fallback: take top 3 eligible models
  return eligible.slice(0, 3).map((m) => m.id);
}

/**
 * Backward-compatible dynamic proxy for GROQ_KNOWN_MODELS.
 * Ensures any code accessing GROQ_KNOWN_MODELS[id] works seamlessly for both seed and live-fetched models.
 */
export const GROQ_KNOWN_MODELS: Record<string, GroqModelCapability> = new Proxy(
  GROQ_SEED_MODELS,
  {
    get(target, prop: string) {
      if (typeof prop !== 'string') return Reflect.get(target, prop);
      const dynamicMap = getCachedGroqModelsMap();
      if (dynamicMap[prop]) return dynamicMap[prop];
      if (target[prop]) return target[prop];
      return getModelCapability(prop);
    },
    has(target, prop: string) {
      if (typeof prop !== 'string') return Reflect.has(target, prop);
      const dynamicMap = getCachedGroqModelsMap();
      return Boolean(dynamicMap[prop] || target[prop] || getModelCapability(prop));
    },
    ownKeys(target) {
      const dynamicMap = getCachedGroqModelsMap();
      return Array.from(new Set([...Object.keys(target), ...Object.keys(dynamicMap)]));
    },
    getOwnPropertyDescriptor(target, prop: string) {
      const dynamicMap = getCachedGroqModelsMap();
      const val = dynamicMap[prop] || target[prop] || getModelCapability(prop);
      if (val) {
        return { value: val, enumerable: true, configurable: true };
      }
      return undefined;
    },
  }
);

/**
 * Default model pool when no custom pool is configured.
 * Dynamically resolves from available models rather than static hardcoding.
 */
export const DEFAULT_GROQ_MODEL_POOL: readonly string[] = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
];

/**
 * Parse environment variable or configuration string into valid model IDs.
 */
export function parseModelPoolString(poolStr?: string, availableModels?: GroqModelCapability[]): string[] {
  if (!poolStr || typeof poolStr !== 'string') return [];
  const models = availableModels || getAvailableGroqModels();
  const validSet = new Set(models.map((m) => m.id));

  return poolStr
    .split(/[,;\s]+/)
    .map((m) => m.trim())
    .filter((m) => Boolean(m) && validSet.has(m));
}

/**
 * Get configured model pool from environment variable VITE_GROQ_MODELS.
 */
export function getEnvGroqModelPool(): string[] {
  try {
    const envVal = import.meta.env?.VITE_GROQ_MODELS;
    if (envVal) {
      return parseModelPoolString(envVal);
    }
  } catch {
    // In environments where import.meta.env is undefined
  }
  return [];
}

/**
 * Resolve the effective active model pool.
 * Priority:
 * 1. Explicit userConfiguredPool (if valid models exist)
 * 2. Environment variable VITE_GROQ_MODELS (if valid models exist)
 * 3. Recommended pool dynamically selected from currently available models
 */
export function resolveEffectiveGroqModelPool(
  userConfiguredPool?: string[],
  availableModels: GroqModelCapability[] = getAvailableGroqModels()
): string[] {
  const availableSet = new Set(availableModels.map((m) => m.id));

  if (Array.isArray(userConfiguredPool) && userConfiguredPool.length > 0) {
    const valid = userConfiguredPool
      .map((id) => (id || '').trim())
      .filter((id) => Boolean(id) && availableSet.has(id));
    if (valid.length > 0) {
      return Array.from(new Set(valid));
    }
  }

  const envPool = getEnvGroqModelPool();
  if (envPool.length > 0) {
    const validEnv = envPool.filter((id) => availableSet.has(id));
    if (validEnv.length > 0) {
      return Array.from(new Set(validEnv));
    }
  }

  return getRecommendedGroqModelPool(availableModels);
}
