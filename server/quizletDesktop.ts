import { chromium, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { normalizeQuizletUrl } from './quizletUrl.ts';
import { extractQuizletPayload } from './quizletPayload.ts';

import type { ScrapedQuizletCardItem, ScrapedQuizletResult } from './quizletScraper.ts';
import { createQuizletBrowserProxy } from './quizletBrowserProxy.ts';
import { openQuizletBrowser } from './quizletNativeBrowser.ts';

export type QuizletProgress = 'loading' | 'verification_required';
interface ScrapeOptions {
  signal?: AbortSignal;
  onProgress?: (progress: QuizletProgress) => void;
  timeoutMs?: number;
}

function getBrowserExecutablePath(): string | undefined {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find((candidate) => candidate && fs.existsSync(candidate));
}

// A dedicated profile preserves login/verification without touching normal Chrome.
// Serialize access because Chromium cannot open the same profile twice.
let browserQueue: Promise<void> = Promise.resolve();
async function launchContext(proxyUrl: string, signal?: AbortSignal) {
  const profile = process.env.QUIZLET_PROFILE_DIR || path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'),
    'LexiPulse', 'quizlet-native-browser',
  );
  const headless = process.env.QUIZLET_HEADLESS === 'true'
    || (process.platform !== 'win32' && process.platform !== 'darwin' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY);
  const executablePath = getBrowserExecutablePath();
  if (!headless && executablePath) return openQuizletBrowser(executablePath, profile, proxyUrl, signal);
  const context = await chromium.launchPersistentContext(profile, {
    executablePath, headless,
    proxy: { server: proxyUrl },
    chromiumSandbox: true,
    serviceWorkers: 'block', acceptDownloads: false,
    args: ['--proxy-bypass-list=<-loopback>', '--disable-quic', ...(process.platform === 'win32' && !headless ? ['--start-minimized'] : [])],
    viewport: { width: 1280, height: 800 }, locale: 'vi-VN', timeout: 15000,
  });
  return { context, close: () => context.close() };
}

async function readCards(page: Page, setId: string) {
  const payload = await page.locator('#__NEXT_DATA__').textContent({ timeout: 500 }).catch(() => null);
  if (payload) {
    if (Buffer.byteLength(payload, 'utf8') > 8 * 1024 * 1024) throw new Error('resource_limit');
    try {
      const result = extractQuizletPayload(JSON.parse(payload), setId);
      if (result.terms.length) return result;
    } catch (error) {
      if (error instanceof Error && error.message === 'resource_limit') throw error;
      // The payload may still be loading.
    }
  }
  return page.evaluate(() => {
    const terms: ScrapedQuizletCardItem[] = [];
    let totalLength = 0;
    for (const card of document.querySelectorAll('.SetPageTerm, [data-testid="SetPageTerm"], .SetPageTerms-term')) {
      const term = card.querySelector('.SetPageTerm-wordText')?.textContent?.trim() || '';
      const definition = card.querySelector('.SetPageTerm-definitionText')?.textContent?.trim() || '';
      totalLength += term.length + definition.length;
      if (term.length > 20000 || definition.length > 20000 || totalLength > 2 * 1024 * 1024 || terms.length >= 10000) {
        throw new Error('resource_limit');
      }
      if (term && definition) terms.push({ term, definition });
    }
    return { title: document.querySelector('h1')?.textContent?.trim().slice(0, 20000), terms, expectedCount: undefined as number | undefined };
  });
}

/** Read accessible cards; security challenges are completed by the user. */
export async function scrapeQuizletOnDesktop(rawUrl: string, options: ScrapeOptions = {}): Promise<ScrapedQuizletResult> {
  const startTime = Date.now();
  const cleanUrl = normalizeQuizletUrl(rawUrl);
  if (!cleanUrl) return { success: false, code: 'invalid_url', error: 'Vui lòng nhập URL bộ thẻ HTTPS từ quizlet.com.' };
  const setId = new URL(cleanUrl).pathname.match(/\d+/)![0];
  let release!: () => void;
  const previous = browserQueue;
  browserQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  let context: BrowserContext | undefined;
  let closeBrowser: (() => Promise<void>) | undefined;
  let proxy: Awaited<ReturnType<typeof createQuizletBrowserProxy>> | undefined;
  const signal = options.signal;
  const abortBrowser = () => { void closeBrowser?.().catch(() => {}); };
  signal?.addEventListener('abort', abortBrowser, { once: true });
  const failure = (code: ScrapedQuizletResult['code'], error: string): ScrapedQuizletResult => ({
    success: false, code, error, cleanUrl, setId, durationMs: Date.now() - startTime,
  });
  try {
    if (signal?.aborted) return failure('aborted', 'Đã hủy tải bộ từ.');
    proxy = await createQuizletBrowserProxy(signal || new AbortController().signal);
    const launched = await launchContext(proxy.url, signal);
    context = launched.context; closeBrowser = launched.close;
    await context.routeWebSocket('**/*', socket => socket.close());
    if (signal?.aborted) return failure('aborted', 'Đã hủy tải bộ từ.');
    const page = context.pages()[0] || await context.newPage();
    let response = await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const deadline = Date.now() + (options.timeoutMs ?? 120000);
    let interactive = false;
    let loginRequired = false;
    let returnedAfterLogin = false;
    let title: string | undefined;
    while (Date.now() < deadline && !signal?.aborted) {
      if (proxy.violation) return failure(proxy.violation, 'Bộ từ vượt giới hạn tải an toàn.');
      if (page.isClosed()) return failure('aborted', 'Cửa sổ Quizlet đã đóng. Dán link để tải lại.');
      const loadedUrl = normalizeQuizletUrl(page.url());
      const requestedSetLoaded = loadedUrl && new URL(loadedUrl).pathname.match(/\d+/)?.[0] === setId;
      // Challenge containers can remain in the DOM after verification. Read the
      // requested set before treating those leftover elements as a blocking wall.
      if (requestedSetLoaded) {
        const extracted = await readCards(page, setId);
        title = extracted.title || title;
        if (extracted.terms.length && (!extracted.expectedCount || extracted.terms.length >= extracted.expectedCount)) {
          return { success: true, title, setId, cleanUrl, terms: extracted.terms, durationMs: Date.now() - startTime };
        }
      }
      const pageTitle = await page.title();
      const blocked = /access.*denied|just a moment|captcha|chờ một chút|verify.*human/i.test(pageTitle)
        || await page.locator('#px-captcha, .px-captcha-container, #challenge-running, #challenge-form').filter({ visible: true }).count() > 0;
      loginRequired = /\/login(?:[/?]|$)/.test(page.url())
        || await page.locator('[data-testid="LoginModal"], form[action*="login"]').filter({ visible: true }).count() > 0;
      if (blocked || loginRequired || response?.status() === 403) {
        if (!interactive) {
          interactive = true;
          options.onProgress?.('verification_required');
          // Restore the minimized window only when a human action is requested.
          if (process.platform === 'win32') {
            const session = await context.newCDPSession(page);
            try {
              const { windowId } = await session.send('Browser.getWindowForTarget');
              await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
            } finally { await session.detach(); }
          }
          await page.bringToFront();
        }
      } else {
        if (response?.status() === 404) return failure('not_found', 'Bộ từ không tồn tại hoặc đã bị xóa trên Quizlet.');
        if (response?.status() === 429) return failure('rate_limited', 'Quizlet giới hạn truy cập. Vui lòng thử lại sau ít phút.');
        if (!requestedSetLoaded) {
          if (interactive && !returnedAfterLogin) {
            returnedAfterLogin = true;
            response = await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            continue;
          }
          return failure('login_required', 'Quizlet chưa cho phép mở bộ từ này. Kiểm tra quyền truy cập của tài khoản.');
        }
        if (!interactive && Date.now() - startTime > 15000) return failure('no_terms_found', 'Không đọc được toàn bộ thẻ từ vựng của bộ này.');
      }
      // Discard the initial HTTP response after navigation/verification.
      response = null;
      await page.waitForTimeout(1000);
    }
    if (signal?.aborted) return failure('aborted', 'Đã hủy tải bộ từ.');
    return failure(loginRequired ? 'login_required' : interactive ? 'challenge_blocked' : 'no_terms_found',
      interactive ? 'Chưa hoàn tất xác minh/đăng nhập trong cửa sổ Quizlet. Bấm Thử lại để tiếp tục.' : 'Không tìm thấy thẻ từ vựng trong bộ này.');
  } catch (error) {
    if (signal?.aborted) return failure('aborted', 'Đã hủy tải bộ từ.');
    if (proxy?.violation || (error instanceof Error && error.message.includes('resource_limit'))) {
      return failure('resource_limit', 'Bộ từ vượt giới hạn tải an toàn.');
    }
    return failure('server_error', 'Không thể mở bộ Quizlet bằng trình duyệt trên máy. Kiểm tra Chrome/Edge rồi thử lại.');
  } finally {
    signal?.removeEventListener('abort', abortBrowser);
    await closeBrowser?.().catch(() => {});
    await proxy?.close();
    release();
  }
}
