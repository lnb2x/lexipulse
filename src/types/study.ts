import type { ClozeQuestion, ReviewMode, ReviewRating, WordItem } from './vocab';

export interface AttemptEvidence {
  firstAttemptCorrect?: boolean;
  incorrectSubmissionCount?: number;
  hintsUsedCount?: number;
  revealedAnswer?: boolean;
  audioPlayCount?: number;
  firstAttemptEditDistance?: number;
  questionType?: 'choice' | 'write';
  deferred?: boolean;
  practice?: boolean;
}

export type LearnQuestionType = 'choice' | 'write';

export interface LearnCardState {
  word: WordItem;
  stage: LearnQuestionType | 'mastered' | 'deferred';
  evidence: AttemptEvidence;
  scheduledRating?: ReviewRating;
}

export interface LearnSessionState {
  version: 1;
  items: LearnCardState[];
  queue: Array<{ wordId: string; type: LearnQuestionType; key: string }>;
  answered: number;
  nextKey: number;
}

export interface StudyAttempt extends AttemptEvidence {
  id: string;
  date: number;
  mode: ReviewMode | 'toeic';
  rating: ReviewRating;
  sessionType: 'due' | 'cram';
  wordId?: string;
  questionId?: string;
  topic?: string;
}

export interface ReviewSessionState {
  sessionId?: string;
  inProgress: boolean;
  mode: ReviewMode;
  cards: WordItem[];
  currentIndex: number;
  clozeQuestions: ClozeQuestion[];
  sessionHistory: Array<{ word: WordItem; rating: number }>;
  isCompleted: boolean;
  sessionType?: 'due' | 'cram';
  learn?: LearnSessionState;
  learnNextKey?: number;
}

export interface ReviewSubmission {
  attempt: StudyAttempt;
  checkpoint?: ReviewSessionState;
  practice?: boolean;
}
