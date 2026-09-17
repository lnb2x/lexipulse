import { afterEach, expect, it, vi } from 'vitest';
import { fetchQuizletSet } from '../src/services/quizlet/quizletParser';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('returns a timeout when Quizlet backend headers arrive but the body stalls', async () => {
  vi.useFakeTimers();
  let body!: ReadableStreamDefaultController<Uint8Array>;
  vi.stubGlobal('fetch', async () => new Response(new ReadableStream({ start(controller) { body = controller; } }),
    { headers: { 'Content-Type': 'application/json' } }));
  let outcome: unknown = 'pending';
  const task = fetchQuizletSet('https://quizlet.com/123456/fixture/', { timeoutMs: 100 }).then(value => { outcome = value; });
  await vi.advanceTimersByTimeAsync(150);
  try { expect(outcome).toMatchObject({ success: false, errorType: 'timeout' }); }
  finally { body.enqueue(new TextEncoder().encode('{}')); body.close(); await task; }
});
