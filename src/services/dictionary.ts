import { db, getAppSettings } from './db';
import { createInitialReviewMeta } from './sm2';
import { enrichWordWithAI } from './ai';
import { vocabRepository } from './vocabRepository';
import type { MeaningItem, SpellingSuggestion, WordFamilyItem, WordItem } from '../types/vocab';
import { findFuzzyMatches, stringSimilarity } from '../utils/fuzzySearch';

// Re-exports from submodules for 100% backward compatibility
export {
  LRUCache,
  normalizeWordKey,
  warmSearchCache,
  WORD_LRU_CACHE,
  MEMORY_CACHE,
  TRANSLATION_CACHE,
} from './dictionary/cache';
export {
  LOCAL_KNOWLEDGE_BASE,
  COMMON_WORDS_IPA,
  STATIC_KB_CANDIDATES,
} from './dictionary/localData';
export { fetchWithTimeout } from './dictionary/circuitBreaker';
export { fetchWiktionaryVi, fetchWiktionaryData } from './dictionary/adapters/wiktionary';
export { fetchOpenVnEnDictData } from './dictionary/adapters/openVnDict';
export {
  fetchDatamuseInfo,
  fetchDatamuseWordFamily,
  fetchDatamuseCollocations,
  resolveSingleWordIpa,
  resolvePhraseIpa,
} from './dictionary/adapters/datamuse';
export { translateToVietnamese } from './dictionary/adapters/translation';

import {
  IN_FLIGHT_LOOKUPS,
  IN_FLIGHT_SUGGESTIONS,
  SUGGESTION_CACHE,
  WORD_LRU_CACHE,
  normalizeWordKey,
} from './dictionary/cache';
import { fetchWithTimeout } from './dictionary/circuitBreaker';
import { LOCAL_KNOWLEDGE_BASE, STATIC_KB_CANDIDATES } from './dictionary/localData';
import { fetchOpenVnEnDictData } from './dictionary/adapters/openVnDict';
import { fetchWiktionaryData } from './dictionary/adapters/wiktionary';
import {
  fetchDatamuseCollocations,
  fetchDatamuseInfo,
  fetchDatamuseWordFamily,
  resolvePhraseIpa,
} from './dictionary/adapters/datamuse';
import { translateToVietnamese } from './dictionary/adapters/translation';

export class WordNotFoundError extends Error {
  query: string;
  suggestions: SpellingSuggestion[];

  constructor(query: string, suggestions: SpellingSuggestion[] = [], message?: string) {
    super(message || `No definitions found for "${query}"`);
    this.name = 'WordNotFoundError';
    this.query = query;
    this.suggestions = suggestions;
  }
}

export interface LookupOptions {
  signal?: AbortSignal;
  onEnriched?: (word: WordItem) => void;
}

/**
 * Intelligent Spelling Suggestions & Typo Correction with LRU caching, TTL and AbortSignal
 */
export async function getSpellingSuggestions(
  rawQuery: string,
  deckWords: WordItem[] = [],
  signal?: AbortSignal
): Promise<SpellingSuggestion[]> {
  const q = rawQuery.trim().toLowerCase();
  if (!q || q.length < 2 || signal?.aborted) return [];

  // Check cache (TTL 5 minutes)
  const cached = SUGGESTION_CACHE.get(q);
  if (cached && cached.expires > Date.now()) {
    return cached.results;
  }

  if (IN_FLIGHT_SUGGESTIONS.has(q)) {
    return IN_FLIGHT_SUGGESTIONS.get(q)!;
  }

  const suggestionPromise = (async (): Promise<SpellingSuggestion[]> => {
    const results: SpellingSuggestion[] = [];
    const seenWords = new Set<string>([q]);

    // 1. Check user's Deck words with fuzzy matching
    if (deckWords.length > 0) {
      const deckCandidates = deckWords.map((w) => ({
        word: w.word,
        meaningVi: w.vietnameseDefinition,
        pos: w.pos?.[0] || 'word',
        source: 'deck' as const,
      }));
      const deckFuzzy = findFuzzyMatches(q, deckCandidates, (item) => item.word, 0.62, 3);
      for (const match of deckFuzzy) {
        if (!seenWords.has(match.key)) {
          seenWords.add(match.key);
          results.push({
            word: match.item.word,
            meaningVi: match.item.meaningVi,
            pos: match.item.pos,
            source: 'deck',
            score: match.similarity,
          });
        }
      }
    }

    // 2. Check pre-computed Built-in Knowledge Base with fuzzy matching
    const kbFuzzy = findFuzzyMatches(q, STATIC_KB_CANDIDATES, (item) => item.word, 0.62, 3);
    for (const match of kbFuzzy) {
      if (!seenWords.has(match.key)) {
        seenWords.add(match.key);
        results.push({
          word: match.item.word,
          meaningVi: match.item.meaningVi,
          pos: match.item.pos,
          source: 'builtin',
          score: match.similarity,
        });
      }
    }

    // 3. Online Datamuse suggestions & spelling
    if (!signal?.aborted) {
      try {
        const [sugRes, spRes] = await Promise.all([
          fetchWithTimeout(`https://api.datamuse.com/sug?s=${encodeURIComponent(q)}&max=6`, {}, 800, signal),
          fetchWithTimeout(`https://api.datamuse.com/words?sp=${encodeURIComponent(q)}&max=6`, {}, 800, signal),
        ]);

        const onlineCandidates: string[] = [];

        if (sugRes.ok) {
          const arr = await sugRes.json();
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item.word && typeof item.word === 'string') {
                const w = item.word.trim().toLowerCase();
                if (!seenWords.has(w) && !w.includes(' ') && w.length >= 2) {
                  onlineCandidates.push(w);
                }
              }
            }
          }
        }

        if (spRes.ok) {
          const arr = await spRes.json();
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item.word && typeof item.word === 'string') {
                const w = item.word.trim().toLowerCase();
                if (!seenWords.has(w) && !w.includes(' ') && w.length >= 2) {
                  onlineCandidates.push(w);
                }
              }
            }
          }
        }

        for (const w of onlineCandidates) {
          if (!seenWords.has(w)) {
            seenWords.add(w);
            const kbMatch = LOCAL_KNOWLEDGE_BASE[w];
            const deckMatch = deckWords.find((dw) => dw.word.toLowerCase() === w);
            const sim = stringSimilarity(q, w);
            results.push({
              word: w,
              meaningVi: kbMatch?.vi || deckMatch?.vietnameseDefinition || '',
              pos: kbMatch?.pos?.[0] || deckMatch?.pos?.[0] || 'word',
              source: deckMatch ? 'deck' : kbMatch ? 'builtin' : 'dictionary',
              score: sim,
            });
          }
          if (results.length >= 6) break;
        }
      } catch {
        // ignore network timeouts
      }
    }

    const sorted = results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);
    SUGGESTION_CACHE.set(q, { results: sorted, expires: Date.now() + 5 * 60 * 1000 });
    return sorted;
  })();

  IN_FLIGHT_SUGGESTIONS.set(q, suggestionPromise);
  try {
    return await suggestionPromise;
  } finally {
    IN_FLIGHT_SUGGESTIONS.delete(q);
  }
}

/**
 * Concurrency limiter for background enrichments (max 2 concurrent)
 */
let activeEnrichmentTasks = 0;
const enrichmentQueue: Array<() => void> = [];

async function acquireEnrichmentSlot(): Promise<void> {
  if (activeEnrichmentTasks < 2) {
    activeEnrichmentTasks++;
    return;
  }
  return new Promise<void>((resolve) => {
    enrichmentQueue.push(() => {
      activeEnrichmentTasks++;
      resolve();
    });
  });
}

function releaseEnrichmentSlot(): void {
  activeEnrichmentTasks--;
  if (enrichmentQueue.length > 0) {
    const next = enrichmentQueue.shift();
    next?.();
  }
}

/**
 * Background enrichment: collocations, examples, word family and AI
 */
async function scheduleBackgroundEnrichment(
  baseWord: WordItem,
  signal?: AbortSignal,
  onEnriched?: (word: WordItem) => void
): Promise<void> {
  if (!onEnriched || signal?.aborted) return;
  const query = normalizeWordKey(baseWord.word);

  setTimeout(async () => {
    if (signal?.aborted) return;
    await acquireEnrichmentSlot();
    try {
      if (signal?.aborted) return;
      const mainPos = baseWord.pos[0] || 'noun';
      const isPhrase = query.includes(' ');
      const articleMatch = query.match(/^(a|an|the|to)\s+([a-z0-9-]+)$/i);
      const targetForDict = !isPhrase ? query : (articleMatch ? articleMatch[2].toLowerCase() : query);

      // 1. Concurrently fetch rich collocations & word family
      const [wfRaw, colRaw] = await Promise.allSettled([
        fetchDatamuseWordFamily(targetForDict, baseWord.pos, 1200, signal),
        fetchDatamuseCollocations(targetForDict, mainPos, 1200, signal),
      ]);

      let richCollocations = [...baseWord.collocations];
      let richWordFamily = [...baseWord.wordFamily];
      let richExamples = [...baseWord.examples];
      let richVietnameseDef = baseWord.vietnameseDefinition;
      let richUsIpa = baseWord.phonetics.us;
      let richUkIpa = baseWord.phonetics.uk;
      let tags = [...baseWord.tags];

      if (wfRaw.status === 'fulfilled' && wfRaw.value?.length > 0) {
        richWordFamily = wfRaw.value;
      }

      if (colRaw.status === 'fulfilled' && colRaw.value?.length > 0 && richCollocations.length <= 2) {
        const batchPhrases = colRaw.value;
        const transRaw = await translateToVietnamese(batchPhrases.join('\n---BREAK---\n'), 1000, signal);
        const transParts = transRaw ? transRaw.split(/\n?---BREAK---\n?/).map((s) => s.trim()) : [];
        richCollocations = batchPhrases.map((phrase, i) => ({
          phrase,
          meaningVi: transParts[i] || 'cụm từ thông dụng',
        }));
      }

      // 2. AI Enrichment if configured
      try {
        const settings = await getAppSettings();
        const apiKey = settings.aiApiKey || settings.geminiApiKey;
        if (settings.aiProvider === 'custom' || (apiKey && apiKey.trim().length >= 5)) {
          const aiData = await enrichWordWithAI(query, mainPos, {
            provider: settings.aiProvider || 'gemini',
            apiKey: (apiKey || '').trim(),
            baseUrl: settings.aiBaseUrl,
            model: settings.aiModel,
            signal,
            timeoutMs: 8000,
          });

          if (aiData) {
            if (aiData.ipaUs) richUsIpa = aiData.ipaUs;
            if (aiData.ipaUk) richUkIpa = aiData.ipaUk;
            if (!richUkIpa && richUsIpa) richUkIpa = richUsIpa;
            if (aiData.vietnameseDefinition) richVietnameseDef = aiData.vietnameseDefinition;
            if (aiData.collocations?.length) richCollocations = aiData.collocations;
            if (aiData.wordFamily?.length) richWordFamily = aiData.wordFamily;
            if (aiData.examples?.length) richExamples = aiData.examples;
            if (aiData.tags?.length) tags = aiData.tags;
          }
        }
      } catch {
        // AI failure is non-fatal
      }

      if (signal?.aborted) return;

      const enrichedWord: WordItem = {
        ...baseWord,
        phonetics: {
          ...baseWord.phonetics,
          us: richUsIpa || baseWord.phonetics.us,
          uk: richUkIpa || baseWord.phonetics.uk,
        },
        vietnameseDefinition: richVietnameseDef,
        collocations: richCollocations,
        wordFamily: richWordFamily,
        examples: richExamples,
        tags,
        updatedAt: Date.now(),
      };

      WORD_LRU_CACHE.set(query, enrichedWord);

      // Safe update via repository to preserve review progress, notes, tags
      try {
        const existingInDb = await db.words.where('word').equals(query).first();
        if (existingInDb) {
          await vocabRepository.updateWord(existingInDb.id, {
            phonetics: enrichedWord.phonetics,
            collocations: enrichedWord.collocations.length > 0 ? enrichedWord.collocations : undefined,
            wordFamily: enrichedWord.wordFamily.length > 0 ? enrichedWord.wordFamily : undefined,
            examples: enrichedWord.examples.length > 0 ? enrichedWord.examples : undefined,
          });
        }
      } catch (dbErr) {
        console.warn('Background enrichment DB sync skipped:', dbErr);
      }

      if (!signal?.aborted) {
        onEnriched(enrichedWord);
      }
    } catch (err) {
      console.warn('Background enrichment error:', err);
    } finally {
      releaseEnrichmentSlot();
    }
  }, 10);
}

/**
 * Intelligent Two-Stage High-Speed Lookup Pipeline:
 * Fast Stage:
 *   Tier 0: LRU Memory Cache (<0.1ms)
 *   Tier 1: Local IndexedDB database check (<2ms)
 *   Tier 2: Built-in high-yield TOEIC knowledge base (<0.5ms)
 *   Tier 3: Parallelized Essential Multi-Source Query (<800ms, Promise.allSettled)
 * Background Stage:
 *   Non-blocking enrichment for rich collocations, examples, word family and AI.
 */
export async function lookupWord(rawWord: string, options?: LookupOptions): Promise<WordItem> {
  const query = normalizeWordKey(rawWord);
  if (!query) {
    throw new Error('Please enter a word to search');
  }

  const signal = options?.signal;
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // Tier 0: Check in-memory LRU cache (<0.1ms)
  const cachedWord = WORD_LRU_CACHE.get(query);
  if (cachedWord) {
    if (options?.onEnriched) {
      scheduleBackgroundEnrichment(cachedWord, signal, options.onEnriched);
    }
    return cachedWord;
  }

  // Check In-Flight Lookups (deduplicate simultaneous requests for same word)
  if (IN_FLIGHT_LOOKUPS.has(query)) {
    const inFlightPromise = IN_FLIGHT_LOOKUPS.get(query)!;
    if (options?.onEnriched) {
      inFlightPromise
        .then((w) => {
          scheduleBackgroundEnrichment(w, signal, options.onEnriched);
        })
        .catch(() => {});
    }
    return inFlightPromise;
  }

  const lookupPromise = (async (): Promise<WordItem> => {
    // Tier 1: Check Local IndexedDB database (<2ms)
    try {
      const existingInDb = await db.words.where('word').equals(query).first();
      if (existingInDb) {
        WORD_LRU_CACHE.set(query, existingInDb);
        if (options?.onEnriched) {
          scheduleBackgroundEnrichment(existingInDb, signal, options.onEnriched);
        }
        return existingInDb;
      }
    } catch (dbErr) {
      console.warn('IndexedDB fast lookup skipped:', dbErr);
    }

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // Tier 2: Check Built-in Offline Knowledge Base (<0.5ms)
    let localMatch = LOCAL_KNOWLEDGE_BASE[query];
    if (!localMatch) {
      const articleMatch = query.match(/^(a|an|the|to)\s+([a-z0-9-]+)$/i);
      if (articleMatch) {
        const core = articleMatch[2].toLowerCase();
        if (LOCAL_KNOWLEDGE_BASE[core]) {
          localMatch = LOCAL_KNOWLEDGE_BASE[core];
        }
      }
    }

    if (localMatch) {
      const now = Date.now();
      const wordItem: WordItem = {
        id: `word-${now}-${Math.random().toString(36).slice(2, 7)}`,
        word: query,
        phonetics: {
          us: localMatch.usIpa,
          uk: localMatch.ukIpa,
          audioUs: `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-US&client=tw-ob&q=${encodeURIComponent(query)}`,
          audioUk: `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-GB&client=tw-ob&q=${encodeURIComponent(query)}`,
        },
        pos: localMatch.pos,
        vietnameseDefinition: localMatch.vi,
        englishDefinition: localMatch.enDef,
        meanings: [
          {
            pos: localMatch.pos[0] || 'noun',
            englishDefinition: localMatch.enDef,
            vietnameseDefinition: localMatch.vi,
            synonyms: [],
          },
        ],
        collocations: localMatch.collocations,
        wordFamily: localMatch.wordFamily,
        examples: localMatch.examples,
        tags: localMatch.tags,
        status: 'new',
        createdAt: now,
        updatedAt: now,
        reviewMeta: createInitialReviewMeta(),
        source: 'local',
        enrichmentStatus: 'completed',
      };

      WORD_LRU_CACHE.set(query, wordItem);
      if (options?.onEnriched) {
        scheduleBackgroundEnrichment(wordItem, signal, options.onEnriched);
      }
      return wordItem;
    }

    const isPhrase = query.includes(' ');
    const articleMatch = query.match(/^(a|an|the|to)\s+([a-z0-9-]+)$/i);
    const coreWord = articleMatch ? articleMatch[2].toLowerCase() : '';
    const targetForDict = !isPhrase ? query : coreWord;

    // Tier 3: Parallelized Fast Essential Sources (<800ms) with Promise.allSettled
    const [openVnRes, datamuseRes, wikiRes, directTransRes, phraseIpaRes] = await Promise.allSettled([
      targetForDict ? fetchOpenVnEnDictData(targetForDict, 800, signal) : Promise.resolve(null),
      targetForDict ? fetchDatamuseInfo(targetForDict, 800, signal) : Promise.resolve(null),
      fetchWiktionaryData(targetForDict || query, 800, signal),
      translateToVietnamese(query, 800, signal),
      isPhrase ? resolvePhraseIpa(query) : Promise.resolve(''),
    ]);

    const openVnData = openVnRes.status === 'fulfilled' ? openVnRes.value : null;
    const datamuseInfo = datamuseRes.status === 'fulfilled' ? datamuseRes.value : null;
    const wikiInfo = wikiRes.status === 'fulfilled' ? wikiRes.value : null;
    const directTrans = directTransRes.status === 'fulfilled' ? directTransRes.value : '';
    const phraseIpa = phraseIpaRes.status === 'fulfilled' ? phraseIpaRes.value : '';

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // Combine POS tags
    const posSet = new Set<string>();
    if (openVnData?.posList) {
      for (const p of openVnData.posList) posSet.add(p);
    }
    if (datamuseInfo?.posList) {
      for (const p of datamuseInfo.posList) posSet.add(p);
    }
    if (wikiInfo?.posList) {
      for (const p of wikiInfo.posList) posSet.add(p);
    }
    if (posSet.size === 0) {
      posSet.add(isPhrase ? 'phrase' : 'noun');
    }
    const posList = Array.from(posSet);
    const mainPos = posList[0];

    // Phonetics
    let ipa = '';
    if (isPhrase) {
      ipa = phraseIpa || '';
    } else {
      ipa = openVnData?.ipa || datamuseInfo?.ipa || '';
    }

    // English definition & meanings
    let englishDef = '';
    const parsedMeanings: MeaningItem[] = [];
    if (wikiInfo?.definitions && wikiInfo.definitions.length > 0) {
      englishDef = wikiInfo.definitions[0].definition;
      for (const d of wikiInfo.definitions.slice(0, 4)) {
        parsedMeanings.push({
          pos: d.pos,
          englishDefinition: d.definition,
          vietnameseDefinition: '',
          example: d.examples[0],
        });
      }
    } else if (datamuseInfo?.defs && datamuseInfo.defs.length > 0) {
      englishDef = datamuseInfo.defs[0].def;
      for (const d of datamuseInfo.defs.slice(0, 4)) {
        parsedMeanings.push({
          pos: d.pos,
          englishDefinition: d.def,
          vietnameseDefinition: '',
        });
      }
    }
    if (!englishDef) {
      if (isPhrase && directTrans) {
        englishDef = `Idiom/collocation: "${query}" (${directTrans})`;
      } else {
        englishDef = `Definition for "${query}"`;
      }
    }

    // Check if word is not recognized in standard dictionaries and is likely a typo
    const hasReliableDef =
      (openVnData?.vietnameseDef && openVnData.vietnameseDef.length > 0) ||
      (wikiInfo?.definitions && wikiInfo.definitions.length > 0) ||
      (datamuseInfo?.defs && datamuseInfo.defs.length > 0 && datamuseInfo.isExact);

    if (!isPhrase && !hasReliableDef) {
      const suggestions = await getSpellingSuggestions(query, [], signal);
      if (suggestions.length > 0) {
        throw new WordNotFoundError(
          query,
          suggestions,
          `No definitions found for "${query}". Did you mean "${suggestions[0].word}"?`
        );
      } else if (!directTrans || directTrans.toLowerCase() === query) {
        throw new WordNotFoundError(
          query,
          [],
          `No definitions found for "${query}". Try checking the spelling!`
        );
      }
    }

    // Synthesize Vietnamese Definition
    let vietnameseDef = '';
    if (openVnData?.vietnameseDef) {
      vietnameseDef = openVnData.vietnameseDef;
      if (directTrans && directTrans.length >= 2 && !vietnameseDef.toLowerCase().includes(directTrans.toLowerCase())) {
        if (vietnameseDef.startsWith('(')) {
          vietnameseDef = vietnameseDef.replace(/^(\([^)]+\))\s*/, `$1 ${directTrans}, `);
        } else {
          vietnameseDef = `${directTrans}, ${vietnameseDef}`;
        }
      }
    } else if (directTrans) {
      vietnameseDef = directTrans;
    } else {
      vietnameseDef = `Từ vựng "${query}"`;
    }

    // Authentic collocations & examples ONLY — NO fake filler sentences!
    const collocations =
      openVnData && Array.isArray(openVnData.collocations) && openVnData.collocations.length > 0
        ? openVnData.collocations.slice(0, 4)
        : [];

    const examples =
      openVnData && Array.isArray(openVnData.examples) && openVnData.examples.length > 0
        ? openVnData.examples.slice(0, 2)
        : [];

    const wordFamily: WordFamilyItem[] = [{ word: query, pos: mainPos }];

    const now = Date.now();
    const basicWordItem: WordItem = {
      id: `word-${now}-${Math.random().toString(36).slice(2, 7)}`,
      word: query,
      phonetics: {
        us: ipa,
        uk: ipa,
        audioUs: `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-US&client=tw-ob&q=${encodeURIComponent(query)}`,
        audioUk: `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-GB&client=tw-ob&q=${encodeURIComponent(query)}`,
      },
      pos: posList,
      vietnameseDefinition: vietnameseDef,
      englishDefinition: englishDef,
      meanings: parsedMeanings.length > 0 ? parsedMeanings : [
        {
          pos: mainPos,
          englishDefinition: englishDef,
          vietnameseDefinition: vietnameseDef,
        },
      ],
      collocations,
      wordFamily,
      examples,
      tags: ['#TOEIC', '#Vocabulary'],
      status: 'new',
      createdAt: now,
      updatedAt: now,
      reviewMeta: createInitialReviewMeta(),
      source: openVnData ? 'online' : 'ai',
      enrichmentStatus: 'completed',
    };

    // Cache basic word immediately
    WORD_LRU_CACHE.set(query, basicWordItem);

    // Schedule background enrichment if caller requested
    if (options?.onEnriched) {
      scheduleBackgroundEnrichment(basicWordItem, signal, options.onEnriched);
    }

    return basicWordItem;
  })();

  IN_FLIGHT_LOOKUPS.set(query, lookupPromise);
  try {
    return await lookupPromise;
  } finally {
    IN_FLIGHT_LOOKUPS.delete(query);
  }
}
