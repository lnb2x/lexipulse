import { test, expect, chromium, type Browser } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { scrapeQuizletWithPlaywright } from '../server/quizletScraper';

test('a Quizlet document cannot reach a private network service', async () => {
  let connections = 0;
  const localService = createServer((_req, res) => { connections++; res.end('private'); });
  await new Promise<void>(resolve => localService.listen(0, '127.0.0.1', resolve));
  const port = (localService.address() as AddressInfo).port;
  const originalLaunch = chromium.launch;
  let browser: Browser | undefined;
  chromium.launch = async () => {
    browser = await originalLaunch.call(chromium, { headless: true, chromiumSandbox: true });
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async options => {
      const page = await newPage(options);
      await page.route('https://quizlet.com/123456/fixture/', route => route.fulfill({
        contentType: 'text/html', body: `<title>Fixture</title><script>location.replace('http://127.0.0.1:${port}/probe');</script>
        <div class="SetPageTerm"><span class="SetPageTerm-wordText">bank</span><span class="SetPageTerm-definitionText">ngân hàng</span></div>`,
      }));
      return page;
    };
    return browser;
  };
  try {
    await scrapeQuizletWithPlaywright('https://quizlet.com/123456/fixture/');
    expect(connections).toBe(0);
    expect(browser?.isConnected()).toBe(false);
  } finally {
    chromium.launch = originalLaunch; await browser?.close();
    localService.closeAllConnections(); await new Promise<void>(resolve => localService.close(() => resolve()));
  }
});
