export type WordStatus = 'new' | 'learning' | 'review_needed' | 'mastered';

export type ReviewRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy
export type LegacyReviewRating = 1 | 2 | 3;

export interface FSRSCardData {
  due: number; // timestamp in ms
  stability: number; // S in days
  difficulty: number; // D (1-10)
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number; // 0: New, 1: Learning, 2: Review, 3: Relearning
  last_review: number | null; // timestamp in ms
}

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
  reviewType?: 'scheduled' | 'cram';
  fsrsState?: number;
  stability?: number;
  difficulty?: number;
}

export interface LegacyReviewMetaBackup {
  repetition: number;
  interval: number;
  easeFactor: number;
  dueDate: number;
  lastReviewedDate: number | null;
  history: ReviewHistoryItem[];
}

export interface ReviewMeta {
  repetition: number;
  interval: number; // in days
  easeFactor: number; // legacy EF kept for compatibility
  dueDate: number; // timestamp in ms
  lastReviewedDate: number | null;
  history: ReviewHistoryItem[];
  // FSRS additions
  fsrs?: FSRSCardData;
  schedulerVersion?: 'fsrs-v5' | 'sm2-legacy';
  isEstimated?: boolean;
  legacyBackup?: LegacyReviewMetaBackup;
}

export interface SpellingSuggestion {
  word: string;
  meaningVi?: string;
  pos?: string;
  source: 'deck' | 'builtin' | 'dictionary';
  score?: number;
}

export type WordSource = 'local' | 'online' | 'ai' | 'manual';
export type EnrichmentStatus = 'completed' | 'pending' | 'failed' | 'manual';

export interface LemmaCandidate {
  lemma: string;
  pos: string; // verb, noun, adj, adv
  formLabel: string; // e.g. "Quá khứ đơn (V2)", "Quá khứ phân từ (V3)", "Dạng -ing", "Số nhiều", "Nguyên mẫu"
  explanationVi?: string;
  isAmbiguous?: boolean;
}

export interface InflectionItem {
  form: string;
  word?: string;
  label?: string;
}

export interface MorphologicalAnalysis {
  originalInput: string;
  lemmaCandidates: LemmaCandidate[];
  selectedLemma: string;
  partOfSpeech: string[];
  formLabels: string[];
  contextSentence?: string;
  senses: Array<{
    meaningVi: string;
    englishDef?: string;
    pos: string;
    context?: string;
  }>;
  inflections: InflectionItem[];
  examples: ExampleItem[];
  source: 'ai' | 'dictionary' | 'local' | 'rule-based';
  needsDisambiguation?: boolean;
  confidenceReason?: string;
}

export type DefinitionSourceType = 'ai' | 'dictionary' | 'machine' | 'user_edit' | 'unknown';

export interface VietnameseDefinitionProvenance {
  source: DefinitionSourceType;
  provider?: string;
  model?: string;
  createdAt?: number;
  isUserEdited?: boolean;
  originalSource?: DefinitionSourceType;
  confidenceReason?: string;
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
  suggestions?: SpellingSuggestion[];
  source?: WordSource;
  enrichmentStatus?: EnrichmentStatus;
  // Morphological & Lemma features
  lemma?: string;
  originalInput?: string;
  formLabels?: string[];
  linkedVariants?: string[];
  contextSentence?: string;
  inflections?: InflectionItem[];
  // Provenance tracking for Vietnamese translation
  vietnameseDefinitionProvenance?: VietnameseDefinitionProvenance;
  isUserEdited?: boolean;
  // Quizlet integration
  quizletSetIds?: string[];
  quizletSets?: QuizletSetRef[];
  rawQuizletTerm?: string;
  rawQuizletDefinition?: string;
}

export interface DailyStats {
  id?: number;
  date: string; // YYYY-MM-DD
  cardsReviewed: number;
  streak: number;
  lastActiveDate: string;
}

export type AIProvider = 'gemini' | 'openai' | 'claude' | 'deepseek' | 'groq' | 'openrouter' | 'custom';

export interface AppSettings {
  aiProvider: AIProvider;
  aiApiKey: string;
  aiBaseUrl?: string;
  aiModel?: string;
  geminiApiKey: string; // legacy backward compatibility
  persistApiKey?: boolean; // Default false: keep in session only; opt-in for persistent storage
  prioritizeAI?: boolean; // Default true when AI is configured
  speechRate: number;
  speechPitch: number;
  preferredAccent: 'US' | 'UK';
  dailyQuota: number;
  theme: 'dark' | 'light' | 'system';
  desiredRetention?: 0.85 | 0.90 | 0.95; // default 0.90
  loopInterval?: number; // Delay in seconds between loop pronunciations (default 1.5)
}

export interface ReviewQueueStats {
  dueCount: number;
  overdueCount: number;
  relearningCount: number;
  nextDueTimestamp: number | null;
  actualRetentionRate: number | null;
  retentionSampleCount: number;
}

export interface FilterOptions {
  search: string;
  tags: string[];
  status: WordStatus | 'all';
  createdDate?: string; // 'YYYY-MM-DD'
  sortBy: 'urgency' | 'date_added' | 'alpha' | 'repetition';
  sortDirection: 'asc' | 'desc';
}

export type ReviewMode = 'flashcards' | 'cloze' | 'listen' | 'match' | 'choice';

export interface ClozeQuestion {
  word: WordItem;
  sentenceWithBlank: string;
  targetWord: string;
  options: string[]; // 4 options for multiple choice
  contextVi: string;
  hintPos: string;
  hintDefinition: string;
}

export interface DefinitionChoiceQuestion {
  word: WordItem;
  promptWord: string;
  correctMeaning: string;
  options: string[]; // 4 definition options
  targetWord: string;
}

export interface MatchCardItem {
  id: string; // unique card id in game session
  wordId: string; // original word id
  text: string;
  type: 'en' | 'vi';
  isMatched: boolean;
  isSelected: boolean;
  isError: boolean;
}

export type ContributionActivityFilter = 'all' | 'reviews' | 'words';

export interface DayActivity {
  date: string; // YYYY-MM-DD
  count: number;
  reviewsCount: number;
  wordsAddedCount: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface QuizletSetRef {
  id: string; // Quizlet set numeric ID, e.g. "1205742993"
  title: string;
  url: string; // Clean canonical URL without tracking parameters
  importedAt: number;
}

export interface QuizletSetRecord {
  id: string; // Quizlet set ID
  title: string;
  url: string;
  createdAt: number;
  updatedAt: number;
  wordCount?: number;
  cardTerms?: string[];
}

export type QuizletReconcileStatus = 'new' | 'existing' | 'needs_review';

export interface QuizletCardItem {
  term: string;
  definition: string;
}

export interface QuizletReconciledWord {
  term: string; // Clean term
  rawTerm?: string; // Original raw Quizlet term
  normalizedTerm: string;
  extractedPos?: string[];
  extractedIpa?: string;
  definition: string; // Clean definition
  rawDefinition?: string; // Original raw Quizlet definition
  normalizedDefinition: string;
  status: QuizletReconcileStatus;
  selected: boolean;
  existingWord?: WordItem;
  existingDefinition?: string;
  resolutionChoice?: 'keep_existing' | 'use_quizlet' | 'merge';
}

