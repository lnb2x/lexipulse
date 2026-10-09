import { describe, expect, it } from 'vitest';
import { findNextUnreviewedCardIndex } from '../src/utils/reviewNavigation';
import { integrityWord } from './dataIntegrityFixture';

const cards = Array.from({ length: 5 }, (_, index) => integrityWord(`card-${index}`));

describe('Review navigation after grading', () => {
  it.each([
    { name: 'continues after a manually selected card', currentIndex: 2, reviewed: [2], expected: 3 },
    { name: 'skips already graded cards ahead', currentIndex: 2, reviewed: [2, 3], expected: 4 },
    { name: 'wraps to skipped cards only at the end', currentIndex: 4, reviewed: [0, 4], expected: 1 },
    { name: 'wraps when every later card has been graded', currentIndex: 2, reviewed: [0, 2, 3, 4], expected: 1 },
    { name: 'finishes only when every card is graded', currentIndex: 2, reviewed: [0, 1, 2, 3, 4], expected: -1 },
  ])('$name', ({ currentIndex, reviewed, expected }) => {
    const sessionHistory = reviewed.map(index => ({ word: cards[index], rating: 3 }));
    expect(findNextUnreviewedCardIndex({ cards, currentIndex, sessionHistory })).toBe(expected);
  });

  it('finishes an empty queue', () => {
    expect(findNextUnreviewedCardIndex({ cards: [], currentIndex: 0, sessionHistory: [] })).toBe(-1);
  });
});
