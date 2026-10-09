// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { LanguageProvider } from '../src/context/LanguageContext';
import { db } from '../src/services/db/schema';
import { getStudyAttempts } from '../src/services/studyProgress';
import type { ReviewViewProps } from '../src/features/review/ReviewView';
import type { ReviewSessionState } from '../src/types/study';
import { integrityWord } from './dataIntegrityFixture';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
// Exercise App's real state handlers and storage, with a minimal view independent of styling.
vi.mock('../src/features/review/ReviewView', () => ({
  ReviewView: (props: ReviewViewProps) => <div>
    <output data-testid="review-state">{JSON.stringify(props.reviewState)}</output>
    <button disabled={!props.allWords.length} onClick={() => props.onStartReviewSession('learn', props.allWords, 'due')}>Start Learn</button>
    <button onClick={() => props.onSwitchReviewMode('flashcards')}>Manual</button>
    <button onClick={() => props.onSwitchReviewMode('learn')}>Learn</button>
    <button onClick={() => props.setReviewState(previous => ({ ...previous, currentIndex: 0 }))}>Seek first</button>
    <button onClick={() => props.onGradeReview(1, { firstAttemptCorrect: false, incorrectSubmissionCount: 1 })}>Fail</button>
    <button onClick={() => props.onGradeReview(3, { firstAttemptCorrect: true })}>Pass</button>
  </div>,
}));

const words = [
  integrityWord('app-learn-a', 'allocate'),
  { ...integrityWord('app-learn-b', 'confirm'), vietnameseDefinition: 'xác nhận' },
];
const state = (): ReviewSessionState => JSON.parse(screen.getByTestId('review-state').textContent!);

beforeEach(async () => {
  for (const table of db.tables) await table.clear();
  await db.words.bulkPut(words);
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    matches: media === '(prefers-reduced-motion: reduce)', media, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function start() {
  render(<LanguageProvider><App /></LanguageProvider>);
  fireEvent.click(document.getElementById('tab-desktop-review')!);
  await screen.findByTestId('review-state');
  await waitFor(() => expect((screen.getByText('Start Learn') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByText('Start Learn'));
  await waitFor(() => expect(state().learn?.items).toHaveLength(2));
}

async function grade(button: 'Fail' | 'Pass', answered: number) {
  fireEvent.click(screen.getByText(button));
  await waitFor(() => expect(state().learn?.answered).toBe(answered));
}

describe('Learn App state regressions', () => {
  it('keeps recognition errors and manual position when switching modes, then schedules the correct write as Again', async () => {
    await start();
    await grade('Fail', 1);
    expect(state().currentIndex).toBe(1);
    fireEvent.click(screen.getByText('Manual'));
    await waitFor(() => expect(state().mode).toBe('flashcards'));
    expect(state().learn?.items[0].evidence.incorrectSubmissionCount).toBe(1);
    fireEvent.click(screen.getByText('Seek first'));
    await waitFor(() => expect(state().currentIndex).toBe(0));
    fireEvent.click(screen.getByText('Learn'));
    await waitFor(() => expect(state().mode).toBe('learn'));
    expect(state().learn?.items[0].evidence.incorrectSubmissionCount).toBe(1);
    await grade('Pass', 1);
    await grade('Pass', 2);
    expect(state().learn?.queue[0]).toMatchObject({ wordId: words[0].id, type: 'write' });
    await grade('Pass', 3);
    expect((await db.words.get(words[0].id))?.reviewMeta.history).toHaveLength(1);
    expect((await db.words.get(words[0].id))?.reviewMeta.history[0].rating).toBe(1);
    const attempts = await getStudyAttempts();
    expect(new Set(attempts.map(attempt => attempt.id)).size).toBe(attempts.length);
  });

  it('moves off a deleted live question and clears the checkpoint when no usable meanings remain', async () => {
    await start();
    await db.words.delete(words[0].id);
    await waitFor(() => expect(state().learn?.queue[0].wordId).toBe(words[1].id));
    expect(state().cards.map(word => word.id)).toEqual([words[1].id]);
    await db.words.update(words[1].id, { vietnameseDefinition: 'Chưa có định nghĩa', englishDefinition: '' });
    await waitFor(() => expect(state()).toMatchObject({ inProgress: false, isCompleted: true, cards: [] }));
    await waitFor(async () => expect(await db.settingsTable.get('studySession')).toBeUndefined());
    expect((await db.words.get(words[1].id))?.reviewMeta.history).toHaveLength(0);
    expect(await getStudyAttempts()).toEqual([]);
  });
});
