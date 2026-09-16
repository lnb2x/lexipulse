import { db } from './schema';
import { exportFullBackupToJson } from './backup';
import { sanitizeBackupSettings, verifyBackupEnvelope } from './backupEnvelope';
import type { WordItem } from '../../types/vocab';

export const BACKUP_TABLES = ['words', 'quizletSets', 'dailyStats', 'settingsTable'] as const;
export type BackupTableName = typeof BACKUP_TABLES[number];
export interface BackupPreview {
  recoveryBackup: string;
  tables: Record<BackupTableName, { current: number; incoming: number; added: number; matched: number; removed: number }>;
}

// JSON property order is immaterial, but record/array order remains significant.
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
}
function stateText(snapshot: Record<string, unknown>) {
  return JSON.stringify(stable(sanitizeBackupSettings(Object.fromEntries(
    BACKUP_TABLES.map(name => [name, snapshot[name] ?? []])))));
}

export async function assertRecoverySnapshot(recovery: Record<string, unknown>) {
  const entries = await Promise.all(BACKUP_TABLES.map(async name => [name, await db.table(name).toArray()]));
  if (stateText(Object.fromEntries(entries)) !== stateText(recovery)) throw new Error('stale_backup_preview');
}

export async function readRecoverySnapshot(json: string) {
  const recovery = JSON.parse(json);
  await verifyBackupEnvelope(recovery, db.verno);
  if (recovery.version !== 2 || BACKUP_TABLES.some(name => !Array.isArray(recovery[name]))) {
    throw new Error('complete_recovery_backup_required');
  }
  return recovery as Record<string, unknown>;
}

export async function buildBackupPreview(words: WordItem[], incoming: Record<string, unknown>, replace: boolean): Promise<BackupPreview> {
  const recoveryBackup = await exportFullBackupToJson();
  const current = JSON.parse(recoveryBackup);
  const tables = Object.fromEntries(BACKUP_TABLES.map(name => {
    const rows = name === 'words' ? words : name === 'settingsTable'
      ? (incoming.settingsTable ?? (incoming.settings ? [{ key: 'appSettings', value: incoming.settings }] : []))
      : (incoming[name] ?? []);
    const key = name === 'words' ? 'word' : name === 'settingsTable' ? 'key' : name === 'dailyStats' ? 'date' : 'id';
    const keys = (items: Record<string, unknown>[]) => new Set(items.filter(Boolean).map(item => String(item[key] ?? '').trim().toLowerCase()));
    const localKeys = keys(current[name]);
    const fileKeys = keys(rows as Record<string, unknown>[]);
    const matched = [...fileKeys].filter(value => localKeys.has(value)).length;
    return [name, { current: localKeys.size, incoming: fileKeys.size, added: fileKeys.size - matched,
      matched, removed: replace ? [...localKeys].filter(value => !fileKeys.has(value)).length : 0 }];
  })) as BackupPreview['tables'];
  return { recoveryBackup, tables };
}
