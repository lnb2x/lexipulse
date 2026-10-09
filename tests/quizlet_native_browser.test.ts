import { EventEmitter } from 'node:events';
import { beforeEach, expect, it, vi } from 'vitest';
const { spawn, connect } = vi.hoisted(() => ({ spawn: vi.fn(), connect: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn }));
vi.mock('@playwright/test', () => ({ chromium: { connectOverCDP: connect } }));
import { openQuizletBrowser } from '../server/quizletNativeBrowser';

beforeEach(() => { vi.resetAllMocks(); });
function fixture(exitCode: number | null = null) {
  const child = Object.assign(new EventEmitter(), { exitCode, kill: vi.fn() });
  const context = {};
  const send = vi.fn().mockResolvedValue(undefined);
  const browser = {
    contexts: () => [context], isConnected: () => true,
    newBrowserCDPSession: async () => ({ send }), close: vi.fn().mockResolvedValue(undefined),
  };
  spawn.mockReturnValue(child); connect.mockResolvedValue(browser);
  return { child, browser, context, send };
}

it('reads through an ephemeral loopback connection and closes the owned browser exactly once', async () => {
  const { context, child, send } = fixture();
  connect.mockRejectedValueOnce(new Error('not listening yet'));
  const session = await openQuizletBrowser('chrome.exe', '/dedicated-profile', 'http://127.0.0.1:10001');
  expect(session.context).toBe(context);
  const endpoint = new URL(connect.mock.calls[0][0]);
  expect(endpoint.hostname).toBe('127.0.0.1'); expect(Number(endpoint.port)).toBeGreaterThan(0);
  await Promise.all([session.close(), session.close()]);
  expect(send).toHaveBeenCalledOnce(); expect(send).toHaveBeenCalledWith('Browser.close');
  expect(child.kill).toHaveBeenCalledOnce();
});

it('stops when the browser exits before its read connection is available', async () => {
  fixture(0);
  await expect(openQuizletBrowser('chrome.exe', '/dedicated-profile', 'http://127.0.0.1:10001')).rejects.toThrow('browser_closed');
  expect(connect).not.toHaveBeenCalled();
});

it('does not start a process when the import was already canceled', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(openQuizletBrowser('chrome.exe', '/dedicated-profile', 'http://127.0.0.1:10001', controller.signal)).rejects.toThrow();
  expect(spawn).not.toHaveBeenCalled();
});
