import type { WordItem } from '../types/vocab';

/** Only human-provided meanings may constrain a new AI translation. */
export function getTargetLearningSense(word?: WordItem): string | undefined {
  if (!word) return undefined;
  const provenance = word.vietnameseDefinitionProvenance;
  const hasKnownSource = provenance && provenance.source !== 'unknown';
  const isUserMeaning = word.isUserEdited || provenance?.isUserEdited ||
    provenance?.source === 'user_edit' || (!hasKnownSource && word.source === 'manual');
  const meaning = isUserMeaning ? word.vietnameseDefinition : word.rawQuizletDefinition;
  return meaning?.trim() || undefined;
}
