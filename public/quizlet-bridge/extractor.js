// This function is injected in an isolated world. Keep it self-contained.
// It only reads the requested page; no cookies, credentials, hidden APIs or CAPTCHA interaction.
export function readQuizletPage(expectedId) {
  const path = location.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(\d+)(?:\/[^/]+)?\/?$/i);
  if (location.protocol !== 'https:' || !['quizlet.com', 'www.quizlet.com'].includes(location.hostname)) {
    return { state: 'error', code: 'blocked_resource' };
  }
  const title = document.title.trim();
  if (/^(captcha challenge|one more step|just a moment|access to this page has been denied|chờ một chút)(?:\s*[.!…]|\s*$)/i.test(title)
    || document.querySelector('#px-captcha, .px-captcha-container, #challenge-form, #challenge-error-text')) {
    return { state: 'waiting', status: 'verification' };
  }
  if (location.pathname.startsWith('/login') || document.querySelector('[data-testid="LoginModal"], form[action*="login"]')) {
    return { state: 'waiting', status: 'login' };
  }
  if (!path || path[1] !== expectedId) return { state: 'error', code: 'invalid_url' };

  const MAX_CARDS = 10000;
  const MAX_TEXT = 20000;
  const MAX_TOTAL = 8 * 1024 * 1024;
  const terms = [];
  let total = 0;
  const add = (term, definition) => {
    if (typeof term !== 'string' || typeof definition !== 'string') return;
    const card = { term: term.trim(), definition: definition.trim() };
    if (!card.term && !card.definition) return;
    total += card.term.length + card.definition.length;
    if (card.term.length > MAX_TEXT || card.definition.length > MAX_TEXT || total > MAX_TOTAL || terms.length >= MAX_CARDS) {
      throw new Error('resource_limit');
    }
    terms.push(card);
  };
  let setTitle = document.querySelector('h1')?.textContent?.trim() || title.replace(/\s*\|\s*Quizlet.*$/i, '');
  let expectedCount;
  let source = 'dom';
  try {
    const text = document.querySelector('#__NEXT_DATA__')?.textContent;
    if (text?.length > MAX_TOTAL) throw new Error('resource_limit');
    if (text) {
      let redux;
      try {
        const data = JSON.parse(text);
        const raw = data.props?.pageProps?.dehydratedReduxStateKey;
        redux = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch { /* A malformed payload can still have readable cards in the DOM. */ }
      const set = redux?.setPage?.set;
      const items = redux?.studyModesCommon?.studiableData?.studiableItems;
      // Never read recommendations or a payload for another set.
      if (set?.id !== undefined && String(set.id) !== expectedId) return { state: 'error', code: 'invalid_url' };
      if (typeof set?.title === 'string') setTitle = set.title.trim();
      if (Number.isInteger(set?.numTerms) && set.numTerms >= 0) expectedCount = set.numTerms;
      if (Array.isArray(items) && set?.id !== undefined) {
        if (items.length > MAX_CARDS) throw new Error('resource_limit');
        for (const item of items) {
          if (!item || item.isDeleted || !Array.isArray(item.cardSides)) continue;
          const word = item.cardSides.find(side => side?.label === 'word') || item.cardSides[0];
          const definition = item.cardSides.find(side => side?.label === 'definition') || item.cardSides[1];
          const read = side => Array.isArray(side?.media) ? side.media.find(media => media?.type === 1)?.plainText || '' : '';
          add(read(word), read(definition));
        }
        if (terms.length) source = 'payload';
      }
    }
    if (!terms.length) {
      const cards = document.querySelectorAll('.SetPageTerm, [data-testid="SetPageTerm"], .SetPageTerms-term');
      if (cards.length > MAX_CARDS) throw new Error('resource_limit');
      for (const card of cards) {
        const word = card.querySelector('.SetPageTerm-wordText');
        const definition = card.querySelector('.SetPageTerm-definitionText');
        if (word && definition) add(word.textContent || '', definition.textContent || '');
      }
    }
    if (setTitle.length > MAX_TEXT) throw new Error('resource_limit');
    if (expectedCount !== undefined && terms.length < expectedCount) {
      return { state: 'waiting', status: 'more_cards' };
    }
    if (!terms.length) return { state: 'waiting', status: 'loading' };
    return { state: 'success', result: { success: true, setId: expectedId, title: setTitle,
      cleanUrl: `${location.origin}${location.pathname}`, terms, source, expectedCount } };
  } catch (error) {
    return { state: 'error', code: error.message === 'resource_limit' ? 'resource_limit' : 'server_error' };
  }
}
