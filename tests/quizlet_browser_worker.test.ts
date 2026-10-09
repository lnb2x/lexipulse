import { afterEach, expect, it, vi } from 'vitest';
import { allowedApp, attachBridge, parseSetUrl } from '../public/quizlet-bridge/background.js';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function event() {
  const listeners: Function[] = [];
  return { addListener: (fn: Function) => listeners.push(fn), emit: (...args: unknown[]) => Promise.all(listeners.map(fn => fn(...args))) };
}
function fixture() {
  const connect = event();
  const api = { runtime: { onConnect: connect }, tabs: {
    create: vi.fn().mockResolvedValue({ id: 10 }), get: vi.fn().mockResolvedValue({ status: 'complete', url: 'https://quizlet.com/123456/fixture/' }),
    remove: vi.fn().mockResolvedValue(undefined), update: vi.fn().mockResolvedValue(undefined),
  }, scripting: { executeScript: vi.fn().mockResolvedValue([{ result: { state: 'waiting', status: 'loading' } }]) } };
  const port = { name: 'lexipulse-quizlet-v1', sender: { frameId: 0, url: 'http://localhost:5173/' },
    onMessage: event(), onDisconnect: event(), postMessage: vi.fn(), disconnect: vi.fn() };
  attachBridge(api);
  void connect.emit(port);
  return { api, port, connect, start: () => port.onMessage.emit({ url: 'https://quizlet.com/123456/fixture/' }) };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

it.each(['https://evil.example/', 'http://localhost.evil.example:5173/', 'http://127.0.0.1:9999/', 'https://localhost:5173/'])
  ('denies extension requests from an untrusted app %s', url => expect(allowedApp(url)).toBe(false));
it.each(['http://quizlet.com/123456/', 'https://quizlet.com.evil.example/123456/', 'https://quizlet.com:8443/123456/', 'https://quizlet.com/123456/%E0%A4%A'])
  ('denies invalid set URLs %s', url => expect(parseSetUrl(url)).toBeNull());
it('strips query strings and fragments before opening a set', () => {
  expect(parseSetUrl('https://quizlet.com/vn/123456/fixture/?i=abc#top')).toEqual({ id: '123456', url: 'https://quizlet.com/vn/123456/fixture/' });
});
it('closes its background tab after reading cards', async () => {
  vi.useFakeTimers();
  const { api, port, start } = fixture();
  api.scripting.executeScript.mockResolvedValue([{ result: { state: 'success', result: { success: true, terms: [{ term: 'word', definition: 'nghĩa' }] } } }]);
  await start(); await flush();
  expect(port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'result' }));
  expect(api.tabs.remove).toHaveBeenCalledWith(10);
});
it('waits for verification without clicking, then resumes and leaves the user-visible tab open', async () => {
  vi.useFakeTimers();
  const { api, port, start } = fixture();
  api.scripting.executeScript.mockResolvedValueOnce([{ result: { state: 'waiting', status: 'verification' } }])
    .mockResolvedValueOnce([{ result: { state: 'success', result: { success: true } } }]);
  await start(); await flush();
  expect(port.postMessage).toHaveBeenCalledWith({ kind: 'progress', status: 'verification' });
  expect(api.tabs.update).toHaveBeenCalledWith(10, { active: true });
  await vi.advanceTimersByTimeAsync(1000);
  expect(port.postMessage).toHaveBeenCalledWith({ kind: 'result', result: { success: true } });
  expect(api.tabs.remove).not.toHaveBeenCalled();
});
it('stops and closes its tab when the caller disconnects', async () => {
  vi.useFakeTimers();
  const { api, port, start } = fixture();
  await start(); await flush();
  await port.onDisconnect.emit();
  const count = api.scripting.executeScript.mock.calls.length;
  await vi.advanceTimersByTimeAsync(10000);
  expect(api.tabs.remove).toHaveBeenCalledWith(10);
  expect(api.scripting.executeScript).toHaveBeenCalledTimes(count);
});
it('cleans up a tab created after cancellation', async () => {
  const { api, port, start } = fixture();
  let resolve!: (value: { id: number }) => void;
  api.tabs.create.mockReturnValue(new Promise(r => { resolve = r; }));
  const pending = start();
  await port.onDisconnect.emit();
  resolve({ id: 99 }); await pending;
  expect(api.tabs.remove).toHaveBeenCalledWith(99);
  expect(api.scripting.executeScript).not.toHaveBeenCalled();
});
it('reports the user closing the Quizlet tab', async () => {
  const { api, port, start } = fixture();
  api.tabs.get.mockRejectedValue(new Error('Tab closed'));
  await start(); await flush();
  expect(port.postMessage).toHaveBeenCalledWith({ kind: 'result', result: { success: false, code: 'browser_closed' } });
});
it('bounds verification waiting to three minutes', async () => {
  vi.useFakeTimers();
  const { api, port, start } = fixture();
  api.scripting.executeScript.mockResolvedValue([{ result: { state: 'waiting', status: 'verification' } }]);
  await start(); await vi.advanceTimersByTimeAsync(180001);
  expect(port.postMessage).toHaveBeenCalledWith({ kind: 'result', result: { success: false, code: 'challenge_blocked' } });
  expect(api.tabs.remove).not.toHaveBeenCalled();
});
