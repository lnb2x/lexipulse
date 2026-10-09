import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/services/db/schema';
import { exportFullBackupToJson } from '../src/services/db/backup';
import { importDeckFromJson } from '../src/services/vocabRepository';
import { difficultWords, getStudyAttempts, recordStudyAttempt, restoreStudySession, saveStudySession, skillSummary } from '../src/services/studyProgress';
import type { ReviewSessionState, StudyAttempt } from '../src/types/study';
import { integrityWord } from './dataIntegrityFixture';
import { TOEIC_PART5, TOEIC_TOPICS } from '../src/data/toeicPart5';

const word = integrityWord('a', 'allocate');
const other = integrityWord('b', 'budget');
const third = integrityWord('c', 'confirm');
function session(): ReviewSessionState {
  return { sessionId: 'session-1', inProgress: true, mode: 'listen', cards: [word, other, third],
    currentIndex: 1, sessionHistory: [{ word, rating: 1 }], clozeQuestions: [], isCompleted: false, sessionType: 'due' };
}
const attempt: StudyAttempt = { id: 'session-1:a', date: 123, mode: 'listen', rating: 2,
  wordId: 'a', sessionType: 'cram', firstAttemptCorrect: false, incorrectSubmissionCount: 2, hintsUsedCount: 1, audioPlayCount: 5 };
beforeEach(async () => { for (const table of db.tables) await table.clear(); });

describe('Study progress and backups', () => {
  it('restores only unfinished existing cards with fresh content and history', () => {
    const result = restoreStudySession(session(), [word, { ...third, vietnameseDefinition: 'xác nhận' }]);
    expect(result?.cards.map(w => w.id)).toEqual(['c']);
    expect(result?.cards[0].vietnameseDefinition).toBe('xác nhận');
    expect(result?.currentIndex).toBe(0);
    expect(result?.sessionHistory).toHaveLength(1);
    expect(restoreStudySession(session(), [word])).toBeNull();
  });
  it('keeps skipped cards and does not offer damaged checkpoints', () => {
    const saved = { ...session(), currentIndex: 2, sessionHistory: [] };
    const restored = restoreStudySession(saved, [word, other, third]);
    expect(restored?.cards).toHaveLength(3);
    expect(restored?.currentIndex).toBe(2);
    expect(restoreStudySession({ ...saved, cards: null }, [word])).toBeNull();
    expect(restoreStudySession({ ...saved, mode: 'unknown' }, [word])).toBeNull();
  });
  it('deduplicates attempts atomically and clears completed sessions', async () => {
    await db.transaction('rw', db.settingsTable, async () => {
      expect(await recordStudyAttempt(attempt)).toBe(true);
      await saveStudySession(session());
    });
    await db.transaction('rw', db.settingsTable, async () => expect(await recordStudyAttempt(attempt)).toBe(false));
    expect(await getStudyAttempts()).toHaveLength(1);
    await saveStudySession({ ...session(), isCompleted: true });
    expect(await db.settingsTable.get('studySession')).toBeUndefined();
  });
  it('rolls back attempt and checkpoint when their transaction fails', async () => {
    await expect(db.transaction('rw', db.settingsTable, async () => {
      await recordStudyAttempt(attempt);
      await saveStudySession(session());
      throw new Error('storage failed');
    })).rejects.toThrow('storage failed');
    expect(await getStudyAttempts()).toEqual([]);
    expect(await db.settingsTable.get('studySession')).toBeUndefined();
  });
  it('selects unique difficult cards and excludes deleted ones', () => {
    expect(difficultWords([{ word, rating: 1 }, { word, rating: 2 }, { word: other, rating: 4 }, { word: third, rating: 1 }], [word, other])).toEqual([word]);
    expect(difficultWords([], [word])).toEqual([]);
  });
  it('separates first-try results from self ratings and counts hints and corrections', () => {
    const summary = skillSummary([attempt, { ...attempt, id: '2', rating: 4, firstAttemptCorrect: true, incorrectSubmissionCount: 0, hintsUsedCount: 0 },
      { id: '3', date: 123, mode: 'flashcards', rating: 3, sessionType: 'due' }]);
    expect(summary.find(s => s.mode === 'listen')).toMatchObject({ count: 2, firstTryRate: 0.5, difficult: 1, hints: 1, corrections: 2 });
    expect(summary.find(s => s.mode === 'flashcards')?.firstTryRate).toBeNull();
  });
  it('round-trips skill history without checkpoints or download timestamps', async () => {
    await db.words.put(word);
    await recordStudyAttempt(attempt);
    await saveStudySession(session());
    await db.settingsTable.bulkPut([{ key: 'toeicSession', value: { id: 'x' } }, { key: 'lastBackupDownload', value: 123 }]);
    const json = await exportFullBackupToJson();
    const backup = JSON.parse(json);
    expect(backup.settingsTable.map((r: { key: string }) => r.key)).toEqual(['studyAttempts']);
    for (const table of db.tables) await table.clear();
    expect((await importDeckFromJson(json)).errors).toEqual([]);
    expect(await getStudyAttempts()).toEqual([attempt]);
  });
  it('merges restored skill events without dropping local attempts or duplicating IDs', async () => {
    await recordStudyAttempt(attempt);
    const json = await exportFullBackupToJson();
    await recordStudyAttempt({ ...attempt, id: 'local-later', date: 456 });
    expect((await importDeckFromJson(json)).errors).toEqual([]);
    expect((await getStudyAttempts()).map(a => a.id)).toEqual(['session-1:a', 'local-later']);
  });
  it('does not count assisted first checks as unassisted recall', () => {
    const summary = skillSummary([{ ...attempt, firstAttemptCorrect: true, hintsUsedCount: 1 },
      { ...attempt, id: 'revealed', firstAttemptCorrect: true, hintsUsedCount: 0, revealedAnswer: true }]);
    expect(summary[0].firstTryRate).toBe(0);
  });
});

it('every original Part 5 item has four distinct choices and bilingual explanations', () => {
  expect(new Set(TOEIC_PART5.map(q => q.id)).size).toBe(16);
  for (const topic of Object.keys(TOEIC_TOPICS)) expect(TOEIC_PART5.filter(q => q.topic === topic)).toHaveLength(4);
  for (const q of TOEIC_PART5) {
    expect(new Set(q.options).size).toBe(4);
    expect(q.correctIndex).toBeGreaterThanOrEqual(0);
    expect(q.correctIndex).toBeLessThan(4);
    expect(q.explanationsVi.every(Boolean)).toBe(true);
    expect(q.explanationsEn.every(Boolean)).toBe(true);
  }
});
