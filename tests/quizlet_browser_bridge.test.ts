// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { detectQuizletBrowserBridge, fetchQuizletFromBrowser } from '../src/services/quizlet/quizletBrowserBridge';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const url = 'https://quizlet.com/123456/fixture/';
function respond(request: any, data: object, origin = location.origin, source: Window | null = window) {
  window.dispatchEvent(new MessageEvent('message', { origin, source, data: {
    ...request, direction: 'extension', ...data,
  } }));
}
const success = { success: true, setId: '123456', title: 'Fixture', terms: [{ term: 'word', definition: 'nghĩa' }], source: 'payload' };

it('discovers a connected extension', async () => {
  vi.spyOn(window, 'postMessage').mockImplementation(request => respond(request, { kind: 'ready' }));
  expect(await detectQuizletBrowserBridge()).toBe(true);
});
it('returns unavailable when the extension is absent', async () => {
  vi.useFakeTimers();
  const pending = detectQuizletBrowserBridge();
  await vi.advanceTimersByTimeAsync(401);
  expect(await pending).toBe(false);
});
it('ignores foreign origins, frames and stale request ids, then reads the matching result', async () => {
  vi.spyOn(window, 'postMessage').mockImplementation(request => {
    const wrong = { kind: 'result', result: { success: false, code: 'invalid_url' } };
    respond(request, wrong, 'https://evil.example');
    respond(request, wrong, location.origin, null);
    respond({ ...request, requestId: 'old-job' }, wrong);
    respond(request, { kind: 'result', result: success });
  });
  expect(await fetchQuizletFromBrowser(url)).toMatchObject({ success: true, setId: '123456', terms: success.terms });
});
it('reports verification progress and then completes without another fetch', async () => {
  const progress = vi.fn();
  vi.spyOn(window, 'postMessage').mockImplementation(request => {
    respond(request, { kind: 'progress', status: 'verification' });
    respond(request, { kind: 'result', result: success });
  });
  expect((await fetchQuizletFromBrowser(url, { onProgress: progress })).success).toBe(true);
  expect(progress).toHaveBeenCalledWith('verification');
});
it('cancels the extension job when the user aborts', async () => {
  const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  const controller = new AbortController();
  const pending = fetchQuizletFromBrowser(url, { signal: controller.signal });
  controller.abort();
  expect(await pending).toMatchObject({ success: false, errorType: 'aborted' });
  expect(post.mock.calls.map(([data]) => data.kind)).toEqual(['start', 'cancel']);
});
it('cleans up a lost extension job after the bounded deadline', async () => {
  vi.useFakeTimers();
  const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  const pending = fetchQuizletFromBrowser(url);
  await vi.advanceTimersByTimeAsync(185001);
  expect(await pending).toMatchObject({ success: false, errorType: 'browser_disconnected' });
  expect(post.mock.calls.at(-1)?.[0].kind).toBe('cancel');
});
it.each([
  { ...success, setId: '999999' },
  { ...success, terms: [{ term: {}, definition: 'bad' }] },
  { ...success, terms: [] },
])('rejects malformed or mismatched results', async result => {
  vi.spyOn(window, 'postMessage').mockImplementation(request => respond(request, { kind: 'result', result }));
  expect((await fetchQuizletFromBrowser(url)).success).toBe(false);
});
it('requires a count check when only DOM cards are available', async () => {
  vi.spyOn(window, 'postMessage').mockImplementation(request => respond(request, { kind: 'result', result: { ...success, source: 'dom' } }));
  expect(await fetchQuizletFromBrowser(url)).toMatchObject({ success: true, needsCountCheck: true });
});
