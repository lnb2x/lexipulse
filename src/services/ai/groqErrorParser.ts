/**
 * Groq Rate Limit & Error Parser
 * Accurately parses HTTP 429 response headers and JSON body from Groq API.
 * Distinguishes model-specific limits (RPM/TPM) from organization/account limits (RPD/TPD).
 * Computes exponential backoff with jitter when explicit Retry-After is absent.
 */

export interface GroqRateLimitInfo {
  isRateLimit: boolean;
  scope: 'model' | 'organization';
  modelId?: string;
  retryAfterMs: number;
  resetTimestamp: number;
  reason: string;
  rawMessage?: string;
}

/**
 * Parses duration strings returned by Groq/OpenAI headers, e.g.:
 * "2m30s" -> 150000ms
 * "1.25s" -> 1250ms
 * "500ms" -> 500ms
 * "30s"   -> 30000ms
 */
export function parseDurationStringToMs(str?: string | null): number | null {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();

  // If plain number of seconds
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && numeric > 0) {
    return Math.round(numeric * 1000);
  }

  // Regex match complex duration like 2m30s, 1m, 45s, 500ms
  let totalMs = 0;
  let matched = false;

  const mMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*m(?:in)?(?![a-z])/i);
  if (mMatch) {
    totalMs += parseFloat(mMatch[1]) * 60 * 1000;
    matched = true;
  }

  const sMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*s(?:ec)?(?![a-z])/i);
  if (sMatch) {
    totalMs += parseFloat(sMatch[1]) * 1000;
    matched = true;
  }

  const msMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*ms/i);
  if (msMatch) {
    totalMs += parseFloat(msMatch[1]);
    matched = true;
  }

  return matched ? Math.round(totalMs) : null;
}

/**
 * Parses Retry-After header which can be seconds or an HTTP Date string.
 */
export function parseRetryAfterHeader(headerVal?: string | null): number | null {
  if (!headerVal) return null;
  const trimmed = headerVal.trim();

  // 1. Check if numeric seconds
  const sec = parseFloat(trimmed);
  if (!Number.isNaN(sec) && sec >= 0) {
    return Math.round(sec * 1000);
  }

  // 2. Check if HTTP Date string (e.g. "Wed, 21 Oct 2026 07:28:00 GMT")
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return Math.max(1000, diff);
  }

  return null;
}

/**
 * Calculates exponential backoff with random jitter.
 */
export function calculateBackoffWithJitter(
  attempt = 1,
  baseMs = 2000,
  maxMs = 60000,
  jitterMaxMs = 800
): number {
  const safeAttempt = Math.max(1, Math.min(6, attempt));
  const exponential = baseMs * Math.pow(2, safeAttempt - 1);
  const jitter = Math.floor(Math.random() * jitterMaxMs);
  return Math.min(maxMs, Math.round(exponential + jitter));
}

/**
 * Redacts sensitive tokens or headers from error messages and logs.
 */
export function sanitizeGroqLogMessage(msg: string): string {
  if (!msg || typeof msg !== 'string') return '';
  return msg
    .replace(/gsk_[a-zA-Z0-9_-]{10,}/g, 'gsk_***REDACTED***')
    .replace(/sk-[a-zA-Z0-9_-]{10,}/g, 'sk-***REDACTED***')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer ***REDACTED***');
}

/**
 * Parses HTTP 429 response or error payload from Groq.
 */
export function parseGroqRateLimitResponse(
  headers: Headers | Record<string, string | undefined> | null | undefined,
  errorBody: any,
  requestedModel?: string,
  consecutiveFails = 1
): GroqRateLimitInfo {
  const getHeader = (name: string): string | null => {
    if (!headers) return null;
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get(name);
    }
    const record = headers as Record<string, string | undefined>;
    return record[name] || record[name.toLowerCase()] || null;
  };

  const retryAfterHeader = getHeader('retry-after');
  const resetReqHeader = getHeader('x-ratelimit-reset-requests');
  const resetTokenHeader = getHeader('x-ratelimit-reset-tokens');

  // Try extracting duration from headers
  let extractedMs: number | null = parseRetryAfterHeader(retryAfterHeader);

  if (extractedMs === null && resetReqHeader) {
    extractedMs = parseDurationStringToMs(resetReqHeader);
  }
  if (extractedMs === null && resetTokenHeader) {
    extractedMs = parseDurationStringToMs(resetTokenHeader);
  }

  // Extract from error body message
  const rawMessage: string =
    typeof errorBody?.error?.message === 'string'
      ? errorBody.error.message
      : typeof errorBody?.message === 'string'
      ? errorBody.message
      : '';

  // Match: "Please try again in 1.25s" or "try again in 500ms"
  if (extractedMs === null && rawMessage) {
    const textSecMatch = rawMessage.match(/try again in (\d+(?:\.\d+)?)\s*s/i);
    if (textSecMatch) {
      extractedMs = Math.round(parseFloat(textSecMatch[1]) * 1000);
    } else {
      const textMsMatch = rawMessage.match(/try again in (\d+(?:\.\d+)?)\s*ms/i);
      if (textMsMatch) {
        extractedMs = Math.round(parseFloat(textMsMatch[1]));
      }
    }
  }

  // Fallback if no explicit time is available: exponential backoff with jitter
  const retryAfterMs = extractedMs !== null && extractedMs > 0
    ? Math.max(10, extractedMs)
    : calculateBackoffWithJitter(consecutiveFails);

  const resetTimestamp = Date.now() + retryAfterMs;

  // Determine Scope: Organization/Account vs Model-specific
  let scope: 'model' | 'organization' = 'model';
  let affectedModel = requestedModel;

  const lowerMsg = rawMessage.toLowerCase();

  // Distinct organization-level limit patterns:
  // "requests per day (RPD)", "tokens per day (TPD)", "organization quota", "account limit"
  const isOrgLimit =
    lowerMsg.includes('requests per day') ||
    lowerMsg.includes('(rpd)') ||
    lowerMsg.includes('tokens per day') ||
    lowerMsg.includes('(tpd)') ||
    lowerMsg.includes('organization quota') ||
    lowerMsg.includes('daily request limit') ||
    (lowerMsg.includes('organization') && !lowerMsg.includes('for model'));

  if (isOrgLimit) {
    scope = 'organization';
  } else {
    // Model specific: extract model ID if mentioned in error
    const modelMatch = rawMessage.match(/for model [`']?([a-zA-Z0-9_.-]+)[`']?/i);
    if (modelMatch && modelMatch[1]) {
      affectedModel = modelMatch[1];
    }
  }

  let reason = 'Rate limit exceeded (HTTP 429)';
  if (scope === 'organization') {
    reason = 'Organization-level rate limit exceeded (RPD / TPD / Account quota)';
  } else if (affectedModel) {
    reason = `Model "${affectedModel}" rate limit exceeded (RPM / TPM)`;
  }

  return {
    isRateLimit: true,
    scope,
    modelId: affectedModel,
    retryAfterMs,
    resetTimestamp,
    reason,
    rawMessage: sanitizeGroqLogMessage(rawMessage),
  };
}
