import type { ReviewMeta, ReviewRating, WordItem, WordStatus } from '../types/vocab';
import {
  applyFSRSReview,
  computeWordStatus as fsrsComputeWordStatus,
  createInitialReviewMeta as fsrsCreateInitialReviewMeta,
} from './fsrs/fsrsService';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;
export const MAX_EASE_FACTOR = 3.0;

/**
 * Creates a fresh ReviewMeta instance with FSRS support.
 */
export function createInitialReviewMeta(now: number = Date.now()): ReviewMeta {
  return fsrsCreateInitialReviewMeta(now);
}

/**
 * Computes updated status of a word based on FSRS metadata.
 */
export function computeWordStatus(meta: ReviewMeta, _now: number = Date.now()): WordStatus {
  return fsrsComputeWordStatus(meta);
}

/**
 * Check if a card is currently due for review
 */
export function isCardDue(item: WordItem, now: number = Date.now()): boolean {
  return item.reviewMeta.dueDate <= now;
}

/**
 * Spaced Repetition calculation delegating directly to FSRS v5.
 */
export function calculateNextReview(
  currentMeta: ReviewMeta,
  rating: ReviewRating,
  now: number = Date.now()
): { nextMeta: ReviewMeta; newStatus: WordStatus } {
  return applyFSRSReview(currentMeta, rating, now, 0.90, 'scheduled');
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
