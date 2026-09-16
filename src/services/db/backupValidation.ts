export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const strings = (value: unknown) => Array.isArray(value) && value.every(v => typeof v === 'string');

function validSettings(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const text = ['aiProvider', 'aiApiKey', 'geminiApiKey', 'aiBaseUrl', 'aiModel', 'theme', 'preferredAccent'];
  const numbers = ['speechRate', 'speechPitch', 'dailyQuota', 'loopInterval', 'desiredRetention'];
  return text.every(key => value[key] === undefined || typeof value[key] === 'string') &&
    numbers.every(key => value[key] === undefined || (finite(value[key]) && Number(value[key]) > 0)) &&
    ['persistApiKey', 'prioritizeAI'].every(key => value[key] === undefined || typeof value[key] === 'boolean') &&
    (value.groqModelPool === undefined || strings(value.groqModelPool));
}

/** Filter damaged auxiliary records before preview or any destructive write. */
export function validateSupplementalTables(parsed: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const validDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().startsWith(value);
  const integer = (value: unknown) => finite(value) && Number.isInteger(value) && Number(value) >= 0;
  const checks: Record<string, (row: Record<string, unknown>) => boolean> = {
    quizletSets: row => typeof row.id === 'string' && !!row.id.trim() && typeof row.title === 'string' &&
      typeof row.url === 'string' && finite(row.createdAt) && finite(row.updatedAt),
    dailyStats: row => validDate(row.date) && integer(row.cardsReviewed) &&
      (row.streak === undefined || integer(row.streak)) && (row.lastActiveDate === undefined || validDate(row.lastActiveDate)),
    settingsTable: row => typeof row.key === 'string' && !!row.key && 'value' in row &&
      (row.key !== 'appSettings' || validSettings(row.value)),
  };
  for (const [name, check] of Object.entries(checks)) {
    if (parsed[name] === undefined) continue;
    if (!Array.isArray(parsed[name])) throw new Error(`Invalid backup table: ${name}`);
    parsed[name] = parsed[name].filter((row, index) => {
      if (isRecord(row) && check(row)) return true;
      errors.push(`${name}[${index}]: invalid record`);
      return false;
    });
  }
  if (parsed.settings !== undefined && !validSettings(parsed.settings)) {
    errors.push('settings: invalid record');
    delete parsed.settings;
  }
  return errors;
}

/** Return a field path, never raw imported content or credentials. */
export function validateBackupWord(item: unknown): string | undefined {
  if (!isRecord(item) || typeof item.word !== 'string' || !item.word.trim()) return 'word';
  for (const key of ['id', 'vietnameseDefinition', 'englishDefinition', 'meaningVi', 'definition',
    'notes', 'lemma', 'originalInput', 'contextSentence', 'rawQuizletTerm', 'rawQuizletDefinition']) {
    if (item[key] !== undefined && typeof item[key] !== 'string') return key;
  }
  for (const key of ['pos', 'tags', 'formLabels', 'linkedVariants', 'quizletSetIds']) {
    if (item[key] !== undefined && !strings(item[key])) return key;
  }
  for (const key of ['createdAt', 'updatedAt']) {
    if (item[key] !== undefined && !finite(item[key])) return key;
  }
  if (item.status !== undefined && !['new', 'learning', 'review_needed', 'mastered'].includes(String(item.status))) return 'status';
  if (item.phonetics !== undefined && (!isRecord(item.phonetics) ||
    Object.values(item.phonetics).some(v => typeof v !== 'string'))) return 'phonetics';
  const arrays: Record<string, string[]> = {
    collocations: ['phrase', 'meaningVi', 'example'], wordFamily: ['word', 'pos', 'meaningVi'],
    examples: ['en', 'vi', 'context'], meanings: ['pos', 'englishDefinition', 'vietnameseDefinition', 'example'],
    inflections: ['form', 'word', 'label'], suggestions: ['word', 'meaningVi', 'pos', 'source'],
    quizletSets: ['id', 'title', 'url'],
  };
  for (const [key, fields] of Object.entries(arrays)) {
    const value = item[key];
    if (value === undefined) continue;
    if (!Array.isArray(value) || value.some(row => !isRecord(row) ||
      typeof row[fields[0]] !== 'string' || fields.some(field => row[field] !== undefined && typeof row[field] !== 'string') ||
      ['synonyms', 'antonyms'].some(field => row[field] !== undefined && !strings(row[field])))) return key;
  }
  if (item.reviewMeta === undefined) return;
  const meta = item.reviewMeta;
  if (!isRecord(meta)) return 'reviewMeta';
  for (const key of ['repetition', 'interval', 'easeFactor', 'dueDate']) {
    if (meta[key] !== undefined && !finite(meta[key])) return `reviewMeta.${key}`;
  }
  if (meta.history !== undefined && (!Array.isArray(meta.history) || meta.history.some(row =>
    !isRecord(row) || !finite(row.date) || ![1, 2, 3, 4].includes(Number(row.rating)) ||
    typeof row.rating !== 'number' || ['interval', 'repetition', 'easeFactor', 'stability', 'difficulty']
      .some(key => row[key] !== undefined && !finite(row[key]))))) return 'reviewMeta.history';
  if (meta.fsrs !== undefined) {
    const fsrs = meta.fsrs;
    if (!isRecord(fsrs)) return 'reviewMeta.fsrs';
    for (const key of ['due', 'stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'reps', 'lapses', 'state']) {
      if (!finite(fsrs[key]) || Number(fsrs[key]) < 0) return `reviewMeta.fsrs.${key}`;
    }
    if (![0, 1, 2, 3].includes(Number(fsrs.state))) return 'reviewMeta.fsrs.state';
    if (fsrs.last_review !== null && !finite(fsrs.last_review)) return 'reviewMeta.fsrs.last_review';
  }
}
