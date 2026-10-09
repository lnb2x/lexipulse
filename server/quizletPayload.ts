import type { ScrapedQuizletCardItem } from './quizletScraper.ts';
interface CardSide { label?: string; media?: { type?: number; plainText?: string }[] }

/** Only read the requested set, never recommended/related sets in the payload. */
export function extractQuizletPayload(payload: any, requestedSetId: string): {
  title?: string; terms: ScrapedQuizletCardItem[]; expectedCount?: number;
} {
  const raw = payload?.props?.pageProps?.dehydratedReduxStateKey;
  const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const set = state?.setPage?.set;
  if (!set || String(set.id) !== requestedSetId) return { terms: [] };
  const items = state?.studyModesCommon?.studiableData?.studiableItems;
  const terms: ScrapedQuizletCardItem[] = [];
  let totalLength = 0;
  if (Array.isArray(items)) {
    if (items.length > 10000) throw new Error('resource_limit');
    for (const item of items) {
      if (item.isDeleted || (item.setId && String(item.setId) !== requestedSetId)) continue;
      const sides: CardSide[] = Array.isArray(item.cardSides) ? item.cardSides : [];
      const word = sides.find((side) => side.label === 'word') || sides[0];
      const definition = sides.find((side) => side.label === 'definition') || sides[1];
      const text = (side?: CardSide) => side?.media?.filter((media) => media.type === 1 && typeof media.plainText === 'string')
        .map((media) => media.plainText!.trim()).filter(Boolean).join('\n') || '';
      const termText = text(word);
      const definitionText = text(definition);
      totalLength += termText.length + definitionText.length;
      if (termText.length > 20000 || definitionText.length > 20000 || totalLength > 2 * 1024 * 1024) throw new Error('resource_limit');
      if (termText) terms.push({ term: termText, definition: definitionText });
    }
  }
  return {
    title: typeof set.title === 'string' ? set.title.trim().slice(0, 20000) : undefined, terms,
    expectedCount: typeof set.numTerms === 'number' ? set.numTerms : undefined,
  };
}
