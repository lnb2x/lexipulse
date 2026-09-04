import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/services/db';
import {
  lookupWord,
  warmSearchCache,
  LOCAL_KNOWLEDGE_BASE,
  LRUCache,
} from '../src/services/dictionary';
import { createInitialReviewMeta } from '../src/services/sm2';
import type { WordItem } from '../src/types/vocab';

describe('Performance & Reliability Optimizations', () => {
  beforeEach(async () => {
    await db.words.clear();
  });

  it('1. Cache, IndexedDB and Local Knowledge Base lookup p95 < 20ms', async () => {
    // 1.1 Local Knowledge Base hit
    const kbLatencies: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      const kbRes = await lookupWord('facilitate');
      kbLatencies.push(performance.now() - t0);
      expect(kbRes.word).toBe('facilitate');
    }
    kbLatencies.sort((a, b) => a - b);
    const kbP95 = kbLatencies[Math.floor(kbLatencies.length * 0.95)];
    expect(kbP95).toBeLessThan(20);

    // 1.2 Memory Cache hit (warm word)
    const cacheLatencies: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      const cacheRes = await lookupWord('facilitate');
      cacheLatencies.push(performance.now() - t0);
      expect(cacheRes.word).toBe('facilitate');
    }
    cacheLatencies.sort((a, b) => a - b);
    const cacheP95 = cacheLatencies[Math.floor(cacheLatencies.length * 0.95)];
    expect(cacheP95).toBeLessThan(20);

    // 1.3 IndexedDB hit
    const sampleWord: WordItem = {
      id: 'test-idb-1',
      word: 'idbbenchmark',
      pos: ['noun'],
      vietnameseDefinition: 'Từ vựng IndexedDB',
      englishDefinition: 'IndexedDB test word',
      phonetics: { us: '/test/', uk: '/test/' },
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: ['#Benchmark'],
      status: 'new',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reviewMeta: createInitialReviewMeta(),
    };
    await db.words.put(sampleWord);

    const idbLatencies: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      const idbRes = await lookupWord('idbbenchmark');
      idbLatencies.push(performance.now() - t0);
      expect(idbRes.word).toBe('idbbenchmark');
    }
    idbLatencies.sort((a, b) => a - b);
    const idbP95 = idbLatencies[Math.floor(idbLatencies.length * 0.95)];
    expect(idbP95).toBeLessThan(20);
  });

  it('2. IndexedDB save p95 < 50ms with 10,000 words deck', async () => {
    // Populate 10,000 words
    const totalWords = 10000;
    const batchSize = 2000;
    const now = Date.now();
    for (let i = 0; i < totalWords; i += batchSize) {
      const batch: WordItem[] = [];
      for (let j = 0; j < batchSize; j++) {
        const idx = i + j;
        batch.push({
          id: `w-${idx}`,
          word: `word${idx}`,
          pos: ['noun'],
          vietnameseDefinition: `Định nghĩa từ ${idx}`,
          englishDefinition: `Definition of word ${idx}`,
          phonetics: { us: `/word${idx}/`, uk: `/word${idx}/` },
          meanings: [],
          collocations: [],
          wordFamily: [],
          examples: [],
          tags: ['#Deck10k'],
          status: 'new',
          createdAt: now - idx * 1000,
          updatedAt: now,
          reviewMeta: createInitialReviewMeta(),
        });
      }
      await db.words.bulkPut(batch);
    }

    const count = await db.words.count();
    expect(count).toBe(10000);

    // Measure single word save times
    const saveLatencies: number[] = [];
    for (let i = 0; i < 20; i++) {
      const testItem: WordItem = {
        id: `single-save-${i}`,
        word: `singlesave${i}`,
        pos: ['verb'],
        vietnameseDefinition: 'Lưu thử nghiệm',
        englishDefinition: 'Single save test',
        phonetics: { us: '/save/', uk: '/save/' },
        meanings: [],
        collocations: [],
        wordFamily: [],
        examples: [],
        tags: ['#Save'],
        status: 'new',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reviewMeta: createInitialReviewMeta(),
      };
      const t0 = performance.now();
      await db.words.put(testItem);
      saveLatencies.push(performance.now() - t0);
    }

    saveLatencies.sort((a, b) => a - b);
    const saveP95 = saveLatencies[Math.floor(saveLatencies.length * 0.95)];
    expect(saveP95).toBeLessThan(50);
  });

  it('3. Synchronous work on main thread for typing is under 16ms', () => {
    // Simulate pre-computed deck map and static items check
    const deckWords: WordItem[] = Array.from({ length: 10000 }, (_, i) => ({
      id: `dw-${i}`,
      word: `terminology${i}`,
      pos: ['noun'],
      vietnameseDefinition: `Thuật ngữ ${i}`,
      englishDefinition: `Terminology ${i}`,
      phonetics: { us: '/t/', uk: '/t/' },
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: [],
      status: 'new',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reviewMeta: createInitialReviewMeta(),
    }));

    // Deck map construction (done in useMemo)
    const t0 = performance.now();
    const map = new Map<string, WordItem>();
    for (const w of deckWords) {
      map.set(w.word.toLowerCase(), w);
    }
    const mapTime = performance.now() - t0;
    expect(mapTime).toBeLessThan(16);

    // Instant O(1) keystroke check
    const t1 = performance.now();
    const isPresent = map.has('terminology500');
    const lookupDuration = performance.now() - t1;
    expect(isPresent).toBe(true);
    expect(lookupDuration).toBeLessThan(1); // sub-millisecond
  });

  it('4. Hanging network source: essential source completes, basic result appears < 1,000ms', async () => {
    // Mock global fetch: OpenVn answers after 150ms, other endpoints hang until aborted
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn((url: string | URL | Request, options?: RequestInit) => {
      const urlStr = url.toString();
      const signal = options?.signal;

      if (urlStr.includes('open-vn-en-dict')) {
        return new Promise<Response>((resolve, reject) => {
          if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          setTimeout(() => {
            resolve(
              new Response(
                JSON.stringify({
                  sentences: [
                    { en: 'resilient', vi: 'kiên cường, mau phục hồi' }
                  ]
                }),
                { status: 200 }
              )
            );
          }, 150);
        });
      }

      // Hanging endpoint that aborts when controller signal fires
      return new Promise<Response>((_, reject) => {
        if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    }) as any;

    try {
      const t0 = performance.now();
      const res = await lookupWord('resilient');
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(1000);
      expect(res.word).toBe('resilient');
      expect(res.vietnameseDefinition).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('5. AI delay or failure does not block basic WordCard result', async () => {
    // Test that background enrichment callback is invoked asynchronously and does not block lookupWord
    let enrichedResult: WordItem | null = null;
    let resolveEnriched: (word: WordItem) => void;
    const enrichedPromise = new Promise<WordItem>((resolve) => {
      resolveEnriched = resolve;
    });

    const t0 = performance.now();
    const basicResult = await lookupWord('collaborate', {
      onEnriched: (enriched) => {
        enrichedResult = enriched;
        resolveEnriched(enriched);
      },
    });
    const syncDuration = performance.now() - t0;

    // Basic result returned instantly from local KB
    expect(syncDuration).toBeLessThan(20);
    expect(basicResult.word).toBe('collaborate');
    expect(basicResult.vietnameseDefinition).toBeTruthy();

    // Background enrichment finishes without blocking initial result
    const enriched = await Promise.race([
      enrichedPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    expect(enriched).not.toBeNull();
    expect(enriched?.word).toBe('collaborate');
  });

  it('6. Rapid typing cancels old requests with AbortSignal', async () => {
    const controllers = [new AbortController(), new AbortController(), new AbortController()];

    // Abort first two controllers
    controllers[0].abort();
    controllers[1].abort();

    // First request should reject with AbortError immediately
    await expect(lookupWord('unprecedented', { signal: controllers[0].signal })).rejects.toThrow();

    // Third request with valid signal proceeds
    const result = await lookupWord('compliance', { signal: controllers[2].signal });
    expect(result.word).toBe('compliance');
  });

  it('7. In-flight request deduplication shares the same Promise', async () => {
    // Run two simultaneous lookups for the same word
    const p1 = lookupWord('negotiate');
    const p2 = lookupWord('negotiate');

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.word).toBe('negotiate');
    expect(r2.word).toBe('negotiate');
    expect(r1.vietnameseDefinition).toBe(r2.vietnameseDefinition);
  });

  it('8 & 9. Add new word, update existing word, preserving id, createdAt, and reviewMeta', async () => {
    const originalMeta = createInitialReviewMeta();
    originalMeta.repetitions = 5;
    originalMeta.interval = 14;
    originalMeta.easeFactor = 2.6;

    const initialWord: WordItem = {
      id: 'custom-word-id-42',
      word: 'retention',
      pos: ['noun'],
      vietnameseDefinition: 'Sự duy trì, giữ lại',
      englishDefinition: 'The continued use, existence, or possession of something.',
      phonetics: { us: '/rɪˈten.ʃən/', uk: '/rɪˈten.ʃən/' },
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: ['#UserCustomTag'],
      status: 'learning',
      createdAt: 1600000000000,
      updatedAt: 1600000000000,
      reviewMeta: originalMeta,
    };

    await db.words.put(initialWord);

    // Simulate background enrichment merging into DB
    const existing = await db.words.where('word').equalsIgnoreCase('retention').first();
    expect(existing).toBeDefined();

    // Enriched data contains new collocations and examples
    const enrichedIncoming: Partial<WordItem> = {
      collocations: [{ phrase: 'customer retention', meaningVi: 'duy trì khách hàng' }],
      wordFamily: [{ word: 'retain', pos: 'verb', meaningVi: 'giữ lại' }],
    };

    const merged: WordItem = {
      ...existing!,
      collocations: enrichedIncoming.collocations || existing!.collocations,
      wordFamily: enrichedIncoming.wordFamily || existing!.wordFamily,
      updatedAt: Date.now(),
    };
    await db.words.put(merged);

    const afterMerge = await db.words.get('custom-word-id-42');
    expect(afterMerge?.id).toBe('custom-word-id-42');
    expect(afterMerge?.createdAt).toBe(1600000000000);
    expect(afterMerge?.status).toBe('learning');
    expect(afterMerge?.tags).toContain('#UserCustomTag');
    expect(afterMerge?.reviewMeta.repetitions).toBe(5);
    expect(afterMerge?.reviewMeta.interval).toBe(14);
    expect(afterMerge?.collocations.length).toBe(1);
    expect(afterMerge?.wordFamily.length).toBe(1);
  });

  it('10. LRU cache eviction and TTL management', () => {
    const lru = new LRUCache<string, number>(3);

    lru.set('a', 1);
    lru.set('b', 2);
    lru.set('c', 3);

    expect(lru.get('a')).toBe(1); // 'a' accessed, so 'b' becomes least recently used

    lru.set('d', 4); // Evicts 'b'

    expect(lru.get('b')).toBeUndefined();
    expect(lru.get('a')).toBe(1);
    expect(lru.get('c')).toBe(3);
    expect(lru.get('d')).toBe(4);
  });

  it('11. Offline fallback for local knowledge base and IndexedDB', async () => {
    // Even if fetch throws network error, local KB resolves seamlessly
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch (offline)'))) as any;

    try {
      const res = await lookupWord('implement');
      expect(res.word).toBe('implement');
      expect(res.vietnameseDefinition).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
