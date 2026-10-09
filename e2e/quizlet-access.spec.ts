import { test, expect, chromium, type Browser } from '@playwright/test';
import { scrapeQuizletWithPlaywright } from '../server/quizletScraper';

const cases = [
  { name: 'live Quizlet CAPTCHA response', status: 403, html: '<title>Captcha Challenge…</title><h1>One more step…</h1>', code: 'challenge_blocked' },
  { name: 'rendered Quizlet challenge title', status: 200, html: '<title>One more step…</title>', code: 'challenge_blocked' },
  { name: 'Cloudflare challenge markup with ordinary title', status: 200, html: '<title>Quizlet</title><span id="challenge-error-text">Enable JavaScript and cookies to continue</span>', code: 'challenge_blocked' },
  { name: 'Cloudflare unavailable response', status: 503, html: '<title>Just a moment...</title>', code: 'challenge_blocked' },
  { name: 'legacy challenge marker', status: 200, html: '<title>Quizlet</title><div id="px-captcha"></div>', code: 'challenge_blocked' },
  { name: 'access denied without challenge markup', status: 403, html: '<title>Forbidden</title>', code: 'challenge_blocked' },
  { name: 'login wall on forbidden response', status: 403, html: '<title>Log in</title><form action="/login"></form>', code: 'login_required' },
  { name: 'authentication required', status: 401, html: '<title>Unauthorized</title>', code: 'login_required' },
  { name: 'upstream failure', status: 500, html: '<title>Server error</title>', code: 'server_error' },
  { name: 'missing set', status: 404, html: '<title>Not found</title>', code: 'not_found' },
  { name: 'rate limit', status: 429, html: '<title>Too many requests</title>', code: 'rate_limited' },
  { name: 'genuinely empty page', status: 200, html: '<title>Empty set | Quizlet</title>', code: 'no_terms_found' },
  { name: 'challenge appearing after hydration', status: 200, html: '<title>Quizlet</title><script>setTimeout(() => { document.title = "One more step…"; }, 500)</script>', code: 'challenge_blocked' },
  { name: 'ordinary vocabulary about CAPTCHA', status: 200, html: '<title>Captcha challenge vocabulary | Quizlet</title><div class="SetPageTerm"><span class="SetPageTerm-wordText">captcha</span><span class="SetPageTerm-definitionText">One more step…</span></div>', code: undefined },
];

for (const fixture of cases) test(`Quizlet classifies ${fixture.name}`, async () => {
  const originalLaunch = chromium.launch;
  let browser: Browser | undefined;
  chromium.launch = async () => {
    browser = await originalLaunch.call(chromium, { headless: true, chromiumSandbox: true });
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async options => {
      const page = await newPage(options);
      await page.route('**/*', route => route.fulfill({ status: fixture.status, contentType: 'text/html; charset=utf-8', body: fixture.html }));
      return page;
    };
    return browser;
  };
  try {
    const result = await scrapeQuizletWithPlaywright('https://quizlet.com/123456/fixture/');
    if (fixture.code) {
      expect(result).toMatchObject({ success: false, code: fixture.code });
      expect(result.terms).toBeUndefined();
      if (['challenge_blocked', 'login_required', 'server_error'].includes(fixture.code)) {
        expect(result.error).toContain(`HTTP ${fixture.status}`);
      }
    } else {
      expect(result.success).toBe(true);
      expect(result.terms).toEqual([{ term: 'captcha', definition: 'One more step…' }]);
    }
    expect(browser?.isConnected()).toBe(false);
  } finally {
    chromium.launch = originalLaunch;
    await browser?.close();
  }
});
