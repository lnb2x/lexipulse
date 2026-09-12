import Dexie, { type Table } from 'dexie';
import type { DailyStats, QuizletSetRecord, WordItem } from '../../types/vocab';

export class LexiPulseDatabase extends Dexie {
  words!: Table<WordItem, string>;
  dailyStats!: Table<DailyStats, string>;
  settingsTable!: Table<{ key: string; value: any }, string>;
  quizletSets!: Table<QuizletSetRecord, string>;

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
    this.version(3).stores({
      words: 'id, word, status, createdAt, updatedAt, *tags, reviewMeta.dueDate',
      dailyStats: 'date, streak',
      settingsTable: 'key',
    });
    this.version(4).stores({
      words: 'id, word, status, createdAt, updatedAt, *tags, reviewMeta.dueDate, *quizletSetIds',
      dailyStats: 'date, streak',
      settingsTable: 'key',
      quizletSets: 'id, title, url, createdAt, updatedAt',
    });
  }
}

export const db = new LexiPulseDatabase();

if (typeof window !== 'undefined') {
  (window as any).__db = db;
}
