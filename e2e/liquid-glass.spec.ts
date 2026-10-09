import { test, expect, type Locator, type Page } from '@playwright/test';

test.use({ video: 'on' });
let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('lexipulse_theme', 'dark');
    localStorage.setItem('lexipulse_ui_language', 'vi');
    (window as any).__spoken = [];
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [],
      cancel() {}, speak(utterance: SpeechSynthesisUtterance) {
        (window as any).__spoken.push(utterance.text);
        setTimeout(() => utterance.onend?.(new Event('end') as SpeechSynthesisEvent), 10);
      },
    }, configurable: true });
  });
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__db);
  await page.evaluate(async () => {
    const db = (window as any).__db;
    for (const table of db.tables) await table.clear();
    const now = Date.now();
    await db.words.bulkPut(Array.from({ length: 80 }, (_, i) => ({
      id: `glass-${i}`, word: i === 0 ? 'negotiate' : `vocabulary${String(i).padStart(2, '0')}`, pos: ['verb'],
      phonetics: { us: '/nɪˈɡoʊ.ʃi.eɪt/', uk: '/nɪˈɡəʊ.ʃi.eɪt/' },
      vietnameseDefinition: i === 0 ? 'đàm phán; thương lượng' : `từ vựng ${i}`, englishDefinition: i === 0 ? 'to discuss something in order to reach an agreement' : 'a vocabulary practice entry', meanings: [],
      vietnameseDefinitionProvenance: { source: 'user_edit', isUserEdited: true, createdAt: now },
      collocations: i === 0 ? [{ phrase: 'negotiate a contract', meaningVi: 'đàm phán hợp đồng' }] : [],
      examples: [{ en: 'We need to negotiate a better price.', vi: 'Chúng ta cần thương lượng một mức giá tốt hơn.', context: 'general' }, { en: 'The company is negotiating a new contract.', vi: 'Công ty đang đàm phán hợp đồng mới.', context: 'toeic' }],
      wordFamily: [{ word: 'negotiation', pos: 'noun', meaningVi: 'sự đàm phán' }],
      inflections: [{ form: 'third-person', word: 'negotiates', label: 'Ngôi thứ ba' }, { form: 'past', word: 'negotiated', label: 'Quá khứ' }, { form: 'participle', word: 'negotiated', label: 'Phân từ' }, { form: 'continuous', word: 'negotiating', label: 'Tiếp diễn' }],
      tags: ['#TOEIC'], status: 'new', createdAt: now - (i % 3) * 86400000, updatedAt: now,
      reviewMeta: { repetition: 0, interval: 0, easeFactor: 2.5, dueDate: now - 10000 + i, lastReviewedDate: null, history: [] },
    })));
  });
});
test.afterEach(() => expect(pageErrors).toEqual([]));

async function navigate(page: Page, tab: 'lookup' | 'deck' | 'review') {
  const width = page.viewportSize()!.width;
  await page.locator(`#tab-${width < 768 ? 'mobile' : 'desktop'}-${tab}`).click();
  await expect(page.locator(`#panel-${tab}`)).toBeVisible();
}
async function lookup(page: Page) {
  await navigate(page, 'lookup');
  await page.locator('.dictionary-search input[type=text]').fill('negotiate');
  await page.locator('.dictionary-search button[type=submit]').click();
  await expect(page.locator('.dictionary-entry')).toBeVisible();
}

const functionalBackdrop = /blur\((2[0-9]|3[0-2])px\) saturate\((1\.65|165%)\) brightness\(1\.04\)/;

async function expectPointerLight(control: Locator, label = control.toString()) {
  await expect(control, `${label}: the hovered control should own the pointer light`).toHaveAttribute('data-glass-lit', 'true');
  expect(await control.evaluate(el => Number(getComputedStyle(el).getPropertyValue('--glass-light-opacity'))),
    `${label}: the material must render its reflection, not only track the pointer`).toBeGreaterThan(0);
  const coordinates = await control.evaluate(el => ['--mouse-x', '--mouse-y'].map(name => el.style.getPropertyValue(name)));
  for (const coordinate of coordinates) {
    expect(coordinate).toMatch(/^\d+(\.\d+)?%$/);
    expect(parseFloat(coordinate)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(coordinate)).toBeLessThanOrEqual(100);
  }
}

async function expectNoPointerLight(control: Locator, label = control.toString()) {
  await expect(control, `${label}: pointer light should be cleared`).not.toHaveAttribute('data-glass-lit', 'true');
  await expect.poll(() => control.evaluate(el => ['--mouse-x', '--mouse-y'].map(name => el.style.getPropertyValue(name))), {
    message: `${label}: inline pointer coordinates should be cleared`,
  }).toEqual(['', '']);
}

async function hoverGlassControl(page: Page, control: Locator, label: string) {
  // Scroll before moving the pointer, so an automatic scroll event cannot clear a new hover.
  await control.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await control.hover();
  await expectPointerLight(control, label);
}

async function expectSelectionGeometry(container: Locator, label: string) {
  await expect.poll(() => container.locator('.sliding-selection').evaluateAll(groups => {
    const mismatches: { group: string; property: string; actual: string; expected: string }[] = [];
    for (const element of groups) {
      const group = element as HTMLElement;
      const selected = group.querySelector<HTMLElement>(":scope > button[aria-selected='true'], :scope > button[aria-pressed='true']");
      if (!selected) {
        mismatches.push({ group: group.className, property: 'selected control', actual: 'missing', expected: 'one selected button' });
        continue;
      }
      const geometry = { '--selection-x': selected.offsetLeft, '--selection-y': selected.offsetTop,
        '--selection-width': selected.offsetWidth, '--selection-height': selected.offsetHeight };
      for (const [property, pixels] of Object.entries(geometry)) {
        const actual = group.style.getPropertyValue(property);
        const expected = `${pixels}px`;
        if (actual !== expected) mismatches.push({ group: group.className, property, actual, expected });
      }
    }
    return mismatches;
  }), { message: `${label}: selection measurements should settle after layout changes` }).toEqual([]);
}

test('floating capsules track the nearest pointer control and retain physical press feedback', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await navigate(page, 'deck');
  const nav = page.locator('nav[role=tablist]');
  const capsule = page.getByTestId('desktop-active-indicator');
  await page.mouse.move(8, 170);
  await expect.poll(async () => {
    const a = await capsule.boundingBox(); const b = await page.locator('#tab-desktop-deck').boundingBox();
    return Math.abs(a!.x - b!.x) + Math.abs(a!.width - b!.width);
  }).toBeLessThan(1);
  expect(await capsule.count()).toBe(1);
  await expect(nav).toHaveCSS('backdrop-filter', functionalBackdrop);
  await expect(page.locator('.app-header')).toHaveCSS('backdrop-filter', 'none');
  await expect(page.locator('.app-header')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const navBounds = (await nav.boundingBox())!;
  await nav.hover({ position: { x: navBounds.width / 2, y: 2 } });
  await expectPointerLight(nav);
  const deckTab = page.locator('#tab-desktop-deck');
  await deckTab.hover();
  await expectPointerLight(deckTab);
  await expectNoPointerLight(nav);
  await expect(deckTab).toHaveCSS('backdrop-filter', 'none');
  await page.mouse.move(8, 170);
  await expectNoPointerLight(deckTab);
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect.poll(() => page.locator('.app-header').evaluate(el => Number(el.style.getPropertyValue('--scroll-edge-opacity')))).toBeGreaterThan(.5);
  expect((await nav.boundingBox())!.y).toBeLessThan(25);
  expect(await page.locator('.deck-list-panel').evaluate(el => getComputedStyle(el).backdropFilter)).toBe('none');
  const button = page.getByRole('button', { name: 'Ôn tập ngay' });
  await button.hover();
  await expectPointerLight(button);
  await expect.poll(() => button.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).a)).toBeCloseTo(1.025, 3);
  await page.mouse.down();
  await expect.poll(() => button.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).a)).toBeCloseTo(.972, 3);
  await page.mouse.move(5, 180); await page.mouse.up();
  await page.screenshot({ path: testInfo.outputPath('floating-scroll.png') });
  expect(errors).toEqual([]);
});

test('glass filters change real collection data and popovers remain anchored and keyboard accessible', async ({ page }, testInfo) => {
  await navigate(page, 'deck');
  await page.getByRole('searchbox').fill('negotiate');
  await expect(page.locator('.deck-word-row')).toHaveCount(1);
  const sort = page.getByRole('combobox', { name: 'Sắp xếp từ' });
  await sort.focus(); await sort.press('Enter'); await sort.press('Home'); await sort.press('ArrowDown'); await sort.press('ArrowDown');
  await sort.press('Enter');
  await expect(sort).toHaveText(/A.*Z/);
  await expect(sort).toBeFocused();
  const dates = page.getByRole('combobox', { name: 'Tất cả ngày thêm' });
  await dates.click();
  const panel = page.getByRole('listbox', { name: 'Tất cả ngày thêm' });
  await expect.poll(async () => {
    const triggerRect = await dates.boundingBox(); const panelRect = await panel.boundingBox();
    return await panel.getAttribute('data-above') === 'true'
      ? Math.abs(triggerRect!.y - panelRect!.y - panelRect!.height)
      : Math.abs(panelRect!.y - triggerRect!.y - triggerRect!.height);
  }).toBeLessThan(16);
  await dates.press('Escape'); await expect(panel).toBeHidden();
  await dates.click(); await page.getByRole('heading', { name: 'Bộ từ vựng' }).click(); await expect(panel).toBeHidden();
  await page.locator('.deck-word-actions button').first().click();
  await expect.poll(() => page.evaluate(() => (window as any).__spoken)).toContain('negotiate');
  await page.locator('.deck-actions-menu summary').click();
  await expect(page.locator('.deck-actions-popover')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('collection-menu.png') });
  await page.locator('.deck-actions-menu summary').press('Escape');
  await lookup(page);
  await page.getByRole('heading', { name: 'Tra cứu từ vựng' }).click();
  await page.keyboard.press('/');
  await expect(page.locator('.dictionary-search input[type=text]')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.locator('.dictionary-pronunciation button').first().hover();
  await expect(page.getByRole('tooltip')).toContainText('Pronounce negotiate');
  await page.mouse.move(8, 170);
  await expect(page.getByRole('tooltip')).toBeHidden();
  await page.getByRole('button', { name: 'Tùy chỉnh từ này' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeHidden();
  expect(await page.evaluate(async () => (window as any).__db.words.count())).toBe(80);
});

test('all four screens fit desktop, tablet and mobile widths in both themes', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1920, 1600, 1440, 1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await lookup(page);
    for (const screen of ['lookup', 'deck', 'review', 'toeic'] as const) {
      if (screen === 'deck' || screen === 'review') await navigate(page, screen);
      if (screen === 'toeic') await page.getByRole('button', { name: 'TOEIC Part 5', exact: true }).click();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.mouse.move(8, 170);
      await page.waitForTimeout(340);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${screen} at ${width}px`).toBe(true);
      const navButtons = page.locator(`[id^=tab-${width < 768 ? 'mobile' : 'desktop'}]`);
      for (const tab of await navButtons.all()) {
        const rect = await tab.boundingBox(); expect(rect!.x).toBeGreaterThanOrEqual(0); expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
      }
      await page.screenshot({ path: testInfo.outputPath(`${screen}-${width}-dark.png`), fullPage: true });
      if (width === 1440) await page.screenshot({ path: testInfo.outputPath(`${screen}-desktop-dark.png`) });
    }
  }
  await page.getByRole('button', { name: 'Chuyển sang Giao diện Sáng', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.waitForTimeout(340);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await lookup(page);
    for (const screen of ['lookup', 'deck', 'review', 'toeic'] as const) {
      if (screen === 'deck' || screen === 'review') await navigate(page, screen);
      if (screen === 'toeic') await page.getByRole('button', { name: 'TOEIC Part 5', exact: true }).click();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.mouse.move(8, 170);
      await page.waitForTimeout(340);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${screen}-${width}-light.png`), fullPage: true });
      if (width === 1440) await page.screenshot({ path: testInfo.outputPath(`${screen}-desktop-light.png`) });
    }
  }
  await page.getByRole('combobox', { name: 'Chủ đề' }).click();
  await expect(page.getByRole('listbox', { name: 'Chủ đề' })).toHaveCSS('filter', 'none');
  await page.screenshot({ path: testInfo.outputPath('toeic-mobile-light-popover.png'), fullPage: true });
  await page.getByRole('option', { name: 'Giới từ', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu Part 5' }).click();
  await expect(page.getByRole('button', { name: 'A. on', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'C. at', exact: true }).click();
  await expect(page.getByText('Chính xác!', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('toeic-mobile-light-answer.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('reduced motion and increased contrast keep controls readable and interactive', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' });
  await navigate(page, 'review');
  const nav = page.locator('nav[role=tablist]');
  await nav.hover();
  await expectNoPointerLight(nav);
  expect(await page.locator('[data-glass-lit=true]').count()).toBe(0);
  expect(await nav.evaluate(el => getComputedStyle(el).backdropFilter)).toBe('none');
  await page.getByRole('button', { name: 'TOEIC Part 5', exact: true }).click();
  const topic = page.getByRole('combobox', { name: 'Chủ đề' });
  await topic.focus(); await topic.press('ArrowDown'); await topic.press('End'); await topic.press('Enter');
  await expect(topic).toHaveText(/Liên từ/);
  await page.screenshot({ path: testInfo.outputPath('accessible-material.png'), fullPage: true });
});

test('profiles pointer interaction without applying filters to the collection rows', async ({ page }, testInfo) => {
  await navigate(page, 'deck');
  const metrics = await page.evaluate(async () => {
    const intervals: number[] = []; let previous = performance.now();
    for (let i = 0; i < 90; i++) {
      const time = await new Promise<number>(resolve => requestAnimationFrame(resolve));
      intervals.push(time - previous); previous = time;
      document.querySelector('nav')?.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 400 + i * 2, clientY: 40, pointerType: 'mouse' }));
    }
    intervals.sort((a, b) => a - b);
    return { medianFrameMs: intervals[45], p95FrameMs: intervals[85], renderedRows: document.querySelectorAll('.deck-word-row').length,
      filteredRows: [...document.querySelectorAll('.deck-word-row')].filter(el => getComputedStyle(el).backdropFilter !== 'none').length };
  });
  await testInfo.attach('pointer-frame-profile', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
  expect(metrics.filteredRows).toBe(0);
  expect(metrics.renderedRows).toBeLessThan(80);
});

test('dialogs trap focus, lock scroll, restore focus and cancel an interrupted exit', async ({ page }, testInfo) => {
  await navigate(page, 'deck');
  const settings = page.getByRole('button', { name: 'Cài đặt', exact: true });
  await settings.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  const controls = dialog.locator('button:visible:not(:disabled), input:visible:not(:disabled), select:visible:not(:disabled), textarea:visible:not(:disabled), a[href]:visible');
  await controls.last().focus(); await page.keyboard.press('Tab');
  await expect(controls.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(controls.last()).toBeFocused();
  const rate = dialog.getByRole('slider').first();
  const oldRate = await rate.inputValue();
  await rate.focus(); await rate.press('ArrowRight');
  expect(await rate.inputValue()).not.toBe(oldRate);
  await page.screenshot({ path: testInfo.outputPath('settings-dark.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(settings).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await settings.click(); await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  // The retained panel is inert immediately; opening again interrupts its 160 ms exit.
  await settings.click(); await expect(dialog).toBeVisible();
  await page.waitForTimeout(220); await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await page.setViewportSize({ width: 390, height: 844 });
  await settings.click(); await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const panelRect = await dialog.boundingBox();
  expect(panelRect!.x).toBeGreaterThanOrEqual(0);
  expect(panelRect!.x + panelRect!.width).toBeLessThanOrEqual(390);
  expect(panelRect!.height).toBeLessThanOrEqual(844 - 32);
  await expect(dialog).toHaveCSS('opacity', '1');
  await page.screenshot({ path: testInfo.outputPath('settings-mobile.png') });
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
});

test('touch targets and optical layers remain usable on mobile and under accessibility preferences', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await navigate(page, 'deck');
  for (const control of await page.locator('.header-tools button:visible, .header-identity button:visible, .deck-word-actions button').all()) {
    const rect = await control.boundingBox();
    expect(rect!.width).toBeGreaterThanOrEqual(44);
    expect(rect!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('searchbox').fill('a-word-that-does-not-exist');
  await expect(page.locator('.deck-word-row')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('empty-mobile.png'), fullPage: true });
  await page.getByRole('searchbox').fill('');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await expect(page.locator('.deck-toolbar .liquid-glass-backdrop')).toHaveCSS('backdrop-filter', 'none');
  const sort = page.getByRole('combobox', { name: 'Sắp xếp từ' });
  await sort.focus(); await sort.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  await sort.press('Escape'); await expect(sort).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('forced-colors-mobile.png'), fullPage: true });
});

test('glass thickness samples a colored backdrop without filtering foreground text', async ({ page }, testInfo) => {
  await lookup(page);
  const surface = page.locator('.dictionary-search .liquid-glass').first();
  for (const variant of ['thin', 'regular', 'thick', 'clear', 'tinted']) {
    await surface.evaluate((el, value) => el.setAttribute('data-glass-variant', value), variant);
    await expect(surface).toHaveCSS('backdrop-filter', 'none');
    await expect(surface.locator(':scope > .liquid-glass-backdrop')).toHaveCSS('backdrop-filter', functionalBackdrop);
    await expect(surface.locator('input')).toHaveCSS('filter', 'none');
    await expect(surface.locator('button[type=submit]')).toHaveCSS('backdrop-filter', 'none');
    await page.screenshot({ path: testInfo.outputPath(`material-${variant}.png`) });
  }
  await surface.evaluate(el => el.setAttribute('data-glass-variant', 'regular'));
});

test('the lens displaces backdrop pixels only at the rim and respects transparency preferences', async ({ page }) => {
  await lookup(page);
  await page.mouse.move(8, 170);
  const search = page.locator('.dictionary-search .glass-search-field');
  const rim = search.locator(':scope > .glass-refraction');
  await search.evaluate(el => {
    el.parentElement!.style.background = 'repeating-linear-gradient(90deg, #2485b8 0 5px, #bedfd7 5px 10px)';
  });
  await expect(rim).toHaveCSS('backdrop-filter', /url\(/);
  await page.waitForTimeout(450);
  const bounds = (await search.boundingBox())!;
  const edgeClip = { x: bounds.x + 40, y: bounds.y + 1, width: bounds.width - 80, height: 3 };
  const centerClip = { x: bounds.x + 40, y: bounds.y + 15, width: bounds.width - 200, height: 24 };
  const edgeWithLens = await page.screenshot({ clip: edgeClip });
  const centerWithLens = await page.screenshot({ clip: centerClip });
  await rim.evaluate(el => el.style.backdropFilter = 'none');
  expect((await page.screenshot({ clip: edgeClip })).equals(edgeWithLens)).toBe(false);
  expect((await page.screenshot({ clip: centerClip })).equals(centerWithLens)).toBe(true);
  await rim.evaluate(el => el.style.removeProperty('backdrop-filter'));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  await expect(rim).toBeHidden();
  await expect(search.locator(':scope > .liquid-glass-backdrop')).toHaveCSS('backdrop-filter', 'none');
});

test('vocabulary content stays unblurred while its glass actions, tags and pronunciation retain behavior', async ({ page }) => {
  await lookup(page);
  const card = page.locator('.dictionary-entry');
  await expect(card).not.toHaveAttribute('data-glass');
  await expect(card).toHaveCSS('backdrop-filter', 'none');
  await expect(card).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(card.locator(':scope > .liquid-glass-backdrop, :scope > .liquid-glass-edge, :scope > .liquid-glass-reflection, :scope > .glass-refraction')).toHaveCount(0);
  expect(await card.locator('.content-surface').count()).toBeGreaterThan(3);
  for (const content of await card.locator('.content-surface').all()) {
    await expect(content).toHaveCSS('backdrop-filter', 'none');
    await expect(content).toHaveCSS('filter', 'none');
  }
  await expect(card.locator('h1')).toHaveCSS('filter', 'none');
  await card.locator('h1').hover();
  await expectNoPointerLight(card);
  const edit = page.getByRole('button', { name: 'Tùy chỉnh từ này' });
  await hoverGlassControl(page, edit, 'dictionary edit action before pronunciation');
  await expect(edit).toHaveCSS('backdrop-filter', functionalBackdrop);
  await expectNoPointerLight(card);
  const pronunciation = card.locator('.dictionary-pronunciation').first();
  await expect(pronunciation).toHaveCSS('backdrop-filter', functionalBackdrop);
  const speaker = pronunciation.locator('button');
  await expect(speaker).toHaveCSS('backdrop-filter', 'none');
  await speaker.hover();
  await expectPointerLight(speaker, 'dictionary US speaker action');
  await expectNoPointerLight(pronunciation);
  await speaker.click();
  await expect.poll(() => page.evaluate(() => (window as any).__spoken)).toContain('negotiate');
  const tag = card.getByRole('button', { name: '#Business', exact: true });
  await tag.click(); await expect(tag).toHaveAttribute('aria-pressed', 'true');
  await tag.click(); await expect(tag).toHaveAttribute('aria-pressed', 'false');
  await hoverGlassControl(page, edit, 'dictionary edit action after tag selection');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expectNoPointerLight(edit, 'dictionary edit action after window blur');
  await page.mouse.move(8, 170); await hoverGlassControl(page, edit, 'dictionary edit action after window blur recovery');
  await page.evaluate(() => window.scrollBy(0, 64));
  await expectNoPointerLight(edit, 'dictionary edit action after scrolling out from under the pointer');
  await page.mouse.move(8, 170); await hoverGlassControl(page, edit, 'dictionary edit action after scroll recovery');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectNoPointerLight(edit, 'dictionary edit action after reduced motion change');
  await edit.hover(); await expectNoPointerLight(edit, 'dictionary edit action under reduced motion');
  await expect(edit).toHaveCSS('transform', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference', contrast: 'no-preference' });
  await page.mouse.move(8, 170); await hoverGlassControl(page, edit, 'dictionary edit action after reduced motion recovery');
  await page.emulateMedia({ reducedMotion: 'no-preference', contrast: 'more' });
  await expectNoPointerLight(edit, 'dictionary edit action after increased contrast change');
  await expect(edit).toHaveCSS('backdrop-filter', 'none');
  await expect(card.locator(':scope > .liquid-glass-backdrop')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference', contrast: 'no-preference' });
  await page.mouse.move(8, 170); await hoverGlassControl(page, edit, 'dictionary edit action after increased contrast recovery');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  await expectNoPointerLight(edit, 'dictionary edit action after reduced transparency change');
  await expect(edit).toHaveCSS('backdrop-filter', 'none');
  await cdp.detach();
});

test('every collection action fits inside its row at desktop, tablet and mobile widths', async ({ page }, testInfo) => {
  await navigate(page, 'deck');
  for (const width of [1920, 1440, 1280, 1024, 950, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const panel = page.locator('.deck-list-panel');
    const bounds = (await panel.boundingBox())!;
    const actions = page.locator('.deck-word-actions').first();
    for (const button of await actions.locator('button').all()) {
      const rect = (await button.boundingBox())!;
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.x).toBeGreaterThan(bounds.x + 8);
      expect(rect.x + rect.width, `action at ${width}px must have room before the panel edge`).toBeLessThan(bounds.x + bounds.width - 8);
      await expect(button).toHaveCSS('backdrop-filter', 'none');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440) await page.screenshot({ path: testInfo.outputPath('collection-actions-dark.png') });
  }
});

test('import dialog tabs and long saved-set names fit inside an inset scroll area', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(async () => {
    const db = (window as any).__db;
    const now = Date.now();
    const sets = Array.from({ length: 5 }, (_, i) => ({ id: String(1071116215 + i),
      title: i === 0 ? 'CAMP BOMB – Listening comprehension: Lesson 3, workplace conversations' : `BE Quizlet ${i + 3} (Lesson ${i + 3})`,
      url: `https://quizlet.com/${1071116215 + i}/lesson-flash-cards/`, createdAt: now, updatedAt: now, wordCount: 16 }));
    await db.quizletSets.bulkPut(sets);
    const words = await db.words.toArray();
    await db.words.bulkPut(words.map((word: any, i: number) => ({ ...word, quizletSets: [{ ...sets[i % 5], importedAt: now }] })));
  });
  await navigate(page, 'deck');
  await page.locator('.deck-actions-menu summary').click();
  await page.locator('.deck-actions-popover').getByRole('button', { name: 'Từ Quizlet', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const body = dialog.locator('.dialog-scroll-body');
  await expect(dialog.locator('.quizlet-saved-set')).toHaveCount(5);
  await expect.poll(() => dialog.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).a)).toBe(1);
  const header = dialog.locator('.dialog-header');
  const headerY = (await header.boundingBox())!.y;
  await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
  expect((await header.boundingBox())!.y).toBe(headerY);
  await body.evaluate(el => { el.scrollTop = 0; });
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expectSelectionGeometry(dialog, `import dialog at ${width}px`);
    const bounds = (await dialog.boundingBox())!;
    const scrollBounds = (await body.boundingBox())!;
    expect(scrollBounds.x).toBeGreaterThan(bounds.x);
    expect(scrollBounds.x + scrollBounds.width).toBeLessThan(bounds.x + bounds.width);
    const overflow = await body.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth,
      outside: [...el.querySelectorAll<HTMLElement>('*')].filter(child => child.getBoundingClientRect().right > el.getBoundingClientRect().right)
        .slice(0, 8).map(child => ({ tag: child.tagName, className: child.className, text: child.textContent?.slice(0, 45) })) }));
    expect(overflow.scroll <= overflow.width, `${width}px: ${JSON.stringify(overflow)}`).toBe(true);
    for (const button of await dialog.locator('.quizlet-set-actions button').all()) {
      const rect = (await button.boundingBox())!;
      expect(rect.x).toBeGreaterThan(bounds.x + 8);
      expect(rect.x + rect.width).toBeLessThan(bounds.x + bounds.width - 8);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    }
    const pairedHeights = await dialog.locator('.quizlet-set-actions').evaluateAll(groups => groups.map(group => {
      const buttons = group.querySelectorAll('button');
      return Math.abs(buttons[0].getBoundingClientRect().height - buttons[1].getBoundingClientRect().height);
    }));
    expect(pairedHeights.every(difference => difference < 1)).toBe(true);
    await body.evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: testInfo.outputPath(`import-${width}-dark.png`), animations: 'disabled' });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectSelectionGeometry(dialog, 'import dialog returning to 1440px');
  for (const label of ['Nhập nhiều từ (Bulk)', 'Xuất file (Export)', 'Sao lưu JSON', 'Từ Quizlet']) {
    const tab = dialog.locator('.import-export-tabs').getByRole('button', { name: label, exact: true });
    await tab.click(); await expect(tab).toHaveAttribute('aria-pressed', 'true');
    expect(await body.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Chuyển sang Giao diện Sáng', exact: true }).click();
  await page.locator('.deck-actions-menu summary').click();
  await page.locator('.deck-actions-popover').getByRole('button', { name: 'Từ Quizlet', exact: true }).click();
  await expect(dialog.locator('.quizlet-saved-set')).toHaveCount(5);
  await page.screenshot({ path: testInfo.outputPath('import-desktop-light.png'), animations: 'disabled' });
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
  expect(await page.evaluate(async () => (window as any).__db.words.count())).toBe(80);
});

test('cloze and choice use shared materials without losing answer feedback or mode switching', async ({ page }, testInfo) => {
  await navigate(page, 'review');
  await page.getByRole('button', { name: /Điền từ ngữ cảnh/ }).click();
  await page.getByRole('button', { name: 'Ôn tập 10 thẻ đến hạn hôm nay', exact: true }).click();
  const panel = page.locator('.review-question-panel');
  await expect(panel).toBeVisible();
  const type = page.getByRole('button', { name: 'Tự gõ từ vào ô trống', exact: true });
  await type.click(); await expect(type).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.review-typed-answer input')).toBeVisible();
  await page.getByRole('button', { name: 'Trắc nghiệm 4 đáp án', exact: true }).click();
  await expect(panel.locator('.review-answer')).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath('cloze-desktop-dark.png'), animations: 'disabled' });
  await panel.locator('.review-answer').first().click();
  await expect(panel.locator('[data-answer-state=correct]')).toHaveCount(1);
  await expect(panel.locator('.review-continue')).toBeVisible();
  await page.getByRole('button', { name: '4 Đáp án', exact: true }).click();
  await expect(panel.locator('.review-answer')).toHaveCount(4);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('choice-mobile-dark.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Chuyển sang Giao diện Sáng', exact: true }).click();
  await page.getByRole('button', { name: 'Điền từ', exact: true }).click();
  await expect(panel).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('cloze-mobile-light.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: testInfo.outputPath('cloze-desktop-light.png'), animations: 'disabled' });
});

test('keyboard search, focus and saved tags preserve the Vietnamese learning content', async ({ page }) => {
  await navigate(page, 'lookup');
  const search = page.locator('.dictionary-search input[type=text]');
  await search.fill('negotiate'); await search.press('Enter');
  const card = page.locator('.dictionary-entry');
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading', { name: 'negotiate', exact: true })).toBeVisible();
  await expect(card.locator('.dictionary-meaning-text')).toHaveText(['đàm phán', 'thương lượng']);
  await expect(card).toContainText('Chúng ta cần thương lượng một mức giá tốt hơn.');
  await expect(card).toContainText('negotiate a contract');
  await expect(card).toContainText('Bảng biến thể ngữ pháp (Inflections)');
  await card.getByRole('button', { name: '#Business', exact: true }).click();
  const customTag = card.getByRole('textbox', { name: 'Thêm nhãn mới' });
  await customTag.fill('Practice'); await customTag.press('Enter');
  await expect(card.getByRole('button', { name: 'Xóa nhãn #Practice', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const save = card.getByRole('button', { name: 'Đã có trong bộ từ', exact: true });
  await card.getByRole('button', { name: 'Tùy chỉnh từ này' }).focus();
  await page.keyboard.press('Tab');
  await expect(save).toBeFocused();
  await expect(save).toHaveCSS('outline-style', 'solid');
  await expect(save).toHaveCSS('outline-width', '2px');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(async () => (await (window as any).__db.words.where('word').equals('negotiate').first()).tags)).toEqual(['#TOEIC', '#Business', '#Practice']);
  await navigate(page, 'deck');
  await page.getByRole('searchbox').fill('negotiate');
  await expect(page.locator('.deck-word-row')).toHaveCount(1);
  await expect(page.locator('.deck-word-row')).toContainText('#Practice');
  expect(await page.evaluate(async () => (window as any).__db.words.count())).toBe(80);
});

test.describe('interaction recording', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test('records the floating controls, menus, modal, theme and study navigation', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await lookup(page);
    await page.locator('.dictionary-search .glass-search-field').hover({ position: { x: 180, y: 24 } });
    await page.waitForTimeout(400);
    await navigate(page, 'deck');
    await page.getByRole('searchbox').fill('negotiate');
    await page.locator('.deck-actions-menu summary').click();
    await page.waitForTimeout(400);
    await page.locator('.deck-actions-menu summary').press('Escape');
    const sort = page.getByRole('combobox', { name: 'Sắp xếp từ' });
    await sort.click(); await page.waitForTimeout(350); await sort.press('Escape');
    await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible(); await page.waitForTimeout(400);
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeHidden();
    await navigate(page, 'review');
    await page.getByRole('button', { name: 'TOEIC Part 5', exact: true }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Chuyển sang Giao diện Sáng', exact: true }).click();
    await page.waitForTimeout(350);
    await navigate(page, 'lookup');
    await page.evaluate(() => window.scrollTo({ top: 540, behavior: 'smooth' }));
    await page.waitForTimeout(650);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    // Rapid changes must settle on the last requested screen with its data intact.
    for (const target of ['deck', 'review', 'lookup', 'deck'] as const) {
      await page.locator(`#tab-desktop-${target}`).click();
    }
    await expect(page.locator('#panel-deck')).toBeVisible();
    await expect(page.locator('.deck-word-row')).toHaveCount(1);
    expect(await page.evaluate(async () => (window as any).__db.words.count())).toBe(80);
    expect(errors).toEqual([]);
  });
});

test.describe('touch device', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('touch navigation avoids hover effects and reduced transparency removes backdrop sampling', async ({ page }) => {
    expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);
    await page.locator('#tab-mobile-deck').tap();
    await expect(page.locator('#panel-deck')).toBeVisible();
    const dates = page.getByRole('combobox', { name: 'Tất cả ngày thêm' });
    await dates.tap(); await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('heading', { name: 'Bộ từ vựng' }).tap();
    await expect(page.getByRole('listbox')).toBeHidden();
    await expectNoPointerLight(page.locator('.app-header [role=tablist]:visible'));
    expect(await page.locator('[data-glass-lit=true]').count()).toBe(0);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)).toBe(true);
    await expect(page.locator('.deck-toolbar .liquid-glass-backdrop')).toHaveCSS('backdrop-filter', 'none');
    await dates.tap(); await expect(page.getByRole('listbox')).toBeVisible();
    await cdp.detach();
  });
});
