import { describe, expect, it } from 'vitest';
import { findFuzzyMatches, levenshteinDistance, stringSimilarity } from '../src/utils/fuzzySearch';

describe('Fuzzy search', () => {
  it.each([
    ['ab', 'ba'],
    ['fundign', 'funding'],
    ['faciltiy', 'facility'],
    ['teh', 'the'],
  ])('counts adjacent transposition in %s as one edit', (query, word) => {
    expect(levenshteinDistance(query, word)).toBe(1);
    expect(levenshteinDistance(word, query)).toBe(1);
  });

  it('handles normalization, empty strings and ordinary edits', () => {
    expect(levenshteinDistance('  WORD ', 'word')).toBe(0);
    expect(levenshteinDistance('', 'word')).toBe(4);
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('facitily', 'facility')).toBe(2);
    expect(stringSimilarity('', '')).toBe(1);
    expect(stringSimilarity('fundign', 'funding')).toBeCloseTo(6 / 7);
  });

  it('ranks suggestions, deduplicates normalized words and excludes exact matches', () => {
    const matches = findFuzzyMatches('fundign', ['funding', ' FUNDING ', 'fundign', 'finding', 'cat'], (word) => word);
    expect(matches.map((match) => match.key)).toEqual(['funding', 'finding']);
    expect(matches[0].distance).toBe(1);
    expect(matches[0].similarity).toBeCloseTo(6 / 7);
    expect(findFuzzyMatches('', ['word'], (word) => word)).toEqual([]);
    expect(findFuzzyMatches('fundign', ['funding', 'finding'], (word) => word, 0.65, 1)).toHaveLength(1);
  });
});
