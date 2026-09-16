import { test, expect, chromium, type Browser, type LaunchOptions } from '@playwright/test';
import { scrapeQuizletWithPlaywright } from '../server/quizletScraper';

for (const mode of ['cancel', 'deadline']) test(`closes Chromium after ${mode} during stalled navigation`, async () => {
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
  const task = scrapeQuizletWithPlaywright('https://quizlet.com/123456/fixture/', {
    signal: controller.signal, timeoutMs: 1800,
  }).then(value => { settled = true; return value; });
  try {
    await expect.poll(() => navigating, { timeout: 5000 }).toBe(true);
    if (mode === 'cancel') controller.abort();
    await expect.poll(() => settled, { timeout: 5000 }).toBe(true);
    expect(browser?.isConnected()).toBe(false);
    expect(launchedOptions?.chromiumSandbox).toBe(true);
    expect(launchedOptions?.args ?? []).not.toContain('--no-sandbox');
    expect(await task).toMatchObject({ success: false, code: mode === 'cancel' ? 'aborted' : 'timeout' });
  } finally { chromium.launch = originalLaunch; await browser?.close(); await task; }
});
