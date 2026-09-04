import type { SpellingSuggestion, WordItem } from '../../types/vocab';

export class LRUCache<K, V> {
  private capacity: number;
  private map: Map<K, V>;

  constructor(capacity = 500) {
    this.capacity = capacity;
    this.map = new Map<K, V>();
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) {
        this.map.delete(oldest);
      }
    }
    this.map.set(key, value);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

export function normalizeWordKey(rawWord: string): string {
  return (rawWord || '').trim().toLowerCase();
}

export interface CachedTranslation {
  result: string;
  expires: number;
}

// Global bounded caches
export const WORD_LRU_CACHE = new LRUCache<string, WordItem>(500);
export const MEMORY_CACHE = WORD_LRU_CACHE;
export const TRANSLATION_CACHE = new LRUCache<string, CachedTranslation>(500);
export const SUGGESTION_CACHE = new LRUCache<string, { results: SpellingSuggestion[]; expires: number }>(300);

// In-flight deduplication maps
export const IN_FLIGHT_LOOKUPS = new Map<string, Promise<WordItem>>();
export const IN_FLIGHT_TRANSLATIONS = new Map<string, Promise<string>>();
export const IN_FLIGHT_SUGGESTIONS = new Map<string, Promise<SpellingSuggestion[]>>();

/**
 * Pre-cache words in memory for instantaneous search responses
 */
export function warmSearchCache(words: WordItem[]) {
  for (const w of words) {
    if (w?.word) {
      WORD_LRU_CACHE.set(normalizeWordKey(w.word), w);
    }
  }
}
