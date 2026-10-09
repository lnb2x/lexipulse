import type { AttemptEvidence, LearnCardState, LearnQuestionType, LearnSessionState, ReviewSessionState, StudyAttempt } from '../types/study';
import type { ReviewRating, WordItem } from '../types/vocab';
import { isPlaceholderDefinition } from './quizlet/quizletNormalizer';
import { normalizeVietnameseDefinition, parseMultipleMeanings } from '../utils/definitionUtils';

const RETRY_GAP = 3;

/** Uses the same real definition for eligibility, prompts and choice options. */
export function getLearnMeaning(word: WordItem): string {
  const vietnamese = parseMultipleMeanings(normalizeVietnameseDefinition(word.vietnameseDefinition || ''))
    .map(sense => sense.text.replace(/^\d+[.)]\s+/, '')).join('; ');
  return [vietnamese, word.englishDefinition]
    .find(definition => definition?.trim() && !isPlaceholderDefinition(definition))?.trim() ?? '';
}

function usableMeaning(word: WordItem): string {
  return getLearnMeaning(word).toLocaleLowerCase();
}

export function hasLearnMeaning(word: WordItem): boolean {
  return !!usableMeaning(word);
}

function previouslyWroteCorrectly(wordId: string, attempts: StudyAttempt[]): boolean {
  return attempts.some(a => a.wordId === wordId &&
    (a.questionType === 'write' || a.mode === 'listen') &&
    a.rating >= 3 && a.firstAttemptCorrect === true &&
    !a.hintsUsedCount && !a.incorrectSubmissionCount && !a.revealedAnswer && !a.deferred);
}

export function createLearnState(cards: WordItem[], attempts: StudyAttempt[] = [], firstKey = 1, previous?: LearnSessionState): LearnSessionState {
  const keyOffset = Math.max(Number.isSafeInteger(firstKey) && firstKey > 0 ? firstKey : 1,
    previous && Number.isSafeInteger(previous.nextKey) && previous.nextKey > 0 ? previous.nextKey : 1);
  const uniqueCards = [...new Map(cards.filter(hasLearnMeaning).map(word => [word.id, word])).values()];
  const canChoose = new Set(uniqueCards.map(usableMeaning).filter(Boolean)).size >= 2;
  const pending = new Map(restoreLearnState(previous, uniqueCards)?.items
    .filter(item => item.scheduledRating === undefined && (item.stage === 'choice' || item.stage === 'write'))
    .map(item => [item.word.id, item]) ?? []);
  const items: LearnCardState[] = uniqueCards.map(word => {
    const prior = pending.get(word.id);
    return {
      word,
      stage: prior ? (prior.stage === 'choice' && !canChoose ? 'write' : prior.stage)
        : canChoose && !previouslyWroteCorrectly(word.id, attempts) ? 'choice' : 'write',
      evidence: prior ? { ...prior.evidence } : {},
    };
  });
  return {
    version: 1,
    items,
    queue: items.map((item, index) => ({ wordId: item.word.id, type: item.stage as LearnQuestionType, key: `q${index + keyOffset}:${item.word.id}` })),
    answered: 0,
    nextKey: items.length + keyOffset,
  };
}

export function getLearnQuestion(state?: LearnSessionState) {
  const question = state?.queue[0];
  const item = state?.items.find(candidate => candidate.word.id === question?.wordId);
  return question && item ? { word: item.word, type: question.type, key: question.key } : null;
}

export function getLearnProgress(state?: LearnSessionState) {
  return {
    mastered: state?.items.filter(item => item.stage === 'mastered').length ?? 0,
    deferred: state?.items.filter(item => item.stage === 'deferred').length ?? 0,
    total: state?.items.length ?? 0,
    answered: state?.answered ?? 0,
  };
}

function combineEvidence(previous: AttemptEvidence, answer: AttemptEvidence, correct: boolean, incorrect: boolean): AttemptEvidence {
  return {
    firstAttemptCorrect: previous.firstAttemptCorrect === undefined ? correct : previous.firstAttemptCorrect && correct,
    incorrectSubmissionCount: (previous.incorrectSubmissionCount ?? 0) + Math.max(incorrect ? 1 : 0, answer.incorrectSubmissionCount ?? 0),
    hintsUsedCount: (previous.hintsUsedCount ?? 0) + (answer.hintsUsedCount ?? 0),
    revealedAnswer: !!previous.revealedAnswer || !!answer.revealedAnswer,
    audioPlayCount: (previous.audioPlayCount ?? 0) + (answer.audioPlayCount ?? 0),
    firstAttemptEditDistance: previous.firstAttemptEditDistance ?? answer.firstAttemptEditDistance,
    questionType: answer.questionType,
    deferred: !!answer.deferred,
  };
}

/** Pure transition: callers persist the returned checkpoint before displaying it. */
export function advanceLearnQuestion(state: LearnSessionState, rating: ReviewRating, evidence: AttemptEvidence = {}) {
  const question = getLearnQuestion(state);
  if (!question) return null;
  const current = state.items.find(item => item.word.id === question.word.id)!;
  const answer = { ...evidence, questionType: question.type };
  const correct = rating >= 3 && answer.firstAttemptCorrect !== false &&
    !answer.incorrectSubmissionCount && !answer.hintsUsedCount && !answer.revealedAnswer && !answer.deferred;
  const incorrect = answer.firstAttemptCorrect === false || (rating < 3 && answer.firstAttemptCorrect !== true);
  const combined = combineEvidence(current.evidence, answer, correct, incorrect);
  const stage = answer.deferred ? 'deferred' :
    question.type === 'write' && correct ? 'mastered' :
    question.type === 'choice' && correct ? 'write' : question.type;
  const schedule = current.scheduledRating === undefined && (question.type === 'write' || !!answer.deferred);
  // Later correction is practice. It must not erase a failed initial recognition/check.
  const officialRating: ReviewRating = combined.incorrectSubmissionCount || combined.revealedAnswer || answer.deferred
    ? 1 : combined.hintsUsedCount ? 2 : rating;
  const item: LearnCardState = { ...current, stage, evidence: combined,
    scheduledRating: schedule ? officialRating : current.scheduledRating };
  const queue = state.queue.slice(1);
  let nextKey = state.nextKey;
  if (stage === 'choice' || stage === 'write') {
    queue.splice(Math.min(RETRY_GAP, queue.length), 0, { wordId: question.word.id, type: stage, key: `q${nextKey++}:${question.word.id}` });
  }
  const learn: LearnSessionState = { ...state, items: state.items.map(candidate => candidate.word.id === item.word.id ? item : candidate),
    queue, answered: state.answered + 1, nextKey };
  return { learn, word: question.word, questionKey: question.key, schedule,
    rating: schedule ? officialRating : rating,
    evidence: { ...(schedule ? combined : answer), practice: !schedule } as AttemptEvidence };
}

/** Retains settled and scheduled-but-pending words; refreshes content and prunes deletions. */
export function restoreLearnState(value: unknown, words: WordItem[]): LearnSessionState | null {
  if (!value || typeof value !== 'object') return null;
  const saved = value as LearnSessionState;
  if (saved.version !== 1 || !Array.isArray(saved.items) || !Array.isArray(saved.queue) ||
    !Number.isSafeInteger(saved.answered) || saved.answered < 0 || !Number.isSafeInteger(saved.nextKey) || saved.nextKey < 1) return null;
  const byId = new Map(words.filter(hasLearnMeaning).map(word => [word.id, word]));
  const items: LearnCardState[] = [];
  const seen = new Set<string>();
  for (const item of saved.items) {
    if (!item?.word || !byId.has(item.word.id) || seen.has(item.word.id)) continue;
    if (!['choice', 'write', 'mastered', 'deferred'].includes(item.stage) ||
      !validEvidence(item.evidence) ||
      (item.scheduledRating !== undefined && ![1, 2, 3, 4].includes(item.scheduledRating))) return null;
    seen.add(item.word.id);
    items.push({ ...item, word: byId.get(item.word.id)! });
  }
  const pending = new Map(items.filter(item => item.stage === 'choice' || item.stage === 'write').map(item => [item.word.id, item]));
  const queue: LearnSessionState['queue'] = [];
  const queuedIds = new Set<string>();
  const keys = new Set<string>();
  for (const entry of saved.queue) {
    const item = pending.get(entry?.wordId);
    if (!item || queuedIds.has(entry.wordId)) continue;
    if (entry.type !== item.stage || typeof entry.key !== 'string' || !entry.key || keys.has(entry.key)) return null;
    const sequence = Number(/^q([1-9]\d*):/.exec(entry.key)?.[1]);
    if (!Number.isSafeInteger(sequence) || sequence >= saved.nextKey || entry.key !== `q${sequence}:${entry.wordId}`) return null;
    queuedIds.add(entry.wordId);
    keys.add(entry.key);
    queue.push({ ...entry });
  }
  // An incomplete checkpoint cannot silently drop an unfinished word.
  if (queuedIds.size !== pending.size || !items.length) return null;
  return { ...saved, items, queue };
}

/** Keeps active or cached Learn snapshots aligned with deck edits without restarting questions. */
export function reconcileLearnSession(session: ReviewSessionState, words: WordItem[]): ReviewSessionState {
  if (!session.inProgress || !session.learn) return session;
  const byId = new Map(words.map(word => [word.id, word]));
  const cards = session.cards.map(word => byId.get(word.id)).filter((word): word is WordItem =>
    !!word && (session.mode !== 'learn' || hasLearnMeaning(word)));
  const history = session.sessionHistory.flatMap(entry => {
    const word = byId.get(entry.word.id);
    return word ? [word === entry.word ? entry : { ...entry, word }] : [];
  });
  const questionsById = new Map(session.clozeQuestions.map(question => [question.word.id, question]));
  const clozeQuestions = cards.flatMap(word => {
    const question = questionsById.get(word.id);
    return question ? [question.word === word ? question : { ...question, word }] : [];
  });
  const learn = restoreLearnState(session.learn, cards) ?? undefined;
  const question = session.mode === 'learn' ? getLearnQuestion(learn) : null;
  const oldCurrentId = session.cards[session.currentIndex]?.id;
  const currentIndex = question ? cards.findIndex(word => word.id === question.word.id)
    : Math.max(0, cards.findIndex(word => word.id === oldCurrentId));
  const inProgress = !cards.length || (session.mode === 'learn' && !learn) ? false : session.inProgress;
  const isCompleted = session.mode === 'learn' ? !question
    : session.isCompleted || cards.every(word => history.some(entry => entry.word.id === word.id));
  const sameItems = learn?.items.length === session.learn.items.length && learn?.items.every((item, index) =>
    item.word === session.learn!.items[index].word);
  const sameQueue = learn?.queue.length === session.learn.queue.length && learn?.queue.every((entry, index) =>
    entry.key === session.learn!.queue[index].key && entry.type === session.learn!.queue[index].type);
  if (cards.length === session.cards.length && cards.every((word, index) => word === session.cards[index]) &&
    history.length === session.sessionHistory.length && history.every((entry, index) => entry === session.sessionHistory[index]) &&
    clozeQuestions.length === session.clozeQuestions.length && clozeQuestions.every((entry, index) => entry === session.clozeQuestions[index]) &&
    sameItems && sameQueue && currentIndex === session.currentIndex &&
    inProgress === session.inProgress && isCompleted === session.isCompleted) return session;
  return { ...session, cards, sessionHistory: history, clozeQuestions, learn, currentIndex, inProgress, isCompleted };
}

function validEvidence(value: unknown): value is AttemptEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const evidence = value as AttemptEvidence;
  return ['incorrectSubmissionCount', 'hintsUsedCount', 'audioPlayCount', 'firstAttemptEditDistance'].every(key => {
    const count = evidence[key as keyof AttemptEvidence];
    return count === undefined || (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0);
  }) && ['firstAttemptCorrect', 'revealedAnswer', 'deferred', 'practice'].every(key => {
    const flag = evidence[key as keyof AttemptEvidence];
    return flag === undefined || typeof flag === 'boolean';
  }) && (evidence.questionType === undefined || ['choice', 'write'].includes(evidence.questionType));
}
