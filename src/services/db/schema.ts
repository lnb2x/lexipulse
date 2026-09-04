import Dexie, { type Table } from 'dexie';
import type { DailyStats, WordItem } from '../../types/vocab';

export class LexiPulseDatabase extends Dexie {
  words!: Table<WordItem, string>;
  dailyStats!: Table<DailyStats, string>;
  settingsTable!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('LexiPulseDB');
    this.version(1).stores({
      words: 'id, word, status, createdAt, updatedAt, *tags, [status+reviewMeta.dueDate]',
      dailyStats: 'date, streak',
      settingsTable: 'key',
    });
    this.version(2).stores({
      words: 'id, word, status, createdAt, updatedAt, *tags',
      dailyStats: 'date, streak',
      settingsTable: 'key',
    });
  }
}

export const db = new LexiPulseDatabase();
