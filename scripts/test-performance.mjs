import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, [
  'node_modules/vitest/vitest.mjs', 'run', 'tests/optimization.test.ts',
  'tests/heatmap_review_navigation.test.tsx', '--maxWorkers=1',
], {
  stdio: 'inherit',
  env: { ...process.env, LEXIPULSE_PERFORMANCE_BUDGETS: '1' },
});
process.exit(result.status ?? 1);
