import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db, getAppSettings, getTodayStats, recordReviewActivity } from '../services/db';
import { applyFSRSReview, previewFSRS, DEFAULT_REQUEST_RETENTION } from '../services/fsrs/fsrsService';
import { generateClozeQuestion as generateClozeQuestionUtil } from '../utils/clozeGenerator';
import type { AppSettings, ClozeQuestion, ReviewQueueStats, ReviewRating, WordItem } from '../types/vocab';

export type ReviewSessionType = 'due' | 'cram';

export function useSpacedRepetition(deckWords?: WordItem[]) {
  const [sessionIndex, setSessionIndex] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<Array<{ word: WordItem; rating: ReviewRating }>>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Dynamic clock tick every 10s so 10-minute relearning cards appear automatically
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

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

  // Due cards (dueDate <= currentTime)
  const dueCards = useMemo(() => {
    return allCards
      .filter((w) => w.reviewMeta.dueDate <= currentTime)
      .sort((a, b) => a.reviewMeta.dueDate - b.reviewMeta.dueDate);
  }, [allCards, currentTime]);

  // Queue Statistics
  const queueStats: ReviewQueueStats = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();

    let overdueCount = 0;
    let relearningCount = 0;
    let nextDueTimestamp: number | null = null;

    // Track first review today for each card to calculate actual retention rate
    const firstReviewMap = new Map<string, { rating: ReviewRating; date: number }>();

    for (const card of allCards) {
      const meta = card.reviewMeta;
      const due = meta.dueDate;

      if (due < startOfTodayMs) {
        overdueCount++;
      } else if (due > currentTime) {
        if (nextDueTimestamp === null || due < nextDueTimestamp) {
          nextDueTimestamp = due;
        }
      }

      // Check if card is currently in relearning step
      if (meta.fsrs?.state === 3 || (card.status === 'learning' && meta.repetition > 0 && due > currentTime)) {
        relearningCount++;
      }

      // Compute actual retention rate from today's first reviews
      if (meta.history && meta.history.length > 0) {
        for (const h of meta.history) {
          if (h.date >= startOfTodayMs && h.reviewType !== 'cram') {
            const existing = firstReviewMap.get(card.id);
            if (!existing || h.date < existing.date) {
              firstReviewMap.set(card.id, { rating: h.rating, date: h.date });
            }
          }
        }
      }
    }

    let actualRetentionRate: number | null = null;
    const retentionSampleCount = firstReviewMap.size;
    if (retentionSampleCount > 0) {
      let rememberedCount = 0;
      for (const [, item] of firstReviewMap) {
        // In 4-level rating, 3 (Good) and 4 (Easy) count as remembered; 1 (Again) is forgotten; 2 (Hard) is recalled with difficulty
        if (item.rating >= 2) {
          rememberedCount++;
        }
      }
      actualRetentionRate = Number((rememberedCount / retentionSampleCount).toFixed(2));
    }

    return {
      dueCount: dueCards.length,
      overdueCount,
      relearningCount,
      nextDueTimestamp,
      actualRetentionRate,
      retentionSampleCount,
    };
  }, [allCards, dueCards.length, currentTime]);

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
  const submitRating = async (
    wordId: string,
    rating: ReviewRating,
    sessionType: ReviewSessionType = 'due'
  ) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const now = Date.now();
      const targetRetention = settings?.desiredRetention || DEFAULT_REQUEST_RETENTION;

      // Atomic Dexie transaction reading FRESH word from DB to avoid stale snapshot bugs
      await db.transaction('rw', [db.words, db.dailyStats], async () => {
        const freshWord = await db.words.get(wordId);
        if (!freshWord) return;

        const { nextMeta, newStatus } = applyFSRSReview(
          freshWord.reviewMeta,
          rating,
          now,
          targetRetention,
          sessionType
        );

        if (sessionType === 'due') {
          // Official SRS review: update schedule & record activity
          await db.words.update(freshWord.id, {
            reviewMeta: nextMeta,
            status: newStatus,
            updatedAt: now,
          });
          await recordReviewActivity();
        } else {
          // Extra Practice (Cram): do NOT alter SRS schedule or learning history
          await db.words.update(freshWord.id, {
            updatedAt: now,
          });
        }
      });

      // Update local clock to reveal relearning or newly due cards
      setCurrentTime(Date.now());

      // Move session queue
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

  // Preview next review options without mutation
  const getCardPreview = useCallback(
    (meta: WordItem['reviewMeta']) => {
      const targetRetention = settings?.desiredRetention || DEFAULT_REQUEST_RETENTION;
      return previewFSRS(meta, Date.now(), targetRetention);
    },
    [settings?.desiredRetention]
  );

  // Reset or restart session
  const restartSession = () => {
    setSessionIndex(0);
    setSessionCompleted(false);
    setSessionHistory([]);
    setCurrentTime(Date.now());
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
    queueStats,
    submitRating,
    getCardPreview,
    generateClozeQuestion,
    generateClozeQuestions,
    restartSession,
    isSubmitting,
    settings,
  };
}
