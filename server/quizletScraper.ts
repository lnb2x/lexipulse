import { chromium, type Browser, type LaunchOptions } from '@playwright/test';
import fs from 'node:fs';
import { createQuizletTransport } from './quizletNetwork.ts';
import { normalizeQuizletUrl } from './quizletUrl.ts';

export interface ScrapedQuizletCardItem {
  term: string;
  definition: string;
}

export interface ScrapedQuizletResult {
  success: boolean;
  title?: string;
  setId?: string;
  cleanUrl?: string;
  terms?: ScrapedQuizletCardItem[];
  error?: string;
  code?: 'invalid_url' | 'login_required' | 'challenge_blocked' | 'rate_limited' | 'not_found' | 'no_terms_found' | 'server_error' | 'timeout' | 'aborted' | 'resource_limit' | 'blocked_resource';
  durationMs?: number;
}

/**
 * Detects available browser executable path on the system.
 */
function getBrowserExecutablePath(): string | undefined {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const commonPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return undefined;
}

/**
 * Scrapes Quizlet set using Playwright with bounded lifetime and sandboxing.
 */
export async function scrapeQuizletWithPlaywright(rawUrl: string, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<ScrapedQuizletResult> {
  const startTime = Date.now();
  const trimmed = normalizeQuizletUrl(rawUrl);
  if (!trimmed) {
    return { success: false, code: 'invalid_url', error: 'Vui lòng nhập URL bộ thẻ HTTPS từ quizlet.com.' };
  }

  const controller = new AbortController();
  const deadline = startTime + Math.max(1, Math.min(options.timeoutMs ?? 30000, 30000));
  const abort = () => controller.abort(new DOMException('Cancelled', 'AbortError'));
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(() => controller.abort(new DOMException('Deadline exceeded', 'TimeoutError')), Math.max(1, deadline - Date.now()));
  let browser: Browser | undefined;
  let blockedNavigation = false;
  let closing: Promise<void> | undefined;
  const close = () => { if (browser) closing ??= browser.close().catch(() => {}); return closing; };
  const onAbort = () => { void close(); };
  controller.signal.addEventListener('abort', onAbort, { once: true });
  try {
    controller.signal.throwIfAborted();
    const launchOptions: LaunchOptions = {
      headless: true, chromiumSandbox: true,
      executablePath: getBrowserExecutablePath(),
      timeout: Math.max(1, Math.min(10000, deadline - Date.now())),
    };
    try { browser = await chromium.launch(launchOptions); }
    catch {
      controller.signal.throwIfAborted();
      browser = await chromium.launch({ ...launchOptions, executablePath: undefined,
        timeout: Math.max(1, Math.min(10000, deadline - Date.now())) });
    }
    controller.signal.throwIfAborted();
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'vi-VN',
      serviceWorkers: 'block',
      acceptDownloads: false,
    });

    const load = createQuizletTransport(controller.signal);
    await page.context().routeWebSocket('**/*', socket => socket.close());
    await page.context().route('**/*', async route => {
      const request = route.request();
      if (['image', 'media', 'font'].includes(request.resourceType()) || request.method() !== 'GET') {
        await route.abort().catch(() => {}); return;
      }
      try { await route.fulfill(await load(request.url())); }
      catch (error) {
        if (request.isNavigationRequest() && error instanceof Error && error.message === 'blocked_resource') blockedNavigation = true;
        await route.abort().catch(() => {});
        if (error instanceof Error && error.message === 'resource_limit') controller.abort(error);
      }
    });
    const navRes = await page.goto(trimmed, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const httpStatus = navRes?.status() || 200;
    if (httpStatus === 404) {
      return {
        success: false,
        code: 'not_found',
        error: 'Bộ từ không tồn tại hoặc đã bị xóa trên Quizlet (404 Not Found).',
        cleanUrl: page.url(),
        durationMs: Date.now() - startTime,
      };
    }
    if (httpStatus === 429) {
      return {
        success: false,
        code: 'rate_limited',
        error: 'Quizlet tạm thời giới hạn truy cập (429 Too Many Requests).',
        cleanUrl: page.url(),
        durationMs: Date.now() - startTime,
      };
    }

    const inspectAccess = async (): Promise<ScrapedQuizletResult | undefined> => {
      const access = await page.evaluate(() => ({
        title: document.title.slice(0, 300).trim(),
        challenge: !!document.querySelector(
          '.px-captcha-container, #px-captcha, #challenge-form, #challenge-error-text, '
          + 'script[src*="/cdn-cgi/challenge-platform/"], iframe[src*="challenges.cloudflare.com/"]'
        ),
        login: !!document.querySelector('[data-testid="LoginModal"], form[action*="login"]'),
      }));
      // Quizlet's Cloudflare interstitial uses both titles observed on live requests.
      // Do not search card/body text: a vocabulary set can itself mention CAPTCHA.
      const challengeTitle = /^(?:captcha challenge|one more step|just a moment|chờ một chút)(?:\s*[.!…]|\s*$)/i.test(access.title)
        || /^access to this page has been denied/i.test(access.title);
      const code = access.challenge || challengeTitle ? 'challenge_blocked'
        : httpStatus === 401 || page.url().includes('/login') || access.login ? 'login_required'
        : httpStatus === 403 ? 'challenge_blocked'
        : httpStatus >= 400 ? 'server_error' : undefined;
      if (!code) return;
      const reason = code === 'challenge_blocked'
        ? 'Quizlet chặn truy cập tự động hoặc yêu cầu xác minh bảo mật.'
        : code === 'login_required' ? 'Bộ từ yêu cầu đăng nhập tài khoản Quizlet để xem.'
        : 'Quizlet trả về lỗi khi tải bộ từ.';
      return {
        success: false, code,
        error: `${reason} HTTP ${httpStatus}; ${access.title}`,
        cleanUrl: page.url(),
        durationMs: Date.now() - startTime,
      };
    };

    // Classify the original response before scripts replace the challenge title,
    // and check again after hydration for login/challenge screens rendered later.
    const initialAccessError = await inspectAccess();
    if (initialAccessError) return initialAccessError;
    await page.waitForTimeout(2000);
    const hydratedAccessError = await inspectAccess();
    if (hydratedAccessError) return hydratedAccessError;
    const title = await page.title();

    // Extract from Next.js payload __NEXT_DATA__
    const payload = await page.evaluate(() => {
      const text = document.querySelector('#__NEXT_DATA__')?.textContent ?? '';
      return text.length > 8 * 1024 * 1024 ? { oversized: true, text: '' } : { oversized: false, text };
    });
    if (payload.oversized) throw new Error('resource_limit');
    const nextDataRaw = payload.text;

    let setTitle: string | undefined;
    let setId: string | undefined;
    const terms: ScrapedQuizletCardItem[] = [];

    if (nextDataRaw) {
      try {
        const parsed = JSON.parse(nextDataRaw);
        const reduxRaw = parsed.props?.pageProps?.dehydratedReduxStateKey;
        if (reduxRaw) {
          const redux = typeof reduxRaw === 'string' ? JSON.parse(reduxRaw) : reduxRaw;

          if (redux.setPage?.set?.title) {
            setTitle = String(redux.setPage.set.title).trim();
          }
          if (redux.setPage?.set?.id) {
            setId = String(redux.setPage.set.id);
          }

          const studiableItems = redux.studyModesCommon?.studiableData?.studiableItems;
          if (Array.isArray(studiableItems)) {
            if (studiableItems.length > 10000) throw new Error('resource_limit');
            for (const item of studiableItems) {
              if (item.isDeleted) continue;
              const wordSide = item.cardSides?.find((s: any) => s.label === 'word') || item.cardSides?.[0];
              const defSide = item.cardSides?.find((s: any) => s.label === 'definition') || item.cardSides?.[1];
              const wordText = wordSide?.media?.find((m: any) => m.type === 1)?.plainText?.trim() || '';
              const defText = defSide?.media?.find((m: any) => m.type === 1)?.plainText?.trim() || '';
              if (wordText.length > 20000 || defText.length > 20000) throw new Error('resource_limit');
              if (wordText || defText) {
                terms.push({ term: wordText, definition: defText });
              }
            }
          }
        }
      } catch (jsonErr: any) {
        if (jsonErr?.message === 'resource_limit') throw jsonErr;
        console.error('[QuizletScraper] Error parsing __NEXT_DATA__:', jsonErr.message);
      }
    }

    // Fallback to DOM elements if __NEXT_DATA__ did not provide terms
    if (terms.length === 0) {
      const domResult = await page.evaluate(() => {
        const h1 = document.querySelector('h1')?.textContent?.trim() || '';
        const list: { term: string; definition: string }[] = [];
        const cards = document.querySelectorAll(
          '.SetPageTerm, [data-testid="SetPageTerm"], .SetPageTerms-term'
        );
        if (cards.length > 10000) return { h1: '', list: [], oversized: true };
        let oversized = h1.length > 20000;
        cards.forEach((c: any) => {
          const w =
            c.querySelector('.SetPageTerm-wordText, [data-testid="UILabel"]')?.textContent?.trim() || '';
          const d = c.querySelector('.SetPageTerm-definitionText')?.textContent?.trim() || '';
          if (w.length > 20000 || d.length > 20000) oversized = true;
          else if (w || d) list.push({ term: w, definition: d });
        });
        return { h1: oversized ? '' : h1, list: oversized ? [] : list, oversized };
      });

      if (domResult.oversized) throw new Error('resource_limit');
      if (!setTitle && domResult.h1) {
        setTitle = domResult.h1;
      }
      if (domResult.list.length > 0) {
        terms.push(...domResult.list);
      }
    }

    if (!setTitle) {
      setTitle = title.replace(/\s*\|\s*Quizlet.*$/i, '').trim();
    }

    if ((setTitle?.length ?? 0) > 20000 || (setId?.length ?? 0) > 1000) throw new Error('resource_limit');
    if (terms.length === 0) {
      return {
        success: false,
        code: 'no_terms_found',
        title: setTitle,
        setId,
        cleanUrl: page.url(),
        error: 'Trang đã tải nhưng không tìm thấy danh sách thẻ từ vựng trong bộ này.',
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      title: setTitle,
      setId,
      cleanUrl: page.url(),
      terms,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      code: error instanceof Error && error.message.includes('resource_limit') ? 'resource_limit'
        : controller.signal.reason?.message === 'resource_limit' ? 'resource_limit'
        : controller.signal.aborted ? (options.signal?.aborted ? 'aborted' : 'timeout') : blockedNavigation ? 'blocked_resource' : 'server_error',
      error: 'Quizlet browser job could not complete.',
      durationMs: Date.now() - startTime,
    };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', onAbort);
    await close();
  }
}
