import { test, expect } from '@playwright/test';
import { verbosePromiseDefinition, normalizedPromiseDefinition } from '../tests/definitionClarityFixture';

const prose = 'Cụm từ này được sử dụng để diễn tả việc một hành động xảy ra ngay lập tức sau khi một hành động khác đã hoàn thành, nhấn mạnh sự liên tiếp về thời gian giữa hai sự kiện.';

test('cleans all existing words on startup and rewrites remaining long meanings through the bulk action', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lexipulse_ui_language', 'vi'));
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__db);
  await page.evaluate(async (definitions) => {
    const db = (window as any).__db;
    for (const table of db.tables) await table.clear();
    const now = Date.now();
    await db.settingsTable.put({ key: 'appSettings', value: {
      aiProvider: 'custom', aiApiKey: '', geminiApiKey: '', aiBaseUrl: 'http://127.0.0.1:4173/cleanup-ai',
      aiModel: 'test-model', speechRate: 1, speechPitch: 1, preferredAccent: 'US', dailyQuota: 20, theme: 'dark',
    } });
    await db.words.bulkPut(definitions.map(([word, definition]) => ({
      id: word, word, pos: ['noun'], phonetics: {}, vietnameseDefinition: definition, englishDefinition: '',
      meanings: [], examples: [{ en: 'An example kept separately.', vi: 'Một ví dụ được giữ riêng.', context: 'general' }],
      collocations: [], wordFamily: [], tags: [], status: 'new', createdAt: now, updatedAt: now,
      reviewMeta: { repetition: 0, interval: 0, easeFactor: 2.5, dueDate: now - 1000, lastReviewedDate: null, history: [],
        schedulerVersion: 'fsrs-v5', fsrs: { due: now - 1000, stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0,
          reps: 0, lapses: 0, state: 0, last_review: 0 } },
    })));
  }, [
    ['promise', verbosePromiseDefinition],
    ['bank', '(n) ngân hàng (ví dụ: Tôi đến ngân hàng.)'],
    ['implement', 'Động từ: thực hiện, triển khai (VD: Chúng tôi triển khai kế hoạch.)'],
    ['as soon as', prose],
    ['allocate', 'phân bổ'],
  ]);
  await page.reload();
  await expect.poll(() => page.evaluate(async () => (await (window as any).__db.words.get('promise'))?.vietnameseDefinition))
    .toBe(normalizedPromiseDefinition);
  const before = await page.evaluate(async () => (await (window as any).__db.words.toArray()));
  expect(before.find((word: any) => word.word === 'bank').vietnameseDefinition).toBe('ngân hàng');
  expect(before.find((word: any) => word.word === 'implement').vietnameseDefinition).toBe('thực hiện, triển khai');
  expect(before.find((word: any) => word.word === 'as soon as').vietnameseDefinition).toBe(prose);
  await page.locator('#tab-desktop-deck').click();
  await expect(page.locator('.deck-word-row').filter({ hasText: 'promise' })).not.toContainText('ví dụ:');
  await page.getByText('Nhập / Xuất', { exact: true }).click();
  await page.getByRole('button', { name: 'Kiểm tra & chỉnh nghĩa', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Kiểm tra & chỉnh nghĩa' });
  const shorten = dialog.getByRole('button', { name: 'Rút gọn nghĩa cho 1 từ bằng AI', exact: true });
  await expect(shorten).toBeEnabled();
  let requests = 0;
  await page.route('**/cleanup-ai/**', async route => {
    requests++;
    const body = route.request().postDataJSON();
    const prompt = body.messages.find((message: any) => message.role === 'user').content;
    expect(prompt).toContain(prose);
    expect(prompt).toContain('retain all of them as short equivalents');
    await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify({ vietnameseDefinition: 'ngay khi; vừa … thì …' }) } }] } });
  });
  await shorten.click();
  await expect(dialog.getByText(/Đã rút gọn 1 từ;/)).toBeVisible();
  expect(requests).toBe(1);
  await expect(dialog.getByRole('button', { name: 'Tải bản gốc (4 từ)', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/deck-wide-definition-cleanup.png', fullPage: true });
  const after = await page.evaluate(async () => {
    const db = (window as any).__db;
    return { words: await db.words.toArray(), backup: (await db.settingsTable.get('definition_cleanup_originals_v1')).value.words };
  });
  for (const word of after.words) {
    const original = before.find((item: any) => item.id === word.id);
    expect(word.reviewMeta).toEqual(original.reviewMeta);
    expect(word.examples).toEqual(original.examples);
  }
  expect(after.backup.find((word: any) => word.word === 'as soon as').vietnameseDefinition).toBe(prose);
  expect(after.backup.find((word: any) => word.word === 'promise').vietnameseDefinition).toBe(verbosePromiseDefinition);
  expect(after.words.find((word: any) => word.word === 'as soon as').vietnameseDefinition).toBe('ngay khi; vừa … thì …');
});
