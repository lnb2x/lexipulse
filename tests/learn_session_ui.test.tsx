// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LearnSession } from '../src/components/review/LearnSession';
import { LanguageProvider } from '../src/context/LanguageContext';
import { integrityWord } from './dataIntegrityFixture';
import { concisePromiseMeaning, verbosePromiseDefinition } from './definitionClarityFixture';

const word = integrityWord('allocate', 'allocate');
const other = { ...integrityWord('budget', 'budget'), vietnameseDefinition: 'ngân sách' };
const progress = { mastered: 0, deferred: 0, total: 2, answered: 0 };
const wrapper = ({ children }: { children: React.ReactNode }) => <LanguageProvider>{children}</LanguageProvider>;
beforeEach(() => localStorage.setItem('lexipulse_ui_language', 'vi'));
afterEach(cleanup);

it('shows a concise legacy meaning for recall and recognition and grades the displayed choice', () => {
  const promise = { ...integrityWord('promise', 'promise'), vietnameseDefinition: verbosePromiseDefinition };
  const props = { progress, allWords: [promise, other], isSubmitting: false, onAnswer: vi.fn() };
  const view = render(<LearnSession {...props} question={{ word: promise, type: 'write', key: 'legacy-write' }} />, { wrapper });
  expect(screen.getByRole('heading', { name: concisePromiseMeaning, exact: true })).toBeTruthy();
  expect(screen.queryByText(/ví dụ:/)).toBeNull();
  view.unmount();
  render(<LearnSession {...props} question={{ word: promise, type: 'choice', key: 'legacy-choice' }} />, { wrapper });
  fireEvent.click(screen.getByRole('button', { name: concisePromiseMeaning, exact: true }));
  expect(screen.getByRole('heading', { name: 'Chính xác!' })).toBeTruthy();
  expect(screen.queryByText(/ví dụ:/)).toBeNull();
  expect(promise.vietnameseDefinition).toBe(verbosePromiseDefinition);
});

it('accepts case and whitespace changes while recording an unassisted written answer', async () => {
  const onAnswer = vi.fn();
  render(<LearnSession question={{ word, type: 'write', key: 'q1' }} progress={progress} allWords={[word, other]} isSubmitting={false} onAnswer={onAnswer} />, { wrapper });
  fireEvent.change(screen.getByRole('textbox', { name: 'Câu trả lời' }), { target: { value: '  ALLOCATE  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }));
  expect(screen.getByRole('heading', { name: 'Chính xác!' })).toBeTruthy();
  expect(onAnswer).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
  await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(3, expect.objectContaining({ questionType: 'write', firstAttemptCorrect: true, hintsUsedCount: 0, revealedAnswer: false })));
});

it('keeps a hinted correct answer distinct from unassisted recall', async () => {
  const onAnswer = vi.fn();
  render(<LearnSession question={{ word, type: 'write', key: 'q2' }} progress={progress} allWords={[word, other]} isSubmitting={false} onAnswer={onAnswer} />, { wrapper });
  fireEvent.click(screen.getByRole('button', { name: 'Gợi ý' }));
  expect(screen.getByText('a…')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: 'Câu trả lời' }), { target: { value: 'allocate' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }));
  expect(screen.getByText(/Bạn sẽ gặp lại từ này/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
  await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(2, expect.objectContaining({ hintsUsedCount: 1, firstAttemptCorrect: true, incorrectSubmissionCount: 0 })));
});

it('reveals an unknown answer and lets the learner defer it without claiming mastery', async () => {
  const onAnswer = vi.fn();
  render(<LearnSession question={{ word, type: 'write', key: 'q3' }} progress={progress} allWords={[word, other]} isSubmitting={false} onAnswer={onAnswer} />, { wrapper });
  fireEvent.click(screen.getByRole('button', { name: 'Không biết' }));
  expect(screen.getByText('allocate', { exact: true })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Để ôn lại sau' }));
  await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(1, expect.objectContaining({ firstAttemptCorrect: false, revealedAnswer: true, deferred: true })));
});

it('supports number shortcuts and rejects duplicate advances while saving', async () => {
  let finish!: () => void;
  const onAnswer = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  render(<LearnSession question={{ word, type: 'choice', key: 'q4' }} progress={progress} allWords={[word, other]} isSubmitting={false} onAnswer={onAnswer} />, { wrapper });
  fireEvent.keyDown(window, { key: '1' });
  expect(screen.getByRole('status')).toBeTruthy();
  const button = screen.getByRole('button', { name: 'Tiếp tục' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(onAnswer).toHaveBeenCalledTimes(1);
  expect((button as HTMLButtonElement).disabled).toBe(true);
  await act(async () => finish());
});

it('does not offer empty or placeholder definitions as answer choices', () => {
  const unavailable = { ...integrityWord('missing', 'missing'), vietnameseDefinition: 'Chưa có định nghĩa', englishDefinition: '' };
  render(<LearnSession question={{ word, type: 'choice', key: 'q5' }} progress={progress} allWords={[word, other, unavailable]} isSubmitting={false} onAnswer={vi.fn()} />, { wrapper });
  const choices = screen.getByRole('group', { name: 'Các đáp án' });
  expect(choices.querySelectorAll('button')).toHaveLength(2);
  expect(screen.queryByRole('button', { name: 'Chưa có định nghĩa', exact: true })).toBeNull();
});
