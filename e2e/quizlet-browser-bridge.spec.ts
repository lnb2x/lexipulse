import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';

const cards = `<meta charset="utf-8"><title>Fixture | Quizlet</title><script type="application/json" id="__NEXT_DATA__">${JSON.stringify({
  props: { pageProps: { dehydratedReduxStateKey: { setPage: { set: { id: 123456, title: 'Extension fixture', numTerms: 1 } },
    studyModesCommon: { studiableData: { studiableItems: [{ cardSides: [
      { label: 'word', media: [{ type: 1, plainText: 'bridgefixture' }] },
      { label: 'definition', media: [{ type: 1, plainText: 'nghĩa kiểm thử' }] },
    ] }] } } } } },
})}</script>`;

for (const mode of ['success', 'verification', 'cancel'] as const) test(`browser extension import: ${mode}`, async () => {
  const extension = path.resolve('public/quizlet-bridge');
  // A disposable browser profile; never touches the user's installed extensions or cookies.
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, chromiumSandbox: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
      '--host-resolver-rules=MAP quizlet.com ~NOTFOUND, MAP www.quizlet.com ~NOTFOUND'] });
  let backendCalls = 0;
  try {
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'quizlet.com') return route.fulfill({ contentType: 'text/html; charset=utf-8',
        body: mode === 'success' ? cards : '<title>Captcha Challenge…</title><div id="challenge-error-text">Synthetic verification fixture</div>' });
      if (url.origin === 'http://127.0.0.1:4173') {
        if (url.pathname === '/api/quizlet/fetch') {
          backendCalls++;
          return route.fulfill({ status: 422, json: { success: false, code: 'challenge_blocked' } });
        }
        return route.continue();
      }
      return route.abort();
    });
    const page = await context.newPage();
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    // Extension-created tabs can navigate before Playwright attaches routing. Defer
    // that navigation until the fixture is installed; DNS also denies real Quizlet.
    await worker.evaluate(() => {
      const api = (globalThis as any).chrome;
      const create = api.tabs.create.bind(api.tabs);
      api.tabs.create = async (options: any) => {
        const tab = await create({ ...options, url: 'about:blank' });
        return new Promise(resolve => {
          (globalThis as any).finishFixtureTab = () => resolve({ ...tab, url: options.url });
        });
      };
    });
    await page.goto('http://127.0.0.1:4173');
    await page.getByRole('tab', { name: /Bộ từ vựng|Deck/i }).click();
    await page.getByRole('button', { name: /Nhập nhiều từ|Bulk Add/i }).click();
    await page.getByRole('button', { name: /Từ Quizlet|From Quizlet/i }).click();
    await expect(page.getByText(/Đã kết nối trình duyệt/)).toBeVisible();
    await page.getByPlaceholder(/https:\/\/quizlet.com/).fill('https://quizlet.com/123456/fixture/');
    const opened = context.waitForEvent('page');
    await page.getByRole('button', { name: /Tải bộ từ|Fetch Set/i }).click();
    const quizlet = await opened;
    await quizlet.goto('https://quizlet.com/123456/fixture/');
    await worker.evaluate(() => (globalThis as any).finishFixtureTab());
    if (mode !== 'success') {
      await expect(page.getByText(/Hãy xác minh trong tab Quizlet/)).toBeVisible();
      if (mode === 'cancel') {
        await page.getByRole('button', { name: 'Hủy tải' }).click();
        await expect(page.getByRole('button', { name: 'Tải bộ từ' })).toBeEnabled();
        await expect(page.getByText('bridgefixture', { exact: true })).toHaveCount(0);
        expect(quizlet.isClosed()).toBe(false);
      } else {
        // Change a synthetic fixture to represent the user completing verification.
        // All responses are fixtures; no real challenge is interacted with.
        await quizlet.setContent(cards);
      }
    }
    if (mode !== 'cancel') {
      await expect(page.getByText('bridgefixture', { exact: true })).toBeVisible();
      await expect(page.getByText('nghĩa kiểm thử', { exact: true })).toBeVisible();
      await expect(page.getByText(/Tải thành công 1 thẻ từ Quizlet/)).toBeVisible();
    }
    expect(backendCalls).toBe(0);
  } finally { await context.close(); }
});
