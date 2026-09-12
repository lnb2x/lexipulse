import { chromium } from '@playwright/test';
import fs from 'node:fs';
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
  code?: 'invalid_url' | 'login_required' | 'challenge_blocked' | 'rate_limited' | 'not_found' | 'no_terms_found' | 'server_error';
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
 * Scrapes Quizlet set using Playwright with automated challenge handling.
 */
export async function scrapeQuizletWithPlaywright(rawUrl: string): Promise<ScrapedQuizletResult> {
  const startTime = Date.now();
  const trimmed = normalizeQuizletUrl(rawUrl);
  if (!trimmed) {
    return { success: false, code: 'invalid_url', error: 'Vui lòng nhập URL bộ thẻ HTTPS từ quizlet.com.' };
  }

  const execPath = getBrowserExecutablePath();
  const launchOptions: any = {
    headless: false,
    args: [
      '--headless=new',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  };

  if (execPath) {
    launchOptions.executablePath = execPath;
  }

  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (err: any) {
    try {
      delete launchOptions.executablePath;
      browser = await chromium.launch(launchOptions);
    } catch (fallbackErr: any) {
      return {
        success: false,
        error: `Không thể khởi động trình duyệt Playwright: ${fallbackErr.message || err.message}`,
      };
    }
  }

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'vi-VN',
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

    await page.waitForTimeout(2000);

    let title = await page.title();

    // Challenge handling (PerimeterX Press & Hold)
    if (
      title.includes('Access to this page has been denied') ||
      (await page.$('.px-captcha-container, #px-captcha'))
    ) {
      const px = await page.$('.px-captcha-container, #px-captcha');
      if (px) {
        const box = await px.boundingBox();
        if (box) {
          const clickX = box.x + box.width / 2;
          const clickY = box.y + box.height * 0.65;
          await page.mouse.move(clickX, clickY);
          await page.mouse.down();
          await page.waitForTimeout(12000);
          await page.mouse.up();
          await page.waitForTimeout(4000);
          title = await page.title();
        }
      }
    }

    // Verify if challenge still blocks access
    if (
      title.includes('Access to this page has been denied') ||
      title.includes('Chờ một chút') ||
      (await page.$('.px-captcha-container, #px-captcha'))
    ) {
      return {
        success: false,
        code: 'challenge_blocked',
        error: 'Quizlet yêu cầu thử thách bảo mật nâng cao mà trình duyệt tự động chưa thể vượt qua.',
        cleanUrl: page.url(),
        durationMs: Date.now() - startTime,
      };
    }

    // Check for login wall
    const isLoginWall =
      page.url().includes('/login') ||
      (await page.$('[data-testid="LoginModal"], form[action*="login"]'));
    if (isLoginWall) {
      return {
        success: false,
        code: 'login_required',
        error: 'Bộ từ yêu cầu đăng nhập tài khoản Quizlet để xem.',
        cleanUrl: page.url(),
        durationMs: Date.now() - startTime,
      };
    }

    // Extract from Next.js payload __NEXT_DATA__
    const nextDataRaw = await page.$eval('#__NEXT_DATA__', (el) => el.textContent).catch(() => null);

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
            for (const item of studiableItems) {
              if (item.isDeleted) continue;
              const wordSide = item.cardSides?.find((s: any) => s.label === 'word') || item.cardSides?.[0];
              const defSide = item.cardSides?.find((s: any) => s.label === 'definition') || item.cardSides?.[1];
              const wordText = wordSide?.media?.find((m: any) => m.type === 1)?.plainText?.trim() || '';
              const defText = defSide?.media?.find((m: any) => m.type === 1)?.plainText?.trim() || '';
              if (wordText || defText) {
                terms.push({ term: wordText, definition: defText });
              }
            }
          }
        }
      } catch (jsonErr: any) {
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
        cards.forEach((c: any) => {
          const w =
            c.querySelector('.SetPageTerm-wordText, [data-testid="UILabel"]')?.textContent?.trim() || '';
          const d = c.querySelector('.SetPageTerm-definitionText')?.textContent?.trim() || '';
          if (w || d) list.push({ term: w, definition: d });
        });
        return { h1, list };
      });

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
  } catch (err: any) {
    return {
      success: false,
      code: 'server_error',
      error: `Lỗi khi tải trang bằng Playwright: ${err.message || 'Không xác định'}`,
      durationMs: Date.now() - startTime,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
