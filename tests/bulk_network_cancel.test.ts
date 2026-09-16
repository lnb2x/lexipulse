import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { runBulkEnrichment } from '../src/services/bulkEnrichment';
import { db } from '../src/services/db/schema';

afterEach(() => vi.unstubAllGlobals());
it.each(['cancelprobezz', 'cancelphrasezz unknownphrasezz'])('cancels real dictionary requests for %s', async word => {
  await db.words.clear();
  const signals: AbortSignal[] = [];
  const release: Array<() => void> = [];
  vi.stubGlobal('fetch', (_url: string, options: RequestInit) => {
    const signal = options.signal!;
    signals.push(signal);
    return new Promise<Response>((resolve, reject) => {
      release.push(() => resolve(new Response('{}', { status: 404 })));
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  });
  const controller = new AbortController();
  const task = runBulkEnrichment([{ rawWord: word, word }], {
    abortSignal: controller.signal, timeoutMs: 10000,
  });
  await vi.waitFor(() => expect(signals.length).toBeGreaterThan(0));
  controller.abort();
  const cancelledAtStop = signals.every(signal => signal.aborted);
  release.forEach(resolve => resolve());
  await task;
  expect(cancelledAtStop).toBe(true);
  expect(await db.words.count()).toBe(0);
});
