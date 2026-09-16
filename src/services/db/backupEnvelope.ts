import { isRecord } from './backupValidation';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export async function backupChecksum(payload: unknown): Promise<string> {
  // Normalize exactly as JSON transport does, including omitted undefined fields.
  const bytes = new TextEncoder().encode(canonical(JSON.parse(JSON.stringify(payload))));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function sanitizeBackupSettings<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (key, item) =>
    key === 'aiApiKey' || key === 'geminiApiKey' ? '' : item));
}

export async function verifyBackupEnvelope(parsed: unknown, schemaVersion: number): Promise<void> {
  if (!isRecord(parsed) || Array.isArray(parsed)) return;
  if (parsed.type !== undefined && parsed.type !== 'lexipulse-backup') throw new Error('Unsupported backup type');
  if (parsed.version === undefined || parsed.version === 1) return;
  if (parsed.version !== 2 || parsed.type !== 'lexipulse-backup') throw new Error('Unsupported backup version');
  if (!Number.isInteger(parsed.schemaVersion) || Number(parsed.schemaVersion) > schemaVersion || Number(parsed.schemaVersion) < 1) {
    throw new Error('Unsupported database schemaVersion');
  }
  const { checksum, ...payload } = parsed;
  if (!isRecord(checksum) || checksum.algorithm !== 'SHA-256' || checksum.value !== await backupChecksum(payload)) {
    throw new Error('Backup checksum mismatch');
  }
  if (!Array.isArray(parsed.words) || !Array.isArray(parsed.quizletSets)) throw new Error('Missing backup tables');
}
