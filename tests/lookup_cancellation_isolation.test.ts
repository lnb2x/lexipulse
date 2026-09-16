import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { lookupWord } from '../src/services/dictionary';
import { translateToVietnamese } from '../src/services/dictionary/adapters/translation';

afterEach(() => vi.unstubAllGlobals());
it.each(['dictionary', 'translation'])('does not cancel a second caller of the same %s request', async kind => {
  const pending: Array<{ signal: AbortSignal; release: () => void }> = [];
  vi.stubGlobal('fetch', (_url, init) => new Promise<Response>((resolve, reject) => {
    pending.push({ signal: init.signal, release: () => resolve(Response.json({ text: 'nghĩa còn hiệu lực' })) });
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
  }));
  const first = new AbortController(); const second = new AbortController();
  const run = (signal: AbortSignal) => kind === 'dictionary'
    ? lookupWord('isolationprobezz', { signal, skipBackgroundAi: true })
    : translateToVietnamese('isolationprobezz', 2000, signal);
  const firstTask = run(first.signal).catch(() => null);
  await vi.waitFor(() => expect(pending.length).toBeGreaterThan(0));
  const secondTask = run(second.signal).catch(() => null);
  await new Promise(resolve => setTimeout(resolve, 30));
  first.abort();
  const active = pending.filter(item => !item.signal.aborted);
  second.abort(); pending.forEach(item => item.release());
  await Promise.all([firstTask, secondTask]);
  expect(active.length).toBeGreaterThan(0);
});
