import { test, expect, chromium, type Browser } from '@playwright/test';
import { scrapeQuizletWithPlaywright } from '../server/quizletScraper';

for (const count of [1000, 10001]) test(`Quizlet extraction handles ${count} cards without silent truncation`, async () => {
  const originalLaunch = chromium.launch;
  let browser: Browser | undefined;
  const payload = { props: { pageProps: { dehydratedReduxStateKey: {
    setPage: { set: { id: '123456', title: 'Fixture' } },
    studyModesCommon: { studiableData: { studiableItems: Array.from({ length: count }, (_, i) => ({
      cardSides: [{ label: 'word', media: [{ type: 1, plainText: `term${i}` }] },
        { label: 'definition', media: [{ type: 1, plainText: `nghĩa ${i}` }] }],
    })) } },
  } } } };
  chromium.launch = async () => {
    browser = await originalLaunch.call(chromium, { headless: true, chromiumSandbox: true });
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async options => {
      const page = await newPage(options);
      await page.route('**/*', route => route.fulfill({ contentType: 'text/html',
        body: `<title>Fixture</title><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>` }));
      return page;
    };
    return browser;
  };
  try {
    const result = await scrapeQuizletWithPlaywright('https://quizlet.com/123456/fixture/');
    if (count === 1000) { expect(result.success).toBe(true); expect(result.terms).toHaveLength(1000); }
    else { expect(result).toMatchObject({ success: false, code: 'resource_limit' }); expect(result.terms).toBeUndefined(); }
  } finally { chromium.launch = originalLaunch; await browser?.close(); }
});
