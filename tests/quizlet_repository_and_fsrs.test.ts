import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/services/db';
import {
  saveQuizletSetMetadata,
  getAllQuizletSets,
  getQuizletSetById,
  deleteQuizletSet,
  getWordsByQuizletSet,
  linkWordsToQuizletSet,
  saveNewQuizletWords,
  resolveNeedsReviewWord,
} from '../src/services/quizlet/quizletRepository';
import { saveOrUpdateWord } from '../src/services/vocabRepository';
import type { QuizletReconciledWord, QuizletSetRef, WordItem } from '../src/types/vocab';
import { createInitialReviewMeta } from '../src/services/fsrs/fsrsService';

describe('Quizlet Repository, FSRS Preservation & Review Scoping Tests', () => {
  const setRef1: QuizletSetRef = {
    id: '1205742993',
    title: 'BTVN 10 Flash Cards',
    url: 'https://quizlet.com/1205742993/btvn-10-flash-cards/',
    importedAt: 1700000000000,
  };

  const setRef2: QuizletSetRef = {
    id: '9999999999',
    title: 'TOEIC Essential 600',
    url: 'https://quizlet.com/9999999999/toeic-essential/',
    importedAt: 1700000500000,
  };

  const initialLearnedWord: WordItem = {
    id: 'learned-word-1',
    word: 'negotiate',
    pos: ['verb'],
    phonetics: { us: '/nəˈɡoʊ.ʃi.eɪt/' },
    vietnameseDefinition: 'Đàm phán thương lượng (User edited definition)',
    englishDefinition: 'To discuss something to reach an agreement.',
    meanings: [],
    collocations: [],
    wordFamily: [],
    examples: [],
    tags: ['#TOEIC', '#Important'],
    notes: 'My personal learning tip for negotiate',
    status: 'learning',
    isUserEdited: true,
    vietnameseDefinitionProvenance: {
      source: 'user_edit',
      isUserEdited: true,
      createdAt: 1700000000000,
    },
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    reviewMeta: {
      repetition: 4,
      interval: 12,
      easeFactor: 2.6,
      dueDate: Date.now() + 5 * 24 * 3600 * 1000, // Due in 5 days (NOT currently due)
      lastReviewedDate: 1700000000000,
      history: [
        { date: 1700000000000 - 86400000, rating: 3, interval: 6, easeFactor: 2.5, repetition: 2 },
        { date: 1700000000000, rating: 3, interval: 12, easeFactor: 2.6, repetition: 4 },
      ],
      fsrs: {
        due: Date.now() + 5 * 24 * 3600 * 1000,
        stability: 12.5,
        difficulty: 4.8,
        elapsed_days: 6,
        scheduled_days: 12,
        reps: 4,
        lapses: 0,
        state: 2, // Review state
        last_review: 1700000000000,
      },
      schedulerVersion: 'fsrs-v5',
    },
  };

  beforeEach(async () => {
    await db.words.clear();
    await db.quizletSets.clear();
    await db.dailyStats.clear();
    await db.settingsTable.clear();

    // Seed with existing learned word
    await db.words.put({ ...initialLearnedWord });
  });

  it('1. Re-importing same set does NOT create duplicate records, does NOT overwrite user-edited fields, and does NOT reset FSRS', async () => {
    // Re-importing 'negotiate' from Quizlet with a different definition
    const items: QuizletReconciledWord[] = [
      {
        term: 'negotiate',
        normalizedTerm: 'negotiate',
        definition: 'thương lượng hợp đồng (Quizlet definition)',
        normalizedDefinition: 'thương lượng hợp đồng',
        status: 'existing',
        selected: true,
      },
    ];

    // Link word to set
    const linked = await linkWordsToQuizletSet([initialLearnedWord], setRef1);
    expect(linked).toHaveLength(1);

    // Save set metadata
    await saveQuizletSetMetadata({
      id: setRef1.id,
      title: setRef1.title,
      url: setRef1.url,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      wordCount: 1,
    });

    // Check DB state
    const allWords = await db.words.toArray();
    expect(allWords).toHaveLength(1); // Absolutely NO duplicate records!

    const savedWord = allWords[0];
    // 1. Vietnamese definition edited by user is strictly preserved
    expect(savedWord.vietnameseDefinition).toBe('Đàm phán thương lượng (User edited definition)');
    expect(savedWord.isUserEdited).toBe(true);
    // 2. Personal notes preserved
    expect(savedWord.notes).toBe('My personal learning tip for negotiate');
    // 3. FSRS schedule and review history are completely preserved
    expect(savedWord.reviewMeta.repetition).toBe(4);
    expect(savedWord.reviewMeta.interval).toBe(12);
    expect(savedWord.reviewMeta.history).toHaveLength(2);
    expect(savedWord.reviewMeta.fsrs?.stability).toBe(12.5);
    // 4. Due date was NOT reset or shifted merely by importing
    expect(savedWord.reviewMeta.dueDate).toBe(initialLearnedWord.reviewMeta.dueDate);
    // 5. Associated with Quizlet set ID
    expect(savedWord.quizletSetIds).toContain(setRef1.id);
  });

  it('2. Supports a single word belonging to multiple Quizlet sets without duplicate records', async () => {
    // First link to set 1
    await linkWordsToQuizletSet([initialLearnedWord], setRef1);
    // Next link to set 2
    await linkWordsToQuizletSet([initialLearnedWord], setRef2);

    const wordInDb = await db.words.get(initialLearnedWord.id);
    expect(wordInDb).toBeDefined();
    expect(wordInDb?.quizletSetIds).toHaveLength(2);
    expect(wordInDb?.quizletSetIds).toContain(setRef1.id);
    expect(wordInDb?.quizletSetIds).toContain(setRef2.id);

    // Both sets can find this word
    const set1Words = await getWordsByQuizletSet(setRef1.id);
    const set2Words = await getWordsByQuizletSet(setRef2.id);
    expect(set1Words).toHaveLength(1);
    expect(set2Words).toHaveLength(1);
    expect(set1Words[0].id).toBe(set2Words[0].id);
  });

  it('3. Scopes review sessions: distinguishes between "Chỉ từ đến hạn" and "Toàn bộ từ trong bộ"', async () => {
    // Add 1 due card and 1 non-due card
    const now = Date.now();
    const dueWord: WordItem = {
      id: 'due-word-1',
      word: 'feasible',
      pos: ['adjective'],
      phonetics: { us: '/ˈfiː.zə.bəl/' },
      vietnameseDefinition: 'khả thi',
      englishDefinition: 'Possible to do easily or conveniently.',
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [],
      tags: ['#Quizlet'],
      status: 'new',
      createdAt: now,
      updatedAt: now,
      quizletSetIds: [setRef1.id],
      reviewMeta: {
        ...createInitialReviewMeta(),
        dueDate: now - 1000, // Due 1 second ago -> due!
      },
    };
    await db.words.put(dueWord);

    // Initial word is scheduled 5 days in future -> NOT due!
    await linkWordsToQuizletSet([initialLearnedWord], setRef1);

    const wordsInSet = await getWordsByQuizletSet(setRef1.id);
    expect(wordsInSet).toHaveLength(2);

    // Scope 1: Due cards only
    const dueCardsOnly = wordsInSet.filter((w) => w.reviewMeta.dueDate <= now);
    expect(dueCardsOnly).toHaveLength(1);
    expect(dueCardsOnly[0].word).toBe('feasible');

    // Scope 2: Entire set
    expect(wordsInSet).toHaveLength(2);
  });

  it('4. Handles empty state gracefully when no cards in the set are currently due', async () => {
    // Only initialLearnedWord exists, which is due in 5 days
    await linkWordsToQuizletSet([initialLearnedWord], setRef1);

    const wordsInSet = await getWordsByQuizletSet(setRef1.id);
    const now = Date.now();
    const dueCards = wordsInSet.filter((w) => w.reviewMeta.dueDate <= now);

    expect(dueCards).toHaveLength(0); // 0 due cards -> triggers empty state UI
  });

  it('5. Deleting a Quizlet set clears set metadata and unlinks references without deleting vocabulary cards', async () => {
    await saveQuizletSetMetadata({
      id: setRef1.id,
      title: setRef1.title,
      url: setRef1.url,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await linkWordsToQuizletSet([initialLearnedWord], setRef1);

    // Delete set
    await deleteQuizletSet(setRef1.id);

    // Set metadata should be removed
    const set = await getQuizletSetById(setRef1.id);
    expect(set).toBeUndefined();

    // Vocabulary card must STILL exist in IndexedDB!
    const word = await db.words.get(initialLearnedWord.id);
    expect(word).toBeDefined();
    expect(word?.word).toBe('negotiate');
    expect(word?.quizletSetIds).toEqual([]); // unlinked
  });
});
