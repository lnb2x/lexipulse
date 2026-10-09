// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext';
import { ReviewDashboard } from '../src/components/review/ReviewDashboard';
import { ReviewComplete } from '../src/components/review/ReviewComplete';
import { ReviewMatch } from '../src/components/review/ReviewMatch';
import { ToeicPractice } from '../src/components/review/ToeicPractice';
import { useSpacedRepetition } from '../src/hooks/useSpacedRepetition';
import { db } from '../src/services/db/schema';
import { getStudyAttempts } from '../src/services/studyProgress';
import { integrityWord } from './dataIntegrityFixture';
import type { ReviewSubmission } from '../src/types/study';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
beforeEach(async () => {
  for (const table of db.tables) await table.clear();
  localStorage.setItem('lexipulse_ui_language', 'vi');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const wrapper = ({ children }: { children: React.ReactNode }) => <LanguageProvider>{children}</LanguageProvider>;

it('starts a bounded due session and keeps selected date practice separate', () => {
  const words = Array.from({ length: 25 }, (_, i) => integrityWord(String(i), `word${i}`));
  const onStart = vi.fn();
  render(<ReviewDashboard dueCards={words} allWords={words} dailyQuota={10} reviewedTodayCount={0} streak={0} onStartSession={onStart} />, { wrapper });
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu học', exact: true }));
  expect(onStart).toHaveBeenLastCalledWith('learn', words.slice(0, 10), 'due');
  fireEvent.click(screen.getByRole('radio', { name: '20' }));
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu học', exact: true }));
  expect(onStart).toHaveBeenLastCalledWith('learn', words.slice(0, 20), 'due');
});

it('offers a separate difficult-word action only when it has cards', () => {
  const retry = vi.fn();
  const { rerender } = render(<ReviewComplete reviewedCount={2} streak={1} history={[]} difficultCount={1} onRetryDifficult={retry} onRestart={vi.fn()} onGoToDeck={vi.fn()} />, { wrapper });
  fireEvent.click(screen.getByRole('button', { name: 'Luyện lại 1 từ chưa nhớ' }));
  expect(retry).toHaveBeenCalledOnce();
  rerender(<ReviewComplete reviewedCount={2} streak={1} history={[]} difficultCount={0} onRetryDifficult={retry} onRestart={vi.fn()} onGoToDeck={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /từ chưa nhớ/ })).toBeNull();
});
it('cancels the matching completion callback when the board is closed', () => {
  vi.useFakeTimers();
  try {
    const complete = vi.fn();
    const { unmount } = render(<ReviewMatch cards={[integrityWord()]} onCompleteSession={complete} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: 'EN allocate' }));
    fireEvent.click(screen.getByRole('button', { name: 'VI phân bổ' }));
    unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(complete).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});

function submission(sessionType: 'due' | 'cram'): ReviewSubmission {
  const word = integrityWord();
  return { attempt: { id: 'session:original', wordId: word.id, date: Date.now(), mode: 'listen', rating: 2, sessionType,
    firstAttemptCorrect: false, incorrectSubmissionCount: 1, hintsUsedCount: 1 },
    checkpoint: { sessionId: 'session', inProgress: true, mode: 'listen', cards: [word], currentIndex: 0,
      clozeQuestions: [], sessionHistory: [], isCompleted: false, sessionType } };
}

it('saves one attempt with its FSRS update and checkpoint, rejecting a replay', async () => {
  await db.words.put(integrityWord());
  const { result } = renderHook(() => useSpacedRepetition());
  await act(async () => { expect(await result.current.submitRating('original', 2, 'due', submission('due'))).toBe(true); });
  const graded = await db.words.get('original');
  expect(graded?.reviewMeta.history).toHaveLength(1);
  expect(await getStudyAttempts()).toHaveLength(1);
  expect((await db.settingsTable.get('studySession'))?.value.sessionId).toBe('session');
  await act(async () => { expect(await result.current.submitRating('original', 2, 'due', submission('due'))).toBe(false); });
  expect((await db.words.get('original'))?.reviewMeta.history).toHaveLength(1);
});

it('practice adds skill evidence while preserving FSRS and official daily activity', async () => {
  const word = integrityWord();
  await db.words.put(word);
  const { result } = renderHook(() => useSpacedRepetition());
  await act(async () => { await result.current.submitRating(word.id, 2, 'cram', submission('cram')); });
  expect((await db.words.get(word.id))?.reviewMeta).toEqual(word.reviewMeta);
  expect(await db.dailyStats.count()).toBe(0);
  expect(await getStudyAttempts()).toHaveLength(1);
});

it('a checkpoint write failure rolls back the attempt and scheduler', async () => {
  const word = integrityWord();
  await db.words.put(word);
  const put = db.settingsTable.put.bind(db.settingsTable);
  vi.spyOn(db.settingsTable, 'put').mockImplementation((row) => {
    if (row.key === 'studySession') throw new Error('full storage');
    return put(row);
  });
  const { result } = renderHook(() => useSpacedRepetition());
  await act(async () => { await expect(result.current.submitRating(word.id, 2, 'due', submission('due'))).rejects.toThrow('full storage'); });
  expect((await db.words.get(word.id))?.reviewMeta).toEqual(word.reviewMeta);
  expect(await getStudyAttempts()).toEqual([]);
  expect(await db.dailyStats.count()).toBe(0);
});

it('Part 5 keeps a checked answer on remount and retries only missed questions', async () => {
  const first = render(<ToeicPractice />, { wrapper });
  fireEvent.click(screen.getByRole('combobox', { name: 'Chủ đề' }));
  fireEvent.click(screen.getByRole('option', { name: 'Từ loại' }));
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu Part 5' }));
  await screen.findByRole('button', { name: 'A. care' });
  fireEvent.click(screen.getByRole('button', { name: 'A. care' }));
  await screen.findByRole('button', { name: 'Câu tiếp theo' });
  expect(await getStudyAttempts()).toHaveLength(1);
  first.unmount();
  render(<ToeicPractice />, { wrapper });
  fireEvent.click(await screen.findByRole('button', { name: 'Tiếp tục Part 5' }));
  expect((screen.getByRole('button', { name: 'A. care' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Câu tiếp theo' }));
  await screen.findByRole('button', { name: 'B. opening' });
  expect(await getStudyAttempts()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng' }));
  fireEvent.click(screen.getByRole('button', { name: 'Luyện lại 1 câu từng sai' }));
  await screen.findByText(/Câu 1\/1/);
  fireEvent.click(screen.getByRole('button', { name: 'C. carefully' }));
  await screen.findByRole('button', { name: 'Câu tiếp theo' });
  await waitFor(async () => expect(await getStudyAttempts()).toHaveLength(2));
  expect((await getStudyAttempts())[1].firstAttemptCorrect).toBe(true);
});
