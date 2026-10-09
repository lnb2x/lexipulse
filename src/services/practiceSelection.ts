import type { StudyAttempt } from '../types/study';
import type { ReviewMode, WordItem } from '../types/vocab';

export const EMPTY_STUDY_ATTEMPTS: StudyAttempt[] = [];

function needsPractice(attempt: StudyAttempt): boolean {
  return attempt.rating <= 2 || attempt.firstAttemptCorrect === false ||
    !!attempt.hintsUsedCount || !!attempt.incorrectSubmissionCount ||
    !!attempt.revealedAnswer || !!attempt.deferred;
}

function practiceCandidates(words: WordItem[], attempts: StudyAttempt[], mode?: ReviewMode) {
  const latest = new Map<string, StudyAttempt>();
  const lastPracticed = new Map<string, number>();
  for (const attempt of attempts) {
    if (!attempt.wordId || attempt.mode === 'toeic') continue;
    lastPracticed.set(attempt.wordId, Math.max(lastPracticed.get(attempt.wordId) ?? 0, attempt.date));
    if (mode && attempt.mode !== mode) continue;
    const previous = latest.get(attempt.wordId);
    if (!previous || attempt.date >= previous.date) latest.set(attempt.wordId, attempt);
  }
  return [...new Map(words.map(word => [word.id, word])).values()].map(word => {
    const attempt = latest.get(word.id);
    const history = word.reviewMeta.history;
    const lastReview = history[history.length - 1];
    return {
      word,
      lastPracticed: Math.max(lastPracticed.get(word.id) ?? 0, word.reviewMeta.lastReviewedDate ?? 0),
      difficult: attempt ? needsPractice(attempt) : !mode &&
        (lastReview ? lastReview.rating <= 2 : word.status === 'review_needed'),
    };
  }).sort((a, b) => a.lastPracticed - b.lastPracticed ||
    a.word.createdAt - b.word.createdAt || a.word.id.localeCompare(b.word.id));
}

export function selectDifficultPracticeWords(
  words: WordItem[], attempts: StudyAttempt[], mode: ReviewMode, limit = 10,
): WordItem[] {
  return practiceCandidates(words, attempts, mode).filter(item => item.difficult)
    .slice(0, Math.max(0, limit)).map(item => item.word);
}

export function selectExtraPracticeWords(words: WordItem[], attempts: StudyAttempt[], limit: number): WordItem[] {
  const candidates = practiceCandidates(words, attempts);
  const size = Math.min(candidates.length, Math.max(0, limit));
  // Reserve half the session for difficult words; use the rest to rotate through the deck.
  const difficult = candidates.filter(item => item.difficult).slice(0, Math.ceil(size / 2));
  const selectedIds = new Set(difficult.map(item => item.word.id));
  return [...difficult, ...candidates.filter(item => !selectedIds.has(item.word.id))]
    .slice(0, size).map(item => item.word);
}
