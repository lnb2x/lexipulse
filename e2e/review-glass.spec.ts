import { test, expect, type Locator, type Page } from '@playwright/test';

async function prepareReview(page: Page, theme: 'light' | 'dark' = 'light', mobile = false) {
  await page.addInitScript((appearance) => {
    localStorage.setItem('lexipulse_ui_language', 'vi');
    localStorage.setItem('lexipulse_theme', appearance);
  }, theme);
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__db);
  await page.evaluate(async () => {
    const db = (window as any).__db;
    for (const table of db.tables) await table.clear();
    const now = Date.now();
    const terms = [['allocate', 'phân bổ'], ['negotiate', 'đàm phán'], ['resilience', 'sự kiên cường']];
    await db.words.bulkPut(terms.map(([word, meaning], index) => ({
      id: `review-glass-${index}`, word, pos: ['noun'], phonetics: {},
      vietnameseDefinition: meaning, englishDefinition: '', meanings: [], collocations: [],
      examples: [], wordFamily: [], tags: [], status: 'new', createdAt: now + index, updatedAt: now,
      reviewMeta: { repetition: 0, interval: 0, easeFactor: 2.5, dueDate: now - 10000 + index,
        lastReviewedDate: null, history: [], schedulerVersion: 'fsrs-v5',
        fsrs: { due: now - 10000 + index, stability: 0, difficulty: 0, elapsed_days: 0,
          scheduled_days: 0, reps: 0, lapses: 0, state: 0, last_review: 0 } },
    })));
  });
  await page.locator(mobile ? '#tab-mobile-review' : '#tab-desktop-review').click();
  await expect(page.getByRole('heading', { name: 'Học hôm nay', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bắt đầu học', exact: true })).toBeEnabled();
}

async function expectSelectionFollows(group: Locator, name: string) {
  const selected = group.getByRole('button', { name, exact: true });
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => {
    const target = await selected.boundingBox();
    const selection = await group.locator(':scope > .selection-surface').boundingBox();
    if (!target || !selection) return Infinity;
    return Math.max(...(['x', 'y', 'width', 'height'] as const)
      .map(dimension => Math.abs(target[dimension] - selection[dimension])));
  }).toBeLessThan(1.5);
}

async function expectWithinViewport(page: Page, controls: Locator) {
  const width = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const control of await controls.all()) {
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
}

async function currentMeaning(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const session = (await (window as any).__db.settingsTable.get('studySession')).value;
    return session.learn.items.find((item: any) => item.word.id === session.learn.queue[0].wordId).word.vietnameseDefinition;
  });
}

async function expectReadableQuestion(page: Page) {
  const card = page.locator('.learn-question-card.content-surface');
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS('backdrop-filter', 'none');
  await expect(card).toHaveCSS('filter', 'none');
  const contrast = await card.evaluate(element => {
    const channels = (value: string) => value.match(/[\d.]+/g)!.map(Number);
    const background = channels(getComputedStyle(element).backgroundColor);
    const text = channels(getComputedStyle(element.querySelector('.learn-question-word')!).color);
    const alpha = text[3] ?? 1;
    const foreground = text.slice(0, 3).map((value, index) => value * alpha + background[index] * (1 - alpha));
    const luminance = (rgb: number[]) => rgb.slice(0, 3).reduce((sum, value, index) => {
      const channel = value / 255;
      return sum + [0.2126, 0.7152, 0.0722][index] * (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    }, 0);
    const levels = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return { backgroundAlpha: background[3] ?? 1, ratio: (levels[0] + 0.05) / (levels[1] + 0.05) };
  });
  expect(contrast.backgroundAlpha).toBe(1);
  expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
}

for (const theme of ['light', 'dark'] as const) {
  test(`review glass matches the site in ${theme} mode, with a moving selection and readable Learn content`, async ({ page }) => {
    await prepareReview(page, theme);
    const modes = page.getByRole('group', { name: 'Chọn cách luyện', exact: true });
    await expect(modes.locator(':scope > .liquid-glass-backdrop')).toHaveCSS('backdrop-filter', /blur\(/);
    await expectSelectionFollows(modes, 'Học thông minh');
    await modes.getByRole('button', { name: 'Thẻ ghi nhớ', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expectSelectionFollows(modes, 'Thẻ ghi nhớ');
    await expect(page.getByRole('heading', { name: 'Thẻ ghi nhớ', exact: true })).toBeVisible();
    await modes.getByRole('button', { name: 'Học thông minh', exact: true }).focus();
    await page.keyboard.press('Space');
    await expectSelectionFollows(modes, 'Học thông minh');
    await page.getByRole('radio', { name: '20', exact: true }).check();
    await expect(page.getByRole('radio', { name: '20', exact: true })).toBeChecked();

    const start = page.locator('.quizlet-review-start-button.glass-button');
    await page.mouse.move(1, 1);
    await expect(start).toHaveCSS('backdrop-filter', /blur\(/);
    const studyAction = await start.evaluate(element => ({
      background: getComputedStyle(element).backgroundImage,
      color: getComputedStyle(element).color,
    }));
    expect(studyAction.background).toContain('linear-gradient');
    // Compare against an established prominent site control without starting another session.
    await page.getByRole('button', { name: 'TOEIC Part 5', exact: true }).click();
    const toeic = page.getByRole('button', { name: 'Bắt đầu Part 5', exact: true });
    await expect(toeic).toBeVisible();
    await page.mouse.move(1, 1);
    expect(await toeic.evaluate(element => ({
      background: getComputedStyle(element).backgroundImage,
      color: getComputedStyle(element).color,
    }))).toEqual(studyAction);
    await page.getByRole('button', { name: 'Từ vựng', exact: true }).click();
    await expectSelectionFollows(modes, 'Học thông minh');
    await page.screenshot({ path: `test-results/review-glass-dashboard-${theme}.png`, fullPage: true });
    await start.click();
    const activeModes = page.getByRole('group', { name: 'Chế độ học', exact: true });
    await expect(activeModes.locator(':scope > .liquid-glass-backdrop')).toHaveCSS('backdrop-filter', /blur\(/);
    await expectSelectionFollows(activeModes, 'Học thông minh');
    await expectReadableQuestion(page);
    const answers = page.getByRole('group', { name: 'Các đáp án', exact: true });
    const correct = answers.getByRole('button', { name: await currentMeaning(page), exact: true });
    await expect(correct).toHaveClass(/glass-button/);
    await expect(correct).toHaveCSS('backdrop-filter', /blur\(/);
    await page.screenshot({ path: `test-results/review-glass-question-${theme}.png`, fullPage: true });
    await correct.click();
    await expect(page.getByRole('region', { name: 'Học thông minh', exact: true }).getByRole('status'))
      .toContainText('Chính xác!');
    const next = page.getByRole('button', { name: 'Tiếp tục', exact: true });
    await expect(next).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Câu 2', { exact: true })).toBeVisible();
    await expectReadableQuestion(page);
  });
}

test('mobile review glass keeps all modes and session settings usable at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareReview(page, 'light', true);
  const modes = page.getByRole('group', { name: 'Chọn cách luyện', exact: true });
  await expectWithinViewport(page, modes.getByRole('button'));
  await modes.getByRole('button', { name: 'Thẻ ghi nhớ', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expectSelectionFollows(modes, 'Thẻ ghi nhớ');
  await modes.getByRole('button', { name: 'Học thông minh', exact: true }).click();
  await expectSelectionFollows(modes, 'Học thông minh');
  const all = page.getByRole('radio', { name: 'Tất cả', exact: true });
  await all.check();
  await expect(all).toBeChecked();
  await page.screenshot({ path: 'test-results/review-glass-dashboard-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Bắt đầu học', exact: true }).click();
  const activeModes = page.getByRole('group', { name: 'Chế độ học', exact: true });
  await expectWithinViewport(page, activeModes.getByRole('button'));
  await activeModes.getByRole('button', { name: 'Flashcard', exact: true }).press('Enter');
  await expectSelectionFollows(activeModes, 'Flashcard');
  await activeModes.getByRole('button', { name: 'Học thông minh', exact: true }).press('Enter');
  await expectSelectionFollows(activeModes, 'Học thông minh');
  await expectReadableQuestion(page);
  const answers = page.getByRole('group', { name: 'Các đáp án', exact: true });
  await expectWithinViewport(page, answers.getByRole('button'));
  await page.screenshot({ path: 'test-results/review-glass-question-mobile.png', fullPage: true });
  const correct = answers.getByRole('button', { name: await currentMeaning(page), exact: true });
  await expect(correct).toBeEnabled();
  await correct.focus();
  await expect(correct).toBeFocused();
  const shortcut = (await correct.locator('.learn-option-number').innerText()).trim();
  expect(shortcut).toMatch(/^[1-4]$/);
  await page.keyboard.press(shortcut);
  await expect(page.getByRole('region', { name: 'Học thông minh', exact: true }).getByRole('status'))
    .toContainText('Chính xác!');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).press('Enter');
  await expect(page.getByText('Câu 2', { exact: true })).toBeVisible();
  await expectWithinViewport(page, page.locator('.learn-answer-options').getByRole('button'));
});

test('review glass honors reduced transparency and motion while retaining keyboard operation', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-reduced-transparency', value: 'reduce' },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ] });
  await prepareReview(page, 'dark');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)).toBe(true);
  const modes = page.getByRole('group', { name: 'Chọn cách luyện', exact: true });
  const backdrop = modes.locator(':scope > .liquid-glass-backdrop');
  await expect(backdrop).toHaveCSS('backdrop-filter', 'none');
  await expect(backdrop).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await modes.getByRole('button', { name: 'Thẻ ghi nhớ', exact: true }).press('Enter');
  await expectSelectionFollows(modes, 'Thẻ ghi nhớ');
  const transition = await modes.locator(':scope > .selection-surface')
    .evaluate(element => getComputedStyle(element).transitionProperty);
  expect(transition).not.toMatch(/\b(?:all|transform|width|height)\b/);
  await modes.getByRole('button', { name: 'Học thông minh', exact: true }).press('Enter');
  await expectSelectionFollows(modes, 'Học thông minh');
  const start = page.getByRole('button', { name: 'Bắt đầu học', exact: true });
  await expect(start).toHaveCSS('backdrop-filter', 'none');
  await start.hover();
  await expect(start).toHaveCSS('transform', 'none');
  await start.click();
  await expectReadableQuestion(page);
  const correct = page.getByRole('group', { name: 'Các đáp án', exact: true })
    .getByRole('button', { name: await currentMeaning(page), exact: true });
  await expect(correct).toHaveCSS('backdrop-filter', 'none');
  await correct.press('Enter');
  await expect(page.getByRole('region', { name: 'Học thông minh', exact: true }).getByRole('status'))
    .toContainText('Chính xác!');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).press('Enter');
  await expect(page.getByText('Câu 2', { exact: true })).toBeVisible();
  await cdp.detach();
});
