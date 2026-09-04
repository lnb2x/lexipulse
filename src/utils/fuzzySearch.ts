/**
 * Fast & Robust Damerau-Levenshtein Fuzzy Matching & String Similarity
 * Handles:
 * 1. Insertions: 'feisible' -> 'feasible'
 * 2. Deletions: 'negotate' -> 'negotiate'
 * 3. Substitutions: 'inplement' -> 'implement'
 * 4. Transpositions: 'fundign' -> 'funding', 'facitily' -> 'facility'
 */

/**
 * Calculates Damerau-Levenshtein distance between two strings
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const a = s1.trim().toLowerCase();
  const b = s2.trim().toLowerCase();

  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  // Check transpositions (Damerau addition)
  for (let i = 1; i < b.length; i++) {
    for (let j = 1; j < a.length; j++) {
      if (
        i > 1 &&
        j > 1 &&
        b.charAt(i - 1) === a.charAt(j - 2) &&
        b.charAt(i - 2) === a.charAt(j - 1)
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }

  return matrix[b.length][a.length];
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
    const similarity = stringSimilarity(q, key);

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
