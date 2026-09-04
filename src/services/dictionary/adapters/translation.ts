import { IN_FLIGHT_TRANSLATIONS, TRANSLATION_CACHE } from '../cache';
import {
  cleanHtmlAndEntities,
  fetchWithTimeout,
  isEndpointAvailable,
  recordEndpointFailure,
  recordEndpointSuccess,
  translationCircuitBreakers,
} from '../circuitBreaker';

/**
 * Optimized Vietnamese translation with bounded LRU cache, TTL, in-flight dedup,
 * circuit breaker, shared deadline, and AbortSignal support.
 *
 * NOTE: Google Translate HTML scraping is an EXPERIMENTAL fallback only.
 * The primary paths are Vite dev proxy and graceful failure without crashes.
 */
export async function translateToVietnamese(
  text: string,
  timeoutMs = 1800,
  signal?: AbortSignal
): Promise<string> {
  const clean = text?.trim();
  if (!clean) return '';

  if (signal?.aborted) {
    return '';
  }

  // Check LRU cache with TTL (24 hours)
  const cached = TRANSLATION_CACHE.get(clean);
  if (cached && cached.expires > Date.now()) {
    return cached.result;
  }

  // Deduplicate in-flight requests for identical text
  if (IN_FLIGHT_TRANSLATIONS.has(clean)) {
    return IN_FLIGHT_TRANSLATIONS.get(clean)!;
  }

  const translationPromise = (async (): Promise<string> => {
    const deadline = Date.now() + timeoutMs;
    const TTL = 24 * 60 * 60 * 1000;

    // Detect if Vite proxy endpoint is available (only in dev mode)
    const isViteDev =
      typeof window !== 'undefined' &&
      typeof import.meta !== 'undefined' &&
      import.meta.env?.DEV;

    if (!isViteDev) {
      translationCircuitBreakers.viteProxy.disabled = true;
    }

    // 1. Try Vite local dev proxy (/api/translate) if available and healthy
    if (isEndpointAvailable('viteProxy')) {
      const rem = Math.max(100, deadline - Date.now());
      try {
        const isLong = clean.length > 80 || clean.includes('\n');
        const res = await fetchWithTimeout(
          isLong ? '/api/translate' : `/api/translate?q=${encodeURIComponent(clean)}`,
          isLong
            ? {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: clean }),
              }
            : {},
          Math.min(rem, 600),
          signal
        );

        if (res.ok) {
          const data = await res.json();
          if (data.text) {
            const result = data.text.trim();
            recordEndpointSuccess('viteProxy');
            TRANSLATION_CACHE.set(clean, { result, expires: Date.now() + TTL });
            return result;
          }
        } else if (res.status === 404) {
          translationCircuitBreakers.viteProxy.disabled = true;
        } else {
          recordEndpointFailure('viteProxy');
        }
      } catch {
        recordEndpointFailure('viteProxy');
      }
    }

    // 2. Direct Google Translate mobile endpoint [EXPERIMENTAL FALLBACK - with graceful failure]
    if (isEndpointAvailable('googleMobile')) {
      const rem = Math.max(100, deadline - Date.now());
      if (rem > 120 && !signal?.aborted) {
        try {
          const res = await fetchWithTimeout(
            `https://translate.google.com/m?sl=en&tl=vi&q=${encodeURIComponent(clean)}`,
            {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
            },
            Math.min(rem, 900),
            signal
          );
          if (res.ok) {
            const html = await res.text();
            const match = html.match(/<div class="result-container">([\s\S]*?)<\/div>/i);
            if (match && match[1]) {
              const result = cleanHtmlAndEntities(match[1]);
              if (result) {
                recordEndpointSuccess('googleMobile');
                TRANSLATION_CACHE.set(clean, { result, expires: Date.now() + TTL });
                return result;
              }
            }
          } else {
            recordEndpointFailure('googleMobile');
          }
        } catch {
          recordEndpointFailure('googleMobile');
        }
      }
    }

    // 3. Lingva public instance (fallback)
    if (isEndpointAvailable('lingva')) {
      const rem = Math.max(100, deadline - Date.now());
      if (rem > 150 && !signal?.aborted) {
        try {
          const res = await fetchWithTimeout(
            `https://translate.plausibility.cloud/api/v1/en/vi/${encodeURIComponent(clean)}`,
            {},
            Math.min(rem, 900),
            signal
          );
          if (res.ok) {
            const data = await res.json();
            if (data.translation) {
              const result = data.translation.trim();
              recordEndpointSuccess('lingva');
              TRANSLATION_CACHE.set(clean, { result, expires: Date.now() + TTL });
              return result;
            }
          } else {
            recordEndpointFailure('lingva');
          }
        } catch {
          recordEndpointFailure('lingva');
        }
      }
    }

    // Graceful failure
    return '';
  })();

  IN_FLIGHT_TRANSLATIONS.set(clean, translationPromise);
  try {
    return await translationPromise;
  } finally {
    IN_FLIGHT_TRANSLATIONS.delete(clean);
  }
}
