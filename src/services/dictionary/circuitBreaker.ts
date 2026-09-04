/**
 * Fast fetch with timeout and external AbortSignal to prevent hanging UI
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 2500,
  externalSignal?: AbortSignal
): Promise<Response> {
  if (externalSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException(`Request timeout of ${timeoutMs}ms exceeded`, 'TimeoutError'));
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort(externalSignal?.reason || new DOMException('Aborted by user', 'AbortError'));
  };

  if (externalSignal) {
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export interface CircuitBreakerState {
  failures: number;
  nextAllowedTime: number;
  disabled?: boolean;
}

export const translationCircuitBreakers: Record<string, CircuitBreakerState> = {
  viteProxy: { failures: 0, nextAllowedTime: 0 },
  googleMobile: { failures: 0, nextAllowedTime: 0 },
  lingva: { failures: 0, nextAllowedTime: 0 },
};

export function recordEndpointFailure(endpoint: string) {
  const cb = translationCircuitBreakers[endpoint];
  if (!cb) return;
  cb.failures++;
  if (cb.failures >= 2) {
    cb.nextAllowedTime = Date.now() + 60_000; // Open circuit for 60 seconds
  }
}

export function recordEndpointSuccess(endpoint: string) {
  const cb = translationCircuitBreakers[endpoint];
  if (!cb) return;
  cb.failures = 0;
  cb.nextAllowedTime = 0;
}

export function isEndpointAvailable(endpoint: string): boolean {
  const cb = translationCircuitBreakers[endpoint];
  if (!cb) return true;
  if (cb.disabled) return false;
  return Date.now() >= cb.nextAllowedTime;
}

export function cleanHtmlAndEntities(str: string): string {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}
