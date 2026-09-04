export type WordStatus = 'new' | 'learning' | 'review_needed' | 'mastered';

export type ReviewRating = 1 | 2 | 3; // 1: Again (1d), 2: Good (3d+), 3: Easy (7d+)

export interface PhoneticInfo {
  us?: string;
  uk?: string;
  audioUs?: string;
  audioUk?: string;
}

export interface CollocationItem {
  phrase: string;
  meaningVi: string;
  example?: string;
}

export interface WordFamilyItem {
  word: string;
  pos: string; // noun, verb, adj, adv
  meaningVi?: string;
}

export interface ExampleItem {
  en: string;
  vi: string;
  context: 'general' | 'toeic' | 'workplace' | 'academic';
}

export interface MeaningItem {
  pos: string;
  englishDefinition: string;
  vietnameseDefinition?: string;
  synonyms?: string[];
  antonyms?: string[];
  example?: string;
}

export interface ReviewHistoryItem {
  date: number;
  rating: ReviewRating;
  interval: number;
  easeFactor: number;
  repetition: number;
}

export interface ReviewMeta {
  repetition: number;
  interval: number; // in days
  easeFactor: number; // SM-2 EF, starts at 2.5
  dueDate: number; // timestamp in ms
  lastReviewedDate: number | null;
  history: ReviewHistoryItem[];
}

export interface WordItem {
  id: string;
  word: string;
  phonetics: PhoneticInfo;
  pos: string[];
  vietnameseDefinition: string;
  englishDefinition: string;
  meanings: MeaningItem[];
  collocations: CollocationItem[];
  wordFamily: WordFamilyItem[];
  examples: ExampleItem[];
  tags: string[];
  notes?: string;
  status: WordStatus;
  createdAt: number;
  updatedAt: number;
  reviewMeta: ReviewMeta;
}

export interface DailyStats {
  id?: number;
  date: string; // YYYY-MM-DD
  cardsReviewed: number;
  streak: number;
  lastActiveDate: string;
}

export interface AppSettings {
  geminiApiKey: string;
  speechRate: number;
  speechPitch: number;
  preferredAccent: 'US' | 'UK';
  dailyQuota: number;
  theme: 'dark' | 'light' | 'system';
}

export interface FilterOptions {
  search: string;
  tags: string[];
  status: WordStatus | 'all';
  createdDate?: string; // 'YYYY-MM-DD'
  sortBy: 'urgency' | 'date_added' | 'alpha' | 'repetition';
  sortDirection: 'asc' | 'desc';
}

export type ReviewMode = 'flashcard' | 'cloze';

export interface ClozeQuestion {
  word: WordItem;
  sentenceWithBlank: string;
  targetWord: string;
  options: string[]; // 4 options for multiple choice
  contextVi: string;
  hintPos: string;
  hintDefinition: string;
}

export type ContributionActivityFilter = 'all' | 'reviews' | 'words';

export interface DayActivity {
  date: string; // YYYY-MM-DD
  count: number;
  reviewsCount: number;
  wordsAddedCount: number;
  level: 0 | 1 | 2 | 3 | 4;
}

