// Run with Node 22.18+ so the production TypeScript module can be imported directly.
import { findFuzzyMatches } from '../src/utils/fuzzySearch.ts';

// Similar-length candidates exercise distance computation instead of length rejection.
const words = Array.from({ length: 10000 }, (_, i) => `vocab${i.toString(36).padStart(4, 'a')}`);
for (let i = 0; i < 10; i++) findFuzzyMatches('vocbaabc', words, (word) => word);

const samples = [];
for (let i = 0; i < 40; i++) {
  const start = performance.now();
  findFuzzyMatches('vocbaabc', words, (word) => word);
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
console.log(JSON.stringify({
  candidates: words.length,
  runs: samples.length,
  p50_ms: samples[20],
  p95_ms: samples[38],
}, null, 2));
