import { test, expect, type Page } from '@playwright/test';
import type { ReviewSessionState } from '../src/types/study';
import type { WordItem } from '../src/types/vocab';
import { concisePromiseMeaning, normalizedPromiseDefinition, verbosePromiseDefinition } from '../tests/definitionClarityFixture';

type Question = { key: string; type: 'choice' | 'write'; word: WordItem; answered: number };
const pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors.length = 0;
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('lexipulse_ui_language', 'vi'));
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__db);
  await page.evaluate(async () => {
    for (const table of (window as any).__db.tables) await table.clear();
  });
});

test.afterEach(() => expect(pageErrors).toEqual([]));

for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]] as const) {
  test(`legacy verbose meanings stay concise during recall and resume on ${label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seedWords(page);
    await page.evaluate(async (definition) => {
      const db = (window as any).__db;
      const template = (await db.words.toArray())[0];
      await db.words.clear();
      await db.words.put({ ...template, id: 'promise', word: 'promise', vietnameseDefinition: definition });
    }, verbosePromiseDefinition);
    await openLearn(page, label === 'mobile');
    const session = page.getByRole('region', { name: 'Học thông minh', exact: true });
    await expect(session.getByRole('heading', { name: concisePromiseMeaning, exact: true })).toBeVisible();
    await expect(session).not.toContainText('ví dụ:');
    await expect(session.getByRole('textbox', { name: 'Câu trả lời' })).toBeInViewport();
    await page.screenshot({ path: `test-results/concise-meaning-${label}.png`, fullPage: true });
    await page.reload();
    await page.locator(label === 'mobile' ? '#tab-mobile-review' : '#tab-desktop-review').click();
    await page.getByRole('button', { name: 'Tiếp tục phiên học', exact: true }).click();
    await expect(session.getByRole('heading', { name: concisePromiseMeaning, exact: true })).toBeVisible();
    const original = await page.evaluate(async () => (await (window as any).__db.words.get('promise')).vietnameseDefinition);
    expect(original).toBe(normalizedPromiseDefinition);
    const backup = await page.evaluate(async () => (await (window as any).__db.settingsTable.get('definition_cleanup_originals_v1')).value.words);
    expect(backup.find((word: WordItem) => word.id === 'promise').vietnameseDefinition).toBe(verbosePromiseDefinition);
    await answerCorrectly(page, (await currentQuestion(page))!, false, concisePromiseMeaning);
    await expect(page.getByRole('heading', { name: 'Bạn đã hoàn thành lượt học', exact: true })).toBeVisible();
  });
}

async function seedWords(page: Page, sessionType: 'due' | 'cram' = 'due') {
  await page.evaluate(async (kind) => {
    const now = Date.now();
    const due = now + (kind === 'due' ? -10000 : 86400000);
    const words = [
      ['allocate', 'phân bổ'],
      ['negotiate', 'đàm phán'],
      ['resilience', 'sự kiên cường'],
      ['efficient', 'đạt hiệu quả cao với ít thời gian và công sức'],
    ];
    await (window as any).__db.words.bulkPut(words.map(([word, meaning], index) => ({
      id: `learn-${index}`, word, pos: ['noun'], phonetics: {},
      vietnameseDefinition: meaning, englishDefinition: '', meanings: [], collocations: [],
      examples: [], wordFamily: [], tags: [], status: 'new', createdAt: now + index, updatedAt: now,
      reviewMeta: { repetition: 0, interval: 0, easeFactor: 2.5, dueDate: due + index,
        lastReviewedDate: null, history: [], schedulerVersion: 'fsrs-v5',
        fsrs: { due: due + index, stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0,
          reps: 0, lapses: 0, state: 0, last_review: 0 } },
    })));
  }, sessionType);
}

async function openLearn(page: Page, mobile = false, screenshots = false) {
  await page.locator(mobile ? '#tab-mobile-review' : '#tab-desktop-review').click();
  if (screenshots) {
    await expect(page.getByRole('heading', { name: 'Học hôm nay', exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/adaptive-learn-dashboard.png', fullPage: true });
  }
  await page.getByRole('button', { name: 'Bắt đầu học', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Học thông minh', exact: true })).toBeVisible();
  await expect.poll(() => currentQuestion(page)).not.toBeNull();
  if (screenshots) await page.screenshot({ path: 'test-results/adaptive-learn-question-desktop.png', fullPage: true });
}

// The saved question identifies the seeded answer. Assertions and all interactions use the visible UI.
async function currentQuestion(page: Page): Promise<Question | null> {
  return page.evaluate(async () => {
    const session = (await (window as any).__db.settingsTable.get('studySession'))?.value as ReviewSessionState | undefined;
    const task = session?.learn?.queue[0];
    const word = session?.learn?.items.find(item => item.word.id === task?.wordId)?.word;
    return task && word ? { ...task, word, answered: session!.learn!.answered } : null;
  });
}

async function advance(page: Page, question: Question, keyboard = false) {
  const next = page.getByRole('region', { name: 'Học thông minh', exact: true })
    .getByRole('button', { name: 'Tiếp tục', exact: true });
  await expect(next).toBeEnabled();
  if (keyboard) { await expect(next).toBeFocused(); await page.keyboard.press('Enter'); }
  else await next.click();
  await expect.poll(async () => (await currentQuestion(page))?.key ?? 'complete').not.toBe(question.key);
}

async function answerCorrectly(page: Page, question: Question, keyboard = false, meaning = question.word.vietnameseDefinition) {
  const session = page.getByRole('region', { name: 'Học thông minh', exact: true });
  await expect(session.getByRole('heading', {
    name: question.type === 'choice' ? question.word.word : meaning, exact: true,
  })).toBeVisible();
  if (question.type === 'choice') {
    const answer = session.getByRole('button', { name: meaning, exact: true });
    if (keyboard) {
      const number = await answer.locator('.learn-option-number').innerText();
      await answer.focus();
      await page.keyboard.press(number);
    }
    else await answer.click();
  } else {
    const answer = session.getByRole('textbox', { name: 'Câu trả lời', exact: true });
    await answer.fill(question.word.word);
    if (keyboard) await answer.press('Enter');
    else await session.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  }
  await expect(session.getByRole('status')).toContainText('Chính xác!');
  await advance(page, question, keyboard);
}

async function finishCorrectly(page: Page, keyboard = false, meanings: Record<string, string> = {}) {
  for (let index = 0; index < 24; index++) {
    const question = await currentQuestion(page);
    if (!question) break;
    await answerCorrectly(page, question, keyboard, meanings[question.word.id] ?? question.word.vietnameseDefinition);
  }
  await expect(page.getByRole('heading', { name: 'Bạn đã hoàn thành lượt học', exact: true })).toBeVisible();
}

async function learningRecords(page: Page) {
  return page.evaluate(async () => {
    const db = (window as any).__db;
    return { words: await db.words.toArray(), attempts: (await db.settingsTable.get('studyAttempts'))?.value ?? [],
      reviewed: (await db.dailyStats.toArray()).reduce((total: number, row: any) => total + row.cardsReviewed, 0),
      checkpoint: await db.settingsTable.get('studySession') };
  });
}

async function expectResultCount(page: Page, label: string, count: number) {
  const result = page.getByRole('region', { name: 'Kết quả lượt học', exact: true });
  await expect(result.getByText(label, { exact: true }).locator('..').getByText(String(count), { exact: true })).toBeVisible();
}

test('default Learn moves from recognition to recall, resumes a delayed retry, and grades each word once', async ({ page }) => {
  await seedWords(page);
  await openLearn(page, false, true);
  for (let index = 0; index < 4; index++) {
    const question = (await currentQuestion(page))!;
    expect(question.type).toBe('choice');
    await answerCorrectly(page, question);
  }
  const failed = (await currentQuestion(page))!;
  expect(failed.type).toBe('write');
  const session = page.getByRole('region', { name: 'Học thông minh', exact: true });
  await session.getByRole('textbox', { name: 'Câu trả lời', exact: true }).fill('wrong answer');
  await session.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  await expect(session.getByRole('status')).toContainText(`Đáp án: ${failed.word.word}`);
  await expect(session.getByRole('status')).toContainText('sau vài câu');
  await advance(page, failed);
  const next = (await currentQuestion(page))!;
  expect(next.word.id).not.toBe(failed.word.id);
  const beforeRetry = await learningRecords(page);
  expect(beforeRetry.reviewed).toBe(1);
  expect(beforeRetry.words.find((word: WordItem) => word.id === failed.word.id).reviewMeta.history).toHaveLength(1);

  await page.reload();
  await page.locator('#tab-desktop-review').click();
  await page.getByRole('button', { name: 'Tiếp tục phiên học', exact: true }).click();
  expect((await currentQuestion(page))?.key).toBe(next.key);
  for (let index = 0; index < 3; index++) {
    const intervening = (await currentQuestion(page))!;
    expect(intervening.word.id).not.toBe(failed.word.id);
    await answerCorrectly(page, intervening);
  }
  const retry = (await currentQuestion(page))!;
  expect(retry.word.id).toBe(failed.word.id);
  expect(retry.type).toBe('write');
  await answerCorrectly(page, retry);
  await expect(page.getByRole('heading', { name: 'Bạn đã hoàn thành lượt học', exact: true })).toBeVisible();
  await expectResultCount(page, 'từ đã tự nhớ', 4);
  const result = await learningRecords(page);
  expect(result.reviewed).toBe(4);
  expect(result.words.every((word: WordItem) => word.reviewMeta.history.length === 1)).toBe(true);
  const scheduledFailure = result.words.find((word: WordItem) => word.id === failed.word.id);
  expect(scheduledFailure.reviewMeta.history[0].rating).toBe(1);
  expect(result.attempts.filter((attempt: any) => !attempt.practice)).toHaveLength(4);
  expect(result.attempts.filter((attempt: any) => attempt.wordId === failed.word.id && attempt.practice)).toHaveLength(2);
  expect(new Set(result.attempts.map((attempt: any) => attempt.id)).size).toBe(result.attempts.length);
  expect(result.checkpoint).toBeUndefined();
  await page.screenshot({ path: 'test-results/adaptive-learn-complete.png', fullPage: true });
});

test('Learn extra practice uses the same progression while preserving every FSRS schedule', async ({ page }) => {
  await seedWords(page, 'cram');
  const before = await learningRecords(page);
  await openLearn(page);
  await expect(page.getByText(/Luyện thêm.*không thay đổi lịch ôn/)).toBeVisible();
  await finishCorrectly(page);
  const after = await learningRecords(page);
  expect(after.words.map((word: WordItem) => word.reviewMeta)).toEqual(before.words.map((word: WordItem) => word.reviewMeta));
  expect(after.reviewed).toBe(0);
  expect(after.attempts).toHaveLength(8);
  expect(after.attempts.every((attempt: any) => attempt.sessionType === 'cram')).toBe(true);
  expect(after.checkpoint).toBeUndefined();
});

test('mobile Learn supports keyboard answers and explicitly defers a revealed word', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedWords(page);
  await openLearn(page, true);
  const revealed = (await currentQuestion(page))!;
  const session = page.getByRole('region', { name: 'Học thông minh', exact: true });
  await session.getByRole('button', { name: 'Không biết', exact: true }).click();
  await expect(session.getByRole('status')).toContainText(`Đáp án: ${revealed.word.vietnameseDefinition}`);
  await session.getByRole('button', { name: 'Để ôn lại sau', exact: true }).click();
  await expect.poll(async () => (await currentQuestion(page))?.key).not.toBe(revealed.key);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/adaptive-learn-mobile.png', fullPage: true });
  await finishCorrectly(page, true);
  await expectResultCount(page, 'từ đã tự nhớ', 3);
  await expectResultCount(page, 'từ cần ôn lại', 1);
  const result = await learningRecords(page);
  const deferred = result.attempts.find((attempt: any) => attempt.wordId === revealed.word.id && !attempt.practice);
  expect(deferred).toMatchObject({ rating: 1, revealedAnswer: true, deferred: true, firstAttemptCorrect: false });
  expect(result.reviewed).toBe(4);
  expect(result.words.every((word: WordItem) => word.reviewMeta.history.length === 1)).toBe(true);
});

test('a failed recognition survives switching study modes and keeps its first official rating', async ({ page }) => {
  await seedWords(page);
  await openLearn(page);
  const failed = (await currentQuestion(page))!;
  expect(failed.type).toBe('choice');
  const session = page.getByRole('region', { name: 'Học thông minh', exact: true });
  await session.getByRole('group', { name: 'Các đáp án', exact: true })
    .getByRole('button').filter({ hasNotText: failed.word.vietnameseDefinition }).first().click();
  await expect(session.getByRole('status')).toContainText(`Đáp án: ${failed.word.vietnameseDefinition}`);
  await advance(page, failed);
  expect((await learningRecords(page)).reviewed).toBe(0);

  const modes = page.getByRole('group', { name: 'Chế độ học', exact: true });
  await modes.getByRole('button', { name: 'Flashcard', exact: true }).click();
  await expect(modes.getByRole('button', { name: 'Flashcard', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await modes.getByRole('button', { name: 'Học thông minh', exact: true }).click();
  await expect(session).toBeVisible();
  await finishCorrectly(page);

  const result = await learningRecords(page);
  const word = result.words.find((item: WordItem) => item.id === failed.word.id);
  expect(word.reviewMeta.history).toHaveLength(1);
  expect(word.reviewMeta.history[0].rating).toBe(1);
  expect(result.attempts.filter((attempt: any) => attempt.wordId === failed.word.id && !attempt.practice))
    .toEqual([expect.objectContaining({ rating: 1, firstAttemptCorrect: false, incorrectSubmissionCount: 1 })]);
  expect(result.reviewed).toBe(4);
  expect(result.words.every((item: WordItem) => item.reviewMeta.history.length === 1)).toBe(true);
  expect(new Set(result.attempts.map((attempt: any) => attempt.id)).size).toBe(result.attempts.length);
  expect(result.checkpoint).toBeUndefined();
});

test('deleting the active Learn word in the deck advances to valid questions without scheduling the deletion', async ({ page }) => {
  await seedWords(page);
  await openLearn(page);
  const deleted = (await currentQuestion(page))!;

  await page.locator('#tab-desktop-deck').click();
  const row = page.getByRole('article').filter({ has: page.getByRole('button', { name: deleted.word.word, exact: true }) });
  await expect(row).toBeVisible();
  await row.getByTitle('Xóa khỏi bộ từ', { exact: true }).click();
  await expect(row).not.toBeVisible();
  await expect.poll(() => page.evaluate(async id => !!await (window as any).__db.words.get(id), deleted.word.id)).toBe(false);

  await page.locator('#tab-desktop-review').click();
  await expect(page.getByRole('region', { name: 'Học thông minh', exact: true })).toBeVisible();
  await expect.poll(async () => (await currentQuestion(page))?.word.id).not.toBe(deleted.word.id);
  await finishCorrectly(page);
  await expectResultCount(page, 'từ đã tự nhớ', 3);

  const result = await learningRecords(page);
  expect(result.words).toHaveLength(3);
  expect(result.attempts.some((attempt: any) => attempt.wordId === deleted.word.id)).toBe(false);
  expect(result.reviewed).toBe(3);
  expect(result.words.every((word: WordItem) => word.reviewMeta.history.length === 1)).toBe(true);
  expect(result.checkpoint).toBeUndefined();
});

test('Learn excludes placeholder-only words and uses real English definitions in choice and recall', async ({ page }) => {
  const englishMeaning = 'Distribute resources for a particular purpose.';
  await seedWords(page);
  await page.evaluate(async meaning => {
    const db = (window as any).__db;
    await db.words.update('learn-0', { vietnameseDefinition: 'Chưa có định nghĩa', englishDefinition: meaning });
    await db.words.update('learn-1', { vietnameseDefinition: 'Chưa có định nghĩa', englishDefinition: '' });
  }, englishMeaning);
  await openLearn(page);
  const initial = (await currentQuestion(page))!;
  expect(initial.word.id).toBe('learn-0');
  expect(initial.type).toBe('choice');
  const session = page.getByRole('region', { name: 'Học thông minh', exact: true });
  await expect(session.getByRole('button', { name: englishMeaning, exact: true })).toBeVisible();
  await expect(session.getByText('Chưa có định nghĩa', { exact: true })).not.toBeVisible();
  await finishCorrectly(page, false, { 'learn-0': englishMeaning });
  await expectResultCount(page, 'từ đã tự nhớ', 3);

  const result = await learningRecords(page);
  const skipped = result.words.find((word: WordItem) => word.id === 'learn-1');
  expect(skipped.reviewMeta.history).toHaveLength(0);
  expect(result.attempts.some((attempt: any) => attempt.wordId === 'learn-1')).toBe(false);
  expect(result.words.find((word: WordItem) => word.id === 'learn-0').reviewMeta.history)
    .toEqual([expect.objectContaining({ rating: 3 })]);
  expect(result.reviewed).toBe(3);
  expect(result.checkpoint).toBeUndefined();
});
