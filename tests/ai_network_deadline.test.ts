import { afterEach, expect, it, vi } from 'vitest';
import { enrichWordWithAI } from '../src/services/ai';
import { clearAICache } from '../src/services/ai/aiCache';
import { analyzeWordMorphologyWithAI } from '../src/services/ai/aiMorphology';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('falls back when an AI provider sends headers but stalls the response body', async () => {
  clearAICache(); vi.useFakeTimers();
  let body!: ReadableStreamDefaultController<Uint8Array>;
  vi.stubGlobal('fetch', async () => new Response(new ReadableStream({ start(controller) { body = controller; } })));
  let outcome: unknown = 'pending';
  const task = enrichWordWithAI('deadline', 'noun', {
    provider: 'custom', apiKey: '', baseUrl: 'https://provider.invalid', timeoutMs: 100,
  }).then(value => { outcome = value; });
  await vi.advanceTimersByTimeAsync(150);
  try { expect(outcome).toBeNull(); }
  finally { body.close(); await task; }
});

it('bounds morphology response bodies without retrying an expired request', async () => {
  vi.useFakeTimers();
  let body!: ReadableStreamDefaultController<Uint8Array>;
  const fetcher = vi.fn(async () => new Response(new ReadableStream({ start(controller) { body = controller; } })));
  vi.stubGlobal('fetch', fetcher);
  let outcome: unknown = 'pending';
  const task = analyzeWordMorphologyWithAI('unboundedmorphology', undefined, {
    provider: 'custom', apiKey: '', baseUrl: 'https://provider.invalid', timeoutMs: 100,
  }).then(value => { outcome = value; });
  await vi.advanceTimersByTimeAsync(150);
  try { expect(outcome).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(1); }
  finally { body.enqueue(new TextEncoder().encode('{"choices":[]}')); body.close(); await vi.advanceTimersByTimeAsync(200); }
  void task;
});
