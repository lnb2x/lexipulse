import type { CollocationItem, ExampleItem } from '../../../types/vocab';
import { cleanHtmlAndEntities, fetchWithTimeout } from '../circuitBreaker';

export const VI_POS_TO_EN: Record<string, string> = {
  'danh từ': 'noun',
  'ngoại động từ': 'verb',
  'nội động từ': 'verb',
  'động từ': 'verb',
  'tính từ': 'adjective',
  'phó từ': 'adverb',
  'trạng từ': 'adverb',
  'giới từ': 'preposition',
  'liên từ': 'conjunction',
};

export interface OpenVnDictResult {
  ipa: string;
  posList: string[];
  vietnameseDef: string;
  collocations: CollocationItem[];
  examples: ExampleItem[];
}

/**
 * Parses open-vn-en-dict JSON data into a structured OpenVnDictResult
 */
export function parseOpenVnJson(json: any, query: string, form: string): OpenVnDictResult {
  const html = json.en_vn?.data?.content || '';
  const result: OpenVnDictResult = {
    ipa: '',
    posList: [],
    vietnameseDef: '',
    collocations: [],
    examples: [],
  };

  // 1. Extract from sentences even if html is null (e.g. funding.json)
  if (Array.isArray(json.sentences)) {
    for (const s of json.sentences) {
      const enClean = cleanHtmlAndEntities(s.en || '');
      const viClean = cleanHtmlAndEntities(s.vi || '');
      if (enClean && viClean) {
        if (enClean.toLowerCase() === query || enClean.toLowerCase() === form) {
          if (!result.vietnameseDef) result.vietnameseDef = viClean;
        } else if (enClean.split(' ').length <= 4) {
          if (!result.collocations.some((c) => c.phrase.toLowerCase() === enClean.toLowerCase())) {
            result.collocations.push({ phrase: enClean, meaningVi: viClean });
          }
        } else if (result.examples.length < 3) {
          if (!result.examples.some((e) => e.en.toLowerCase() === enClean.toLowerCase())) {
            result.examples.push({ en: enClean, vi: viClean, context: 'general' });
          }
        }
      }
    }
  }

  // 2. Parse HTML definitions if available
  if (html) {
    const paMatch = html.match(/\[([^\]]+)\]/);
    if (paMatch && !result.ipa) result.ipa = `/${paMatch[1]}/`;

    const sections = html.split(/<tr id="tl">/i);
    const definitionsByPos: Record<string, string[]> = {};

    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i];
      const posMatch = sec.match(/<b><font[^>]*>([^<]+)<\/font><\/b>/i);
      const rawPos = posMatch ? posMatch[1].trim().toLowerCase() : 'nghĩa';
      const enPos = VI_POS_TO_EN[rawPos] || rawPos;

      if (!result.posList.includes(enPos)) result.posList.push(enPos);

      const meanings: string[] = [];
      const mnMatches = sec.matchAll(/<tr id="mn">.*?<td id="C_C"[^>]*>(.*?)<\/td>/gis);
      for (const m of mnMatches) {
        const clean = cleanHtmlAndEntities(m[1]);
        if (clean && !meanings.includes(clean)) meanings.push(clean);
      }
      definitionsByPos[enPos] = (definitionsByPos[enPos] || []).concat(meanings);

      const exMatches = sec.matchAll(
        /<tr id="mh">.*?<td id="C_C"><font[^>]*>(.*?)<\/font><\/td>.*?<tr id="mh_n">.*?<td id="C_C"><font[^>]*>(.*?)<\/font><\/td>/gis
      );
      for (const em of exMatches) {
        const en = cleanHtmlAndEntities(em[1]);
        const vi = cleanHtmlAndEntities(em[2]);
        if (en && vi) {
          if (en.split(' ').length <= 4 && result.collocations.length < 5) {
            if (!result.collocations.some((c) => c.phrase.toLowerCase() === en.toLowerCase())) {
              result.collocations.push({ phrase: en, meaningVi: vi });
            }
          } else if (result.examples.length < 3) {
            if (!result.examples.some((e) => e.en.toLowerCase() === en.toLowerCase())) {
              result.examples.push({ en, vi, context: 'general' });
            }
          }
        }
      }
    }

    const posKeys = Object.keys(definitionsByPos);
    if (posKeys.length > 0) {
      const formatted = posKeys
        .map((p) => `(${p}) ${definitionsByPos[p].slice(0, 4).join(', ')}`)
        .join('; ');
      if (!result.vietnameseDef || form === query) {
        result.vietnameseDef = formatted;
      }
    }
  }

  return result;
}

/**
 * Fetches authentic English-Vietnamese dictionary data via CDN (CORS-enabled, zero rate limits)
 * Supports lemma stemming for -ing, -ed, -s words (e.g. funding -> fund)
 */
export async function fetchOpenVnEnDictData(
  word: string,
  timeoutMs = 1500,
  externalSignal?: AbortSignal
): Promise<OpenVnDictResult | null> {
  const query = word.trim().toLowerCase();

  const fetchSingle = async (f: string): Promise<OpenVnDictResult | null> => {
    try {
      const res = await fetchWithTimeout(
        `https://raw.githubusercontent.com/samuraitruong/open-vn-en-dict/master/data/${encodeURIComponent(f)}.json`,
        {},
        timeoutMs,
        externalSignal
      );
      if (!res.ok) return null;
      const json = await res.json();
      const parsed = parseOpenVnJson(json, query, f);
      return parsed.vietnameseDef || parsed.collocations.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  };

  // 1. Try exact word first
  const exactResult = await fetchSingle(query);
  if (exactResult && exactResult.vietnameseDef) {
    return exactResult;
  }

  // 2. Lemma fallbacks for inflected words (parallelized)
  const fallbackForms: string[] = [];
  if (query.endsWith('ing') && query.length > 4) {
    fallbackForms.push(query.slice(0, -3));
    fallbackForms.push(`${query.slice(0, -3)}e`);
  } else if (query.endsWith('ed') && query.length > 3) {
    fallbackForms.push(query.slice(0, -2));
    fallbackForms.push(query.slice(0, -1));
  } else if (query.endsWith('s') && query.length > 3) {
    fallbackForms.push(query.slice(0, -1));
    if (query.endsWith('es')) fallbackForms.push(query.slice(0, -2));
  }

  if (fallbackForms.length > 0) {
    const fallbackResults = await Promise.all(fallbackForms.map((f) => fetchSingle(f)));
    for (const r of fallbackResults) {
      if (r && r.vietnameseDef) return r;
    }
  }

  return exactResult;
}
