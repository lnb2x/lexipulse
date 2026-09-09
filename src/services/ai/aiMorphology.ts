import type { AIRequestConfig } from '../ai';
import { AI_PROVIDERS } from '../ai';
import { hashString } from './aiCache';

export interface AIMorphologyAlternative {
  lemma: string;
  pos: string;
  form?: string;
  confidence?: number;
  explanation?: string;
}

export interface AIMorphologyResult {
  original: string;
  lemma: string;
  pos: string;
  form: string;
  is_inflected: boolean;
  confidence: number;
  explanation?: string;
  alternatives: AIMorphologyAlternative[];
  tense?: string;
  number?: string;
  degree?: string;
  source?: 'ai' | 'cache' | 'fallback';
}

/**
 * System Prompt strictly conforming to TOEIC/IELTS morphology requirements.
 */
export const MORPHOLOGY_SYSTEM_PROMPT = `You are an English morphological analyzer for a TOEIC/IELTS vocabulary application.

Your task is to determine the canonical dictionary lemma of an English word.

Do NOT perform naive stemming.
Do NOT simply remove suffixes such as -ing, -ed, -s, -es, -er, or -est.

Recover the correct dictionary form using English morphology.

Examples:
postponing -> postpone
making -> make
running -> run
studies -> study
went -> go
written -> write
children -> child

Use the provided sentence context when available.

Return the lemma that a high-quality English learner dictionary would normally use as the headword.

For verbs, return the infinitive/base form without 'to'.
For plural nouns, return the singular form.
For regular comparative/superlative adjectives, return the base adjective when appropriate.
For irregular forms, resolve the actual dictionary lemma.

Never invent a word.

If the word is already in canonical dictionary form, return it unchanged.

If multiple analyses are genuinely possible, return the most probable analysis plus alternatives.

Respond ONLY with valid JSON matching the requested schema.`;

/**
 * In-memory LRU cache for morphology analyses.
 * Key: lemma:${normWord}:${contextHash}
 */
interface LemmaCacheEntry {
  result: AIMorphologyResult;
  timestamp: number;
}

const lemmaCache = new Map<string, LemmaCacheEntry>();
const MAX_LEMMA_CACHE_ENTRIES = 500;
const LEMMA_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getCachedMorphology(word: string, contextSentence?: string): AIMorphologyResult | null {
  const normWord = word.trim().toLowerCase();
  const contextHash = contextSentence?.trim() ? hashString(contextSentence.trim().toLowerCase()) : 'none';
  const key = `lemma:${normWord}:${contextHash}`;

  const entry = lemmaCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > LEMMA_CACHE_TTL_MS) {
    lemmaCache.delete(key);
    return null;
  }

  // Refresh LRU order
  lemmaCache.delete(key);
  lemmaCache.set(key, entry);

  return { ...entry.result, source: 'cache' };
}

export function clearMorphologyCache(): void {
  lemmaCache.clear();
}

export function setCachedMorphology(
  word: string,
  arg2: AIMorphologyResult | string,
  arg3?: AIMorphologyResult | string
): void {
  let result: AIMorphologyResult;
  let contextSentence: string | undefined;

  if (typeof arg2 === 'object' && arg2 !== null) {
    result = arg2;
    contextSentence = typeof arg3 === 'string' ? arg3 : undefined;
  } else if (typeof arg3 === 'object' && arg3 !== null) {
    result = arg3;
    contextSentence = typeof arg2 === 'string' ? arg2 : undefined;
  } else {
    return;
  }

  const normWord = word.trim().toLowerCase();
  const contextHash = contextSentence?.trim() ? hashString(contextSentence.trim().toLowerCase()) : 'none';
  const key = `lemma:${normWord}:${contextHash}`;

  if (lemmaCache.size >= MAX_LEMMA_CACHE_ENTRIES) {
    const oldestKey = lemmaCache.keys().next().value;
    if (oldestKey) lemmaCache.delete(oldestKey);
  }

  lemmaCache.set(key, {
    result: { ...result, source: 'cache' },
    timestamp: Date.now(),
  });
}

/**
 * Valid English word pattern: single word or hyphenated word, no digits or symbols.
 */
const VALID_ENGLISH_LEMMA_REGEX = /^[a-zA-Z]+(-[a-zA-Z]+)*$/;

/**
 * Known suspicious truncated stems that indicate a naive stemming defect.
 * Maps truncated stem -> canonical correct dictionary lemma.
 */
export const SUSPICIOUS_TRUNCATED_STEMS = new Map<string, string>([
  ['postpon', 'postpone'],
  ['manag', 'manage'],
  ['improv', 'improve'],
  ['schedul', 'schedule'],
  ['promot', 'promote'],
  ['negotiat', 'negotiate'],
  ['requir', 'require'],
  ['includ', 'include'],
  ['reduc', 'reduce'],
  ['produc', 'produce'],
  ['provid', 'provide'],
  ['receiv', 'receive'],
  ['believ', 'believe'],
  ['argu', 'argue'],
  ['arrang', 'arrange'],
  ['continu', 'continue'],
  ['defin', 'define'],
  ['examin', 'examine'],
  ['exercis', 'exercise'],
  ['guid', 'guide'],
  ['introduc', 'introduce'],
  ['notic', 'notice'],
  ['organiz', 'organize'],
  ['practic', 'practice'],
  ['prepar', 'prepare'],
  ['realiz', 'realize'],
  ['recogniz', 'recognize'],
  ['releas', 'release'],
  ['remov', 'remove'],
  ['replac', 'replace'],
  ['reserv', 'reserve'],
  ['respond', 'respond'],
  ['settl', 'settle'],
  ['shar', 'share'],
  ['stat', 'state'],
  ['structur', 'structure'],
  ['surpris', 'surprise'],
  ['surviv', 'survive'],
  ['valu', 'value'],
  ['wast', 'waste'],
  ['welcom', 'welcome'],
  ['worke', 'work'],
  ['reade', 'read'],
  ['meete', 'meet'],
]);

/**
 * Validates and normalizes AI morphology response.
 * Strictly prevents hallucinated or suspicious chopped stems.
 */
export function validateAIMorphologyResult(
  data: unknown,
  originalWord: string
): AIMorphologyResult | null {
  let parsed: unknown = data;

  if (typeof data === 'string') {
    let clean = data.trim();
    clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
    try {
      parsed = JSON.parse(clean);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  const rawLemma = typeof obj.lemma === 'string' ? obj.lemma.trim().toLowerCase() : '';

  if (!rawLemma || rawLemma.length === 0 || rawLemma.length > 45) {
    return null;
  }

  // Must be valid alphabetic English word
  if (!VALID_ENGLISH_LEMMA_REGEX.test(rawLemma)) {
    return null;
  }

  // Intercept and correct suspicious truncated stems (e.g. 'postpon' -> 'postpone')
  if (SUSPICIOUS_TRUNCATED_STEMS.has(rawLemma)) {
    obj.lemma = SUSPICIOUS_TRUNCATED_STEMS.get(rawLemma);
  }

  const cleanLemma = typeof obj.lemma === 'string' ? obj.lemma.trim().toLowerCase() : rawLemma;
  const original = typeof obj.original === 'string' && obj.original.trim() ? obj.original.trim() : originalWord.trim();
  const pos = typeof obj.pos === 'string' && obj.pos.trim() ? obj.pos.trim().toLowerCase() : 'verb';
  const form = typeof obj.form === 'string' && obj.form.trim() ? obj.form.trim().toLowerCase() : 'base';
  const is_inflected = typeof obj.is_inflected === 'boolean'
    ? obj.is_inflected
    : cleanLemma !== original.toLowerCase();

  const rawConf = typeof obj.confidence === 'number' ? obj.confidence : 0.95;
  const confidence = Math.max(0, Math.min(1, rawConf));

  const explanation = typeof obj.explanation === 'string' && obj.explanation.trim()
    ? obj.explanation.trim()
    : undefined;

  const alternatives: AIMorphologyAlternative[] = [];
  if (Array.isArray(obj.alternatives)) {
    for (const item of obj.alternatives) {
      if (item && typeof item === 'object') {
        const alt = item as Record<string, unknown>;
        const altLemma = typeof alt.lemma === 'string' ? alt.lemma.trim().toLowerCase() : '';
        const altPos = typeof alt.pos === 'string' ? alt.pos.trim().toLowerCase() : 'noun';
        if (altLemma && VALID_ENGLISH_LEMMA_REGEX.test(altLemma) && !SUSPICIOUS_TRUNCATED_STEMS.has(altLemma)) {
          alternatives.push({
            lemma: altLemma,
            pos: altPos,
            form: typeof alt.form === 'string' ? alt.form.trim() : undefined,
            confidence: typeof alt.confidence === 'number' ? alt.confidence : undefined,
            explanation: typeof alt.explanation === 'string' ? alt.explanation.trim() : undefined,
          });
        }
      }
    }
  }

  return {
    original,
    lemma: cleanLemma,
    pos,
    form,
    is_inflected,
    confidence,
    explanation,
    alternatives,
    tense: typeof obj.tense === 'string' ? obj.tense.trim() : undefined,
    number: obj.number === 'singular' || obj.number === 'plural' ? obj.number : undefined,
    degree: obj.degree === 'positive' || obj.degree === 'comparative' || obj.degree === 'superlative' ? obj.degree : undefined,
    source: 'ai',
  };
}

/**
 * Extracts and cleans JSON from raw AI text response (sanitizes markdown code fences).
 */
export function sanitizeAndExtractJson(rawText: string): unknown {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonSubstr = cleaned.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonSubstr);
    }
    throw new Error('Malformed JSON in AI response');
  }
}

/**
 * Standalone AI Morphology Analyzer.
 * Follows strict prompt and JSON schema.
 */
export async function analyzeWordMorphologyWithAI(
  word: string,
  contextSentence?: string,
  config?: AIRequestConfig
): Promise<AIMorphologyResult | null> {
  const trimmedWord = word.trim();
  if (!trimmedWord) return null;

  // 1. Check LRU Cache
  const cached = getCachedMorphology(trimmedWord, contextSentence);
  if (cached) {
    return cached;
  }

  if (!config) {
    return null;
  }

  const provider = config.provider || 'gemini';
  const providerInfo = AI_PROVIDERS[provider] || AI_PROVIDERS.gemini;
  const apiKey = config.apiKey?.trim() || '';
  const model = config.model?.trim() || providerInfo.defaultModel;
  const baseUrl = (config.baseUrl || providerInfo.defaultBaseUrl).replace(/\/+$/, '');

  if (provider !== 'custom' && (!apiKey || apiKey.length < 5)) {
    return null;
  }

  const contextPrompt = contextSentence?.trim()
    ? `\nSentence context: "${contextSentence.trim()}".\nCRITICAL: You MUST use this sentence context to disambiguate the word's part of speech, grammatical form, and lemma.`
    : '';

  const userPrompt = `Analyze the English word: "${trimmedWord}".${contextPrompt}

Respond strictly in JSON matching this schema:
{
  "original": "${trimmedWord}",
  "lemma": "base dictionary form",
  "pos": "verb | noun | adjective | adverb | other",
  "form": "base | past | past_participle | present_participle | plural | third_person_singular | comparative | superlative",
  "is_inflected": true,
  "confidence": 0.99,
  "explanation": "Short grammatical explanation in Vietnamese or English",
  "alternatives": []
}
Return raw JSON strictly. Do not include markdown code block fences.`;

  // Helper to execute 1 request attempt
  const executeCall = async (): Promise<string> => {
    if (provider === 'gemini') {
      const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: MORPHOLOGY_SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal: config.signal,
      });

      if (!res.ok) {
        throw new Error(`Gemini API error ${res.status}`);
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // OpenAI / DeepSeek / Groq / OpenRouter / Custom compatible endpoint
      const endpoint = `${baseUrl}/chat/completions`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: MORPHOLOGY_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
        signal: config.signal,
      });

      if (!res.ok) {
        throw new Error(`${providerInfo.name} API error ${res.status}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
  };

  // Attempt with at most 1 retry on malformed JSON
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const rawText = await executeCall();
      if (!rawText) continue;

      const parsed = sanitizeAndExtractJson(rawText);
      const validated = validateAIMorphologyResult(parsed, trimmedWord);

      if (validated) {
        setCachedMorphology(trimmedWord, validated, contextSentence);
        return validated;
      }
    } catch (err) {
      if (attempt === 1) {
        console.warn(`[AIMorphology] Failed to analyze lemma for "${trimmedWord}":`, err instanceof Error ? err.message : err);
      }
    }
  }

  return null;
}
