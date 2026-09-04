import { fetchWithTimeout } from '../circuitBreaker';

/**
 * MediaWiki CORS-enabled query to extract Vietnamese translation from Wiktionary
 */
export async function fetchWiktionaryVi(
  word: string,
  timeoutMs = 1200,
  externalSignal?: AbortSignal
): Promise<string[]> {
  try {
    const encoded = encodeURIComponent(word.trim().toLowerCase());
    const res = await fetchWithTimeout(
      `https://en.wiktionary.org/w/api.php?action=parse&page=${encoded}&prop=wikitext&format=json&origin=*`,
      { headers: { 'User-Agent': 'LexiPulse/1.0' } },
      timeoutMs,
      externalSignal
    );
    if (!res.ok) return [];
    const data = await res.json();
    const text = data.parse?.wikitext?.['*'] || '';
    const matches = Array.from(text.matchAll(/\{\{t[\+\-]?\|vi\|([^}|]+)/g)).map((m: any) => m[1]?.trim() || '');
    return Array.from(new Set(matches)).filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

/**
 * Wiktionary REST API for rich definitions and real natural examples
 */
export async function fetchWiktionaryData(
  word: string,
  timeoutMs = 1200,
  externalSignal?: AbortSignal
): Promise<{
  posList: string[];
  definitions: Array<{ pos: string; definition: string; examples: string[] }>;
} | null> {
  try {
    const res = await fetchWithTimeout(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      { headers: { 'User-Agent': 'LexiPulse/1.0' } },
      timeoutMs,
      externalSignal
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.en || !Array.isArray(data.en)) return null;

    const posList: string[] = [];
    const definitions: Array<{ pos: string; definition: string; examples: string[] }> = [];

    for (const section of data.en) {
      const pos = (section.partOfSpeech || '').toLowerCase();
      if (pos && !posList.includes(pos)) posList.push(pos);

      for (const d of section.definitions || []) {
        const cleanDef = (d.definition || '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\.mw-parser-output[^{]*\{[^}]*\}/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        const cleanExamples: string[] = [];
        for (const ex of d.examples || []) {
          const stripped = ex.replace(/<[^>]+>/g, '').trim();
          if (stripped && !cleanExamples.includes(stripped)) {
            cleanExamples.push(stripped);
          }
        }
        if (cleanDef) {
          definitions.push({ pos: pos || 'noun', definition: cleanDef, examples: cleanExamples });
        }
      }
    }

    return { posList, definitions };
  } catch {
    return null;
  }
}
