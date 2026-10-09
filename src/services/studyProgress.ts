import { db } from './db/schema';
import type { ReviewSessionState, StudyAttempt } from '../types/study';
import type { WordItem } from '../types/vocab';
import { getLearnQuestion, restoreLearnState } from './adaptiveLearning';

export const STUDY_SESSION_KEY = 'studySession';
export const STUDY_ATTEMPTS_KEY = 'studyAttempts';
export const TOEIC_SESSION_KEY = 'toeicSession';
export const BACKUP_DOWNLOAD_KEY = 'lastBackupDownload';

export function isStudyAttempt(value: unknown): value is StudyAttempt {
  if (!value || typeof value !== 'object') return false;
  const a = value as StudyAttempt;
  return typeof a.id === 'string' && Number.isFinite(a.date) &&
    ['learn', 'flashcards', 'cloze', 'listen', 'match', 'choice', 'toeic'].includes(a.mode) &&
    [1, 2, 3, 4].includes(a.rating) && ['due', 'cram'].includes(a.sessionType) &&
    ['wordId', 'questionId', 'topic'].every(key => a[key as keyof StudyAttempt] === undefined || typeof a[key as keyof StudyAttempt] === 'string') &&
    ['incorrectSubmissionCount', 'hintsUsedCount', 'audioPlayCount', 'firstAttemptEditDistance'].every(key => {
      const n = a[key as keyof StudyAttempt];
      return n === undefined || (typeof n === 'number' && Number.isInteger(n) && n >= 0);
    }) && ['firstAttemptCorrect', 'revealedAnswer', 'deferred', 'practice'].every(key => a[key as keyof StudyAttempt] === undefined || typeof a[key as keyof StudyAttempt] === 'boolean') &&
    (a.questionType === undefined || ['choice', 'write'].includes(a.questionType));
}

export async function getStudyAttempts(): Promise<StudyAttempt[]> {
  const value = (await db.settingsTable.get(STUDY_ATTEMPTS_KEY))?.value;
  return Array.isArray(value) ? value.filter(isStudyAttempt) : [];
}

// Call inside the same transaction as the scheduler and session checkpoint.
export async function recordStudyAttempt(attempt: StudyAttempt): Promise<boolean> {
  const attempts = await getStudyAttempts();
  if (attempts.some(a => a.id === attempt.id)) return false;
  await db.settingsTable.put({ key: STUDY_ATTEMPTS_KEY, value: [...attempts, attempt] });
  return true;
}

export async function saveStudySession(session: ReviewSessionState): Promise<void> {
  if (!session.sessionId) return;
  if (session.isCompleted) {
    await db.settingsTable.delete(STUDY_SESSION_KEY);
  } else {
    await db.settingsTable.put({ key: STUDY_SESSION_KEY, value: session });
  }
}

export function restoreStudySession(value: unknown, words: WordItem[]): ReviewSessionState | null {
  if (!value || typeof value !== 'object') return null;
  const saved = value as ReviewSessionState;
  if (typeof saved.sessionId !== 'string' || saved.isCompleted ||
    !['learn', 'flashcards', 'cloze', 'listen', 'choice', 'match'].includes(saved.mode) ||
    !Array.isArray(saved.cards) || !Array.isArray(saved.sessionHistory) ||
    !Array.isArray(saved.clozeQuestions) || !Number.isInteger(saved.currentIndex) || saved.currentIndex < 0) return null;
  const byId = new Map(words.map(w => [w.id, w]));
  const validHistory = saved.sessionHistory.filter(h => h && h.word && byId.has(h.word.id) && [1, 2, 3, 4].includes(h.rating));
  if (saved.mode === 'learn') {
    const learn = restoreLearnState(saved.learn, words);
    const question = getLearnQuestion(learn ?? undefined);
    if (!learn || !question) return null;
    const cards = [...new Map(saved.cards.filter(w => w && byId.has(w.id)).map(w => [w.id, byId.get(w.id)!])).values()];
    if (learn.items.some(item => !cards.some(w => w.id === item.word.id))) return null;
    return { ...saved, cards, learn, currentIndex: Math.max(0, cards.findIndex(w => w.id === question.word.id)),
      clozeQuestions: [], sessionHistory: validHistory.map(h => ({ ...h, word: byId.get(h.word.id)! })),
      inProgress: true, isCompleted: false, sessionType: saved.sessionType === 'due' ? 'due' : 'cram' };
  }
  const completedIds = new Set(validHistory.map(h => h.word.id));
  const remaining = saved.cards.filter(w => w && byId.has(w.id) && !completedIds.has(w.id));
  if (!remaining.length) return null;
  const cards = remaining.map(w => byId.get(w.id)!);
  const clozeQuestions = saved.clozeQuestions.filter(q => q?.word && cards.some(w => w.id === q.word.id))
    .map(q => ({ ...q, word: byId.get(q.word.id)! }));
  const position = cards.findIndex(w => w.id === saved.cards[saved.currentIndex]?.id);
  return { ...saved, cards, currentIndex: Math.max(0, position), clozeQuestions,
    sessionHistory: validHistory.map(h => ({ ...h, word: byId.get(h.word.id)! })),
    inProgress: true, isCompleted: false, sessionType: saved.sessionType === 'due' ? 'due' : 'cram' };
}

export function difficultWords(history: ReviewSessionState['sessionHistory'], words: WordItem[]): WordItem[] {
  const difficultIds = new Set(history.filter(h => h.rating <= 2).map(h => h.word.id));
  return words.filter(w => difficultIds.has(w.id));
}

export function skillSummary(attempts: StudyAttempt[]) {
  return (['learn', 'flashcards', 'listen', 'choice', 'cloze', 'match', 'toeic'] as const).map(mode => {
    const rows = attempts.filter(a => a.mode === mode && !a.practice);
    const measured = rows.filter(a => a.firstAttemptCorrect !== undefined);
    return { mode, count: rows.length, difficult: rows.filter(a => a.rating <= 2).length,
      firstTryCount: measured.length, firstTryRate: measured.length ? measured.filter(a => a.firstAttemptCorrect && !a.revealedAnswer && !a.hintsUsedCount).length / measured.length : null,
      hints: rows.reduce((n, a) => n + (a.hintsUsedCount ?? 0), 0),
      corrections: rows.reduce((n, a) => n + (a.incorrectSubmissionCount ?? 0), 0) };
  }).filter(row => row.count > 0);
}

export async function markBackupDownloaded(): Promise<void> {
  await db.settingsTable.put({ key: BACKUP_DOWNLOAD_KEY, value: Date.now() });
}
