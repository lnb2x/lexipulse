import type { WordFamilyItem } from '../../../types/vocab';
import { MEMORY_CACHE } from '../cache';
import { fetchWithTimeout } from '../circuitBreaker';
import { COMMON_WORDS_IPA, LOCAL_KNOWLEDGE_BASE } from '../localData';
import { fetchOpenVnEnDictData } from './openVnDict';

export function cleanIpa(rawIpa: string): string {
  if (!rawIpa) return '';
  return rawIpa.replace(/^\/+|\/+$/g, '').replace(/^[\[\(]+|[\]\)]+$/g, '').trim();
}

/**
 * Datamuse API query for accurate IPA, parts of speech, and English definitions (80ms)
 */
export async function fetchDatamuseInfo(
  word: string,
  timeoutMs = 1500,
  externalSignal?: AbortSignal
): Promise<{
  matchedWord: string;
  isExact: boolean;
  ipa: string;
  posList: string[];
  defs: Array<{ pos: string; def: string }>;
} | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=rdp&ipa=1&max=1`,
      {},
      timeoutMs,
      externalSignal
    );
    if (!res.ok) return null;
    const array = await res.json();
    const item = array?.[0];
    if (!item) return null;

    let ipa = '';
    const posList: string[] = [];
    const posMap: Record<string, string> = {
      n: 'noun',
      v: 'verb',
      adj: 'adjective',
      adv: 'adverb',
    };

    if (Array.isArray(item.tags)) {
      for (const t of item.tags) {
        if (t.startsWith('ipa_pron:')) {
          ipa = `/${t.replace('ipa_pron:', '').trim()}/`;
        } else if (posMap[t]) {
          if (!posList.includes(posMap[t])) posList.push(posMap[t]);
        }
      }
    }

    const defs: Array<{ pos: string; def: string }> = [];
    if (Array.isArray(item.defs)) {
      for (const d of item.defs) {
        const parts = d.split('\t');
        const posCode = parts[0];
        const defText = (parts[1] || '').trim();
        const posFull = posMap[posCode] || posCode || 'noun';
        if (defText) {
          defs.push({ pos: posFull, def: defText });
        }
      }
    }

    const matchedWord = typeof item.word === 'string' ? item.word.trim() : word;
    const isExact = matchedWord.toLowerCase() === word.toLowerCase();

    return { matchedWord, isExact, ipa, posList, defs };
  } catch {
    return null;
  }
}

/**
 * Resolves IPA for a single word using cache, knowledge base, open-vn-en-dict, and Datamuse.
 */
export async function resolveSingleWordIpa(rawWord: string): Promise<string> {
  const w = rawWord.trim().toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
  if (!w) return '';

  // 1. Common words dictionary
  if (COMMON_WORDS_IPA[w]) {
    return COMMON_WORDS_IPA[w];
  }

  // 2. Built-in Knowledge Base
  if (LOCAL_KNOWLEDGE_BASE[w]?.usIpa) {
    return cleanIpa(LOCAL_KNOWLEDGE_BASE[w].usIpa);
  }

  // 3. Memory cache
  if (MEMORY_CACHE.has(w)) {
    const cached = MEMORY_CACHE.get(w);
    if (cached?.phonetics?.us) {
      return cleanIpa(cached.phonetics.us);
    }
  }

  // 4. Online parallel query (OpenVnDict + Datamuse)
  try {
    const [openVn, datamuse] = await Promise.all([
      fetchOpenVnEnDictData(w, 1500),
      fetchDatamuseInfo(w, 1500),
    ]);
    const ipa = openVn?.ipa || datamuse?.ipa;
    if (ipa) {
      return cleanIpa(ipa);
    }
  } catch {
    // fallback
  }

  return '';
}

/**
 * Resolves accurate IPA for multi-word phrases (e.g. "floral arrangement", "take into account")
 * by resolving each constituent word and combining them cleanly.
 */
export async function resolvePhraseIpa(phrase: string): Promise<string> {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) {
    const singleIpa = await resolveSingleWordIpa(words[0]);
    return singleIpa ? `/${singleIpa}/` : '';
  }

  // Resolve all words in parallel
  const wordIpas = await Promise.all(words.map((w) => resolveSingleWordIpa(w)));

  // If at least one word has a valid phonetic representation, combine
  const hasAnyValid = wordIpas.some((ipa) => ipa.length > 0);
  if (!hasAnyValid) return '';

  const combined = wordIpas
    .map((ipa, idx) => ipa || words[idx].toLowerCase())
    .join(' ');

  return `/${combined}/`;
}

/**
 * Real derived word family members from Datamuse (80ms)
 * For phrases, decomposes individual words into real forms
 */
export async function fetchDatamuseWordFamily(
  word: string,
  posList: string[],
  timeoutMs = 1500,
  externalSignal?: AbortSignal
): Promise<WordFamilyItem[]> {
  if (externalSignal?.aborted) return [{ word: word.toLowerCase(), pos: posList[0] || 'noun' }];

  // If multi-word phrase, extract real roots for constituent words
  if (word.includes(' ')) {
    const tokens = word.split(/\s+/).filter((t) => t.length > 2);
    const result: WordFamilyItem[] = [];
    const seen = new Set<string>();

    for (const token of tokens) {
      if (externalSignal?.aborted) break;
      try {
        const prefix = token.endsWith('ing') ? token.slice(0, -3) : token.replace(/e$/, '');
        const res = await fetchWithTimeout(
          `https://api.datamuse.com/words?sp=${encodeURIComponent(prefix)}*&md=p&max=4`,
          {},
          1000,
          externalSignal
        );
        if (res.ok) {
          const array = await res.json();
          const posMap: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
          for (const it of array) {
            const w = it.word.toLowerCase();
            if (!seen.has(w) && !w.includes(' ') && w.length >= 3) {
              seen.add(w);
              const tag = it.tags?.[0];
              result.push({ word: w, pos: posMap[tag] || 'noun' });
              if (result.length >= 4) break;
            }
          }
        }
      } catch {
        // ignore
      }
    }
    if (result.length > 0) return result;
    return tokens.map((t) => ({ word: t, pos: 'noun' }));
  }

  try {
    let prefix = word.toLowerCase();
    if (prefix.endsWith('ity') && prefix.length > 4) {
      prefix = prefix.slice(0, -1);
    } else if (prefix.endsWith('tion') && prefix.length > 5) {
      prefix = prefix.slice(0, -3);
    } else if (prefix.endsWith('e')) {
      prefix = prefix.slice(0, -1);
    } else if (prefix.endsWith('y') && prefix.length > 3) {
      prefix = prefix.slice(0, -1);
    }

    const res = await fetchWithTimeout(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(prefix)}*&md=p&max=12`,
      {},
      timeoutMs,
      externalSignal
    );
    const posMap: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
    const result: WordFamilyItem[] = [];
    const seen = new Set<string>([word.toLowerCase()]);
    result.push({ word: word.toLowerCase(), pos: posList[0] || 'noun' });

    if (res.ok) {
      const array = await res.json();
      if (Array.isArray(array)) {
        for (const item of array) {
          const w = item.word.toLowerCase();
          if (seen.has(w) || w.includes(' ') || w.includes('-') || w.length < 3) continue;
          seen.add(w);
          const tag = item.tags?.[0];
          const pos = posMap[tag] || 'noun';
          result.push({ word: w, pos });
          if (result.length >= 5) break;
        }
      }
    }

    return result;
  } catch {
    return [{ word: word.toLowerCase(), pos: posList[0] || 'noun' }];
  }
}

/**
 * Collocations from Datamuse
 */
export async function fetchDatamuseCollocations(
  word: string,
  mainPos: string,
  timeoutMs = 1500,
  externalSignal?: AbortSignal
): Promise<string[]> {
  if (externalSignal?.aborted) return [];

  if (word.includes(' ')) {
    return [];
  }

  try {
    const phrases: string[] = [];
    if (mainPos === 'noun') {
      const res = await fetchWithTimeout(
        `https://api.datamuse.com/words?rel_jjb=${encodeURIComponent(word)}&max=5`,
        {},
        timeoutMs,
        externalSignal
      );
      if (res.ok) {
        const array = await res.json();
        for (const item of array) {
          if (item.word && !item.word.includes('.') && item.word.length > 2) {
            phrases.push(`${item.word} ${word}`);
            if (phrases.length >= 3) break;
          }
        }
      }
    }

    return phrases.slice(0, 3);
  } catch {
    return [];
  }
}
