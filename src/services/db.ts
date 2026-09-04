import { db } from './db/schema';
import { SEED_WORDS } from './db/seedData';
import { DEFAULT_SETTINGS } from './db/statsRepo';
import { formatLocalDate } from '../utils/dateUtils';

// Re-export core modules
export { db, LexiPulseDatabase } from './db/schema';
export { SEED_WORDS } from './db/seedData';
export {
  DEFAULT_SETTINGS,
  getAppSettings,
  saveAppSettings,
  getTodayStats,
  recordReviewActivity,
  getAllDailyStats,
} from './db/statsRepo';
export {
  exportDeckToJson,
  exportDeckToCsv,
  exportDeckToXlsx,
} from './db/backup';
export {
  importDeckFromJson,
  type ImportDeckOptions,
  saveOrUpdateWord,
  bulkUpsertWords,
  findWordByTerm,
  getWordById,
  updateWordNotes,
  updateWordTags,
  deleteWord,
} from './vocabRepository';

export interface InitializeDbOptions {
  optInDemoWords?: boolean;
}

/**
 * Initializes database idempotently.
 * - Demo words are strictly opt-in (fresh database has 0 words by default).
 * - Fresh database has authentic 0 reviews and 0 streak (no fake historical activity).
 * - Safe for React 19 StrictMode double-execution.
 */
export async function initializeDatabase(options: InitializeDbOptions = {}): Promise<void> {
  const todayDateStr = formatLocalDate();

  const count = await db.words.count();
  if (count === 0 && options.optInDemoWords) {
    // Populate pre-seeded words only when explicitly opted in
    await db.words.bulkAdd(SEED_WORDS);
  }

  // Ensure app settings exist idempotently
  const settings = await db.settingsTable.get('appSettings');
  if (!settings) {
    await db.settingsTable.put({ key: 'appSettings', value: DEFAULT_SETTINGS });
  }

  // Ensure today's stats exist without creating fake streaks or review activity
  const todayStats = await db.dailyStats.get(todayDateStr);
  if (!todayStats) {
    const yesterday = formatLocalDate(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStats = await db.dailyStats.get(yesterday);
    const streak = yesterdayStats && yesterdayStats.cardsReviewed > 0 ? yesterdayStats.streak : 0;

    await db.dailyStats.put({
      date: todayDateStr,
      cardsReviewed: 0,
      streak,
      lastActiveDate: yesterdayStats && yesterdayStats.cardsReviewed > 0 ? yesterdayStats.lastActiveDate : todayDateStr,
    });
  }
}

/**
 * Reset deck to original default seed words
 */
export async function resetDatabaseToDefault(): Promise<void> {
  await db.words.clear();
  await db.words.bulkAdd(SEED_WORDS);
}
