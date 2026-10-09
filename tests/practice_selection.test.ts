import { describe, expect, it } from 'vitest';
import { selectDifficultPracticeWords, selectExtraPracticeWords } from '../src/services/practiceSelection';
import type { StudyAttempt } from '../src/types/study';
import { integrityWord } from './dataIntegrityFixture';

const words = Array.from({ length: 24 }, (_, i) => integrityWord(String(i).padStart(2, '0'), `word${i}`));
function attempt(wordId: string, date: number, overrides: Partial<StudyAttempt> = {}): StudyAttempt {
  return { id: `${wordId}:${date}`, wordId, date, mode: 'listen', rating: 3,
    sessionType: 'cram', firstAttemptCorrect: true, ...overrides };
}

describe('extra practice selection', () => {
  it('includes difficult words beyond the old first-ten slice and balances them with other words', () => {
    const attempts = words.slice(12).map(word => attempt(word.id, 10, { rating: 1 }));
    const result = selectExtraPracticeWords(words, attempts, 10);
    expect(result).toHaveLength(10);
    expect(result.filter(word => Number(word.id) >= 12)).toHaveLength(5);
    expect(result.filter(word => Number(word.id) < 12)).toHaveLength(5);
    expect(new Set(result.map(word => word.id)).size).toBe(10);
  });

  it('rotates to less recently practiced words after recording a completed session', () => {
    const first = selectExtraPracticeWords(words, [], 10);
    const second = selectExtraPracticeWords(words, first.map(word => attempt(word.id, 100)), 10);
    expect(second.some(word => first.includes(word))).toBe(false);
    expect(selectExtraPracticeWords(words, [], Infinity)).toHaveLength(words.length);
  });

  it('uses legacy review history and dates when no study attempts exist', () => {
    const legacy = integrityWord('legacy');
    legacy.reviewMeta.lastReviewedDate = 500;
    legacy.reviewMeta.history = [{ date: 500, rating: 1, interval: 1, easeFactor: 2.5, repetition: 1 }];
    expect(selectExtraPracticeWords([...words, legacy], [], 2)[0]).toBe(legacy);
    const recent = integrityWord('recent');
    recent.reviewMeta.lastReviewedDate = 600;
    expect(selectExtraPracticeWords([recent, words[0]], [], 1)).toEqual([words[0]]);
  });

  it('returns unique, bounded cards without mutating vocabulary or history', () => {
    const input = [words[0], words[0], words[1]];
    const snapshot = structuredClone(input);
    expect(selectExtraPracticeWords(input, [], 20)).toHaveLength(2);
    expect(selectExtraPracticeWords(input, [], 0)).toEqual([]);
    expect(selectExtraPracticeWords(input, [], -5)).toEqual([]);
    expect(selectExtraPracticeWords([], [], 10)).toEqual([]);
    expect(input).toEqual(snapshot);
  });
});

describe('practice by skill', () => {
  it('uses the latest result in the requested skill, including follow-up practice', () => {
    const attempts = [
      attempt('00', 20, { rating: 1 }), attempt('00', 30, { mode: 'choice' }),
      attempt('01', 20, { rating: 1 }), attempt('01', 30, { practice: true }),
      attempt('02', 40, { firstAttemptCorrect: false }),
      attempt('deleted', 10, { rating: 1 }),
      attempt('03', 10, { mode: 'toeic', rating: 1 }),
    ].reverse();
    expect(selectDifficultPracticeWords(words, attempts, 'listen').map(word => word.id)).toEqual(['00', '02']);
    expect(selectDifficultPracticeWords(words, attempts, 'choice')).toEqual([]);
  });

  it('treats hints, corrections, reveals, and deferrals as assisted recall', () => {
    const attempts = [
      attempt('00', 10, { hintsUsedCount: 1 }),
      attempt('01', 10, { revealedAnswer: true }),
      attempt('02', 10, { incorrectSubmissionCount: 1 }),
      attempt('03', 10, { deferred: true }),
      attempt('04', 10, { audioPlayCount: 5 }),
    ];
    expect(selectDifficultPracticeWords(words, attempts, 'listen').map(word => word.id)).toEqual(['00', '01', '02', '03']);
  });

  it('caps targeted practice at ten and revisits the oldest difficult words first', () => {
    const attempts = words.map((word, i) => attempt(word.id, 100 - i, { rating: 2 }));
    const selected = selectDifficultPracticeWords(words, attempts, 'listen');
    expect(selected).toHaveLength(10);
    expect(selected[0].id).toBe('23');
  });
});
