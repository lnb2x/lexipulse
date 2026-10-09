import { expect, test } from '@playwright/test';

for (const scenario of [
  { name: 'desktop light', theme: 'light', width: 1440, height: 900 },
  { name: 'desktop dark', theme: 'dark', width: 1440, height: 900 },
  { name: 'mobile dark', theme: 'dark', width: 390, height: 844 },
]) {
  test(`Quizlet dialog covers navigation and separates saving from review: ${scenario.name}`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.addInitScript(theme => {
      localStorage.setItem('lexipulse_theme', theme);
      localStorage.setItem('lexipulse_ui_language', 'vi');
    }, scenario.theme);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/quizlet/fetch', route => route.fulfill({ json: {
      success: true, title: 'Bộ từ kiểm thử giao diện', setId: '123456',
      terms: [
        { term: 'shuttle bus', definition: 'xe buýt đưa đón' },
        { term: 'ladder', definition: 'cái thang' },
      ],
    } }));
    await page.goto('/');
    await page.locator(scenario.width < 768 ? '#tab-mobile-deck' : '#tab-desktop-deck').click();
    await page.locator('.deck-actions-menu summary').click();
    await page.locator('.deck-actions-popover').getByRole('button', { name: 'Từ Quizlet', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const backdrop = page.locator('.app-dialog-backdrop');
    expect(await backdrop.evaluate(element => {
      const header = document.querySelector('.app-header')!;
      const nav = Array.from(header.querySelectorAll<HTMLElement>('[role="tablist"]')).find(element => element.offsetWidth > 0)!;
      const bounds = nav.getBoundingClientRect();
      return {
        aboveHeader: Number(getComputedStyle(element).zIndex) > Number(getComputedStyle(header).zIndex),
        blocksNavigation: !document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)?.closest('.app-header'),
      };
    })).toEqual({ aboveHeader: true, blocksNavigation: true });
    await dialog.getByPlaceholder(/https:\/\/quizlet.com/).fill('https://quizlet.com/123456/ui-fixture/');
    await dialog.getByRole('button', { name: 'Tải bộ từ', exact: true }).click();
    await expect(dialog.getByText(/Tải thành công 2 thẻ từ Quizlet/)).toBeVisible();
    const actions = dialog.locator('.quizlet-import-actions');
    await expect(actions.getByRole('button')).toHaveCount(2);
    const add = actions.getByRole('button', { name: 'Thêm từ đã chọn' });
    const review = actions.getByRole('button', { name: 'Ôn bộ từ' });
    await expect(add).toBeEnabled();
    await expect(review).toBeDisabled();
    await dialog.getByLabel(/Tự động tra cứu phát âm/).uncheck();
    await add.scrollIntoViewIfNeeded();
    const bounds = await actions.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(scenario.width);
    await page.screenshot({ path: `test-results/quizlet-actions-${scenario.name.replaceAll(' ', '-')}.png` });
    await add.click();
    await expect(dialog.getByText(/Đã lưu 2 từ mới/)).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(add).toBeDisabled();
    await expect(review).toBeEnabled();
    await expect(dialog.getByText('Chọn chế độ ôn tập bộ Quizlet')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__db.words.count())).toBe(2);
    await page.screenshot({ path: `test-results/quizlet-saved-${scenario.name.replaceAll(' ', '-')}.png` });
    await review.click();
    await expect(dialog.getByText('Chọn chế độ ôn tập bộ Quizlet')).toBeVisible();
    await dialog.getByRole('button', { name: /Toàn bộ từ trong bộ \(2 thẻ\)/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('tab', { name: /Ôn tập SRS/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-review')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
