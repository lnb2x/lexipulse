import { createInitialReviewMeta } from '../src/services/fsrs/fsrsService';
import type { WordItem } from '../src/types/vocab';

export const fixtureNow = 1789420000000;
export function integrityWord(id = 'original', word = 'allocate'): WordItem {
  return {
    id, word, pos: ['verb'], phonetics: {}, vietnameseDefinition: 'phân bổ',
    englishDefinition: '', meanings: [], collocations: [], examples: [], wordFamily: [],
    tags: [], status: 'new', createdAt: fixtureNow, updatedAt: fixtureNow,
    reviewMeta: createInitialReviewMeta(fixtureNow),
  };
}
