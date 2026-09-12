/**
 * Quizlet Card Normalizer for LexiPulse.
 *
 * Responsibilities:
 * 1. Accurately identifies and extracts POS indicators in parentheticals (e.g. "(v)", "(n)", "(adj)", "(phr)").
 *    - Never removes non-POS parentheticals (e.g. "(World Trade Organization)", "(financial)", "(fruit)").
 * 2. Extracts embedded IPA pronunciations from definition strings (e.g. "/bræntʃ/ - cành cây", "[teɪk ɒf] cất cánh").
 * 3. Cleans definition strings by removing extracted IPA, delimiter dashes/colons, and POS prefixes.
 * 4. Strips fabricated placeholder definitions (e.g. 'Definition for "..."', 'Từ vựng "..."').
 * 5. Preserves raw Quizlet term and definition for provenance and user verification.
 */

export interface NormalizedQuizletCard {
  word: string; // Clean word or phrase without trailing POS tags, e.g. "sign the contract"
  rawWord: string; // Original Quizlet term, e.g. "sign the contract (v)"
  pos: string[]; // Standardized POS list, e.g. ['verb']
  extractedIpa?: string; // e.g. "/bræntʃ/"
  definition: string; // Clean definition without IPA or leading POS markers
  rawDefinition: string; // Original raw definition string
  hasExtractedPos: boolean;
  hasExtractedIpa: boolean;
}

// Map of recognized POS abbreviations / synonyms to standard grammatical types
const POS_MAP: Record<string, string> = {
  v: 'verb',
  'v.': 'verb',
  verb: 'verb',
  verbs: 'verb',
  vt: 'verb',
  'vt.': 'verb',
  vi: 'verb',
  'vi.': 'verb',
  n: 'noun',
  'n.': 'noun',
  noun: 'noun',
  nouns: 'noun',
  adj: 'adjective',
  'adj.': 'adjective',
  adjective: 'adjective',
  adjectives: 'adjective',
  a: 'adjective',
  'a.': 'adjective',
  adv: 'adverb',
  'adv.': 'adverb',
  adverb: 'adverb',
  adverbs: 'adverb',
  phr: 'phrase',
  'phr.': 'phrase',
  phrase: 'phrase',
  phrases: 'phrase',
  idiom: 'phrase',
  idioms: 'phrase',
  'phrasal verb': 'verb',
  'phr v': 'verb',
  'phr. v.': 'verb',
  'phr. v': 'verb',
  prep: 'preposition',
  'prep.': 'preposition',
  preposition: 'preposition',
  conj: 'conjunction',
  'conj.': 'conjunction',
  conjunction: 'conjunction',
  pron: 'pronoun',
  'pron.': 'pronoun',
  pronoun: 'pronoun',
  interj: 'interjection',
  'interj.': 'interjection',
  interjection: 'interjection',
};

/**
 * Checks if a string inside brackets contains ONLY recognized POS tokens.
 * E.g.: "v", "v.", "n, v", "adj/adv", "phr, v" -> true
 * E.g.: "World Trade Organization", "financial", "slang", "fruit", "US" -> false
 */
export function parsePosFromBracketContent(content: string): string[] | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  // Split by comma, slash, semicolon, or whitespace if multiple
  const tokens = trimmed
    .split(/[,;/]|\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) return null;

  const matchedPos: string[] = [];

  for (const token of tokens) {
    const cleanToken = token.replace(/^[[(]|[)\]]$/g, '').trim();
    if (POS_MAP[cleanToken]) {
      const stdPos = POS_MAP[cleanToken];
      if (!matchedPos.includes(stdPos)) {
        matchedPos.push(stdPos);
      }
    } else {
      // Encountered an unknown token; this bracket is NOT purely a POS indicator!
      return null;
    }
  }

  return matchedPos.length > 0 ? matchedPos : null;
}

/**
 * Detects if a definition string is an artificial placeholder.
 */
export function isPlaceholderDefinition(text?: string | null): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  const placeholderPatterns = [
    /^definition for\s+["'].*["']$/i,
    /^từ vựng\s+["'].*["']$/i,
    /^nghĩa của\s+["'].*["']$/i,
    /^idiom\/collocation:\s+["'].*["']\s*\([^)]*\)$/i,
    /^definition of\s+["'].*["']$/i,
    /^meaning of\s+["'].*["']$/i,
    /^no definition found\b/i,
    /^chưa có định nghĩa\b/i,
  ];

  return placeholderPatterns.some((p) => p.test(trimmed));
}

/**
 * Extracts embedded IPA from a definition string.
 * Supports /.../ and [...] with phonetic characters or stress marks.
 */
export function extractIpaFromText(text: string): { ipa?: string; cleanText: string } {
  if (!text || typeof text !== 'string') {
    return { ipa: undefined, cleanText: '' };
  }

  const trimmed = text.trim();

  // Pattern 1: Leading IPA like "/saɪn ðə ˈkɒntrækt/ - ký hợp đồng" or "[bræntʃ] : cành cây"
  const leadingMatch = trimmed.match(
    /^\s*(?:\/([^\/\r\n]+)\/|\[([^\[\]\r\n]+)\])\s*[-:–—;,\s]?\s*(.*)$/s
  );
  if (leadingMatch) {
    const rawIpa = (leadingMatch[1] || leadingMatch[2] || '').trim();
    // Verify it's not simply empty or plain words without phonetic value
    if (rawIpa.length >= 1) {
      const formattedIpa = rawIpa.startsWith('/') ? rawIpa : `/${rawIpa}/`;
      const cleanRemaining = (leadingMatch[3] || '').trim();
      return {
        ipa: formattedIpa,
        cleanText: cleanRemaining,
      };
    }
  }

  // Pattern 2: Trailing IPA like "ký hợp đồng /saɪn ðə ˈkɒntrækt/" or "cành cây (/bræntʃ/)"
  const trailingMatch = trimmed.match(
    /^(.*?)\s*(?:\(?\s*(?:\/([^\/\r\n]+)\/|\[([^\[\]\r\n]+)\])\s*\)?)\s*$/s
  );
  if (trailingMatch) {
    const cleanLeading = (trailingMatch[1] || '').trim().replace(/[-:–—;,\s]+$/, '');
    const rawIpa = (trailingMatch[2] || trailingMatch[3] || '').trim();
    if (rawIpa.length >= 1) {
      const formattedIpa = rawIpa.startsWith('/') ? rawIpa : `/${rawIpa}/`;
      return {
        ipa: formattedIpa,
        cleanText: cleanLeading,
      };
    }
  }

  // Pattern 3: Anywhere inside text: "từ /ipa/ nghĩa"
  const inlineMatch = trimmed.match(/(?:\/([^\/\r\n]+)\/|\[([^\[\]\r\n]{2,})\])/);
  if (inlineMatch && inlineMatch.index !== undefined) {
    const rawIpa = (inlineMatch[1] || inlineMatch[2] || '').trim();
    // Sanity check for common IPA symbols or length
    const hasIpaChar = /[æəʌɪʊɒɔɑɜiuθðʃʒʧʤŋˈˌːɡ:]/.test(rawIpa);
    if (hasIpaChar || rawIpa.includes(' ') || rawIpa.length >= 3) {
      const formattedIpa = rawIpa.startsWith('/') ? rawIpa : `/${rawIpa}/`;
      const before = trimmed.slice(0, inlineMatch.index).trim();
      const after = trimmed.slice(inlineMatch.index + inlineMatch[0].length).trim();
      const combined = `${before} ${after}`
        .replace(/\s*[-:–—;,]\s*$/, '')
        .replace(/^\s*[-:–—;,]\s*/, '')
        .trim();
      return {
        ipa: formattedIpa,
        cleanText: combined,
      };
    }
  }

  return { ipa: undefined, cleanText: trimmed };
}

/**
 * Cleans definition text by removing leading POS markers:
 * e.g. "(v) ký hợp đồng" -> "ký hợp đồng"
 * e.g. "v. ký hợp đồng" -> "ký hợp đồng"
 */
export function cleanDefinitionPosPrefix(def: string): { cleanDef: string; extractedPos?: string[] } {
  let trimmed = def.trim();
  if (!trimmed) return { cleanDef: '' };

  // Check bracketed POS prefix: "(v) nghĩa", "(n, v) nghĩa"
  const bracketMatch = trimmed.match(/^\s*\(([^)]+)\)\s*[-:–—;,\s]?\s*(.*)$/s);
  if (bracketMatch) {
    const pos = parsePosFromBracketContent(bracketMatch[1]);
    if (pos) {
      return {
        cleanDef: bracketMatch[2].trim(),
        extractedPos: pos,
      };
    }
  }

  // Check prefix like "v. nghĩa", "n. nghĩa", "adj. nghĩa"
  const prefixMatch = trimmed.match(/^\s*(v|n|adj|adv|phr)\.\s*[-:–—;,\s]?\s*(.*)$/is);
  if (prefixMatch) {
    const pos = parsePosFromBracketContent(prefixMatch[1]);
    if (pos) {
      return {
        cleanDef: prefixMatch[2].trim(),
        extractedPos: pos,
      };
    }
  }

  return { cleanDef: trimmed };
}

/**
 * Normalizes a Quizlet card:
 * 1. Analyzes term for POS brackets (e.g. "sign the contract (v)").
 * 2. Analyzes definition for embedded IPA and POS prefixes.
 * 3. Cleans placeholders.
 * 4. Returns complete, validated structure.
 */
export function normalizeQuizletCard(
  rawTerm: string,
  rawDefinition: string
): NormalizedQuizletCard {
  const origTerm = (rawTerm || '').trim();
  const origDef = (rawDefinition || '').trim();

  let cleanWord = origTerm;
  let posList: string[] = [];
  let hasExtractedPos = false;

  // 1. Check trailing parenthetical in term: "sign the contract (v)", "take off (v, phr)"
  const trailingBracketMatch = cleanWord.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (trailingBracketMatch) {
    const content = trailingBracketMatch[2];
    const extracted = parsePosFromBracketContent(content);
    if (extracted) {
      cleanWord = trailingBracketMatch[1].trim();
      posList = extracted;
      hasExtractedPos = true;
    }
  }

  // Check leading parenthetical in term: "(v) sign the contract"
  if (!hasExtractedPos) {
    const leadingBracketMatch = cleanWord.match(/^\s*\(([^)]+)\)\s*(.*?)$/);
    if (leadingBracketMatch) {
      const content = leadingBracketMatch[1];
      const extracted = parsePosFromBracketContent(content);
      if (extracted) {
        cleanWord = leadingBracketMatch[2].trim();
        posList = extracted;
        hasExtractedPos = true;
      }
    }
  }

  // 2. Extract IPA from definition
  const { ipa, cleanText: defWithoutIpa } = extractIpaFromText(origDef);

  // 3. Clean any POS prefix in definition
  const { cleanDef, extractedPos: defPos } = cleanDefinitionPosPrefix(defWithoutIpa);

  if (posList.length === 0 && defPos && defPos.length > 0) {
    posList = defPos;
    hasExtractedPos = true;
  }

  // 4. Remove placeholder definitions
  let finalDefinition = cleanDef
    .replace(/^[-:–—;,\s]+|[-:–—;,\s]+$/g, '')
    .trim();

  if (isPlaceholderDefinition(finalDefinition)) {
    finalDefinition = '';
  }

  return {
    word: cleanWord,
    rawWord: origTerm,
    pos: posList,
    extractedIpa: ipa,
    definition: finalDefinition,
    rawDefinition: origDef,
    hasExtractedPos,
    hasExtractedIpa: Boolean(ipa),
  };
}
