// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpacedRepetition } from '../src/hooks/useSpacedRepetition';
import { advanceLearnQuestion, createLearnState } from '../src/services/adaptiveLearning';
import { db, getTodayStats } from '../src/services/db';
import { getStudyAttempts, restoreStudySession, saveStudySession } from '../src/services/studyProgress';
import type { AttemptEvidence, ReviewSessionState, ReviewSubmission } from '../src/types/study';
import type { ReviewRating } from '../src/types/vocab';
import { integrityWord } from './dataIntegrityFixture';

const word = integrityWord('adaptive-word', 'allocate');
function makeSession(): ReviewSessionState {
  return { sessionId: 'adaptive-session', inProgress: true, mode: 'learn', cards: [word], currentIndex: 0,
    clozeQuestions: [], sessionHistory: [], isCompleted: false, sessionType: 'due', learn: createLearnState([word]) };
}
function submission(state: ReviewSessionState, rating: ReviewRating, evidence: AttemptEvidence): ReviewSubmission {
  const result = advanceLearnQuestion(state.learn!, rating, evidence)!;
  const history = result.schedule ? [...state.sessionHistory, { word: result.word, rating: result.rating }] : state.sessionHistory;
  return { practice: !result.schedule,
    attempt: { ...result.evidence, id: result.schedule ? `${state.sessionId}:${result.word.id}` : `${state.sessionId}:learn:${result.questionKey}`,
      date: Date.now(), wordId: result.word.id, questionId: result.questionKey, mode: 'learn', rating: result.rating, sessionType: 'due' },
    checkpoint: { ...state, learn: result.learn, sessionHistory: history, isCompleted: result.learn.queue.length === 0 } };
}

beforeEach(async () => { for (const table of db.tables) await table.clear(); await db.words.put(word); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Adaptive learning schedule transactions', () => {
  it('schedules a failed written check once, resumes it, and saves later mastery as practice without changing counts', async () => {
    const { result } = renderHook(() => useSpacedRepetition([word]));
    const first = submission(makeSession(), 1, { firstAttemptCorrect: false, incorrectSubmissionCount: 1 });
    await act(async () => { expect(await result.current.submitRating(word.id, first.attempt.rating, 'due', first)).toBe(true); });
    const scheduled = (await db.words.get(word.id))!.reviewMeta;
    const restored = restoreStudySession((await db.settingsTable.get('studySession'))?.value, [word])!;
    expect(restored.learn?.queue).toHaveLength(1);
    expect(restored.sessionHistory).toHaveLength(1);
    const retry = submission(restored, 3, { firstAttemptCorrect: true });
    await act(async () => { expect(await result.current.submitRating(word.id, retry.attempt.rating, 'due', retry)).toBe(true); });
    expect((await db.words.get(word.id))!.reviewMeta).toEqual(scheduled);
    expect(scheduled.history).toHaveLength(1);
    expect((await getTodayStats()).cardsReviewed).toBe(1);
    expect(await getStudyAttempts()).toHaveLength(2);
    expect(await db.settingsTable.get('studySession')).toBeUndefined();
    await act(async () => { expect(await result.current.submitRating(word.id, retry.attempt.rating, 'due', retry)).toBe(false); });
    expect(await getStudyAttempts()).toHaveLength(2);
  });

  it('recognition practice and mode-switch duplicate grades do not reschedule a word', async () => {
    const other = { ...integrityWord('other-word', 'confirm'), vietnameseDefinition: 'xác nhận' };
    await db.words.put(other);
    const { result } = renderHook(() => useSpacedRepetition([word, other]));
    const state = { ...makeSession(), cards: [word, other], learn: createLearnState([word, other]) };
    const choice = submission(state, 3, { firstAttemptCorrect: true });
    const before = (await db.words.get(word.id))!.reviewMeta;
    await act(async () => { expect(await result.current.submitRating(word.id, 3, 'due', choice)).toBe(true); });
    expect((await db.words.get(word.id))!.reviewMeta).toEqual(before);
    expect((await getTodayStats()).cardsReviewed).toBe(0);
    const restarted = { ...state, learn: createLearnState(state.cards, [], choice.checkpoint!.learn!.nextKey) };
    const choiceAfterSwitch = submission(restarted, 3, { firstAttemptCorrect: true });
    expect(choiceAfterSwitch.attempt.id).not.toBe(choice.attempt.id);
    await act(async () => { expect(await result.current.submitRating(word.id, 3, 'due', choiceAfterSwitch)).toBe(true); });
    const manual: ReviewSubmission = { attempt: { id: `${state.sessionId}:${word.id}`, date: Date.now(), mode: 'flashcards',
      wordId: word.id, rating: 3, sessionType: 'due' } };
    await act(async () => { expect(await result.current.submitRating(word.id, 3, 'due', manual)).toBe(true); });
    await act(async () => { expect(await result.current.submitRating(word.id, 1, 'due', { ...manual,
      attempt: { ...manual.attempt, mode: 'learn', rating: 1 } })).toBe(false); });
    expect((await db.words.get(word.id))!.reviewMeta.history).toHaveLength(1);
    expect((await getTodayStats()).cardsReviewed).toBe(1);
  });

  it.each([
    { evidence: { firstAttemptCorrect: false, incorrectSubmissionCount: 1 }, rating: 1 as const, expected: 1 },
    { evidence: { firstAttemptCorrect: true, hintsUsedCount: 1 }, rating: 2 as const, expected: 2 },
  ])('retains $expected scheduling evidence through leaving Learn, saving, and returning before the written check', async ({ evidence, rating, expected }) => {
    const other = { ...integrityWord('other-word', 'confirm'), vietnameseDefinition: 'xác nhận' };
    const words = [word, other];
    await db.words.put(other);
    const { result } = renderHook(() => useSpacedRepetition(words));
    const initial = { ...makeSession(), cards: words, learn: createLearnState(words) };
    const first = submission(initial, rating, evidence);
    await act(async () => { expect(await result.current.submitRating(word.id, first.attempt.rating, 'due', first)).toBe(true); });
    expect((await db.words.get(word.id))!.reviewMeta.history).toHaveLength(0);
    const manual = { ...first.checkpoint!, mode: 'flashcards' as const, learnNextKey: first.checkpoint!.learn!.nextKey };
    await saveStudySession(manual);
    const saved = restoreStudySession((await db.settingsTable.get('studySession'))?.value, words)!;
    let resumed = { ...saved, mode: 'learn' as const,
      learn: createLearnState(saved.cards, [], saved.learnNextKey, saved.learn) };
    const retry = submission(resumed, 3, { firstAttemptCorrect: true });
    expect(retry.attempt.id).not.toBe(first.attempt.id);
    await act(async () => { expect(await result.current.submitRating(word.id, 3, 'due', retry)).toBe(true); });
    resumed = retry.checkpoint!;
    const otherChoice = submission(resumed, 3, { firstAttemptCorrect: true });
    await act(async () => { expect(await result.current.submitRating(other.id, 3, 'due', otherChoice)).toBe(true); });
    resumed = otherChoice.checkpoint!;
    const written = submission(resumed, 3, { firstAttemptCorrect: true });
    expect(written.attempt).toMatchObject({ wordId: word.id, rating: expected, questionType: 'write', practice: false,
      ...evidence, firstAttemptCorrect: false });
    await act(async () => { expect(await result.current.submitRating(word.id, written.attempt.rating, 'due', written)).toBe(true); });
    expect((await db.words.get(word.id))!.reviewMeta.history).toHaveLength(1);
    expect((await db.words.get(word.id))!.reviewMeta.history[0].rating).toBe(expected);
    const pending = written.checkpoint!.cards.filter(card => !written.checkpoint!.sessionHistory.some(entry => entry.word.id === card.id));
    const backAgain = createLearnState(pending, [], written.checkpoint!.learn!.nextKey, written.checkpoint!.learn);
    expect(backAgain.items.map(item => item.word.id)).toEqual([other.id]);
    const attempts = await getStudyAttempts();
    expect(new Set(attempts.map(attempt => attempt.id)).size).toBe(attempts.length);
    expect((await getTodayStats()).cardsReviewed).toBe(1);
  });

  it('rolls back evidence, schedule and checkpoint on storage failure so the same submission can retry', async () => {
    const { result } = renderHook(() => useSpacedRepetition([word]));
    const first = submission(makeSession(), 3, { firstAttemptCorrect: true });
    const before = (await db.words.get(word.id))!.reviewMeta;
    const spy = vi.spyOn(db.settingsTable, 'delete').mockRejectedValueOnce(new Error('disk full'));
    await act(async () => { await expect(result.current.submitRating(word.id, 3, 'due', first)).rejects.toThrow('disk full'); });
    expect((await db.words.get(word.id))!.reviewMeta).toEqual(before);
    expect(await getStudyAttempts()).toEqual([]);
    expect((await getTodayStats()).cardsReviewed).toBe(0);
    spy.mockRestore();
    await act(async () => { expect(await result.current.submitRating(word.id, 3, 'due', first)).toBe(true); });
    expect((await db.words.get(word.id))!.reviewMeta.history).toHaveLength(1);
    expect(await getStudyAttempts()).toHaveLength(1);
  });

  it('extra practice Learn persists evidence while leaving the official schedule untouched', async () => {
    const { result } = renderHook(() => useSpacedRepetition([word]));
    const state = { ...makeSession(), sessionType: 'cram' as const };
    const first = submission(state, 3, { firstAttemptCorrect: true });
    first.attempt.sessionType = 'cram';
    const before = (await db.words.get(word.id))!.reviewMeta;
    await act(async () => { expect(await result.current.submitRating(word.id, 3, 'cram', first)).toBe(true); });
    expect((await db.words.get(word.id))!.reviewMeta).toEqual(before);
    expect((await getTodayStats()).cardsReviewed).toBe(0);
    expect(await getStudyAttempts()).toHaveLength(1);
  });
});
