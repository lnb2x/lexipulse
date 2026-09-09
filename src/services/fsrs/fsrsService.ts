import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
  type Grade,
} from 'ts-fsrs';
import type {
  FSRSCardData,
  LegacyReviewMetaBackup,
  ReviewHistoryItem,
  ReviewMeta,
  ReviewRating,
  WordStatus,
} from '../../types/vocab';

export const DEFAULT_REQUEST_RETENTION = 0.90;
export const SHORT_TERM_RELEARNING_STEP = '10m';

/**
 * Returns a configured FSRS scheduler instance.
 * Disabling fuzz guarantees 100% parity between preview and submission.
 */
export function getFSRSScheduler(requestRetention: number = DEFAULT_REQUEST_RETENTION) {
  return fsrs({
    request_retention: requestRetention,
    enable_short_term: true,
    learning_steps: ['1m', '10m'],
    relearning_steps: [SHORT_TERM_RELEARNING_STEP],
    enable_fuzz: false,
  });
}

/**
 * Convert serializable FSRSCardData (timestamps as ms numbers) to ts-fsrs Card.
 */
export function toFSRSCard(cardData: FSRSCardData): Card {
  const base = createEmptyCard(new Date(cardData.due));
  return {
    ...base,
    due: new Date(cardData.due),
    stability: cardData.stability,
    difficulty: cardData.difficulty,
    elapsed_days: cardData.elapsed_days,
    scheduled_days: cardData.scheduled_days,
    reps: cardData.reps,
    lapses: cardData.lapses,
    state: cardData.state as State,
    last_review: cardData.last_review ? new Date(cardData.last_review) : undefined,
  };
}

/**
 * Convert ts-fsrs Card to serializable FSRSCardData.
 */
export function fromFSRSCard(card: Card): FSRSCardData {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.getTime() : null,
  };
}

/**
 * Creates initial FSRSCardData for a brand-new card.
 */
export function createInitialFSRSCard(now: number = Date.now()): FSRSCardData {
  const empty = createEmptyCard(new Date(now));
  return fromFSRSCard(empty);
}

/**
 * Creates initial ReviewMeta for a brand-new card using FSRS.
 */
export function createInitialReviewMeta(now: number = Date.now()): ReviewMeta {
  const fsrsData = createInitialFSRSCard(now);
  return {
    repetition: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: fsrsData.due,
    lastReviewedDate: null,
    history: [],
    fsrs: fsrsData,
    schedulerVersion: 'fsrs-v5',
  };
}

/**
 * Human-readable interval formatting (e.g. '10m', '1d', '3d', '2w', '1mo').
 */
export function formatFSRSInterval(dueMs: number, nowMs: number = Date.now(), language: 'vi' | 'en' = 'vi'): string {
  const diffMs = dueMs - nowMs;
  if (diffMs <= 0) return language === 'vi' ? 'ngay bây giờ' : 'now';

  const diffMinutes = Math.round(diffMs / (60 * 1000));
  if (diffMinutes < 60) {
    return `${Math.max(1, diffMinutes)}${language === 'vi' ? 'p' : 'm'}`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}${language === 'vi' ? 'g' : 'h'}`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays}${language === 'vi' ? 'ng' : 'd'}`;
  }

  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths}${language === 'vi' ? 'th' : 'mo'}`;
  }

  const diffYears = Math.round(diffDays / 365);
  return `${diffYears}${language === 'vi' ? 'n' : 'y'}`;
}

export interface FSRSPreviewOption {
  rating: ReviewRating;
  labelVi: string;
  labelEn: string;
  intervalTextVi: string;
  intervalTextEn: string;
  intervalText: string;
  nextDue: number;
  scheduledDays: number;
  card: FSRSCardData;
}

/**
 * Pure preview calculation without mutating card or database.
 * Returns preview for all 4 ratings (Again, Hard, Good, Easy).
 */
export function previewFSRS(
  meta: ReviewMeta,
  now: number = Date.now(),
  targetRetention: number = DEFAULT_REQUEST_RETENTION
): Record<ReviewRating, FSRSPreviewOption> {
  const scheduler = getFSRSScheduler(targetRetention);

  let currentCard: Card;
  if (meta.fsrs) {
    currentCard = toFSRSCard(meta.fsrs);
  } else {
    // On-the-fly migration for legacy meta
    const migrated = migrateLegacyMetaToFSRS(meta, now, meta.dueDate);
    currentCard = toFSRSCard(migrated.fsrs!);
  }

  const repeatResult = scheduler.repeat(currentCard, new Date(now));

  const buildOption = (
    rating: ReviewRating,
    labelVi: string,
    labelEn: string,
    fsrsRating: Grade
  ): FSRSPreviewOption => {
    const nextCard = repeatResult[fsrsRating].card;
    const nextDue = nextCard.due.getTime();
    const intervalTextVi = formatFSRSInterval(nextDue, now, 'vi');
    const intervalTextEn = formatFSRSInterval(nextDue, now, 'en');
    return {
      rating,
      labelVi,
      labelEn,
      intervalTextVi,
      intervalTextEn,
      intervalText: intervalTextVi,
      nextDue,
      scheduledDays: nextCard.scheduled_days,
      card: fromFSRSCard(nextCard),
    };
  };

  return {
    1: buildOption(1, 'Quên', 'Again', Rating.Again as Grade),
    2: buildOption(2, 'Khó', 'Hard', Rating.Hard as Grade),
    3: buildOption(3, 'Nhớ', 'Good', Rating.Good as Grade),
    4: buildOption(4, 'Dễ', 'Easy', Rating.Easy as Grade),
  };
}

/**
 * Determines WordStatus from FSRS metadata.
 */
export function computeWordStatus(meta: ReviewMeta): WordStatus {
  if (meta.repetition === 0) return 'new';

  if (meta.fsrs) {
    if (meta.fsrs.state === State.Learning || meta.fsrs.state === State.Relearning) {
      return 'learning';
    }
    if (
      meta.fsrs.state === State.Review &&
      meta.repetition >= 4 &&
      (meta.fsrs.scheduled_days >= 21 || meta.interval >= 21)
    ) {
      return 'mastered';
    }
    return 'review_needed';
  }

  if (meta.repetition >= 4 && meta.interval >= 21) {
    return 'mastered';
  }
  return 'learning';
}

/**
 * Applies FSRS review to a card's reviewMeta.
 * Guaranteed to match preview output at the same `now`.
 * In 'cram' mode, does NOT mutate dueDate or SRS trajectory.
 */
export function applyFSRSReview(
  meta: ReviewMeta,
  rating: ReviewRating,
  now: number = Date.now(),
  targetRetention: number = DEFAULT_REQUEST_RETENTION,
  reviewType: 'scheduled' | 'due' | 'cram' = 'scheduled'
): { nextMeta: ReviewMeta; newStatus: WordStatus; nextDue: number } {
  if (reviewType === 'cram') {
    // Cram / Extra practice does NOT alter SRS schedule or trajectory
    const newStatus = computeWordStatus(meta);
    return {
      nextMeta: { ...meta },
      newStatus,
      nextDue: meta.dueDate,
    };
  }

  // Scheduled SRS review
  const preview = previewFSRS(meta, now, targetRetention);
  const selectedPreview = preview[rating];
  const nextFsrsData = selectedPreview.card;

  const historyItem: ReviewHistoryItem = {
    date: now,
    rating,
    interval: nextFsrsData.scheduled_days,
    easeFactor: meta.easeFactor,
    repetition: nextFsrsData.reps,
    reviewType: 'scheduled',
    fsrsState: nextFsrsData.state,
    stability: nextFsrsData.stability,
    difficulty: nextFsrsData.difficulty,
  };

  const nextMeta: ReviewMeta = {
    ...meta,
    repetition: nextFsrsData.reps,
    interval: nextFsrsData.scheduled_days,
    dueDate: nextFsrsData.due,
    lastReviewedDate: now,
    history: [...(meta.history || []), historyItem],
    fsrs: nextFsrsData,
    schedulerVersion: 'fsrs-v5',
  };

  const newStatus = computeWordStatus(nextMeta);

  return {
    nextMeta,
    newStatus,
    nextDue: nextFsrsData.due,
  };
}

/**
 * Lossless migration from legacy SM-2 metadata to FSRS.
 * Replays chronological history if valid.
 * Estimates parameters if history is missing or damaged.
 * PRESERVES current dueDate so existing cards are not rescheduled to today.
 * Preserves legacy backup for safe rollback.
 */
export function migrateLegacyMetaToFSRS(
  meta: ReviewMeta,
  createdAt: number = Date.now(),
  currentDueDate?: number
): ReviewMeta {
  // Idempotency: If already migrated, return intact
  if (meta.schedulerVersion === 'fsrs-v5' && meta.fsrs) {
    return meta;
  }

  const legacyBackup: LegacyReviewMetaBackup = {
    repetition: meta.repetition ?? 0,
    interval: meta.interval ?? 0,
    easeFactor: meta.easeFactor ?? 2.5,
    dueDate: meta.dueDate ?? currentDueDate ?? createdAt,
    lastReviewedDate: meta.lastReviewedDate ?? null,
    history: [...(meta.history || [])],
  };

  const scheduler = getFSRSScheduler(DEFAULT_REQUEST_RETENTION);
  const targetDueDate = meta.dueDate ?? currentDueDate ?? createdAt;

  // Case 1: Brand new card with no repetition
  if ((meta.repetition ?? 0) === 0 && (!meta.history || meta.history.length === 0)) {
    const fsrsData = createInitialFSRSCard(createdAt);
    fsrsData.due = targetDueDate;
    return {
      ...meta,
      repetition: 0,
      interval: 0,
      easeFactor: meta.easeFactor ?? 2.5,
      dueDate: targetDueDate,
      lastReviewedDate: meta.lastReviewedDate ?? null,
      history: meta.history ?? [],
      fsrs: fsrsData,
      schedulerVersion: 'fsrs-v5',
      legacyBackup,
    };
  }

  // Case 2: History exists and is valid -> Chronological Replay
  const history = [...(meta.history || [])].filter((h) => typeof h.date === 'number' && !isNaN(h.date));
  history.sort((a, b) => a.date - b.date);

  if (history.length > 0) {
    const initialDate = history[0].date > createdAt ? createdAt : history[0].date - 1000;
    let card = createEmptyCard(new Date(initialDate));

    for (const item of history) {
      let fsrsRating: Rating;
      // Strict semantic mapping:
      // Old 1 (Again) -> Rating.Again (1)
      // Old 2 (Good) -> Rating.Good (3)
      // Old 3 (Easy) -> Rating.Easy (4)
      if (item.rating === 1) {
        fsrsRating = Rating.Again;
      } else if (item.rating === 2) {
        fsrsRating = Rating.Good;
      } else if (item.rating === 3 || (item.rating as number) === 4) {
        fsrsRating = Rating.Easy;
      } else {
        fsrsRating = Rating.Good;
      }

      const result = scheduler.next(card, new Date(item.date), fsrsRating);
      card = result.card;
    }

    const fsrsData = fromFSRSCard(card);
    // CRITICAL REQUIREMENT: Preserve current dueDate to prevent bulk cards becoming due today
    fsrsData.due = targetDueDate;

    return {
      ...meta,
      repetition: fsrsData.reps,
      interval: fsrsData.scheduled_days,
      dueDate: targetDueDate,
      lastReviewedDate: fsrsData.last_review,
      history: meta.history,
      fsrs: fsrsData,
      schedulerVersion: 'fsrs-v5',
      legacyBackup,
    };
  }

  // Case 3: repetition > 0 but history is missing or damaged -> Estimated conversion without fake history
  const interval = Math.max(1, meta.interval || 1);
  const ef = Math.min(3.0, Math.max(1.3, meta.easeFactor || 2.5));
  // In FSRS, stability at 90% retention roughly equals interval (days)
  const stability = Number(interval.toFixed(2));
  // Higher ease factor correlates with lower difficulty (scale 1 to 10)
  const difficulty = Number((10 - (ef - 1.3) * (9 / 1.7)).toFixed(2));

  const estimatedCardData: FSRSCardData = {
    due: targetDueDate,
    stability,
    difficulty,
    elapsed_days: interval,
    scheduled_days: interval,
    reps: meta.repetition,
    lapses: 0,
    state: State.Review,
    last_review: meta.lastReviewedDate,
  };

  return {
    ...meta,
    repetition: meta.repetition,
    interval,
    dueDate: targetDueDate,
    lastReviewedDate: meta.lastReviewedDate,
    history: [], // Do NOT create fake history!
    fsrs: estimatedCardData,
    schedulerVersion: 'fsrs-v5',
    isEstimated: true,
    legacyBackup,
  };
}
