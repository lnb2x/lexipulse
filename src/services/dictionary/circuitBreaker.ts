/** Fetch a buffered response under one deadline covering headers and body. */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 2500,
  externalSignal?: AbortSignal
): Promise<Response> {
  const signals = [...new Set([externalSignal, options.signal].filter((s): s is AbortSignal => !!s))];
  for (const signal of signals) signal.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signals.find(signal => signal.aborted)?.reason);
  for (const signal of signals) signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('Request deadline exceeded', 'TimeoutError')), timeoutMs);
  let response: Response | undefined;
  let rejectAbort!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
  });
  try {
    return await Promise.race([
      (async () => {
        response = await fetch(url, { ...options, signal: controller.signal });
        // Drain a clone so callers retain native status/headers/url and body methods.
        if (response.body) await response.clone().arrayBuffer();
        controller.signal.throwIfAborted();
        return response;
      })(),
      aborted,
    ]);
  } finally {
    clearTimeout(timer);
    for (const signal of signals) signal.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', rejectAbort);
    if (controller.signal.aborted) void response?.body?.cancel().catch(() => {});
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
