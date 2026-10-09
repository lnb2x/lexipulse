import type { WordItem } from '../types/vocab';
import { normalizeVietnameseDefinition } from '../utils/definitionUtils';
import { db } from './db/schema';
import { getAppSettings } from './db/statsRepo';
import { SUGGESTION_CACHE, WORD_LRU_CACHE } from './dictionary/cache';
import { isMissingOrUntranslated } from '../utils/translationAuditor';

export const DEFINITION_CLEANUP_BACKUP_KEY = 'definition_cleanup_originals_v1';

export function hasVerboseDefinition(word: WordItem): boolean {
  return (word.vietnameseDefinition?.trim().split(/\s+/).length ?? 0) > 30;
}

/** A display projection also covers restored sessions and newly imported records. */
export function withCleanDefinitions(word: WordItem): WordItem {
  const clean = (raw: string) => {
    const normalized = normalizeVietnameseDefinition(raw);
    // Punctuation alone does not warrant rewriting a saved definition.
    return !normalized || normalized === raw.trim().replace(/[;,.]+$/, '') ? raw : normalized;
  };
  const definition = clean(word.vietnameseDefinition || '');
  let changed = definition !== word.vietnameseDefinition;
  const meanings = (word.meanings || []).map(meaning => {
    if (!meaning.vietnameseDefinition) return meaning;
    const vietnameseDefinition = clean(meaning.vietnameseDefinition);
    if (vietnameseDefinition === meaning.vietnameseDefinition) return meaning;
    changed = true;
    return { ...meaning, vietnameseDefinition };
  });
  return changed ? { ...word, vietnameseDefinition: definition, meanings } : word;
}

/** Keep the first original of each changed record, in the same transaction as its edit. */
async function backupOriginals(words: WordItem[]) {
  const previous = await db.settingsTable.get(DEFINITION_CLEANUP_BACKUP_KEY);
  const originals = new Map<string, WordItem>((previous?.value?.words ?? []).map((word: WordItem) => [word.id, word]));
  for (const word of words) if (!originals.has(word.id)) originals.set(word.id, word);
  await db.settingsTable.put({ key: DEFINITION_CLEANUP_BACKUP_KEY, value: {
    timestamp: previous?.value?.timestamp ?? Date.now(), words: [...originals.values()],
  } });
}

/** Offline, idempotent cleanup of every existing main definition and sub-sense. */
export async function cleanStoredDefinitions(): Promise<number> {
  const updated = await db.transaction('rw', db.words, db.settingsTable, async () => {
    const originals: WordItem[] = [];
    const replacements: WordItem[] = [];
    for (const word of await db.words.toArray()) {
      const clean = withCleanDefinitions(word);
      if (clean === word) continue;
      originals.push(word);
      replacements.push({ ...clean, updatedAt: Date.now() });
    }
    if (originals.length) {
      await backupOriginals(originals);
      await db.words.bulkPut(replacements);
    }
    return replacements;
  });
  for (const word of updated) WORD_LRU_CACHE.set(word.word.toLowerCase(), word);
  if (updated.length) SUGGESTION_CACHE.clear();
  return updated.length;
}

export interface DefinitionCleanupProgress {
  total: number;
  processed: number;
  updated: number;
  failed: number;
  skipped: number;
  currentWord: string;
  cancelled: boolean;
}

/** Rephrase the remaining prose without regenerating examples or the learning schedule. */
export async function shortenVerboseDefinitions(options: {
  signal?: AbortSignal;
  onProgress?: (progress: DefinitionCleanupProgress) => void;
} = {}): Promise<DefinitionCleanupProgress> {
  const locallyCleaned = await cleanStoredDefinitions();
  const words = (await db.words.toArray()).filter(hasVerboseDefinition);
  const progress: DefinitionCleanupProgress = {
    total: words.length + locallyCleaned, processed: locallyCleaned, updated: locallyCleaned,
    failed: 0, skipped: 0, currentWord: '', cancelled: false,
  };
  if (!words.length || options.signal?.aborted) return { ...progress, cancelled: !!options.signal?.aborted };
  const settings = await getAppSettings();
  if (settings.aiProvider !== 'custom' && !(settings.aiApiKey || settings.geminiApiKey)?.trim()) {
    throw new Error('Hãy cấu hình AI trong Cài đặt để viết lại các nghĩa dài.');
  }
  const { enrichWordWithAI } = await import('./ai');
  let index = 0;
  const report = () => options.onProgress?.({ ...progress });
  async function worker() {
    while (index < words.length && !options.signal?.aborted) {
      const snapshot = words[index++];
      progress.currentWord = snapshot.word;
      report();
      try {
        const result = await enrichWordWithAI(snapshot.word, snapshot.pos.join(', ') || 'noun', {
          provider: settings.aiProvider, apiKey: settings.aiApiKey || settings.geminiApiKey,
          model: settings.aiModel, baseUrl: settings.aiBaseUrl, forceReTranslate: true,
        }, snapshot.contextSentence, snapshot.vietnameseDefinition);
        if (options.signal?.aborted) break;
        const definition = normalizeVietnameseDefinition(result?.vietnameseDefinition || '');
        if (isMissingOrUntranslated(definition, snapshot.word) || hasVerboseDefinition({ ...snapshot, vietnameseDefinition: definition })) {
          progress.failed++;
        } else {
          const saved = await db.transaction('rw', db.words, db.settingsTable, async () => {
            const latest = await db.words.get(snapshot.id);
            if (!latest || latest.vietnameseDefinition !== snapshot.vietnameseDefinition ||
              latest.usageNoteVi !== snapshot.usageNoteVi || latest.word !== snapshot.word ||
              latest.contextSentence !== snapshot.contextSentence || JSON.stringify(latest.pos) !== JSON.stringify(snapshot.pos) ||
              JSON.stringify(latest.vietnameseDefinitionProvenance) !== JSON.stringify(snapshot.vietnameseDefinitionProvenance) ||
              latest.isUserEdited !== snapshot.isUserEdited) return undefined;
            await backupOriginals([latest]);
            const word: WordItem = { ...latest, vietnameseDefinition: definition, updatedAt: Date.now(),
              vietnameseDefinitionProvenance: { source: 'ai', provider: settings.aiProvider,
                model: settings.aiModel, createdAt: Date.now(), originalSource: latest.vietnameseDefinitionProvenance?.source } };
            await db.words.put(word);
            return word;
          });
          if (saved) {
            WORD_LRU_CACHE.set(saved.word.toLowerCase(), saved);
            SUGGESTION_CACHE.clear();
            progress.updated++;
          } else progress.skipped++;
        }
      } catch {
        if (options.signal?.aborted) break;
        progress.failed++;
      }
      progress.processed++;
      report();
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, words.length) }, () => worker()));
  progress.cancelled = !!options.signal?.aborted;
  progress.currentWord = '';
  report();
  return { ...progress };
}
