import { afterEach, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from '../src/services/dictionary/circuitBreaker';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it.each(['deadline', 'cancel'])('keeps %s active while response body is stalled', async mode => {
  vi.useFakeTimers();
  let body!: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(new ReadableStream({ start(controller) { body = controller; } }));
  vi.stubGlobal('fetch', async () => response);
  const controller = new AbortController();
  let outcome = 'pending';
  const task = fetchWithTimeout('https://fixture.invalid', {}, 100, controller.signal)
    .then(res => res.text()).then(() => { outcome = 'resolved'; }, error => { outcome = error.name; });
  await vi.advanceTimersByTimeAsync(1);
  if (mode === 'cancel') controller.abort();
  await vi.advanceTimersByTimeAsync(100);
  try { expect(outcome).toBe(mode === 'cancel' ? 'AbortError' : 'TimeoutError'); }
  finally { body.close(); await task; }
});
