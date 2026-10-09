// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext';
import { DeckView, type DeckViewProps } from '../src/features/deck/DeckView';
import { SkillProgress } from '../src/components/review/SkillProgress';
import { ReviewDashboard } from '../src/components/review/ReviewDashboard';
import type { StudyAttempt } from '../src/types/study';
import { integrityWord } from './dataIntegrityFixture';

beforeEach(() => localStorage.setItem('lexipulse_ui_language', 'vi'));
afterEach(cleanup);
const wrapper = ({ children }: { children: React.ReactNode }) => <LanguageProvider>{children}</LanguageProvider>;
function deckProps(allWords = [integrityWord()]): DeckViewProps {
  return { words: [], allWords, dailyStats: [], deckStats: { total: allWords.length, due: 0, new: 0, learning: 0, mastered: 0 },
    deckLoading: false, filterOptions: { search: 'missing', tags: ['work'], status: 'mastered', createdDate: '2026-10-01', sortBy: 'alpha', sortDirection: 'desc' },
    setFilterOptions: vi.fn(), allTags: [], availableDates: [], isFuzzyMatch: false,
    onOpenDetail: vi.fn(), onOpenEdit: vi.fn(), onDeleteWord: vi.fn(), onOpenImportExport: vi.fn(),
    onQuickExportCsv: vi.fn(), onQuickExportXlsx: vi.fn(), onStartReviewSession: vi.fn(), onNavigateToLookup: vi.fn(), showToast: vi.fn() };
}

it('clears every filtering condition while preserving sorting and stored words', () => {
  const props = deckProps();
  render(<DeckView {...props} />, { wrapper });
  expect(screen.getByRole('heading', { name: 'Không có từ nào phù hợp với bộ lọc' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Khám phá & Tra từ mới' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
  const update = vi.mocked(props.setFilterOptions).mock.calls[0][0];
  expect(typeof update === 'function' ? update(props.filterOptions) : update).toEqual({
    search: '', tags: [], status: 'all', createdDate: undefined, sortBy: 'alpha', sortDirection: 'desc',
  });
  expect(props.onNavigateToLookup).not.toHaveBeenCalled();
  expect(props.allWords).toHaveLength(1);
});

it('offers lookup for a truly empty deck, including the English translation', () => {
  localStorage.setItem('lexipulse_ui_language', 'en');
  const props = deckProps([]);
  render(<DeckView {...props} />, { wrapper });
  expect(screen.getByRole('heading', { name: 'Your vocabulary deck is empty' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Look Up New Words' }));
  expect(props.onNavigateToLookup).toHaveBeenCalledOnce();
});

it('starts targeted practice in its original skill as cram and removes resolved or deleted words', () => {
  const words = [integrityWord('hard'), integrityWord('resolved')];
  const attempts: StudyAttempt[] = ['hard', 'resolved', 'deleted'].map(wordId => ({ id: wordId, wordId,
    mode: 'listen', date: 10, rating: 1, firstAttemptCorrect: false, sessionType: 'due' }));
  attempts.push({ id: 'correct', wordId: 'resolved', mode: 'listen', date: 20, rating: 3,
    firstAttemptCorrect: true, sessionType: 'cram' });
  const onStart = vi.fn();
  const { rerender } = render(<SkillProgress allWords={words} attempts={attempts} onStartSession={onStart} />, { wrapper });
  fireEvent.click(screen.getByRole('button', { name: 'Luyện 1 từ cần củng cố · Nghe và chính tả' }));
  expect(onStart).toHaveBeenCalledWith('listen', [words[0]], 'cram');
  rerender(<SkillProgress allWords={[words[1]]} attempts={attempts} onStartSession={onStart} />);
  expect(screen.queryByRole('button', { name: /cần củng cố/ })).toBeNull();
});

it('uses historical difficulty for extra practice while leaving due-card order intact', () => {
  const words = Array.from({ length: 12 }, (_, i) => integrityWord(String(i), `word${i}`));
  const attempts: StudyAttempt[] = [{ id: 'hard', wordId: '11', mode: 'choice', date: 100,
    rating: 1, firstAttemptCorrect: false, sessionType: 'cram' }];
  const onStart = vi.fn();
  const props = { allWords: words, studyAttempts: attempts, dailyQuota: 10, reviewedTodayCount: 0, streak: 0, onStartSession: onStart };
  const { rerender } = render(<ReviewDashboard {...props} dueCards={[]} />, { wrapper });
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu học', exact: true }));
  expect(onStart.mock.calls[0][1]).toContain(words[11]);
  expect(onStart.mock.calls[0][1]).toHaveLength(10);
  expect(onStart.mock.calls[0][2]).toBe('cram');
  rerender(<ReviewDashboard {...props} dueCards={words} />);
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu học', exact: true }));
  expect(onStart).toHaveBeenLastCalledWith('learn', words.slice(0, 10), 'due');
});
