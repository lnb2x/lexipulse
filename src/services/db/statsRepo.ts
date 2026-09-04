import { db } from './schema';
import type { AppSettings, DailyStats } from '../../types/vocab';
import { formatLocalDate } from '../../utils/dateUtils';

export const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'gemini',
  aiApiKey: '',
  aiBaseUrl: '',
  aiModel: 'gemini-2.5-flash',
  geminiApiKey: '',
  speechRate: 0.95,
  speechPitch: 1.0,
  preferredAccent: 'US',
  dailyQuota: 10,
  theme: 'dark',
};

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const item = await db.settingsTable.get('appSettings');
    if (!item) return DEFAULT_SETTINGS;

    const loaded = { ...DEFAULT_SETTINGS, ...item.value };

    // Backward compatibility: If user had legacy geminiApiKey but no aiApiKey, migrate it
    if (!loaded.aiApiKey && loaded.geminiApiKey) {
      loaded.aiApiKey = loaded.geminiApiKey;
      loaded.aiProvider = 'gemini';
    }

    return loaded;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const updated = { ...current, ...settings };
  await db.settingsTable.put({ key: 'appSettings', value: updated });
  return updated;
}

export async function getTodayStats(): Promise<DailyStats> {
  const today = formatLocalDate();
  const existing = await db.dailyStats.get(today);
  if (existing) return existing;

  // Calculate streak from yesterday if yesterday actually had reviews
  const yesterday = formatLocalDate(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayStats = await db.dailyStats.get(yesterday);
  const streak = yesterdayStats && yesterdayStats.cardsReviewed > 0 ? yesterdayStats.streak : 0;

  const newStats: DailyStats = {
    date: today,
    cardsReviewed: 0,
    streak,
    lastActiveDate: yesterdayStats && yesterdayStats.cardsReviewed > 0 ? yesterdayStats.lastActiveDate : today,
  };
  await db.dailyStats.put(newStats);
  return newStats;
}

export async function recordReviewActivity(): Promise<DailyStats> {
  return await db.transaction('rw', db.dailyStats, async () => {
    const today = formatLocalDate();
    const yesterday = formatLocalDate(Date.now() - 24 * 60 * 60 * 1000);

    const current = await db.dailyStats.get(today);
    const yesterdayStats = await db.dailyStats.get(yesterday);

    let newStreak = 1;
    if (current && current.cardsReviewed > 0) {
      newStreak = current.streak; // already incremented today
    } else if (yesterdayStats && yesterdayStats.cardsReviewed > 0) {
      newStreak = yesterdayStats.streak + 1;
    }

    const updated: DailyStats = {
      date: today,
      cardsReviewed: (current?.cardsReviewed || 0) + 1,
      streak: newStreak,
      lastActiveDate: today,
    };

    await db.dailyStats.put(updated);
    return updated;
  });
}

export async function getAllDailyStats(): Promise<DailyStats[]> {
  try {
    return await db.dailyStats.toArray();
  } catch {
    return [];
  }
}
