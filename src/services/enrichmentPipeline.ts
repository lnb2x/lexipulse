import { analyzeMorphology, type MorphologicalAnalysis } from './morphology/lemmatizer';
import { enrichWordWithAI, type AIEnrichmentResult } from './ai';
import { SUSPICIOUS_TRUNCATED_STEMS } from './ai/aiMorphology';
import { lookupWord } from './dictionary';
import { getAppSettings } from './db/statsRepo';
import type { AppSettings, WordItem, VietnameseDefinitionProvenance, ExampleItem, MeaningItem } from '../types/vocab';
import { createInitialReviewMeta } from './fsrs/fsrsService';

export interface PipelineOptions {
  query: string;
  contextSentence?: string;
  signal?: AbortSignal;
  settings?: AppSettings;
  onStageUpdate?: (update: {
    stage: 'morphology' | 'ai' | 'dictionary' | 'done';
    analysis: MorphologicalAnalysis;
    word: WordItem;
    sourceVi: 'ai' | 'dictionary' | 'rule-based';
  }) => void;
}

export interface PipelineResult {
  word: WordItem;
  analysis: MorphologicalAnalysis;
  sourceVi: 'ai' | 'dictionary' | 'rule-based';
}

export interface MergePipelineParams {
  query: string;
  contextSentence?: string;
  analysis: MorphologicalAnalysis;
  aiResult?: AIEnrichmentResult | null;
  dictResult?: WordItem | null;
  prioritizeAI: boolean;
  settings?: AppSettings;
  baseWordId?: string;
  createdAt?: number;
}

/**
 * Deterministic merge function for pipeline data sources.
 * Regardless of whether AI or Dictionary completes first, given the same
 * inputs it produces the exact same WordItem, definition provenance, and sourceVi.
 */
export function mergePipelineSources(params: MergePipelineParams): {
  word: WordItem;
  sourceVi: 'ai' | 'dictionary' | 'rule-based';
} {
  const {
    query,
    contextSentence,
    analysis,
    aiResult,
    dictResult,
    prioritizeAI,
    settings,
    baseWordId,
    createdAt = Date.now(),
  } = params;

  const now = Date.now();
  const normQuery = query.trim();
  const lowerQuery = normQuery.toLowerCase();

  // 1. Morphological identity & Lemma alignment
  let rawLemma = (aiResult?.lemma || analysis.selectedLemma || lowerQuery).toLowerCase();
  if (SUSPICIOUS_TRUNCATED_STEMS.has(rawLemma)) {
    rawLemma = SUSPICIOUS_TRUNCATED_STEMS.get(rawLemma) || analysis.selectedLemma || lowerQuery;
  }
  const lemma = rawLemma.toLowerCase();
  const isInflected = lemma !== lowerQuery;

  // Variants
  const existingVariants = dictResult?.linkedVariants || [];
  const linkedVariants = Array.from(
    new Set([...existingVariants, ...(isInflected ? [lowerQuery] : [])])
  );

  // Form labels
  const formLabels = Array.from(
    new Set([...(analysis.formLabels || []), ...(aiResult?.formLabels || []), ...(dictResult?.formLabels || [])])
  );

  // Inflections
  const inflections = aiResult?.inflections?.length
    ? aiResult.inflections
    : analysis.inflections.length > 0
      ? analysis.inflections
      : dictResult?.inflections;

  // Part of speech: prefer dictionary, then AI, then morphology analysis, fallback to ['noun']
  const rawPosList = [
    ...(dictResult?.pos || []),
    ...(aiResult?.pos || []),
    ...(analysis.partOfSpeech || []),
  ].filter(Boolean);
  const pos = rawPosList.length > 0 ? Array.from(new Set(rawPosList)) : ['noun'];
  const mainPos = pos[0] || 'noun';

  // 2. Phonetics (assigned to the queried form 'query', not mashed with root)
  const phonetics = {
    us: aiResult?.ipaUs || dictResult?.phonetics?.us || '',
    uk: aiResult?.ipaUk || dictResult?.phonetics?.uk || '',
    audioUs: dictResult?.phonetics?.audioUs,
    audioUk: dictResult?.phonetics?.audioUk,
  };

  // 3. Deterministic Vietnamese Definition & Provenance Policy
  const hasAiDef = Boolean(aiResult?.vietnameseDefinition && aiResult.vietnameseDefinition.trim());
  const hasDictDef = Boolean(dictResult?.vietnameseDefinition && dictResult.vietnameseDefinition.trim());

  let vietnameseDefinition = '';
  let provenance: VietnameseDefinitionProvenance = { source: 'unknown' };
  let sourceVi: 'ai' | 'dictionary' | 'rule-based' = 'rule-based';

  if (prioritizeAI) {
    if (hasAiDef) {
      vietnameseDefinition = aiResult!.vietnameseDefinition.trim();
      provenance = {
        source: 'ai',
        provider: settings?.aiProvider || 'gemini',
        model: settings?.aiModel,
        createdAt: now,
      };
      sourceVi = 'ai';
    } else if (hasDictDef) {
      vietnameseDefinition = dictResult!.vietnameseDefinition.trim();
      provenance = dictResult?.vietnameseDefinitionProvenance || {
        source: 'dictionary',
        createdAt: now,
      };
      sourceVi = 'dictionary';
    }
  } else {
    // prioritizeAI is false: Dictionary takes priority if valid
    if (hasDictDef) {
      vietnameseDefinition = dictResult!.vietnameseDefinition.trim();
      provenance = dictResult?.vietnameseDefinitionProvenance || {
        source: 'dictionary',
        createdAt: now,
      };
      sourceVi = 'dictionary';
    } else if (hasAiDef) {
      vietnameseDefinition = aiResult!.vietnameseDefinition.trim();
      provenance = {
        source: 'ai',
        provider: settings?.aiProvider || 'gemini',
        model: settings?.aiModel,
        createdAt: now,
      };
      sourceVi = 'ai';
    }
  }

  // 4. English definition & meanings
  const englishDefinition =
    dictResult?.englishDefinition?.trim() ||
    dictResult?.meanings?.[0]?.englishDefinition?.trim() ||
    '';

  const meanings: MeaningItem[] = dictResult?.meanings && dictResult.meanings.length > 0
    ? dictResult.meanings
    : (englishDefinition || vietnameseDefinition)
      ? [
          {
            pos: mainPos,
            englishDefinition,
            vietnameseDefinition,
          },
        ]
      : [];

  // 5. Examples: No fake placeholders!
  const examples: ExampleItem[] = [];
  if (contextSentence?.trim()) {
    // If AI gave an example translation matching context, use it; NEVER borrow an unrelated example's translation
    const normContext = contextSentence.trim().toLowerCase();
    const aiContextExample = aiResult?.examples?.find((e) => {
      const exEn = e.en.trim().toLowerCase();
      return (
        exEn === normContext ||
        (exEn.length > 0 && normContext.length > 0 && (exEn.includes(normContext) || normContext.includes(exEn)))
      );
    });
    examples.push({
      en: contextSentence.trim(),
      vi: aiContextExample?.vi?.trim() || '',
      context: 'general',
    });
  }

  // Add additional examples from AI and Dictionary
  const addedEnSet = new Set(examples.map((e) => e.en.trim().toLowerCase()));
  if (aiResult?.examples) {
    for (const ex of aiResult.examples) {
      const enKey = ex.en.trim().toLowerCase();
      if (!addedEnSet.has(enKey)) {
        examples.push(ex);
        addedEnSet.add(enKey);
      }
    }
  }
  if (dictResult?.examples) {
    for (const ex of dictResult.examples) {
      const enKey = ex.en.trim().toLowerCase();
      if (!addedEnSet.has(enKey)) {
        examples.push(ex);
        addedEnSet.add(enKey);
      }
    }
  }

  // 6. Collocations & Word family
  const collocations = aiResult?.collocations?.length
    ? aiResult.collocations
    : dictResult?.collocations || [];

  const wordFamily = aiResult?.wordFamily?.length
    ? aiResult.wordFamily
    : dictResult?.wordFamily || [];

  const tags = Array.from(
    new Set(['#TOEIC', ...(dictResult?.tags || []), ...(aiResult?.tags || [])])
  );

  const wordItem: WordItem = {
    id: baseWordId || dictResult?.id || `word_${now}_${Math.random().toString(36).slice(2, 7)}`,
    word: lowerQuery,
    phonetics,
    pos,
    vietnameseDefinition,
    englishDefinition,
    meanings,
    collocations,
    wordFamily,
    examples,
    tags,
    status: dictResult?.status || 'new',
    createdAt: dictResult?.createdAt || createdAt,
    updatedAt: now,
    reviewMeta: dictResult?.reviewMeta || createInitialReviewMeta(),
    lemma,
    originalInput: normQuery,
    formLabels: formLabels.length > 0 ? formLabels : undefined,
    linkedVariants: linkedVariants.length > 0 ? linkedVariants : undefined,
    contextSentence: contextSentence?.trim() || undefined,
    inflections: inflections && inflections.length > 0 ? inflections : undefined,
    vietnameseDefinitionProvenance: provenance,
    source: sourceVi === 'ai' ? 'ai' : sourceVi === 'dictionary' ? 'online' : 'local',
    enrichmentStatus: 'completed',
  };

  return { word: wordItem, sourceVi };
}

/**
 * Orchestrates unified vocabulary enrichment:
 * 1. Immediate Rule-based Morphological Analysis (went -> go, written -> write, studies -> study)
 * 2. Traditional Dictionary Lookup (concurrent, skips duplicate AI call via skipBackgroundAi: true)
 * 3. AI Enrichment (prioritized if configured and prioritizeAI === true)
 * 4. Merges all streams deterministically.
 */
export async function runEnrichmentPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const query = options.query.trim();
  const contextSentence = options.contextSentence?.trim();
  const baseWordId = `word_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = Date.now();

  // 1. Instant Morphological Analysis (Synchronous & Offline)
  const analysis = analyzeMorphology(query, contextSentence);

  const settings = options.settings || (await getAppSettings());
  const apiKey = (settings.aiApiKey || settings.geminiApiKey || '').trim();
  const isAIConfigured = settings.aiProvider === 'custom' || apiKey.length >= 5;
  const prioritizeAI = settings.prioritizeAI !== false;
  const mainPos = analysis.partOfSpeech[0] || 'noun';

  // Base word from morphology
  let initialResult = mergePipelineSources({
    query,
    contextSentence,
    analysis,
    prioritizeAI,
    settings,
    baseWordId,
    createdAt,
  });

  options.onStageUpdate?.({
    stage: 'morphology',
    analysis,
    word: initialResult.word,
    sourceVi: initialResult.sourceVi,
  });

  let latestAiResult: AIEnrichmentResult | null = null;
  let latestDictResult: WordItem | null = null;

  // Run AI and Dictionary concurrently
  const promises: Promise<void>[] = [];

  // A. AI Enrichment
  if (isAIConfigured && !options.signal?.aborted) {
    const aiPromise = (async () => {
      try {
        const aiRes = await enrichWordWithAI(
          query,
          mainPos,
          {
            provider: settings.aiProvider || 'gemini',
            apiKey,
            baseUrl: settings.aiBaseUrl,
            model: settings.aiModel,
            signal: options.signal,
            timeoutMs: 8000,
          },
          contextSentence
        );

        if (aiRes && !options.signal?.aborted) {
          latestAiResult = aiRes;
          const merged = mergePipelineSources({
            query,
            contextSentence,
            analysis,
            aiResult: latestAiResult,
            dictResult: latestDictResult,
            prioritizeAI,
            settings,
            baseWordId,
            createdAt,
          });

          options.onStageUpdate?.({
            stage: 'ai',
            analysis,
            word: merged.word,
            sourceVi: merged.sourceVi,
          });
        }
      } catch (err) {
        console.warn('[Enrichment Pipeline] AI enrichment failed, falling back to dictionary:', err);
      }
    })();
    promises.push(aiPromise);
  }

  // B. Dictionary Lookup (skipBackgroundAi prevents recursive/duplicate AI calls!)
  const dictPromise = (async () => {
    try {
      const dictRes = await lookupWord(query, {
        signal: options.signal,
        skipBackgroundAi: true,
      });

      if (dictRes && !options.signal?.aborted) {
        latestDictResult = dictRes;
        const merged = mergePipelineSources({
          query,
          contextSentence,
          analysis,
          aiResult: latestAiResult,
          dictResult: latestDictResult,
          prioritizeAI,
          settings,
          baseWordId,
          createdAt,
        });

        options.onStageUpdate?.({
          stage: 'dictionary',
          analysis,
          word: merged.word,
          sourceVi: merged.sourceVi,
        });
      }
    } catch (err) {
      console.warn('[Enrichment Pipeline] Dictionary lookup error:', err);
    }
  })();
  promises.push(dictPromise);

  await Promise.allSettled(promises);

  const finalResult = mergePipelineSources({
    query,
    contextSentence,
    analysis,
    aiResult: latestAiResult,
    dictResult: latestDictResult,
    prioritizeAI,
    settings,
    baseWordId,
    createdAt,
  });

  if (!options.signal?.aborted) {
    options.onStageUpdate?.({
      stage: 'done',
      analysis,
      word: finalResult.word,
      sourceVi: finalResult.sourceVi,
    });
  }

  return {
    word: finalResult.word,
    analysis,
    sourceVi: finalResult.sourceVi,
  };
}
