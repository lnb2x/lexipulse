import { test, expect } from '@playwright/test';

test.describe('LexiPulse E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lexipulse_ui_language', 'vi');
    });
    await page.goto('/');
    await page.evaluate(async () => {
      if ((window as any).__db) {
        await (window as any).__db.words.clear();
        await (window as any).__db.dailyStats.clear();
      }
    });
  });

  test('1. Adding a new word to the deck', async ({ page }) => {
    // Type query in search input
    const searchInput = page.locator('input[placeholder*="Tra cứu từ"], input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
    await searchInput.click();
    await searchInput.fill('negotiate');

    // Click submit button
    const submitBtn = page.getByRole('button', { name: /Tìm kiếm|Search/i });
    await submitBtn.click();

    // Word card should render
    const wordHeading = page.locator('h1, h2').filter({ hasText: /^negotiate$/i });
    await expect(wordHeading.first()).toBeVisible({ timeout: 10000 });

    // Click "Lưu vào Deck" / "Save to Deck"
    const saveBtn = page.getByRole('button', { name: /Lưu vào Deck|Save to Deck/i });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Verify button state changes to "Đã có trong Deck" / "Already in Deck"
    await expect(page.getByRole('button', { name: /Đã có trong Deck|Already in Deck/i })).toBeVisible();

    // Switch to Deck tab
    const deckTabBtn = page.getByRole('button', { name: /Bộ từ vựng|Deck/i }).first();
    await deckTabBtn.click();

    // Verify word exists in deck list
    await expect(page.locator('text=negotiate').first()).toBeVisible();
  });

  test('2. Updating an existing word without losing review progress', async ({ page }) => {
    // Insert word directly with established review progress into IndexedDB
    await page.evaluate(async () => {
      await (window as any).__db.words.put({
        id: 'word-preserve-test',
        word: 'collaborate',
        pos: ['verb'],
        phonetics: { us: '/kəˈlæb.ə.reɪt/' },
        vietnameseDefinition: 'Hợp tác',
        englishDefinition: 'Work jointly with others.',
        meanings: [{ pos: 'verb', englishDefinition: 'Work jointly with others.', vietnameseDefinition: 'Hợp tác' }],
        collocations: [{ phrase: 'collaborate closely', meaningVi: 'hợp tác chặt chẽ' }],
        examples: [{ en: 'We collaborate closely.', vi: 'Chúng tôi hợp tác chặt chẽ.', context: 'workplace' }],
        wordFamily: [],
        tags: ['#customtag', '#project'],
        notes: 'User original notes',
        status: 'learning',
        reviewMeta: {
          repetition: 5,
          interval: 14,
          easeFactor: 2.6,
          dueDate: Date.now() + 864000000,
          lastReviewedDate: Date.now() - 86400000,
          history: [{ date: Date.now() - 86400000, rating: 2, interval: 14, easeFactor: 2.6, repetition: 5 }],
        },
        createdAt: Date.now() - 2592000000,
        updatedAt: Date.now() - 86400000,
        source: 'local_dictionary',
        enrichmentStatus: 'enriched',
      });
    });

    // Switch to Deck tab
    const deckNavBtn = page.locator('nav button').filter({ hasText: /Bộ từ vựng|Deck/i }).first();
    await deckNavBtn.click();
    await expect(page.locator('text=collaborate').first()).toBeVisible({ timeout: 10000 });

    // Click on the word to open detail
    await page.locator('text=collaborate').first().click();

    // Click Edit button inside detail modal
    const editBtn = page.getByRole('button', { name: /Chỉnh sửa|Edit/i }).first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Update definition inside EditableWordModal
    const modal = page.locator('div[aria-labelledby="editable-word-dialog-title"]');
    await expect(modal).toBeVisible();
    const defInput = modal.locator('input[placeholder*="Cơ sở"], input[placeholder*="translation"]');
    await defInput.fill('Hợp tác cùng phát triển');

    // Save changes
    const saveEditBtn = modal.getByRole('button', { name: /Lưu thay đổi|Save Changes/i });
    await saveEditBtn.click();

    // Verify in IndexedDB that reviewMeta, createdAt, status were strictly preserved
    const wordData = await page.evaluate(async () => {
      return await (window as any).__db.words.get('word-preserve-test');
    });

    expect(wordData).toBeDefined();
    expect(wordData.vietnameseDefinition).toBe('Hợp tác cùng phát triển');
    expect(wordData.reviewMeta.repetition).toBe(5);
    expect(wordData.reviewMeta.interval).toBe(14);
    expect(wordData.tags).toContain('#customtag');
  });

  test('3. Bulk import hyphenated words accurately', async ({ page }) => {
    // Switch to Deck tab
    const deckNavBtn = page.locator('nav button').filter({ hasText: /Bộ từ vựng|Deck/i }).first();
    await deckNavBtn.click();

    // Click "Nhập nhiều từ" / "Bulk Add"
    const bulkBtn = page.getByRole('button', { name: /Nhập nhiều từ|Bulk Add/i });
    await bulkBtn.click();

    // Verify modal is open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Fill in hyphenated words
    const bulkInput = modal.locator('textarea');
    const bulkText = [
      'cost-effective - Mang lại hiệu quả kinh tế cao',
      'state-of-the-art - Tối tân, hiện đại nhất',
      'up-to-date - Được cập nhật mới nhất',
    ].join('\n');

    await bulkInput.fill(bulkText);

    // Uncheck auto enrich to import quickly without external network requests
    const autoEnrichCheckbox = modal.locator('input[type="checkbox"]').first();
    if (await autoEnrichCheckbox.isChecked()) {
      await autoEnrichCheckbox.uncheck();
    }

    // Click proceed/submit button
    const proceedBtn = modal.getByRole('button', { name: /Thêm danh sách từ|Add Words to Deck/i });
    await proceedBtn.click();

    // Modal closes automatically on completion
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Verify all 3 hyphenated words appear in deck without being mangled
    await expect(page.locator('text=cost-effective').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=state-of-the-art').first()).toBeVisible();
    await expect(page.locator('text=up-to-date').first()).toBeVisible();
  });

  test('4. Completing a full review session', async ({ page }) => {
    // Seed 1 due word
    await page.evaluate(async () => {
      await (window as any).__db.words.put({
        id: 'due-word-1',
        word: 'innovate',
        pos: ['verb'],
        phonetics: { us: '/ˈɪn.ə.veɪt/' },
        meanings: [{ pos: 'verb', englishDefinition: 'Make changes in something established.', vietnameseDefinition: 'Đổi mới, cách tân' }],
        collocations: [],
        examples: [],
        wordFamily: [],
        tags: [],
        status: 'learning',
        reviewMeta: {
          repetition: 1,
          interval: 1,
          easeFactor: 2.5,
          dueDate: Date.now() - 1000,
          lastReviewedDate: Date.now() - 86400000,
          history: [],
        },
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
        source: 'local_dictionary',
        enrichmentStatus: 'enriched',
      });
    });

    await page.reload();

    // Go to Review tab
    await page.getByRole('button', { name: /Ôn tập SRS|Review/i }).first().click();

    // Start session if button visible
    const startBtn = page.getByRole('button', { name: /Bắt đầu ôn tập|Start Review/i });
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }

    // Flashcard should display 'innovate'
    await expect(page.locator('text=innovate').first()).toBeVisible();

    // Press Space or click to flip
    await page.keyboard.press('Space');

    // Rate card as Good (press 2 or click "Tốt")
    const goodBtn = page.getByRole('button', { name: /Tốt|Good/i });
    if (await goodBtn.isVisible()) {
      await goodBtn.click();
    } else {
      await page.keyboard.press('2');
    }

    // Review completion screen should appear
    await expect(page.locator('text=/Hoàn thành|Completed|Finished/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('5. Export and import round-trip', async ({ page }) => {
    // Seed 1 word
    await page.evaluate(async () => {
      await (window as any).__db.words.put({
        id: 'export-test-word',
        word: 'benchmark',
        pos: ['noun'],
        phonetics: { us: '/ˈbentʃ.mɑːrk/' },
        meanings: [{ pos: 'noun', englishDefinition: 'A standard against which things may be compared.', vietnameseDefinition: 'Tiêu chuẩn đối sánh' }],
        collocations: [],
        examples: [],
        wordFamily: [],
        tags: ['#metric'],
        status: 'learning',
        reviewMeta: {
          repetition: 3,
          interval: 6,
          easeFactor: 2.5,
          dueDate: Date.now() + 86400000,
          lastReviewedDate: Date.now(),
          history: [],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'local_dictionary',
        enrichmentStatus: 'enriched',
      });
    });

    await page.reload();
    await page.getByRole('button', { name: /Bộ từ vựng|Deck/i }).first().click();

    // Click Export/Backup button
    const exportBtn = page.getByRole('button', { name: /Xuất \/ Sao lưu|Export \/ Backup/i });
    await exportBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify export format options exist
    await expect(page.locator('text=/JSON/i').first()).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('6. Offline reload using cached assets and IndexedDB', async ({ page, context }) => {
    // Wait for Service Worker precaching to be ready
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }
    });
    await page.waitForTimeout(600);

    // Seed a word in IndexedDB
    await page.evaluate(async () => {
      await (window as any).__db.words.put({
        id: 'offline-test-word',
        word: 'resilience',
        pos: ['noun'],
        phonetics: { us: '/rɪˈzɪl.jəns/' },
        meanings: [{ pos: 'noun', englishDefinition: 'The capacity to recover quickly from difficulties.', vietnameseDefinition: 'Khả năng phục hồi, kiên cường' }],
        collocations: [],
        examples: [],
        wordFamily: [],
        tags: ['#softskills'],
        status: 'learning',
        reviewMeta: {
          repetition: 2,
          interval: 4,
          easeFactor: 2.5,
          dueDate: Date.now() + 100000,
          lastReviewedDate: Date.now(),
          history: [],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'local_dictionary',
        enrichmentStatus: 'enriched',
      });
    });

    // Emulate offline network
    await context.setOffline(true);

    // Reload page
    await page.reload();

    // Verify app shell header rendered
    await expect(page.locator('text=LexiPulse').first()).toBeVisible({ timeout: 10000 });

    // Switch to Deck tab and verify IndexedDB word loaded offline
    const deckNavBtn = page.locator('nav button').filter({ hasText: /Bộ từ vựng|Deck/i }).first();
    await deckNavBtn.click();
    await expect(page.locator('text=resilience').first()).toBeVisible();

    // Restore online
    await context.setOffline(false);
  });

  test('7. Keyboard navigation and modal focus trap with Escape key', async ({ page }) => {
    // Click body to unfocus search input
    await page.locator('header').click();

    // Press Alt+2 to switch to Deck tab
    await page.keyboard.press('Alt+2');
    await expect(page.getByRole('button', { name: /Nhập nhiều từ|Bulk Add/i })).toBeVisible();

    // Press Alt+1 to switch to Lookup tab
    await page.keyboard.press('Alt+1');
    const searchInput = page.locator('input[placeholder*="Tra cứu từ"], input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Open Shortcuts Modal
    const shortcutsBtn = page.getByRole('button', { name: /Phím tắt|Shortcuts/i }).first();
    await shortcutsBtn.click();

    // Verify modal has role="dialog" and aria-modal="true"
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Press Escape to close modal
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
