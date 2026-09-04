import { describe, it, expect, vi } from 'vitest';
import { getSpellingSuggestions } from '../src/services/dictionary';

describe('Network Request Count Benchmark on Fast Typing', () => {
  it('measures request counts when user types rapidly with AbortController cancellation', async () => {
    let activeRequestsCount = 0;
    let completedRequestsCount = 0;
    let abortedRequestsCount = 0;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn((url: string | URL | Request, options?: RequestInit) => {
      activeRequestsCount++;
      const signal = options?.signal;

      return new Promise<Response>((resolve, reject) => {
        if (signal?.aborted) {
          abortedRequestsCount++;
          return reject(new DOMException('Aborted', 'AbortError'));
        }

        const onAbort = () => {
          abortedRequestsCount++;
          reject(new DOMException('Aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });

        // Simulate network delay of 120ms
        setTimeout(() => {
          signal?.removeEventListener('abort', onAbort);
          if (signal?.aborted) return;
          completedRequestsCount++;
          resolve(new Response(JSON.stringify([{ word: 'test', score: 100 }]), { status: 200 }));
        }, 120);
      });
    }) as any;

    try {
      // Simulate fast typing: "c", "co", "col", "coll", "colla", "collab", "collabo", "collaborate" (each 40ms)
      const letters = ['c', 'co', 'col', 'coll', 'colla', 'collab', 'collabo', 'collaborate'];
      let prevController: AbortController | null = null;
      const promises: Promise<any>[] = [];

      for (const query of letters) {
        if (prevController) {
          prevController.abort();
        }
        const currentController = new AbortController();
        prevController = currentController;

        if (query.length >= 3) {
          promises.push(
            getSpellingSuggestions(query, [], currentController.signal).catch((err) => {
              if (err?.name === 'AbortError') return [];
              return [];
            })
          );
        }
        // User types next key after 30ms
        await new Promise((r) => setTimeout(r, 30));
      }

      await Promise.all(promises);

      console.log(`[Request Benchmark] Total initiated fetches: ${activeRequestsCount}`);
      console.log(`[Request Benchmark] Aborted fetches: ${abortedRequestsCount}`);
      console.log(`[Request Benchmark] Completed fetches: ${completedRequestsCount}`);

      // Crucial verification: Out of the rapid keystrokes, previous in-flight ones were aborted
      expect(abortedRequestsCount).toBeGreaterThan(0);
      // Only the last 1 or 2 requests are allowed to complete
      expect(completedRequestsCount).toBeLessThanOrEqual(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
