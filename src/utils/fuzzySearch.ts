/**
 * Fast & Robust Damerau-Levenshtein Fuzzy Matching & String Similarity
 * Handles:
 * 1. Insertions: 'feisible' -> 'feasible'
 * 2. Deletions: 'negotate' -> 'negotiate'
 * 3. Substitutions: 'inplement' -> 'implement'
 * 4. Adjacent transpositions: 'fundign' -> 'funding', 'faciltiy' -> 'facility'
 */

/**
 * Calculates restricted Damerau-Levenshtein (optimal string alignment) distance.
 * Three rolling rows retain the two previous prefixes needed for transpositions.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  let a = s1.trim().toLowerCase();
  let b = s2.trim().toLowerCase();

  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Keep row storage proportional to the shorter input.
  if (a.length > b.length) [a, b] = [b, a];
  let previousPrevious = new Array<number>(a.length + 1).fill(0);
  let previous = Array.from({ length: a.length + 1 }, (_, index) => index);
  let current = new Array<number>(a.length + 1).fill(0);

  for (let i = 1; i <= b.length; i++) {
    current[0] = i;
    for (let j = 1; j <= a.length; j++) {
      current[j] = Math.min(
        previous[j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1),
        current[j - 1] + 1,
        previous[j] + 1
      );
      if (
        i > 1 &&
        j > 1 &&
        b[i - 1] === a[j - 2] &&
        b[i - 2] === a[j - 1]
      ) {
        current[j] = Math.min(current[j], previousPrevious[j - 2] + 1);
      }
    }
    const reusable = previousPrevious;
    previousPrevious = previous;
    previous = current;
    current = reusable;
  }

  return previous[a.length];
}

/**
 * Returns a normalized similarity score between 0.0 (completely different) and 1.0 (identical)
 */
export function stringSimilarity(s1: string, s2: string): number {
  const a = s1.trim().toLowerCase();
  const b = s2.trim().toLowerCase();
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

export interface FuzzyMatchCandidate<T> {
  item: T;
  key: string;
  distance: number;
  similarity: number;
}

/**
 * Searches a list of candidates and returns items matching above a similarity threshold,
 * ranked by relevance (similarity desc, then distance asc, then length diff).
 */
export function findFuzzyMatches<T>(
  query: string,
  items: T[],
  getKey: (item: T) => string,
  minSimilarity = 0.65,
  maxResults = 5
): FuzzyMatchCandidate<T>[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const candidates: FuzzyMatchCandidate<T>[] = [];
  const seenKeys = new Set<string>();

  for (const item of items) {
    const key = getKey(item).trim().toLowerCase();
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    // Exact match is not a typo
    if (key === q) continue;

    // Fast check: length difference cannot exceed 3 for typical typos
    if (Math.abs(key.length - q.length) > 3) continue;

    const distance = levenshteinDistance(q, key);
    const similarity = Math.max(0, 1 - distance / Math.max(q.length, key.length));

    // If similarity passes threshold or edit distance is <= 2
    if (similarity >= minSimilarity || (q.length >= 4 && distance <= 2)) {
      candidates.push({
        item,
        key,
        distance,
        similarity,
      });
    }
  }

  // Sort: highest similarity first, lowest distance, then alphabetical
  return candidates
    .sort((a, b) => {
      if (b.similarity !== a.similarity) {
        return b.similarity - a.similarity;
      }
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      return a.key.localeCompare(b.key);
    })
    .slice(0, maxResults);
}
