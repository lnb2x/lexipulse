import { test, expect } from '@playwright/test';

test('first visit precaches unopened deck and review routes for offline use', async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem('lexipulse_ui_language', 'en'));
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller && !!(window as any).__db);
  await page.evaluate(async () => {
    await (window as any).__db.words.put({
      id: 'cold-offline', word: 'resilience', pos: ['noun'], phonetics: {},
      vietnameseDefinition: 'kiên cường', englishDefinition: 'recover', meanings: [], collocations: [], examples: [], wordFamily: [],
      tags: [], status: 'learning', createdAt: Date.now(), updatedAt: Date.now(),
      reviewMeta: { repetition: 1, interval: 1, easeFactor: 2.5, dueDate: Date.now() - 1000, lastReviewedDate: null, history: [] },
    });
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('tab', { name: /Deck/i }).click();
  await expect(page.getByRole('heading', { name: 'resilience', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Review/i }).click();
  await page.getByRole('button', { name: /Review 1 Cards Due Today/i }).click();
  await expect(page.getByText('Front Card')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('kiên cường').first()).toBeVisible();
  await page.getByRole('button', { name: /Good.*3/i }).click();
  await expect.poll(() => page.evaluate(async () => (await (window as any).__db.words.get('cold-offline')).reviewMeta.history.length)).toBe(1);
});
