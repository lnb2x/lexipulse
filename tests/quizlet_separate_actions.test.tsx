// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ImportExportModal } from '../src/components/deck/ImportExportModal';
import { LanguageProvider } from '../src/context/LanguageContext';
import { createUnenrichedWordItem } from '../src/services/bulkEnrichment';
import { db } from '../src/services/db';
import * as parser from '../src/services/quizlet/quizletParser';
import * as bridge from '../src/services/quizlet/quizletBrowserBridge';
import type { WordItem } from '../src/types/vocab';

beforeEach(async () => {
  localStorage.setItem('lexipulse_ui_language', 'vi');
  await db.words.clear();
  await db.quizletSets.clear();
  vi.spyOn(bridge, 'detectQuizletBrowserBridge').mockResolvedValue(false);
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await db.words.clear();
  await db.quizletSets.clear();
});

async function openSet(allWords: WordItem[] = []) {
  const onImportComplete = vi.fn();
  const onStartReviewSession = vi.fn();
  const onClose = vi.fn();
  render(<LanguageProvider><ImportExportModal isOpen initialTab="quizlet" allWords={allWords}
    onClose={onClose} onImportComplete={onImportComplete} onStartReviewSession={onStartReviewSession} /></LanguageProvider>);
  fireEvent.change(screen.getByPlaceholderText(/quizlet\.com/), {
    target: { value: 'https://quizlet.com/123456/separate-actions/' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Tải bộ từ' }));
  await screen.findByText(/Tải thành công/);
  fireEvent.click(screen.getByLabelText(/Tự động tra cứu phát âm/));
  return { onImportComplete, onStartReviewSession, onClose };
}

it.each(['due', 'all'] as const)('adds selected words without starting review, then explicitly starts %s review', async scope => {
  vi.spyOn(parser, 'fetchQuizletSet').mockResolvedValue({ success: true, title: 'Separate actions', terms: [
    { term: 'shuttle bus', definition: 'xe buýt đưa đón' },
    { term: 'ladder', definition: 'cái thang' },
  ] });
  const callbacks = await openSet();
  const add = screen.getByRole('button', { name: 'Thêm từ đã chọn' }) as HTMLButtonElement;
  const review = screen.getByRole('button', { name: 'Ôn bộ từ' }) as HTMLButtonElement;
  expect(screen.queryByRole('button', { name: /Thêm và ôn/ })).toBeNull();
  expect(review.disabled).toBe(true);
  fireEvent.click(within(screen.getByText('ladder').closest('tr')!).getByRole('checkbox'));
  fireEvent.click(add);
  await waitFor(() => expect(callbacks.onImportComplete).toHaveBeenCalledWith(undefined, { keepOpen: true }));
  expect(callbacks.onClose).not.toHaveBeenCalled();
  expect(callbacks.onStartReviewSession).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeDefined();
  expect((await db.words.toArray()).map(word => word.word)).toEqual(['shuttle bus']);
  expect(review.disabled).toBe(false);
  expect(screen.queryByText('Chọn chế độ ôn tập bộ Quizlet')).toBeNull();
  fireEvent.click(review);
  await screen.findByText('Chọn chế độ ôn tập bộ Quizlet');
  fireEvent.click(screen.getByRole('button', { name: scope === 'due' ? /Chỉ từ đến hạn \(1 thẻ\)/ : /Toàn bộ từ trong bộ \(1 thẻ\)/ }));
  expect(callbacks.onClose).toHaveBeenCalledOnce();
  const [mode, cards, sessionType] = callbacks.onStartReviewSession.mock.calls[0];
  expect(mode).toBe('flashcards');
  expect(cards.map((word: WordItem) => word.word)).toEqual(['shuttle bus']);
  expect(sessionType).toBe(scope === 'due' ? 'due' : 'cram');
  expect(await db.words.count()).toBe(1);
});

it('can resolve a selected definition conflict without adding new words and reviews the fresh definition', async () => {
  const word = createUnenrichedWordItem({ rawWord: 'compliment', word: 'compliment', userMeaning: 'nghĩa cũ' });
  await db.words.put(word);
  vi.spyOn(parser, 'fetchQuizletSet').mockResolvedValue({ success: true, title: 'Definition conflict', terms: [
    { term: 'compliment', definition: 'lời khen' },
  ] });
  const callbacks = await openSet([word]);
  const add = screen.getByRole('button', { name: 'Thêm từ đã chọn' }) as HTMLButtonElement;
  expect(add.disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Dùng nghĩa Quizlet' }));
  fireEvent.click(within(screen.getByText('compliment').closest('tr')!).getByRole('checkbox'));
  expect(add.disabled).toBe(false);
  fireEvent.click(add);
  await waitFor(() => expect(callbacks.onImportComplete).toHaveBeenCalledOnce());
  const saved = await db.words.get(word.id);
  expect(saved?.vietnameseDefinition).toBe('lời khen');
  expect(saved?.reviewMeta).toEqual(word.reviewMeta);
  expect(callbacks.onStartReviewSession).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Ôn bộ từ' }));
  await screen.findByText('Chọn chế độ ôn tập bộ Quizlet');
  fireEvent.click(screen.getByRole('button', { name: /Toàn bộ từ trong bộ \(1 thẻ\)/ }));
  expect(callbacks.onStartReviewSession.mock.calls[0][1][0].vietnameseDefinition).toBe('lời khen');
  expect(await db.words.count()).toBe(1);
});

it('reviews existing words without importing selected new words or changing their FSRS schedule', async () => {
  const word = createUnenrichedWordItem({ rawWord: 'ladder', word: 'ladder', userMeaning: 'cái thang' });
  await db.words.put(word);
  vi.spyOn(parser, 'fetchQuizletSet').mockResolvedValue({ success: true, title: 'Mixed set', terms: [
    { term: 'ladder', definition: 'cái thang' },
    { term: 'shuttle bus', definition: 'xe buýt đưa đón' },
  ] });
  const callbacks = await openSet([word]);
  fireEvent.click(screen.getByRole('button', { name: 'Ôn bộ từ' }));
  await screen.findByText('Chọn chế độ ôn tập bộ Quizlet');
  fireEvent.click(screen.getByRole('button', { name: /Toàn bộ từ trong bộ \(1 thẻ\)/ }));
  expect(callbacks.onImportComplete).not.toHaveBeenCalled();
  expect(callbacks.onStartReviewSession.mock.calls[0][1].map((word: WordItem) => word.word)).toEqual(['ladder']);
  expect(await db.words.count()).toBe(1);
  expect((await db.words.get(word.id))?.reviewMeta).toEqual(word.reviewMeta);
});
