import { test, expect, type Page } from '@playwright/test';
import type { LexiPulseDatabase } from '../src/services/db/schema';
import type { WordItem } from '../src/types/vocab';

test.use({ serviceWorkers: 'block' });

const wordId = 'legacy-ai-as-soon-as';
const legacyDefinition = "Cụm từ dùng để chỉ thời điểm ngay khi một sự việc xảy ra, thường xuất hiện trong câu điều kiện: 'as soon as he arrived, we started the meeting' nghĩa là 'khi anh ấy đến, chúng ta đã bắt đầu cuộc họp'.";
const conciseMeaning = 'ngay khi; vừa … thì …';
const usageNote = 'Diễn tả việc xảy ra ngay sau một việc khác. Dùng as soon as + mệnh đề.';
const contextSentence = 'As soon as he arrived, we started the meeting.';
const contextTranslation = 'Ngay khi anh ấy đến, chúng tôi bắt đầu cuộc họp.';
const examples = [
  { en: contextSentence, vi: contextTranslation, context: 'general' as const },
  { en: 'Please send the report as soon as you finish it.', vi: 'Vui lòng gửi báo cáo ngay khi bạn hoàn thành.', context: 'toeic' as const },
];

async function searchPhrase(page: Page) {
  await page.locator('.dictionary-search input[type=text]').fill('as soon as');
  await page.locator('.dictionary-search button[type=submit]').click();
  await expect(page.locator('.dictionary-entry')).toBeVisible();
}

async function expectClearDefinition(page: Page) {
  const definition = page.locator('.dictionary-definition');
  const meanings = definition.locator('.dictionary-meaning-text');
  await expect(meanings).toHaveText(['ngay khi', 'vừa … thì …']);
  await expect(definition.getByRole('heading', { name: 'Cách dùng', exact: true })).toBeVisible();
  await expect(definition.getByText(usageNote, { exact: true })).toBeVisible();
  const meaningText = (await meanings.allTextContents()).join('; ');
  expect(meaningText).not.toContain('mệnh đề');
  expect(meaningText).not.toContain(contextSentence);
  await expect(page.locator('.dictionary-context')).toContainText(contextSentence);
  for (const example of examples) {
    const card = page.locator('.dictionary-example').filter({ hasText: example.en });
    await expect(card.getByText(example.en, { exact: true })).toBeVisible();
    await expect(card.getByText(example.vi, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(legacyDefinition, { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`AI retranslation separates meaning, usage, and examples at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const pageErrors: string[] = [];
    const prompts: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('lexipulse_ui_language', 'vi');
      localStorage.setItem('lexipulse_theme', 'dark');
    });

    // All provider/dictionary responses are fixtures; no request reaches an external service.
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/__ai_fixture__/chat/completions') {
        const body = route.request().postDataJSON() as { messages: Array<{ role: string; content: string }> };
        prompts.push(body.messages.find(message => message.role === 'user')?.content || '');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({
            lemma: 'as soon as', pos: ['conjunction'], formLabels: [], inflections: [],
            ipaUs: '/æz suːn æz/', ipaUk: '/æz suːn æz/',
            vietnameseDefinition: conciseMeaning, usageNoteVi: usageNote,
            collocations: [{ phrase: 'as soon as possible', meaningVi: 'sớm nhất có thể' }],
            wordFamily: [], examples, tags: ['#TOEIC'],
          }) } }] }),
        });
      } else if (url.origin === 'http://127.0.0.1:4173') {
        await route.continue();
      } else {
        await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      }
    });

    await page.goto('/');
    await page.waitForFunction(() => !!(window as unknown as { __db?: LexiPulseDatabase }).__db);
    const original = await page.evaluate(async ({ wordId, legacyDefinition, contextSentence }) => {
      const db = (window as unknown as { __db: LexiPulseDatabase }).__db;
      for (const table of db.tables) await table.clear();
      await db.settingsTable.put({ key: 'appSettings', value: {
        aiProvider: 'custom', aiApiKey: '', aiBaseUrl: `${location.origin}/__ai_fixture__`,
        aiModel: 'fixture-definition-model', prioritizeAI: true,
      } });
      const now = Date.now();
      const lastReview = now - 86400000;
      const due = now + 14 * 86400000;
      const word: WordItem = {
        id: wordId, word: 'as soon as', pos: ['conjunction'], phonetics: { us: '/æz suːn æz/' },
        vietnameseDefinition: legacyDefinition, englishDefinition: 'Immediately after something happens.',
        meanings: [{ pos: 'conjunction', englishDefinition: 'Immediately after something happens.', vietnameseDefinition: legacyDefinition }],
        vietnameseDefinitionProvenance: { source: 'ai', provider: 'groq', model: 'legacy-model', createdAt: now - 86400000 },
        collocations: [], wordFamily: [], examples: [], contextSentence,
        tags: ['#TOEIC', '#MyPhrase'], notes: 'My saved phrase note', status: 'learning',
        source: 'ai', enrichmentStatus: 'completed', createdAt: now - 30 * 86400000, updatedAt: lastReview,
        reviewMeta: {
          repetition: 5, interval: 14, easeFactor: 2.6, dueDate: due, lastReviewedDate: lastReview,
          history: [{ date: lastReview, rating: 3, interval: 14, easeFactor: 2.6, repetition: 5 }],
          schedulerVersion: 'fsrs-v5', fsrs: {
            due, stability: 14, difficulty: 5, elapsed_days: 10, scheduled_days: 14,
            reps: 5, lapses: 1, state: 2, last_review: lastReview,
          },
        },
      };
      await db.words.put(word);
      return word;
    }, { wordId, legacyDefinition, contextSentence });

    await page.reload();
    await searchPhrase(page);
    await expect(page.locator('.dictionary-meaning-text')).toHaveText(legacyDefinition);
    expect(prompts).toEqual([]);
    await page.locator('.dictionary-definition').getByRole('button', { name: 'Dịch lại bằng AI', exact: true }).click();
    await expectClearDefinition(page);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).not.toContain(legacyDefinition);
    expect(prompts[0]).not.toContain('TARGET LEARNING SENSE:');
    expect(prompts[0]).toContain(`Sentence context: "${contextSentence}"`);
    expect(prompts[0]).toContain('usageNoteVi');

    await expect.poll(() => page.evaluate(async id => {
      const db = (window as unknown as { __db: LexiPulseDatabase }).__db;
      return (await db.words.get(id))?.vietnameseDefinition;
    }, wordId)).toBe(conciseMeaning);
    const saved = await page.evaluate(async id => {
      const db = (window as unknown as { __db: LexiPulseDatabase }).__db;
      return { word: await db.words.get(id), count: await db.words.count() };
    }, wordId);
    expect(saved.count).toBe(1);
    expect(saved.word).toMatchObject({
      id: original.id, usageNoteVi: usageNote, contextSentence,
      reviewMeta: original.reviewMeta, createdAt: original.createdAt, status: original.status,
      notes: original.notes,
    });
    expect(saved.word?.tags).toEqual(expect.arrayContaining(original.tags));
    expect(saved.word?.examples).toEqual(examples);
    expect(saved.word?.vietnameseDefinitionProvenance).toMatchObject({ source: 'ai', provider: 'custom' });
    await page.reload();
    await searchPhrase(page);
    await expectClearDefinition(page);
    expect(prompts).toHaveLength(1);
    expect(pageErrors).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`ai-definition-${viewport.width}.png`), fullPage: true });
  });
}
