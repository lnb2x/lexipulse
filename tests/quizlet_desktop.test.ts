import { beforeEach, expect, it, vi } from 'vitest';
const { launch, createProxy } = vi.hoisted(() => ({ launch: vi.fn(), createProxy: vi.fn() }));
vi.mock('@playwright/test', () => ({ chromium: { launchPersistentContext: launch } }));
vi.mock('../server/quizletBrowserProxy.ts', () => ({ createQuizletBrowserProxy: createProxy }));
vi.mock('../server/quizletNativeBrowser.ts', () => ({ openQuizletBrowser: async () => {
  const context = await launch(); return { context, close: () => context.close() };
} }));
import { scrapeQuizletOnDesktop } from '../server/quizletDesktop';

const url = 'https://quizlet.com/123/cards/';
const payload = JSON.stringify({ props: { pageProps: { dehydratedReduxStateKey: {
  setPage: { set: { id: 123, title: 'Requested set', numTerms: 1 } },
  studyModesCommon: { studiableData: { studiableItems: [{ cardSides: [
    { label: 'word', media: [{ type: 1, plainText: 'store' }] },
    { label: 'definition', media: [{ type: 1, plainText: 'cửa hàng' }] },
  ] }] } },
} } } });

beforeEach(() => { vi.clearAllMocks(); });
function fixture(readPayload: () => Promise<string | null>) {
  const proxy = { url: 'http://127.0.0.1:12345', close: vi.fn().mockResolvedValue(undefined), violation: undefined };
  const page = {
    goto: vi.fn().mockResolvedValue({ status: () => 403 }), url: () => url,
    isClosed: () => false, title: vi.fn().mockResolvedValue('Captcha Challenge…'),
    locator: vi.fn((selector: string) => selector === '#__NEXT_DATA__'
      ? { textContent: readPayload }
      : { filter: () => ({ count: async () => selector.includes('captcha') ? 1 : 0 }) }),
    evaluate: vi.fn().mockResolvedValue({ terms: [] }), bringToFront: vi.fn(), waitForTimeout: vi.fn(),
  };
  const context = {
    pages: () => [page], close: vi.fn().mockResolvedValue(undefined), routeWebSocket: vi.fn(),
    newCDPSession: vi.fn().mockResolvedValue({ send: async () => ({ windowId: 1 }), detach: vi.fn() }),
  };
  launch.mockResolvedValue(context); createProxy.mockResolvedValue(proxy);
  return { page, context, proxy };
}

it('reads complete cards after verification even when old challenge markup/title remains', async () => {
  let verified = false;
  const { page, context, proxy } = fixture(async () => verified ? payload : null);
  page.waitForTimeout.mockImplementation(async () => { verified = true; });
  const onProgress = vi.fn();
  const result = await scrapeQuizletOnDesktop(url, { onProgress });
  expect(result).toMatchObject({ success: true, setId: '123', terms: [{ term: 'store', definition: 'cửa hàng' }] });
  expect(onProgress).toHaveBeenCalledWith('verification_required');
  expect(context.close).toHaveBeenCalledOnce(); expect(proxy.close).toHaveBeenCalledOnce();
});

it('does not return partial cards when the payload is oversized', async () => {
  const { context, proxy } = fixture(async () => 'x'.repeat(8 * 1024 * 1024 + 1));
  expect(await scrapeQuizletOnDesktop(url)).toMatchObject({ success: false, code: 'resource_limit' });
  expect(context.close).toHaveBeenCalledOnce(); expect(proxy.close).toHaveBeenCalledOnce();
});

it('does not launch a browser for a canceled or invalid request', async () => {
  const controller = new AbortController(); controller.abort();
  expect(await scrapeQuizletOnDesktop(url, { signal: controller.signal })).toMatchObject({ code: 'aborted' });
  expect(await scrapeQuizletOnDesktop('https://evil.example/123/')).toMatchObject({ code: 'invalid_url' });
  expect(launch).not.toHaveBeenCalled(); expect(createProxy).not.toHaveBeenCalled();
});
