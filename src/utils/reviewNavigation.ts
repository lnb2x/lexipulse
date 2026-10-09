import type { ReviewSessionState } from '../types/study';

export function findNextUnreviewedCardIndex(
  { cards, currentIndex, sessionHistory }: Pick<ReviewSessionState, 'cards' | 'currentIndex' | 'sessionHistory'>
): number {
  const reviewedIds = new Set(sessionHistory.map(({ word }) => word.id));
  // Continue after the current card; revisit skipped cards only after reaching the end.
  for (let offset = 1; offset <= cards.length; offset++) {
    const index = (currentIndex + offset) % cards.length;
    if (!reviewedIds.has(cards[index].id)) return index;
  }
  return -1;
}
