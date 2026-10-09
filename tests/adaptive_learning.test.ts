import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { advanceLearnQuestion, createLearnState, getLearnMeaning, getLearnProgress, getLearnQuestion, hasLearnMeaning, reconcileLearnSession, restoreLearnState } from '../src/services/adaptiveLearning';
import { db } from '../src/services/db/schema';
import { getStudyAttempts, isStudyAttempt, recordStudyAttempt, restoreStudySession, saveStudySession, skillSummary } from '../src/services/studyProgress';
import type { AttemptEvidence, LearnSessionState, ReviewSessionState, StudyAttempt } from '../src/types/study';
import type { ReviewRating } from '../src/types/vocab';
import { integrityWord } from './dataIntegrityFixture';

const cards = ['allocate', 'budget', 'confirm', 'delegate', 'estimate'].map((word, index) => ({
  ...integrityWord(`word-${index}`, word), vietnameseDefinition: `nghĩa ${index}`,
}));

function answer(state: LearnSessionState, rating: ReviewRating = 3, evidence: AttemptEvidence = { firstAttemptCorrect: true }) {
  return advanceLearnQuestion(state, rating, evidence)!;
}
function session(learn: LearnSessionState, history: ReviewSessionState['sessionHistory'] = []): ReviewSessionState {
  return { sessionId: 'learn-session', inProgress: true, mode: 'learn', cards, currentIndex: 0,
    clozeQuestions: [], sessionHistory: history, isCompleted: false, sessionType: 'due', learn };
}

beforeEach(async () => { for (const table of db.tables) await table.clear(); });

describe('Adaptive vocabulary learning', () => {
  it('starts new words with recognition and returns errors after three other questions', () => {
    const initial = createLearnState(cards);
    expect(getLearnQuestion(initial)).toMatchObject({ word: cards[0], type: 'choice' });
    const failed = answer(initial, 1, { firstAttemptCorrect: false, incorrectSubmissionCount: 1 });
    expect(failed.schedule).toBe(false);
    expect(failed.learn.queue.map(q => q.wordId)).toEqual(['word-1', 'word-2', 'word-3', 'word-0', 'word-4']);
    expect(failed.learn.queue[3].key).not.toBe(initial.queue[0].key);
    expect(initial.answered).toBe(0);
    let state = failed.learn;
    for (let i = 0; i < 3; i++) state = answer(state).learn;
    expect(getLearnQuestion(state)).toMatchObject({ word: cards[0], type: 'choice' });
    const recognized = answer(state);
    expect(recognized.learn.items[0].stage).toBe('write');
    expect(getLearnProgress(recognized.learn).mastered).toBe(0);
  });

  it('single words or indistinguishable meanings begin with a written check', () => {
    expect(getLearnQuestion(createLearnState([cards[0]]))?.type).toBe('write');
    expect(getLearnQuestion(createLearnState(cards.map(word => ({ ...word, vietnameseDefinition: 'same' }))))?.type).toBe('write');
    expect(answer(createLearnState([cards[0]])).learn.queue).toEqual([]);
  });

  it('excludes unavailable meanings instead of presenting the English answer as a writing prompt', () => {
    const blank = { ...cards[0], vietnameseDefinition: ' ', englishDefinition: '' };
    expect(createLearnState([blank]).items).toEqual([]);
    const usableEnglish = { ...blank, englishDefinition: 'to distribute' };
    const state = createLearnState([blank, cards[1], usableEnglish]);
    expect(state.items.map(item => item.word.id)).toEqual([cards[1].id, cards[0].id]);
    const restored = restoreLearnState(createLearnState(cards.slice(0, 2)), [blank, cards[1]])!;
    expect(restored.items.map(item => item.word.id)).toEqual([cards[1].id]);
  });

  it('rejects legacy and synthetic placeholders and uses a real English definition when Vietnamese is unavailable', () => {
    const legacy = { ...cards[0], vietnameseDefinition: ' Chưa có định nghĩa ', englishDefinition: '' };
    expect(getLearnMeaning(legacy)).toBe('');
    expect(hasLearnMeaning(legacy)).toBe(false);
    expect(createLearnState([legacy, cards[1]]).items.map(item => item.word.id)).toEqual([cards[1].id]);
    const fallback = { ...legacy, englishDefinition: ' To distribute resources ' };
    expect(getLearnMeaning(fallback)).toBe('To distribute resources');
    expect(getLearnQuestion(createLearnState([fallback, cards[1]]))?.type).toBe('choice');
    expect(getLearnMeaning({ ...fallback, vietnameseDefinition: ' phân bổ ' })).toBe('phân bổ');
    expect(getLearnMeaning({ ...legacy, englishDefinition: "Definition for 'allocate'" })).toBe('');
    expect(restoreLearnState(createLearnState(cards.slice(0, 2)), [legacy, cards[1]])?.items.map(item => item.word.id))
      .toEqual([cards[1].id]);
    expect(restoreLearnState(createLearnState([cards[0]]), [legacy])).toBeNull();
  });

  it('starts writing only from observed unassisted prior writing evidence', () => {
    const base: StudyAttempt = { id: 'prior', date: 1, mode: 'learn', rating: 3, sessionType: 'due', wordId: cards[0].id,
      questionType: 'write', firstAttemptCorrect: true };
    expect(getLearnQuestion(createLearnState(cards, [base]))?.type).toBe('write');
    for (const patch of [{ questionType: 'choice' as const }, { firstAttemptCorrect: false }, { hintsUsedCount: 1 },
      { revealedAnswer: true }, { deferred: true }]) {
      expect(getLearnQuestion(createLearnState(cards, [{ ...base, ...patch }]))?.type).toBe('choice');
    }
  });

  it('keeps the first failed writing grade while later unassisted success masters the session word', () => {
    const initial = createLearnState([cards[0]]);
    const first = answer(initial, 1, { firstAttemptCorrect: false, incorrectSubmissionCount: 1 });
    expect(first).toMatchObject({ schedule: true, rating: 1, evidence: { practice: false, firstAttemptCorrect: false } });
    const second = answer(first.learn, 1, { firstAttemptCorrect: false, incorrectSubmissionCount: 1 });
    expect(second.schedule).toBe(false);
    const last = answer(second.learn);
    expect(last.schedule).toBe(false);
    expect(last.evidence.practice).toBe(true);
    expect(last.learn.items[0].scheduledRating).toBe(1);
    expect(last.learn.items[0].evidence.incorrectSubmissionCount).toBe(2);
    expect(getLearnProgress(last.learn)).toEqual({ mastered: 1, deferred: 0, total: 1, answered: 3 });
  });

  it('carries failed recognition into the scheduled grade despite a later correct written answer', () => {
    let state = createLearnState(cards.slice(0, 2));
    state = answer(state, 1, { firstAttemptCorrect: false, incorrectSubmissionCount: 1 }).learn;
    state = answer(state).learn;
    state = answer(state).learn; // word 0 recognition succeeds, but its earlier failure is retained
    expect(getLearnQuestion(state)?.type).toBe('write');
    state = answer(state).learn; // word 1 written check
    const result = answer(state);
    expect(result.word.id).toBe(cards[0].id);
    expect(result).toMatchObject({ schedule: true, rating: 1, evidence: { firstAttemptCorrect: false, incorrectSubmissionCount: 1 } });
    expect(result.learn.items[0].stage).toBe('mastered');
  });

  it('does not count hints or revealed answers as mastery and explicitly defers difficult words', () => {
    const initial = createLearnState([cards[0]]);
    const helped = answer(initial, 3, { firstAttemptCorrect: true, hintsUsedCount: 1 });
    expect(helped).toMatchObject({ schedule: true, rating: 2 });
    expect(getLearnProgress(helped.learn).mastered).toBe(0);
    expect(getLearnQuestion(helped.learn)?.type).toBe('write');
    const deferred = answer(helped.learn, 1, { deferred: true, revealedAnswer: true });
    expect(deferred.schedule).toBe(false);
    expect(getLearnProgress(deferred.learn)).toEqual({ mastered: 0, deferred: 1, total: 1, answered: 2 });
    const earlyDefer = answer(createLearnState(cards), 1, { deferred: true, revealedAnswer: true });
    expect(earlyDefer).toMatchObject({ schedule: true, rating: 1 });
  });

  it('restores the exact pending key, including scheduled words, while pruning deleted and refreshing changed words', () => {
    let state = createLearnState(cards);
    state = answer(state).learn;
    state = answer(state).learn;
    state = answer(state).learn;
    state = answer(state).learn;
    expect(getLearnQuestion(state)?.word.id).toBe(cards[0].id);
    state = answer(state, 1, { firstAttemptCorrect: false, incorrectSubmissionCount: 1 }).learn;
    const saved = session(state, [{ word: cards[0], rating: 1 }]);
    const refreshed = cards.filter(word => word.id !== cards[2].id).map(word => word.id === cards[0].id ? { ...word, notes: 'edited' } : word);
    const restored = restoreStudySession(JSON.parse(JSON.stringify(saved)), refreshed)!;
    expect(restored.learn?.items.find(item => item.word.id === cards[0].id)).toMatchObject({ stage: 'write', scheduledRating: 1, word: { notes: 'edited' } });
    expect(restored.learn?.queue.some(q => q.wordId === cards[0].id)).toBe(true);
    expect(restored.learn?.queue.some(q => q.wordId === cards[2].id)).toBe(false);
    expect(getLearnQuestion(restored.learn)?.key).toBe(getLearnQuestion(state)?.key);
    expect(restored.sessionHistory).toHaveLength(1);
  });

  it('preserves mastered progress and rejects checkpoints that lose pending queue entries', () => {
    const learned = answer(createLearnState([cards[0]])).learn;
    const saved = { ...createLearnState(cards.slice(1, 2)), items: [...learned.items, ...createLearnState(cards.slice(1, 2)).items] };
    expect(getLearnProgress(restoreLearnState(saved, cards)!)).toMatchObject({ mastered: 1, total: 2 });
    expect(restoreLearnState({ ...createLearnState(cards), queue: [] }, cards)).toBeNull();
    expect(restoreStudySession({ ...session(createLearnState(cards)), learn: null }, cards)).toBeNull();
  });

  it('uses fresh question IDs when returning to Learn after a manual mode switch', () => {
    const first = answer(createLearnState(cards));
    const restarted = createLearnState(cards, [], first.learn.nextKey, first.learn);
    expect(new Set([...first.learn.queue.map(q => q.key), first.questionKey]).has(getLearnQuestion(restarted)!.key)).toBe(false);
    expect(restarted.answered).toBe(0);
    expect(restarted.items.every(item => item.scheduledRating === undefined)).toBe(true);
    expect(restarted.items[0].stage).toBe('write');
  });

  it('retains unscheduled recognition mistakes and hints across mode switches without reusing keys', () => {
    let state = createLearnState(cards.slice(0, 2));
    state = answer(state, 1, { firstAttemptCorrect: false, incorrectSubmissionCount: 1, hintsUsedCount: 1 }).learn;
    state = answer(state).learn;
    state = answer(state).learn;
    const priorKeys = new Set(state.queue.map(question => question.key));
    const resumed = createLearnState(cards.slice(0, 2), [], state.nextKey, state);
    expect(resumed.items[0]).toMatchObject({ stage: 'write', evidence: {
      firstAttemptCorrect: false, incorrectSubmissionCount: 1, hintsUsedCount: 1,
    } });
    expect(resumed.queue.every(question => !priorKeys.has(question.key))).toBe(true);
    const result = answer(resumed);
    expect(result).toMatchObject({ schedule: true, rating: 1, evidence: {
      firstAttemptCorrect: false, incorrectSubmissionCount: 1, hintsUsedCount: 1,
    } });
    const onlyPending = createLearnState([cards[1]], [], result.learn.nextKey, result.learn);
    expect(onlyPending.items.map(item => item.word.id)).toEqual([cards[1].id]);
    expect(onlyPending.items[0].stage).toBe('write');
  });

  it('refreshes live Learn content, prunes deleted or placeholder words, and exits an empty round', () => {
    const initial = session(createLearnState(cards.slice(0, 2)));
    initial.cards = cards.slice(0, 2);
    expect(reconcileLearnSession(initial, cards)).toBe(initial);
    const edited = { ...cards[1], vietnameseDefinition: 'nghĩa đã sửa', updatedAt: cards[1].updatedAt + 1 };
    const refreshed = reconcileLearnSession(initial, [edited]);
    expect(refreshed.cards).toEqual([edited]);
    expect(getLearnQuestion(refreshed.learn)).toMatchObject({ word: edited, key: initial.learn!.queue[1].key });
    expect(refreshed.currentIndex).toBe(0);
    expect(refreshed.isCompleted).toBe(false);
    expect(reconcileLearnSession(refreshed, [edited])).toBe(refreshed);
    const noMeaning = { ...edited, vietnameseDefinition: 'Chưa có định nghĩa', englishDefinition: '' };
    expect(reconcileLearnSession(refreshed, [noMeaning])).toMatchObject({
      inProgress: false, isCompleted: true, cards: [], learn: undefined,
    });
    const completed = answer(createLearnState([cards[0]])).learn;
    const settled = { ...session(completed), cards: [cards[0]] };
    expect(reconcileLearnSession(settled, cards)).toMatchObject({ inProgress: true, isCompleted: true });
  });

  it('refreshes cached Learn while preserving the selected manual card and pending evidence', () => {
    const failed = answer(createLearnState(cards.slice(0, 2)), 1, { firstAttemptCorrect: false, incorrectSubmissionCount: 1 });
    const manual = { ...session(failed.learn), mode: 'flashcards' as const, cards: cards.slice(0, 2), currentIndex: 0 };
    const edited = { ...cards[0], notes: 'edited' };
    const refreshed = reconcileLearnSession(manual, [edited, cards[1]]);
    expect(refreshed.currentIndex).toBe(0); // cached Learn points at word 1, manual mode stays on word 0
    expect(refreshed.learn?.items[0]).toMatchObject({ word: edited, evidence: { incorrectSubmissionCount: 1 } });
  });

  it('keeps cloze questions aligned with surviving manual cards when refreshing a cached Learn session', () => {
    const manual: ReviewSessionState = { ...session(createLearnState(cards.slice(0, 2))), mode: 'cloze', cards: cards.slice(0, 2) };
    manual.clozeQuestions = manual.cards.map(word => ({ word, sentenceWithBlank: 'Please ____ the task.',
      targetWord: word.word, options: [word.word], contextVi: '', hintPos: 'verb', hintDefinition: word.vietnameseDefinition }));
    const edited = { ...cards[1], notes: 'updated' };
    const refreshed = reconcileLearnSession(manual, [edited]);
    expect(refreshed.cards[refreshed.currentIndex]).toBe(edited);
    expect(refreshed.clozeQuestions[refreshed.currentIndex]).toMatchObject({ word: edited, targetWord: edited.word });
    expect(refreshed.clozeQuestions).toHaveLength(1);
    expect(reconcileLearnSession(refreshed, [])).toMatchObject({ inProgress: false, isCompleted: true, cards: [], clozeQuestions: [] });
  });

  it('rejects malformed evidence and question key counters before they can affect grading', () => {
    const initial = createLearnState(cards);
    for (const corrupt of [{ hintsUsedCount: -1 }, { incorrectSubmissionCount: '2' }, { firstAttemptCorrect: 'yes' }, { questionType: 'listen' }]) {
      const saved = { ...initial, items: [{ ...initial.items[0], evidence: corrupt }, ...initial.items.slice(1)] };
      expect(restoreLearnState(saved, cards)).toBeNull();
    }
    expect(restoreLearnState({ ...initial, nextKey: 1 }, cards)).toBeNull();
  });

  it('deduplicates checkpoint evidence and keeps practice out of recall statistics', async () => {
    const result = answer(createLearnState(cards), 1, { firstAttemptCorrect: false, incorrectSubmissionCount: 1 });
    const attempt: StudyAttempt = { ...result.evidence, id: result.questionKey, date: 1, mode: 'learn',
      rating: result.rating, wordId: result.word.id, sessionType: 'due' };
    expect(isStudyAttempt(attempt)).toBe(true);
    expect(isStudyAttempt({ ...attempt, questionType: 'unknown' })).toBe(false);
    await db.transaction('rw', db.settingsTable, async () => {
      await recordStudyAttempt(attempt);
      await saveStudySession(session(result.learn));
    });
    expect(await recordStudyAttempt(attempt)).toBe(false);
    expect(await getStudyAttempts()).toHaveLength(1);
    expect((await db.settingsTable.get('studySession'))?.value.learn.queue[0].key).toBe(result.learn.queue[0].key);
    expect(skillSummary([attempt])).toEqual([]);
    expect(skillSummary([attempt, { ...attempt, id: 'official', practice: false }])[0]).toMatchObject({ mode: 'learn', count: 1, firstTryRate: 0 });
  });
});
