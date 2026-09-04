import type { ReviewMeta, ReviewRating, WordItem, WordStatus } from '../types/vocab';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;
export const MAX_EASE_FACTOR = 3.0;

/**
 * Creates a fresh ReviewMeta instance for a newly added word.
 */
export function createInitialReviewMeta(): ReviewMeta {
  return {
    repetition: 0,
    interval: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    dueDate: Date.now(), // due immediately as 'new'
    lastReviewedDate: null,
    history: [],
  };
}

/**
 * Computes updated status of a word based on its review metadata.
 */
export function computeWordStatus(meta: ReviewMeta, now: number = Date.now()): WordStatus {
  if (meta.repetition === 0 && meta.lastReviewedDate === null) {
    return 'new';
  }

  // Mastered condition: reviewed reliably at least 4 times and interval is 21+ days
  if (meta.repetition >= 4 && meta.interval >= 21) {
    return 'mastered';
  }

  // If due date has passed and card has been studied before
  if (meta.dueDate <= now) {
    return 'review_needed';
  }

  return 'learning';
}

/**
 * Check if a card is currently due for review
 */
export function isCardDue(item: WordItem, now: number = Date.now()): boolean {
  // Brand new cards or cards whose due date has arrived
  return item.reviewMeta.dueDate <= now;
}

/**
 * Modified SuperMemo SM-2 Spaced Repetition Algorithm
 *
 * Ratings:
 * 1 = Again: Forgot the word. Reset repetition, interval = 1 day.
 * 2 = Good: Recalled correctly. Increment repetition, standard interval progression.
 * 3 = Easy: Recalled easily. Increment repetition, boosted interval progression + EF bonus.
 */
export function calculateNextReview(
  currentMeta: ReviewMeta,
  rating: ReviewRating,
  now: number = Date.now()
): { nextMeta: ReviewMeta; newStatus: WordStatus } {
  let repetition = currentMeta.repetition;
  let interval = currentMeta.interval;
  let easeFactor = currentMeta.easeFactor || DEFAULT_EASE_FACTOR;

  if (rating === 1) {
    // Rating 1: Again (lapse)
    repetition = 0;
    interval = 1; // 1 day
    // Reduce EF slightly, min 1.3
    easeFactor = Math.max(MIN_EASE_FACTOR, Number((easeFactor - 0.2).toFixed(2)));
  } else if (rating === 2) {
    // Rating 2: Good
    repetition += 1;
    if (repetition === 1) {
      interval = 1;
    } else if (repetition === 2) {
      interval = 3;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    // Keep or slightly adjust EF
    easeFactor = Math.max(MIN_EASE_FACTOR, Number(easeFactor.toFixed(2)));
  } else if (rating === 3) {
    // Rating 3: Easy
    repetition += 1;
    if (repetition === 1) {
      interval = 2;
    } else if (repetition === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor * 1.3);
    }
    // Increase EF for easy cards
    easeFactor = Math.min(MAX_EASE_FACTOR, Number((easeFactor + 0.15).toFixed(2)));
  }

  // Ensure minimum 1 day interval
  interval = Math.max(1, interval);

  const dueDate = now + interval * MS_PER_DAY;

  const nextMeta: ReviewMeta = {
    repetition,
    interval,
    easeFactor,
    dueDate,
    lastReviewedDate: now,
    history: [
      ...currentMeta.history,
      {
        date: now,
        rating,
        interval,
        easeFactor,
        repetition,
      },
    ],
  };

  const newStatus = computeWordStatus(nextMeta, now);

  return { nextMeta, newStatus };
}

/**
 * Format interval in days into human-friendly text (e.g. "1d", "3d", "2w", "1mo")
 */
export function formatInterval(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

/**
 * Format relative due time (e.g. "Due today", "Due in 2 days", "Overdue by 1 day")
 */
export function formatDueText(dueDate: number, now: number = Date.now()): { text: string; isOverdue: boolean } {
  const diffMs = dueDate - now;
  const diffDays = Math.round(diffMs / MS_PER_DAY);

  if (diffDays < 0) {
    const abs = Math.abs(diffDays);
    return {
      text: abs === 1 ? 'Overdue by 1 day' : `Overdue by ${abs} days`,
      isOverdue: true,
    };
  }

  if (diffDays === 0) {
    return { text: 'Due today', isOverdue: true };
  }

  if (diffDays === 1) {
    return { text: 'Due tomorrow', isOverdue: false };
  }

  return { text: `Due in ${diffDays} days`, isOverdue: false };
}
