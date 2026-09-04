import type { WordItem, EnrichmentStatus } from '../types/vocab';
import type { ParsedImportItem } from '../utils/importParser';
import { bulkUpsertWords } from './vocabRepository';
import { createInitialReviewMeta } from './sm2';
import { lookupWord } from './dictionary';

export interface BulkEnrichProgress {
  current: number;
  total: number;
  currentWord: string;
  succeeded: number;
  failed: number;
}

export interface BulkEnrichOptions {
  concurrency?: number;
  timeoutMs?: number;
  tags?: string[];
  createdAt?: number;
  abortSignal?: AbortSignal;
  onProgress?: (progress: BulkEnrichProgress) => void;
  lookupFn?: (word: string, signal?: AbortSignal) => Promise<any>;
}

export interface BulkEnrichResult {
  total: number;
  succeeded: number;
  failed: number;
  cancelled: boolean;
}

/**
 * Creates a clean WordItem from an item where lookup failed or wasn't performed.
 * CRITICAL: NEVER generates fake IPA, fake collocations, or fake example sentences!
 */
export function createUnenrichedWordItem(
  item: ParsedImportItem,
  tags: string[] = ['#Imported'],
  createdAt: number = Date.now(),
  status: EnrichmentStatus = 'failed'
): WordItem {
  return {
    id: `word-${createdAt}-${Math.random().toString(36).slice(2, 9)}`,
    word: item.word,
    phonetics: {},
    pos: item.userPos ? [item.userPos] : ['noun'],
    vietnameseDefinition: item.userMeaning || '',
    englishDefinition: '',
    meanings: [],
    collocations: [],
    wordFamily: [],
    examples: [],
    tags,
    status: 'new',
    createdAt,
    updatedAt: createdAt,
    reviewMeta: createInitialReviewMeta(),
    source: 'manual',
    enrichmentStatus: status,
  };
}

/**
 * Runs bulk enrichment over a list of parsed import items with:
 * - Bounded concurrency (default 3)
 * - Real AbortController cancellation on timeout or user cancel
 * - Throttled UI progress updates
 * - Batched IndexedDB writes via bulkUpsertWords
 * - Clean failure states with zero fake linguistic data
 */
export async function runBulkEnrichment(
  items: ParsedImportItem[],
  options: BulkEnrichOptions = {}
): Promise<BulkEnrichResult> {
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const timeoutMs = options.timeoutMs ?? 4000;
  const tags = options.tags && options.tags.length > 0 ? options.tags : ['#Imported'];
  const createdAt = options.createdAt ?? Date.now();
  const parentSignal = options.abortSignal;
  const lookup = options.lookupFn ?? lookupWord;

  const total = items.length;
  let succeeded = 0;
  let failed = 0;
  let processed = 0;
  let cancelled = false;

  // Throttling progress updates (~100ms interval)
  let lastProgressReportTime = 0;
  const reportProgress = (currentWord: string, force = false) => {
    const now = performance.now();
    if (force || now - lastProgressReportTime > 100 || processed === total) {
      lastProgressReportTime = now;
      options.onProgress?.({
        current: processed,
        total,
        currentWord,
        succeeded,
        failed,
      });
    }
  };

  const processedWords: WordItem[] = [];
  let itemIndex = 0;

  async function worker() {
    while (itemIndex < items.length) {
      if (parentSignal?.aborted) {
        cancelled = true;
        break;
      }

      const currentIndex = itemIndex++;
      const item = items[currentIndex];
      if (!item) break;

      reportProgress(item.word);

      // Create child abort controller for this specific request linked to parent signal and timeout
      const childController = new AbortController();
      let timer: any = null;

      const onParentAbort = () => {
        childController.abort();
      };
      if (parentSignal) {
        parentSignal.addEventListener('abort', onParentAbort, { once: true });
      }

      timer = setTimeout(() => {
        childController.abort();
      }, timeoutMs);

      let enrichedRecord: WordItem;

      try {
        const lookupResult = await lookup(item.word, childController.signal);

        // Word enriched successfully
        enrichedRecord = {
          ...lookupResult,
          id: `word-${createdAt}-${Math.random().toString(36).slice(2, 9)}`,
          word: item.word,
          vietnameseDefinition: item.userMeaning || lookupResult.vietnameseDefinition || '',
          tags: Array.from(new Set([...(lookupResult.tags || []), ...tags])),
          status: 'new',
          createdAt,
          updatedAt: createdAt,
          reviewMeta: createInitialReviewMeta(),
          source: lookupResult.source || 'online',
          enrichmentStatus: 'completed',
        };
        succeeded++;
      } catch (err: any) {
        // If user cancelled, don't count as standard failure
        if (parentSignal?.aborted) {
          cancelled = true;
          break;
        }

        // Clean un-enriched fallback without fake data
        enrichedRecord = createUnenrichedWordItem(item, tags, createdAt, 'failed');
        failed++;
      } finally {
        if (timer) clearTimeout(timer);
        if (parentSignal) {
          parentSignal.removeEventListener('abort', onParentAbort);
        }
      }

      processed++;
      processedWords.push(enrichedRecord);
      reportProgress(item.word);

      // Flush in batches of 10 to keep memory low and database fresh
      if (processedWords.length >= 10) {
        const batchToSave = processedWords.splice(0, processedWords.length);
        await bulkUpsertWords(batchToSave, { replaceProgress: false });
      }
    }
  }

  // Launch bounded worker pool
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  // Flush any remaining records
  if (processedWords.length > 0) {
    await bulkUpsertWords(processedWords, { replaceProgress: false });
  }

  reportProgress('', true);

  return {
    total,
    succeeded,
    failed,
    cancelled: cancelled || Boolean(parentSignal?.aborted),
  };
}
