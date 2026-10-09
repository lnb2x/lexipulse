import { test, expect, type Page } from '@playwright/test';

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(viewport.width === 390 ? 'mobile practice improvements' : 'desktop practice improvements', () => {
    test.use({ viewport });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('lexipulse_ui_language', 'vi'));
      await page.goto('/');
      await page.waitForFunction(() => !!(window as any).__db);
      await page.evaluate(async () => {
        const db = (window as any).__db;
        for (const table of db.tables) await table.clear();
        const now = Date.now();
        await db.words.bulkPut(Array.from({ length: 24 }, (_, i) => ({
          id: `practice-${String(i).padStart(2, '0')}`, word: `term${i}`, pos: ['noun'], phonetics: {},
          vietnameseDefinition: `nghĩa ${i}`, englishDefinition: '', meanings: [], collocations: [], examples: [], wordFamily: [], tags: [],
          status: 'new', createdAt: now, updatedAt: now,
          reviewMeta: { repetition: 0, interval: 0, easeFactor: 2.5, dueDate: now + 86400000, lastReviewedDate: null, history: [] },
        })));
      });
    });

    const openTab = async (page: Page, tab: 'deck' | 'review') => {
      await page.locator(`#tab-${viewport.width === 390 ? 'mobile' : 'desktop'}-${tab}`).click();
      await expect(page.locator(`#panel-${tab}`)).toBeVisible();
    };

    test('clearing an empty filter restores existing words without changing stored data', async ({ page }, testInfo) => {
      await openTab(page, 'deck');
      await expect(page.getByText('term0', { exact: true })).toBeVisible();
      const search = page.getByRole('searchbox');
      await search.fill('zzzznomatchzzzz');
      await expect(page.getByRole('heading', { name: 'Không có từ nào phù hợp với bộ lọc' })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('empty-filter.png'), fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
      await expect(search).toHaveValue('');
      await expect(page.getByText('term0', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => (window as any).__db.words.count())).toBe(24);
    });

    test('targeted skill practice preserves the schedule and daily counts, then clears the resolved suggestion', async ({ page }, testInfo) => {
      await page.evaluate(async () => {
        await (window as any).__db.settingsTable.put({ key: 'studyAttempts', value: [{
          id: 'old-hard', wordId: 'practice-23', date: Date.now() - 1000, mode: 'flashcards', rating: 1, sessionType: 'due',
        }] });
      });
      await openTab(page, 'review');
      const practice = page.getByRole('button', { name: 'Luyện 1 từ cần củng cố · Tự nhớ từ' });
      await expect(practice).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('skill-practice.png'), fullPage: true, animations: 'disabled' });
      const before = await page.evaluate(async () => {
        const db = (window as any).__db;
        return { word: await db.words.get('practice-23'), stats: await db.dailyStats.toArray() };
      });
      await practice.click();
      await expect(page.getByText(/⚡ Luyện thêm/)).toBeVisible();
      await page.getByRole('heading', { name: 'term23', exact: true }).click();
      await page.getByTitle('Good', { exact: true }).click();
      await expect(page.getByRole('button', { name: 'Ôn tập lại', exact: true })).toBeVisible();
      const after = await page.evaluate(async () => {
        const db = (window as any).__db;
        return { word: await db.words.get('practice-23'), stats: await db.dailyStats.toArray(),
          attempts: (await db.settingsTable.get('studyAttempts')).value };
      });
      expect(after.word.reviewMeta).toEqual(before.word.reviewMeta);
      expect(after.stats).toEqual(before.stats);
      expect(after.attempts).toHaveLength(2);
      expect(after.attempts[1]).toMatchObject({ mode: 'flashcards', sessionType: 'cram', rating: 3 });
      await page.getByRole('button', { name: 'Khám phá Bộ từ vựng' }).click();
      await openTab(page, 'review');
      await expect(practice).toHaveCount(0);
    });

    test('a second extra-practice session rotates away from the completed first ten', async ({ page }) => {
      await openTab(page, 'review');
      await page.getByRole('button', { name: /^Thẻ ghi nhớ/ }).click();
      await page.getByRole('button', { name: 'Luyện thêm 10 thẻ', exact: true }).click();
      const firstWords: string[] = [];
      for (let i = 0; i < 10; i++) {
        const heading = page.getByRole('heading', { name: /^term\d+$/ });
        await expect(heading).toBeVisible();
        firstWords.push((await heading.textContent())!);
        await heading.click();
        await page.getByTitle('Good', { exact: true }).click();
      }
      await expect(page.getByRole('button', { name: 'Ôn tập lại', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Khám phá Bộ từ vựng' }).click();
      await openTab(page, 'review');
      await page.getByRole('button', { name: /^Thẻ ghi nhớ/ }).click();
      await page.getByRole('button', { name: 'Luyện thêm 10 thẻ', exact: true }).click();
      await expect(page.getByRole('heading', { name: /^term\d+$/ })).toBeVisible();
      await expect.poll(() => page.evaluate(async () => (await (window as any).__db.settingsTable.get('studySession'))?.value.cards.length)).toBe(10);
      const secondWords = await page.evaluate(async () => (await (window as any).__db.settingsTable.get('studySession')).value.cards.map((word: any) => word.word));
      expect(secondWords.some((word: string) => firstWords.includes(word))).toBe(false);
      expect(await page.evaluate(async () => (await (window as any).__db.dailyStats.toArray())
        .reduce((count: number, row: any) => count + row.cardsReviewed, 0))).toBe(0);
    });
  });
}
