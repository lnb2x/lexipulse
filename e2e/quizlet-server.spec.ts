import { test, expect, chromium, type Browser, type LaunchOptions } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { handleQuizletFetch } from '../server/quizletHandler';
import { scrapeQuizletWithPlaywright } from '../server/quizletScraper';

for (const mode of ['cancel', 'deadline', 'disconnect']) test(`closes Chromium after ${mode} during stalled navigation`, async () => {
  const originalLaunch = chromium.launch;
  const launch = originalLaunch.bind(chromium);
  let browser: Browser | undefined;
  let launchedOptions: LaunchOptions | undefined;
  let navigating = false;
  chromium.launch = async options => {
    launchedOptions = options;
    browser = await launch({ headless: true, chromiumSandbox: true });
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async options => {
      const page = await newPage(options);
      await page.route('**/*', async () => { navigating = true; });
      return page;
    };
    return browser;
  };
  const controller = new AbortController();
  let settled = false;
  const backend = createServer(handleQuizletFetch);
  if (mode === 'disconnect') await new Promise<void>(resolve => backend.listen(0, '127.0.0.1', resolve));
  const task = (mode === 'disconnect'
    ? fetch(`http://127.0.0.1:${(backend.address() as AddressInfo).port}/api/quizlet/fetch`, { method: 'POST',
      body: JSON.stringify({ url: 'https://quizlet.com/123456/fixture/' }), signal: controller.signal })
      .then(response => response.json()).catch(() => ({ success: false, code: 'aborted' }))
    : scrapeQuizletWithPlaywright('https://quizlet.com/123456/fixture/', {
    signal: controller.signal, timeoutMs: 1800,
  })).then(value => { settled = true; return value; });
  try {
    await expect.poll(() => navigating, { timeout: 5000 }).toBe(true);
    if (mode !== 'deadline') controller.abort();
    await expect.poll(() => settled, { timeout: 5000 }).toBe(true);
    await expect.poll(() => browser?.isConnected()).toBe(false);
    expect(launchedOptions?.chromiumSandbox).toBe(true);
    expect(launchedOptions?.args ?? []).not.toContain('--no-sandbox');
    expect(await task).toMatchObject({ success: false, code: mode === 'deadline' ? 'timeout' : 'aborted' });
  } finally {
    chromium.launch = originalLaunch; await browser?.close(); await task;
    backend.closeAllConnections(); await new Promise<void>(resolve => backend.close(() => resolve()));
  }
});
