import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db, getAppSettings, getTodayStats, recordReviewActivity } from '../services/db';
import { calculateNextReview } from '../services/sm2';
import { generateClozeQuestion as generateClozeQuestionUtil } from '../utils/clozeGenerator';
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
      return generateClozeQuestionUtil(word, allCards);
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

  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submit review grading for a given word ID
  const submitRating = async (wordId: string, rating: ReviewRating) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const targetWord = allCards.find((w) => w.id === wordId) || currentCard;
      if (!targetWord) return;

      const { nextMeta, newStatus } = calculateNextReview(targetWord.reviewMeta, rating);

      // Atomic Dexie transaction for word update & review activity recording
      await db.transaction('rw', [db.words, db.dailyStats], async () => {
        await db.words.update(targetWord.id, {
          reviewMeta: nextMeta,
          status: newStatus,
          updatedAt: Date.now(),
        });
        await recordReviewActivity();
      });

      // Track session history
      setSessionHistory((prev) => [...prev, { word: targetWord, rating }]);

      // Move to next card or complete
      if (sessionIndex + 1 >= dueCards.length) {
        setSessionCompleted(true);
      } else {
        setSessionIndex((prev) => prev + 1);
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
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
    totalInSession: dueCards.length,
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
    isSubmitting,
  };
}
