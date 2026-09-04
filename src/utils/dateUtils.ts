/**
 * Date utilities for robust Local-Timezone handling.
 * 
 * CRITICAL FIX FOR TIMEZONE OFFSETS (e.g. UTC+7 Vietnam):
 * NEVER use `date.toISOString().split('T')[0]`!
 * `toISOString()` formats in UTC, which means before 07:00 AM in UTC+7,
 * the date is STILL YESTERDAY (e.g. at 06:50 AM on Sep 3 in Vietnam, UTC is 23:50 on Sep 2).
 * `formatLocalDate` formats in the user's actual device/browser local timezone.
 */

/**
 * Returns 'YYYY-MM-DD' formatted according to the user's LOCAL timezone.
 */
export function formatLocalDate(input?: Date | number | string): string {
  if (!input && input !== 0) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const date = typeof input === 'object' && input instanceof Date ? input : new Date(input);
  if (isNaN(date.getTime())) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses a 'YYYY-MM-DD' string into a local timestamp (noon: 12:00:00 to prevent DST/timezone shifts).
 */
export function parseLocalDateToTimestamp(dateStr: string, timeOfDay: 'start' | 'noon' | 'end' = 'noon'): number {
  if (!dateStr || typeof dateStr !== 'string') return Date.now();
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return Date.now();
  }
  const [year, month, day] = parts;
  if (timeOfDay === 'start') {
    return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
  }
  if (timeOfDay === 'end') {
    return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  }
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
}

/**
 * Checks if two timestamps or Dates occur on the same local calendar day.
 */
export function isSameLocalDay(date1: Date | number | string, date2: Date | number | string): boolean {
  return formatLocalDate(date1) === formatLocalDate(date2);
}
