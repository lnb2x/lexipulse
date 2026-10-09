import type { FetchQuizletResult } from './quizletParser';
import { parseQuizletUrl } from './quizletParser';

export type BrowserImportProgress = 'loading' | 'verification' | 'login' | 'more_cards';
const CHANNEL = 'lexipulse-quizlet-v1';
const post = (requestId: string, kind: string, data: object = {}) => window.postMessage({
  channel: CHANNEL, direction: 'app', requestId, kind, ...data,
}, window.location.origin);
const matches = (event: MessageEvent, id: string) => event.source === window
  && event.origin === window.location.origin && event.data?.channel === CHANNEL
  && event.data.direction === 'extension' && event.data.requestId === id;

export function detectQuizletBrowserBridge(signal?: AbortSignal): Promise<boolean> {
  if (typeof window === 'undefined' || signal?.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    const id = crypto.randomUUID();
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      signal?.removeEventListener('abort', abort);
      resolve(ready);
    };
    const receive = (event: MessageEvent) => {
      if (matches(event, id) && event.data.kind === 'ready') finish(true);
    };
    const abort = () => finish(false);
    const timer = setTimeout(() => finish(false), 400);
    window.addEventListener('message', receive);
    signal?.addEventListener('abort', abort, { once: true });
    post(id, 'ping');
  });
}

function validateResult(raw: unknown, setId: string, cleanUrl: string): FetchQuizletResult {
  const result = raw as Record<string, unknown> | undefined;
  if (!result || typeof result !== 'object') return { success: false, errorType: 'server_error' };
  if (result.success !== true) {
    const codes = ['invalid_url', 'resource_limit', 'server_busy', 'blocked_resource', 'server_error', 'no_terms_found',
      'browser_closed', 'browser_disconnected', 'incomplete_set', 'challenge_blocked', 'quizlet_login_required'] as const;
    const code = codes.find(code => code === result.code) ?? 'server_error';
    return { success: false, errorType: code };
  }
  if (result.setId !== setId || !Array.isArray(result.terms) || !result.terms.length) {
    return { success: false, errorType: 'server_error' };
  }
  if (result.terms.length > 10000 || (typeof result.title === 'string' && result.title.length > 20000)) {
    return { success: false, errorType: 'resource_limit' };
  }
  let total = 0;
  const terms: { term: string; definition: string }[] = [];
  for (const card of result.terms) {
    if (!card || typeof card.term !== 'string' || typeof card.definition !== 'string') {
      return { success: false, errorType: 'server_error' };
    }
    total += card.term.length + card.definition.length;
    if (card.term.length > 20000 || card.definition.length > 20000 || total > 8 * 1024 * 1024) {
      return { success: false, errorType: 'resource_limit' };
    }
    terms.push({ term: card.term, definition: card.definition });
  }
  return { success: true, title: typeof result.title === 'string' ? result.title : undefined, setId, cleanUrl, terms,
    needsCountCheck: result.source !== 'payload' || result.expectedCount !== terms.length };
}

export function fetchQuizletFromBrowser(rawUrl: string, options: {
  signal?: AbortSignal;
  onProgress?: (progress: BrowserImportProgress) => void;
} = {}): Promise<FetchQuizletResult> {
  const parsed = parseQuizletUrl(rawUrl);
  if (!parsed.isValid || !parsed.setId || !parsed.cleanUrl) return Promise.resolve({ success: false, errorType: 'invalid_url' });
  if (options.signal?.aborted) return Promise.resolve({ success: false, errorType: 'aborted' });
  return new Promise(resolve => {
    const id = crypto.randomUUID();
    let done = false;
    const finish = (result: FetchQuizletResult, cancel = false) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      options.signal?.removeEventListener('abort', abort);
      if (cancel) post(id, 'cancel');
      resolve(result);
    };
    const abort = () => finish({ success: false, errorType: 'aborted' }, true);
    const receive = (event: MessageEvent) => {
      if (!matches(event, id)) return;
      if (event.data.kind === 'result') finish(validateResult(event.data.result, parsed.setId!, parsed.cleanUrl!));
      else if (event.data.kind === 'progress' && ['loading', 'verification', 'login', 'more_cards'].includes(event.data.status)) {
        options.onProgress?.(event.data.status);
      }
    };
    // The extension has its own 3-minute deadline; this also covers extension failure.
    const timer = setTimeout(() => finish({ success: false, errorType: 'browser_disconnected' }, true), 185000);
    window.addEventListener('message', receive);
    options.signal?.addEventListener('abort', abort, { once: true });
    post(id, 'start', { url: parsed.cleanUrl });
  });
}
