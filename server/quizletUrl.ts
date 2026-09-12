/** Validate untrusted API input before launching a browser. */
export function normalizeQuizletUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;

  try {
    const url = new URL(rawUrl.trim());
    if (
      url.protocol !== 'https:' ||
      !['quizlet.com', 'www.quizlet.com'].includes(url.hostname) ||
      url.username || url.password || url.port ||
      !/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?\d+(?:\/[^/]+)?\/?$/i.test(url.pathname)
    ) return null;

    // Invalid percent escapes should be rejected rather than failing later.
    decodeURIComponent(url.pathname);
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}
