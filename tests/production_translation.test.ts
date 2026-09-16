import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { translateToVietnamese } from '../src/services/dictionary/adapters/translation';
import { translationCircuitBreakers } from '../src/services/dictionary/circuitBreaker';
import { TRANSLATION_CACHE } from '../src/services/dictionary/cache';

beforeEach(() => {
  vi.stubEnv('DEV', false); vi.stubGlobal('window', {}); TRANSLATION_CACHE.clear();
  for (const cb of Object.values(translationCircuitBreakers)) Object.assign(cb, { failures: 0, nextAllowedTime: 0, disabled: false });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('uses an available same-origin translation backend in a production build', async () => {
  vi.stubGlobal('fetch', async (url: string) => new Response(JSON.stringify(
    url.startsWith('/api/translate') ? { text: 'nghĩa từ backend' } : {}), { headers: { 'Content-Type': 'application/json' } }));
  expect(await translateToVietnamese('production fixture')).toBe('nghĩa từ backend');
});
it('falls back when a static deployment has no API', async () => {
  vi.stubGlobal('fetch', async (url: string) => url.startsWith('/api/')
    ? new Response('', { status: 404 })
    : new Response('<div class="result-container">nghĩa dự phòng</div>'));
  expect(await translateToVietnamese('static fixture')).toBe('nghĩa dự phòng');
});
