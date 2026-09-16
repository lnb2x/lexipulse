import { expect } from 'vitest';

// Timing budgets belong to a dedicated run, not concurrent correctness tests.
export function expectPerformanceBudget(actualMs: number, limitMs: number) {
  if (process.env.LEXIPULSE_PERFORMANCE_BUDGETS === '1') {
    expect(actualMs).toBeLessThan(limitMs);
  }
}
