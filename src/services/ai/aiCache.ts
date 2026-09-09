import type { AIEnrichmentResult } from '../ai';

interface CacheEntry {
  result: AIEnrichmentResult;
  timestamp: number;
}

const MAX_CACHE_ENTRIES = 200;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const aiCache = new Map<string, CacheEntry>();

/**
 * Normalizes context sentence for cache key to avoid whitespace/casing noise.
 */
function normalizeContext(context?: string): string {
  if (!context || !context.trim()) return '';
  return context.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Deterministic 64-bit string hash (two 32-bit seeds) to avoid prefix truncation.
 * Even long sentences with identical 80-char prefixes will produce distinct hashes.
 */
export function hashString(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * Sanitizes base URL / endpoint:
 * Extracts scheme + host + pathname; strips all query parameters, hashes,
 * basic auth credentials, or bearer tokens to prevent leaking secrets.
 */
export function sanitizeEndpoint(baseUrl?: string): string {
  if (!baseUrl || !baseUrl.trim()) return 'default_endpoint';
  try {
    const url = new URL(baseUrl.trim());
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return baseUrl.trim().split('?')[0].split('#')[0].replace(/\/+$/, '');
  }
}

export interface AICacheKeyParams {
  word: string;
  pos?: string;
  contextSentence?: string;
  provider?: string;
  model?: string;
  baseUrl?: string;
  targetLang?: string;
  schemaVersion?: string;
}

/**
 * Builds a deterministic, safe cache key.
 * Strictly NEVER includes API keys, tokens, or query params.
 * Distinguishes: word, POS, full context hash, provider, model, sanitized endpoint, targetLang, schemaVersion.
 */
export function buildAICacheKey(params: AICacheKeyParams): string;
export function buildAICacheKey(
  word: string,
  contextSentence?: string,
  provider?: string,
  model?: string,
  pos?: string,
  baseUrl?: string,
  targetLang?: string
): string;
export function buildAICacheKey(
  wordOrParams: string | AICacheKeyParams,
  contextSentence?: string,
  provider = 'gemini',
  model = 'default',
  pos = 'any',
  baseUrl?: string,
  targetLang = 'vi'
): string {
  if (typeof wordOrParams === 'object') {
    const normWord = (wordOrParams.word || '').trim().toLowerCase();
    const normPos = (wordOrParams.pos || 'any').trim().toLowerCase();
    const normContext = normalizeContext(wordOrParams.contextSentence);
    const contextHash = normContext ? hashString(normContext) : 'none';
    const cleanEndpoint = hashString(sanitizeEndpoint(wordOrParams.baseUrl));
    const prov = wordOrParams.provider || 'gemini';
    const mod = wordOrParams.model || 'default';
    const lang = wordOrParams.targetLang || 'vi';
    const schema = wordOrParams.schemaVersion || 'v3';
    return `ai:${schema}:${prov}:${mod}:${cleanEndpoint}:${lang}:${normPos}:${normWord}:ctx_${contextHash}`;
  }

  const normWord = wordOrParams.trim().toLowerCase();
  const normContext = normalizeContext(contextSentence);
  const contextHash = normContext ? hashString(normContext) : 'none';
  const cleanEndpoint = hashString(sanitizeEndpoint(baseUrl));
  const normPos = (pos || 'any').trim().toLowerCase();
  return `ai:v3:${provider}:${model}:${cleanEndpoint}:${targetLang}:${normPos}:${normWord}:ctx_${contextHash}`;
}

/**
 * Retrieves cached AI enrichment result if valid and not expired.
 * Updates LRU position on cache hit, and returns deep clone.
 */
export function getCachedAIEnrichment(
  word: string,
  contextSentence?: string,
  provider = 'gemini',
  model = 'default',
  pos?: string,
  baseUrl?: string
): AIEnrichmentResult | null {
  const key = buildAICacheKey({
    word,
    pos,
    contextSentence,
    provider,
    model,
    baseUrl,
  });

  const entry = aiCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    aiCache.delete(key);
    return null;
  }

  // True LRU: delete and re-insert so key becomes newest
  aiCache.delete(key);
  aiCache.set(key, entry);

  // Deep clone to prevent caller mutations from poisoning cache
  return structuredClone(entry.result);
}

/**
 * Stores a validated AI result in the LRU cache.
 */
export function setCachedAIEnrichment(
  word: string,
  result: AIEnrichmentResult,
  contextSentence?: string,
  provider = 'gemini',
  model = 'default',
  pos?: string,
  baseUrl?: string
): void {
  const key = buildAICacheKey({
    word,
    pos,
    contextSentence,
    provider,
    model,
    baseUrl,
  });

  // If already exists, delete first to re-append at tail
  if (aiCache.has(key)) {
    aiCache.delete(key);
  } else if (aiCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = aiCache.keys().next().value;
    if (oldestKey) {
      aiCache.delete(oldestKey);
    }
  }

  aiCache.set(key, {
    result: structuredClone(result),
    timestamp: Date.now(),
  });
}

/**
 * Clears the AI cache (useful in testing or manual refresh)
 */
export function clearAICache(): void {
  aiCache.clear();
}
