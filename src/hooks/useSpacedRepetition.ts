import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { db, getAppSettings, getTodayStats, recordReviewActivity } from '../services/db';
import { calculateNextReview } from '../services/sm2';
import type { AppSettings, ClozeQuestion, ReviewRating, WordItem } from '../types/vocab';

export function useSpacedRepetition(deckWords?: WordItem[]) {
  const [sessionIndex, setSessionIndex] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<Array<{ word: WordItem; rating: ReviewRating }>>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Load app settings
  useEffect(() => {
    getAppSettings().then(setSettings);
  }, []);

  // Today stats reactively
  const todayStats = useLiveQuery(async () => {
    return await getTodayStats();
  }, []) || { date: '', cardsReviewed: 0, streak: 0, lastActiveDate: '' };

  // All cards from database or prop
  const dbCards = useLiveQuery(async () => {
    return await db.words.toArray();
  }, []) || [];

  const allCards = deckWords && deckWords.length > 0 ? deckWords : dbCards;

  // Due cards (dueDate <= now)
  const dueCards = useMemo(() => {
    const now = Date.now();
    return allCards
      .filter((w) => w.reviewMeta.dueDate <= now)
      .sort((a, b) => a.reviewMeta.dueDate - b.reviewMeta.dueDate);
  }, [allCards]);

  // Daily quota progress
  const dailyQuota = settings?.dailyQuota || 10;
  const cardsReviewedToday = todayStats.cardsReviewed;
  const quotaProgress = Math.min(100, Math.round((cardsReviewedToday / dailyQuota) * 100));

  // Current session queue
  const currentCard = dueCards[sessionIndex] || null;

  // Generate Cloze Test question for a single word
  const generateClozeQuestion = useCallback(
    (word: WordItem): ClozeQuestion => {
      // Find workplace/TOEIC example if available, else general example
      const ex = word.examples.find((e) => e.context === 'toeic') || word.examples[0] || {
        en: `It is essential to understand how to apply ${word.word} in business.`,
        vi: `Điều quan trọng là hiểu cách áp dụng từ này trong kinh doanh.`,
        context: 'toeic',
      };

      // Mask the target word in the sentence (case-insensitive regex)
      const regex = new RegExp(`\\b${word.word}\\b`, 'gi');
      let maskedSentence = ex.en.replace(regex, '________');
      if (!maskedSentence.includes('________')) {
        // In case of inflections like 'negotiates' or 'negotiating'
        const rootRegex = new RegExp(`\\b${word.word.slice(0, -1)}[a-z]*\\b`, 'gi');
        maskedSentence = ex.en.replace(rootRegex, '________');
      }
      if (!maskedSentence.includes('________')) {
        maskedSentence = `[Sentence]: The key task was to ________ all aspects.`;
      }

      // Generate 3 distractors from other words in the deck
      const otherWords = allCards
        .filter((w) => w.word !== word.word)
        .map((w) => w.word);

      // Shuffle other words
      const shuffledOthers = [...otherWords].sort(() => 0.5 - Math.random());
      const distractors = shuffledOthers.slice(0, 3);

      // If not enough words in deck, pad with realistic business words
      const fallbackDistractors = ['facilitate', 'preliminary', 'substantial', 'comprehensive'];
      for (const fallback of fallbackDistractors) {
        if (distractors.length < 3 && fallback !== word.word && !distractors.includes(fallback)) {
          distractors.push(fallback);
        }
      }

      // Combine and shuffle 4 options
      const options = [word.word, ...distractors].sort(() => 0.5 - Math.random());

      return {
        word,
        sentenceWithBlank: maskedSentence,
        targetWord: word.word,
        options,
        contextVi: ex.vi,
        hintPos: word.pos.join(', '),
        hintDefinition: word.vietnameseDefinition,
      };
    },
    [allCards]
  );

  // Generate multiple cloze questions
  const generateClozeQuestions = useCallback(
    (words: WordItem[]): ClozeQuestion[] => {
      return words.map((w) => generateClozeQuestion(w));
    },
    [generateClozeQuestion]
  );

  // Submit review grading for a given word ID
  const submitRating = async (wordId: string, rating: ReviewRating) => {
    const targetWord = allCards.find((w) => w.id === wordId) || currentCard;
    if (!targetWord) return;

    const { nextMeta, newStatus } = calculateNextReview(targetWord.reviewMeta, rating);

    // Update word in database
    await db.words.update(targetWord.id, {
      reviewMeta: nextMeta,
      status: newStatus,
      updatedAt: Date.now(),
    });

    // Record review stats
    await recordReviewActivity();

    // Track session history
    setSessionHistory((prev) => [...prev, { word: targetWord, rating }]);

    // Move to next card or complete
    if (sessionIndex + 1 >= dueCards.length) {
      setSessionCompleted(true);
    } else {
      setSessionIndex((prev) => prev + 1);
    }
  };

  // Reset or restart session
  const restartSession = () => {
    setSessionIndex(0);
    setSessionCompleted(false);
    setSessionHistory([]);
  };

  return {
    dueCards,
    totalDue: dueCards.length,
    currentCard,
    sessionIndex,
    sessionCompleted,
    sessionHistory,
    todayStats,
    streak: todayStats.streak,
    reviewedTodayCount: cardsReviewedToday,
    dailyQuota,
    quotaProgress,
    submitRating,
    generateClozeQuestion,
    generateClozeQuestions,
    restartSession,
  };
}
