import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/services/db';
import { runBulkEnrichment, type BulkEnrichProgress } from '../src/services/bulkEnrichment';
import type { ParsedImportItem } from '../src/utils/importParser';

describe('Phase 2: Bounded Bulk Enrichment Service', () => {
  beforeEach(async () => {
    await db.words.clear();
  });

  it('1. Lookup failure leaves fields empty and DOES NOT create fake IPA or fake examples', async () => {
    const items: ParsedImportItem[] = [
      { rawWord: 'nonexistentwordxyz', word: 'nonexistentwordxyz', userMeaning: 'chưa biết' },
    ];

    // Mock lookup function that fails
    const mockLookup = vi.fn().mockRejectedValue(new Error('Word not found'));

    const abortController = new AbortController();
    const result = await runBulkEnrichment(items, {
      lookupFn: mockLookup,
      concurrency: 3,
      timeoutMs: 1000,
      abortSignal: abortController.signal,
      tags: ['#BulkTest'],
    });

    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(0);

    const stored = await db.words.where('word').equals('nonexistentwordxyz').first();
    expect(stored).toBeDefined();
    expect(stored!.vietnameseDefinition).toBe('chưa biết');
    expect(stored!.englishDefinition).toBe(''); // Clean empty, no fake definition
    expect(stored!.phonetics.us).toBeUndefined(); // No fake /nonexistentwordxyz/
    expect(stored!.phonetics.uk).toBeUndefined();
    expect(stored!.collocations.length).toBe(0); // No fake collocations
    expect(stored!.examples.length).toBe(0); // No fake examples
    expect(stored!.enrichmentStatus).toBe('failed');
  });

  it('2. Enforces bounded concurrency (max 3 concurrent in-flight requests)', async () => {
    let currentInFlight = 0;
    let maxInFlight = 0;

    const mockLookup = vi.fn().mockImplementation(async () => {
      currentInFlight++;
      maxInFlight = Math.max(maxInFlight, currentInFlight);
      await new Promise((resolve) => setTimeout(resolve, 50));
      currentInFlight--;
      return {
        word: 'test',
        phonetics: { us: '/tɛst/' },
        pos: ['noun'],
        vietnameseDefinition: 'kiểm tra',
        englishDefinition: 'a procedure intended to establish quality',
        meanings: [],
        collocations: [],
        wordFamily: [],
        examples: [],
        tags: [],
        source: 'online' as const,
      };
    });

    const items: ParsedImportItem[] = Array.from({ length: 9 }, (_, i) => ({
      rawWord: `word${i}`,
      word: `word${i}`,
    }));

    await runBulkEnrichment(items, {
      lookupFn: mockLookup,
      concurrency: 3,
      timeoutMs: 2000,
      abortSignal: new AbortController().signal,
    });

    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it('3. Cancels remaining requests immediately when abortSignal is triggered', async () => {
    let processedCount = 0;

    const abortController = new AbortController();

    const mockLookup = vi.fn().mockImplementation(async (_word, signal) => {
      if (signal?.aborted) throw new Error('Aborted');
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          processedCount++;
          resolve({
            word: 'test',
            phonetics: {},
            pos: ['noun'],
            vietnameseDefinition: 'test',
            englishDefinition: 'test',
            meanings: [],
            collocations: [],
            wordFamily: [],
            examples: [],
            tags: [],
          });
        }, 100);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Aborted'));
        });
      });
    });

    const items: ParsedImportItem[] = Array.from({ length: 10 }, (_, i) => ({
      rawWord: `canceltest${i}`,
      word: `canceltest${i}`,
    }));

    const promise = runBulkEnrichment(items, {
      lookupFn: mockLookup,
      concurrency: 2,
      timeoutMs: 2000,
      abortSignal: abortController.signal,
    });

    // Abort after 30ms
    setTimeout(() => {
      abortController.abort();
    }, 30);

    const result = await promise;
    expect(result.cancelled).toBe(true);
    expect(processedCount).toBeLessThan(10);
  });
});
