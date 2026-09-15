import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  filterGroqChatModels,
  fetchLiveGroqModels,
  migrateGroqPoolConfig,
  getRecommendedGroqModelPool,
  resolveEffectiveGroqModelPool,
  getCachedGroqModels,
  saveCachedGroqModels,
  getModelCapability,
  GROQ_SEED_MODELS,
  GROQ_MODELS_CACHE_KEY,
  resetGroqModelsCacheForTesting,
  type GroqRawModel,
  type GroqModelCapability,
} from '../src/config/groqConfig';
import { AI_PROVIDERS } from '../src/services/ai';

const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};
globalThis.localStorage = mockLocalStorage as any;
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {};
}
(globalThis as any).window.localStorage = mockLocalStorage;

describe('Groq Model Registry & Filtering', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    resetGroqModelsCacheForTesting();
  });

  afterEach(() => {
    mockLocalStorage.clear();
    resetGroqModelsCacheForTesting();
    vi.restoreAllMocks();
  });

  it('filters out non-chat specialized models: whisper, guard, tts, embeddings, and inactive models', () => {
    const rawApiModels: GroqRawModel[] = [
      { id: 'whisper-large-v3', object: 'model', active: true },
      { id: 'whisper-large-v3-turbo', object: 'model', active: true },
      { id: 'distil-whisper-large-v3-en', object: 'model', active: true },
      { id: 'llama-guard-3-8b', object: 'model', active: true },
      { id: 'prompt-guard-86m', object: 'model', active: true },
      { id: 'bge-large-en-v1.5', object: 'model', active: true },
      { id: 'orpheus-tts-preview', object: 'model', active: true },
      { id: 'llama-3.2-1b-preview', object: 'model', active: false }, // inactive
      // Valid models from user Groq console
      { id: 'openai/gpt-oss-120b', object: 'model', active: true, context_window: 131072 },
      { id: 'openai/gpt-oss-20b', object: 'model', active: true, context_window: 131072 },
      { id: 'qwen/qwen3.6-27b', object: 'model', active: true, context_window: 131072 },
      { id: 'qwen/qwen3.8-27b', object: 'model', active: true, context_window: 131072 },
      { id: 'groq/compound', object: 'model', active: true, context_window: 131072 },
      { id: 'groq/compound-mini', object: 'model', active: true, context_window: 131072 },
    ];

    const filtered = filterGroqChatModels(rawApiModels);
    const filteredIds = filtered.map((m) => m.id);

    // Verify non-chat models are completely removed
    expect(filteredIds).not.toContain('whisper-large-v3');
    expect(filteredIds).not.toContain('whisper-large-v3-turbo');
    expect(filteredIds).not.toContain('distil-whisper-large-v3-en');
    expect(filteredIds).not.toContain('llama-guard-3-8b');
    expect(filteredIds).not.toContain('prompt-guard-86m');
    expect(filteredIds).not.toContain('bge-large-en-v1.5');
    expect(filteredIds).not.toContain('orpheus-tts-preview');
    expect(filteredIds).not.toContain('llama-3.2-1b-preview'); // inactive

    // Verify valid models are retained
    expect(filteredIds).toContain('openai/gpt-oss-120b');
    expect(filteredIds).toContain('openai/gpt-oss-20b');
    expect(filteredIds).toContain('qwen/qwen3.6-27b');
    expect(filteredIds).toContain('qwen/qwen3.8-27b');
    expect(filteredIds).toContain('groq/compound');
    expect(filteredIds).toContain('groq/compound-mini');
  });

  it('isolates Compound models: sets supportsJson to false', () => {
    const rawApiModels: GroqRawModel[] = [
      { id: 'groq/compound', object: 'model', active: true },
      { id: 'groq/compound-mini', object: 'model', active: true },
      { id: 'openai/gpt-oss-120b', object: 'model', active: true },
    ];

    const filtered = filterGroqChatModels(rawApiModels);
    const compound = filtered.find((m) => m.id === 'groq/compound');
    const compoundMini = filtered.find((m) => m.id === 'groq/compound-mini');
    const gptOss = filtered.find((m) => m.id === 'openai/gpt-oss-120b');

    expect(compound?.isCompound).toBe(true);
    expect(compound?.supportsJson).toBe(false);

    expect(compoundMini?.isCompound).toBe(true);
    expect(compoundMini?.supportsJson).toBe(false);

    expect(gptOss?.isCompound).toBe(false);
    expect(gptOss?.supportsJson).toBe(true);
  });

  it('getRecommendedGroqModelPool excludes Compound models and prioritizes top models', () => {
    const models: GroqModelCapability[] = [
      getModelCapability('groq/compound'),
      getModelCapability('groq/compound-mini'),
      getModelCapability('openai/gpt-oss-120b'),
      getModelCapability('openai/gpt-oss-20b'),
      getModelCapability('qwen/qwen3.6-27b'),
    ];

    const recommended = getRecommendedGroqModelPool(models);

    expect(recommended).not.toContain('groq/compound');
    expect(recommended).not.toContain('groq/compound-mini');
    expect(recommended).toContain('openai/gpt-oss-120b');
    expect(recommended).toContain('openai/gpt-oss-20b');
    expect(recommended).toContain('qwen/qwen3.6-27b');
  });
});

describe('Groq Configuration Migration', () => {
  const currentAvailableModels: GroqModelCapability[] = [
    getModelCapability('openai/gpt-oss-120b'),
    getModelCapability('openai/gpt-oss-20b'),
    getModelCapability('qwen/qwen3.6-27b'),
    getModelCapability('groq/compound'),
  ];

  it('preserves valid models and removes decommissioned models from saved pool', () => {
    // User had old models + some still-valid models in their saved pool
    const savedPool = [
      'llama-3.2-1b-preview', // deprecated/removed
      'openai/gpt-oss-120b',   // valid
      'some-ancient-model',    // deprecated/removed
      'qwen/qwen3.6-27b',      // valid
    ];

    const migration = migrateGroqPoolConfig(savedPool, currentAvailableModels);

    expect(migration.validPool).toEqual(['openai/gpt-oss-120b', 'qwen/qwen3.6-27b']);
    expect(migration.removedModels).toEqual(['llama-3.2-1b-preview', 'some-ancient-model']);
    expect(migration.needsAttention).toBe(false);
  });

  it('signals needsAttention when no valid models remain in saved pool', () => {
    const outdatedPool = ['llama-3.2-1b-preview', 'deprecated-model-xyz'];

    const migration = migrateGroqPoolConfig(outdatedPool, currentAvailableModels);

    expect(migration.validPool).toEqual([]);
    expect(migration.removedModels).toEqual(['llama-3.2-1b-preview', 'deprecated-model-xyz']);
    expect(migration.needsAttention).toBe(true);
  });

  it('resolveEffectiveGroqModelPool falls back to recommended pool if user pool is invalid', () => {
    const invalidPool = ['totally-invalid-model'];
    const effective = resolveEffectiveGroqModelPool(invalidPool, currentAvailableModels);

    expect(effective.length).toBeGreaterThan(0);
    expect(effective).toContain('openai/gpt-oss-120b');
  });
});

describe('Groq Live API Synchronization & Cache Resilience', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    resetGroqModelsCacheForTesting();
  });

  afterEach(() => {
    mockLocalStorage.clear();
    resetGroqModelsCacheForTesting();
    vi.restoreAllMocks();
  });

  it('fetches live models from GET /openai/v1/models and caches them in localStorage', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          object: 'list',
          data: [
            { id: 'openai/gpt-oss-120b', object: 'model', active: true },
            { id: 'qwen/qwen3.6-27b', object: 'model', active: true },
            { id: 'whisper-large-v3', object: 'model', active: true }, // will be filtered
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await fetchLiveGroqModels({ apiKey: 'gsk_test_key' });

    expect(result.success).toBe(true);
    expect(result.fromCache).toBe(false);
    expect(result.models.map((m) => m.id)).toEqual(['openai/gpt-oss-120b', 'qwen/qwen3.6-27b']);

    // Verify localStorage was updated
    const cachedRaw = localStorage.getItem(GROQ_MODELS_CACHE_KEY);
    expect(cachedRaw).not.toBeNull();
    const parsed = JSON.parse(cachedRaw!);
    expect(parsed.models.map((m: any) => m.id)).toContain('openai/gpt-oss-120b');
  });

  it('retains last valid cache on network error without deleting user selections', async () => {
    // Seed localStorage with valid cache
    const initialModels = [
      getModelCapability('openai/gpt-oss-120b'),
      getModelCapability('openai/gpt-oss-20b'),
    ];
    saveCachedGroqModels(initialModels);

    // Simulate network error
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch (offline)'));

    const result = await fetchLiveGroqModels({ apiKey: 'gsk_test_key' });

    expect(result.success).toBe(false);
    expect(result.fromCache).toBe(true);
    expect(result.error).toContain('Không thể kết nối tới Groq API');
    expect(result.models.map((m) => m.id)).toContain('openai/gpt-oss-120b');

    // Verify cache was NOT wiped
    const cached = getCachedGroqModels();
    expect(cached.map((m) => m.id)).toContain('openai/gpt-oss-120b');
  });

  it('retains last valid cache when API responds with 401 Invalid API Key', async () => {
    const initialModels = [getModelCapability('qwen/qwen3.6-27b')];
    saveCachedGroqModels(initialModels);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: 'Invalid API Key',
            type: 'invalid_request_error',
            code: 'invalid_api_key',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await fetchLiveGroqModels({ apiKey: 'gsk_bad_key' });

    expect(result.success).toBe(false);
    expect(result.fromCache).toBe(true);
    expect(result.error).toContain('Invalid API Key');
    expect(result.models.map((m) => m.id)).toContain('qwen/qwen3.6-27b');
  });
});

describe('Shared Data Source Consistency', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    resetGroqModelsCacheForTesting();
  });

  afterEach(() => {
    mockLocalStorage.clear();
    resetGroqModelsCacheForTesting();
  });

  it('AI_PROVIDERS.groq exposes dynamic models matching the registry', () => {
    const groqProvider = AI_PROVIDERS.groq;
    const available = getCachedGroqModels().map((m) => m.id);

    // AI_PROVIDERS.groq.models getter should match registry
    expect(groqProvider.models).toEqual(available);
    expect(available).toContain(groqProvider.defaultModel);
  });
});
