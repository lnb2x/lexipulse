import { test, expect } from '@playwright/test';
const pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors.length = 0;
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('lexipulse_ui_language', 'vi'));
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__db);
  await page.evaluate(async () => {
    const db = (window as any).__db;
    for (const table of db.tables) await table.clear();
    const now = Date.now();
    await db.words.bulkPut(Array.from({ length: 12 }, (_, i) => ({
      id: `study-${i}`, word: `term${i}`, pos: ['noun'], phonetics: {},
      vietnameseDefinition: `nghĩa ${i}`, englishDefinition: '', meanings: [], collocations: [], examples: [], wordFamily: [], tags: [],
      status: 'new', createdAt: Date.now(), updatedAt: Date.now(),
      reviewMeta: { repetition: 0, interval: 0, easeFactor: 2.5, dueDate: now - 10000 + i, lastReviewedDate: null, history: [] },
    })));
  });
});
test.afterEach(() => expect(pageErrors).toEqual([]));

async function openReview(page: import('@playwright/test').Page) {
  await page.locator('#tab-desktop-review').click();
  await expect(page.locator('#panel-review')).toBeVisible();
}
async function grade(page: import('@playwright/test').Page, rating: 'Again' | 'Good') {
  await page.getByRole('heading', { name: /^term\d+$/ }).click();
  await page.getByTitle(rating, { exact: true }).click();
}

test('bounded review resumes after reload and difficult-word practice preserves its schedule', async ({ page }) => {
  await openReview(page);
  await page.getByRole('button', { name: /^Thẻ ghi nhớ/ }).click();
  await page.getByRole('button', { name: 'Ôn tập 10 thẻ đến hạn hôm nay' }).click();
  await grade(page, 'Again');
  await expect(page.getByText('term1', { exact: true }).first()).toBeVisible();
  await page.reload();
  await openReview(page);
  await page.getByRole('button', { name: 'Tiếp tục phiên học' }).click();
  await expect(page.getByText('term1', { exact: true }).first()).toBeVisible();
  for (let i = 1; i < 10; i++) {
    await grade(page, 'Good');
    if (i < 9) await expect(page.getByText(`term${i + 1}`, { exact: true }).first()).toBeVisible();
  }
  const retry = page.getByRole('button', { name: 'Luyện lại 1 từ chưa nhớ' });
  await expect(retry).toBeVisible();
  const before = await page.evaluate(async () => (await (window as any).__db.words.get('study-0')).reviewMeta);
  await retry.click();
  await grade(page, 'Good');
  await expect(page.getByRole('button', { name: 'Ôn tập lại', exact: true })).toBeVisible();
  const result = await page.evaluate(async () => {
    const db = (window as any).__db;
    return { word: await db.words.get('study-0'), attempts: (await db.settingsTable.get('studyAttempts')).value,
      stats: await db.dailyStats.toArray(), checkpoint: await db.settingsTable.get('studySession') };
  });
  expect(result.word.reviewMeta).toEqual(before);
  expect(result.attempts).toHaveLength(11);
  expect(result.stats.reduce((n: number, s: any) => n + s.cardsReviewed, 0)).toBe(10);
  expect(result.checkpoint).toBeUndefined();
  await page.getByRole('button', { name: 'Khám phá Bộ từ vựng' }).click();
  await openReview(page);
  await expect(page.getByRole('heading', { name: 'Bạn cần luyện gì?' })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải backup đầy đủ' }).click();
  expect((await downloading).suggestedFilename()).toMatch(/^lexipulse_backup_.*\.json$/);
  await expect(page.getByText(/Lần yêu cầu tải backup gần nhất/)).toBeVisible();
  await page.screenshot({ path: 'test-results/study-dashboard.png', fullPage: true });
});

test('Part 5 preserves a checked answer across reload and retries only the incorrect question', async ({ page }) => {
  await openReview(page);
  await page.getByRole('button', { name: 'TOEIC Part 5', exact: true }).click();
  await page.getByRole('combobox', { name: 'Chủ đề' }).click();
  await page.getByRole('option', { name: 'Giới từ', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu Part 5' }).click();
  await page.getByRole('button', { name: 'A. on', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Câu tiếp theo' })).toBeVisible();
  await page.reload();
  await openReview(page);
  await page.getByRole('button', { name: 'TOEIC Part 5', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục Part 5' }).click();
  await expect(page.getByRole('button', { name: 'A. on', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Câu tiếp theo' }).click();
  for (const answer of ['B. for', 'D. by', 'A. on']) {
    await page.getByRole('button', { name: answer, exact: true }).click();
    await page.getByRole('button', { name: 'Câu tiếp theo' }).click();
  }
  await expect(page.getByText('Hoàn thành! 3/4 câu đúng.')).toBeVisible();
  await page.getByRole('button', { name: 'Luyện lại câu sai', exact: true }).click();
  await expect(page.getByText(/Câu 1\/1/)).toBeVisible();
  await page.getByRole('button', { name: 'C. at', exact: true }).click();
  await page.getByRole('button', { name: 'Câu tiếp theo' }).click();
  const attempts = await page.evaluate(async () => (await (window as any).__db.settingsTable.get('studyAttempts')).value);
  expect(attempts).toHaveLength(5);
  expect(new Set(attempts.map((a: any) => a.id)).size).toBe(5);
  expect(await page.evaluate(async () => (await (window as any).__db.dailyStats.toArray()).reduce((n: number, s: any) => n + s.cardsReviewed, 0))).toBe(0);
});

test('new practice UI fits a mobile screen and explanations remain visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#tab-mobile-review').click();
  await page.getByRole('button', { name: 'TOEIC Part 5', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu Part 5' }).click();
  await page.getByRole('button', { name: 'C. carefully', exact: true }).click();
  await expect(page.getByText('Trạng từ “cẩn thận” bổ nghĩa cho read.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/study-mobile.png', fullPage: true });
});

test('matching resumes with only ungraded pairs and never repeats scheduler events', async ({ page }) => {
  await openReview(page);
  await page.getByRole('button', { name: /^Nối từ với nghĩa/ }).click();
  await page.getByRole('button', { name: 'Ôn tập 10 thẻ đến hạn hôm nay' }).click();
  await page.getByRole('button', { name: 'EN term0', exact: true }).click();
  await page.getByRole('button', { name: 'VI nghĩa 0', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => (await (window as any).__db.settingsTable.get('studyAttempts'))?.value.length)).toBe(1);
  await page.reload();
  await openReview(page);
  await page.getByRole('button', { name: 'Tiếp tục phiên học' }).click();
  await expect(page.getByRole('button', { name: 'EN term1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'EN term0', exact: true })).toHaveCount(0);
  for (let i = 1; i < 10; i++) {
    await page.getByRole('button', { name: `EN term${i}`, exact: true }).click();
    await page.getByRole('button', { name: `VI nghĩa ${i}`, exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'Ôn tập lại', exact: true })).toBeVisible();
  const result = await page.evaluate(async () => {
    const db = (window as any).__db;
    return { attempts: (await db.settingsTable.get('studyAttempts')).value, word: await db.words.get('study-0'),
      checkpoint: await db.settingsTable.get('studySession') };
  });
  expect(result.attempts).toHaveLength(10);
  expect(result.attempts.every((a: any) => a.mode === 'match')).toBe(true);
  expect(result.word.reviewMeta.history).toHaveLength(1);
  expect(result.checkpoint).toBeUndefined();
});

test('dictation saves actual incorrect checks and hints without confusing them with unassisted recall', async ({ page }) => {
  await openReview(page);
  await page.getByRole('button', { name: /^Nghe và viết/ }).click();
  await page.getByRole('button', { name: 'Ôn tập 10 thẻ đến hạn hôm nay' }).click();
  const answer = page.getByPlaceholder('Nhập từ tiếng Anh...');
  await answer.fill('term');
  await page.getByRole('button', { name: /^Kiểm tra đáp án/ }).click();
  await page.getByRole('button', { name: 'Gợi ý chữ cái', exact: true }).click();
  await answer.fill('term0');
  await page.getByRole('button', { name: /^Kiểm tra đáp án/ }).click();
  await page.getByRole('button', { name: /^Tiếp tục/ }).click();
  await expect.poll(() => page.evaluate(async () => (await (window as any).__db.settingsTable.get('studyAttempts'))?.value.length)).toBe(1);
  const attempt = await page.evaluate(async () => (await (window as any).__db.settingsTable.get('studyAttempts')).value[0]);
  expect(attempt).toMatchObject({ wordId: 'study-0', mode: 'listen', rating: 2,
    firstAttemptCorrect: false, incorrectSubmissionCount: 1, hintsUsedCount: 1, firstAttemptEditDistance: 1 });
  await page.getByRole('button', { name: 'Quay lại Hub Ôn tập' }).click();
  const progress = page.getByRole('region', { name: 'Tiến độ theo kỹ năng' });
  await expect(progress.getByText('0%', { exact: true })).toBeVisible();
  await expect(progress.getByText(/1 lượt · 1 lượt khó · N=1/)).toBeVisible();
  await expect(progress.getByText(/1 lần nhập sai, 1 lần dùng gợi ý/)).toBeVisible();
});
