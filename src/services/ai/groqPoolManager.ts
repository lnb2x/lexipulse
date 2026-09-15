/**
 * Groq Multi-Model Pool Manager
 * Coordinates concurrent requests across multiple Groq models with round-robin distribution,
 * dynamic HTTP 429 rate-limit failover, org-vs-model rate limit awareness, anti-stampede ramp-up,
 * strict compatibility checking, and safe streaming interruption handling.
 */

import {
  GROQ_KNOWN_MODELS,
  resolveEffectiveGroqModelPool,
  getModelCapability,
  type GroqModelCapability,
} from '../../config/groqConfig';
import {
  parseGroqRateLimitResponse,
  sanitizeGroqLogMessage,
  type GroqRateLimitInfo,
} from './groqErrorParser';

export class GroqNonRetryableError extends Error {
  status?: number;
  responseBody?: any;

  constructor(message: string, status?: number, responseBody?: any) {
    super(message);
    this.name = 'GroqNonRetryableError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export class GroqStreamInterruptedError extends Error {
  partialContent: string;
  reason: string;
  lastModelUsed: string;

  constructor(
    message: string,
    partialContent: string,
    reason: string,
    lastModelUsed: string
  ) {
    super(message);
    this.name = 'GroqStreamInterruptedError';
    this.partialContent = partialContent;
    this.reason = reason;
    this.lastModelUsed = lastModelUsed;
  }
}

export class GroqTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroqTimeoutError';
  }
}

export interface GroqChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface GroqChatCompletionRequest {
  messages: GroqChatCompletionMessage[];
  model?: string; // Optional preferred model; if omitted or in pool, uses round-robin
  modelPool?: string[]; // Optional custom pool of models for this request
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  response_format?: { type: 'json_object' | 'text' };
  tools?: any[];
  tool_choice?: any;
  stream?: boolean;
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number; // Total timeout budget for the request including retries (default 30000ms)
  signal?: AbortSignal;
}

export interface GroqChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: any[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  headers?: Record<string, string>;
  _poolMeta?: {
    modelUsed: string;
    attempts: number;
    failoverHistory: string[];
  };
}

export interface GroqStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: any[];
    };
    finish_reason: string | null;
  }>;
}

export type ModelState = 'available' | 'cooldown' | 'recovering' | 'unsupported';

export interface ModelRuntimeStatus {
  modelId: string;
  capability: GroqModelCapability;
  state: ModelState;
  cooldownUntil: number;
  activeRequests: number;
  consecutive429s: number;
  totalSuccesses: number;
  totalFailovers: number;
  lastUsedTimestamp: number;
}

export interface RequestCompatibilityRequirement {
  requiresJson: boolean;
  requiresTools: boolean;
  requiresVision: boolean;
  estimatedTokens: number;
}

/**
 * Detects structural requirements of a chat completion request to match compatible models.
 */
export function detectRequestRequirements(
  req: GroqChatCompletionRequest
): RequestCompatibilityRequirement {
  const requiresJson = req.response_format?.type === 'json_object';
  const requiresTools = Array.isArray(req.tools) && req.tools.length > 0;

  let requiresVision = false;
  let totalChars = 0;

  for (const m of req.messages) {
    if (typeof m.content === 'string') {
      totalChars += m.content.length;
    } else if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part.type === 'text' && part.text) {
          totalChars += part.text.length;
        } else if (part.type === 'image_url') {
          requiresVision = true;
        }
      }
    }
  }

  // Rough estimation: 1 token ~ 3.5 chars + output tokens
  const estimatedPromptTokens = Math.ceil(totalChars / 3.5);
  const estimatedTokens = estimatedPromptTokens + (req.max_tokens || 1024);

  return {
    requiresJson,
    requiresTools,
    requiresVision,
    estimatedTokens,
  };
}

/**
 * Checks whether a specific Groq model meets all compatibility criteria for a request.
 */
export function isModelCompatible(
  cap: GroqModelCapability,
  reqs: RequestCompatibilityRequirement
): boolean {
  if (reqs.requiresJson && !cap.supportsJson) return false;
  if (reqs.requiresTools && !cap.supportsTools) return false;
  if (reqs.requiresVision && !cap.supportsVision) return false;
  if (reqs.estimatedTokens > cap.contextWindow) return false;
  return true;
}

/**
 * Core Groq Model Pool Manager class
 */
export class GroqPoolManager {
  private modelStates: Map<string, ModelRuntimeStatus> = new Map();
  private roundRobinCounter = 0;
  private orgRateLimitUntil = 0;
  private orgRateLimitReason = '';

  // Concurrency controls
  private globalActiveCount = 0;
  private readonly maxGlobalConcurrency = 4;
  private readonly maxModelConcurrency = 2;
  private readonly maxRecoveringConcurrency = 1;

  // Concurrency queue for waiting requests
  private waitQueue: Array<() => void> = [];

  constructor() {
    this.initPool();
  }

  /**
   * Initializes or refreshes runtime statuses for all known Groq models.
   */
  private initPool(): void {
    for (const [id, cap] of Object.entries(GROQ_KNOWN_MODELS)) {
      if (!this.modelStates.has(id)) {
        this.modelStates.set(id, {
          modelId: id,
          capability: cap,
          state: 'available',
          cooldownUntil: 0,
          activeRequests: 0,
          consecutive429s: 0,
          totalSuccesses: 0,
          totalFailovers: 0,
          lastUsedTimestamp: 0,
        });
      }
    }
  }

  /**
   * Ensures a model status is tracked, registering dynamically if needed.
   */
  private ensureModelRegistered(id: string): ModelRuntimeStatus {
    let status = this.modelStates.get(id);
    if (!status) {
      const cap = getModelCapability(id);
      status = {
        modelId: id,
        capability: cap,
        state: 'available',
        cooldownUntil: 0,
        activeRequests: 0,
        consecutive429s: 0,
        totalSuccesses: 0,
        totalFailovers: 0,
        lastUsedTimestamp: 0,
      };
      this.modelStates.set(id, status);
    }
    return status;
  }

  /**
   * Clears state - primarily for test suites.
   */
  public resetState(): void {
    this.modelStates.clear();
    this.initPool();
    this.roundRobinCounter = 0;
    this.orgRateLimitUntil = 0;
    this.orgRateLimitReason = '';
    this.globalActiveCount = 0;
    this.waitQueue = [];
  }

  /**
   * Gets a read-only snapshot of current pool statuses.
   */
  public getPoolStatus(customPool?: string[]): ModelRuntimeStatus[] {
    const activeIds = resolveEffectiveGroqModelPool(customPool);
    const now = Date.now();

    return activeIds.map((id) => {
      const state = this.ensureModelRegistered(id);

      // Check if cooldown has expired
      let effectiveState = state.state;
      if (effectiveState === 'cooldown' && now >= state.cooldownUntil) {
        effectiveState = 'recovering';
      }

      return {
        ...state,
        state: effectiveState,
      };
    });
  }

  /**
   * Acquires a concurrency slot respecting global and per-model limits.
   */
  private async acquireConcurrencySlot(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new DOMException('Aborted by user', 'AbortError');
    }

    if (this.globalActiveCount < this.maxGlobalConcurrency) {
      this.globalActiveCount++;
      return;
    }

    return new Promise<void>((resolve, reject) => {
      let onAbort: (() => void) | undefined;
      const releaseListener = () => {
        if (onAbort && signal) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      const task = () => {
        releaseListener();
        if (signal?.aborted) {
          reject(new DOMException('Aborted by user', 'AbortError'));
          return;
        }
        this.globalActiveCount++;
        resolve();
      };

      if (signal) {
        onAbort = () => {
          const idx = this.waitQueue.indexOf(task);
          if (idx !== -1) {
            this.waitQueue.splice(idx, 1);
          }
          reject(new DOMException('Aborted by user', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }

      this.waitQueue.push(task);
    });
  }

  /**
   * Releases a concurrency slot and wakes the next waiting request in queue.
   */
  private releaseConcurrencySlot(): void {
    this.globalActiveCount = Math.max(0, this.globalActiveCount - 1);
    if (this.waitQueue.length > 0) {
      const nextTask = this.waitQueue.shift();
      nextTask?.();
    }
  }

  /**
   * Helper to sleep with AbortSignal support.
   */
  private async sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) return;
    if (signal?.aborted) {
      throw new DOMException('Aborted by user', 'AbortError');
    }

    return new Promise<void>((resolve, reject) => {
      let timer: any;
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted by user', 'AbortError'));
      };

      timer = setTimeout(() => {
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }

  /**
   * Selects an available model from the pool using round-robin distribution,
   * checking compatibility and handling cooldown/recovering ramp-up.
   */
  private selectCandidateModel(
    candidateIds: string[],
    reqs: RequestCompatibilityRequirement
  ): { selectedModelId: string | null; earliestCooldownMs: number } {
    const now = Date.now();
    let earliestCooldownMs = Infinity;

    // Filter compatible models
    const compatibleIds = candidateIds.filter((id) => {
      const cap = getModelCapability(id);
      return cap && isModelCompatible(cap, reqs);
    });

    if (compatibleIds.length === 0) {
      return { selectedModelId: null, earliestCooldownMs: 0 };
    }

    // Identify eligible models ready for requests
    const eligibleIds: string[] = [];

    for (const id of compatibleIds) {
      const status = this.ensureModelRegistered(id);

      // Permanently skip models confirmed unsupported / not-found in this session
      if (status.state === 'unsupported') {
        continue;
      }

      // Check if cooldown expired -> transition to recovering
      if (status.state === 'cooldown') {
        if (now >= status.cooldownUntil) {
          status.state = 'recovering';
        } else {
          const remaining = status.cooldownUntil - now;
          if (remaining < earliestCooldownMs) {
            earliestCooldownMs = remaining;
          }
          continue; // In cooldown, skip
        }
      }

      // Concurrency check based on state
      if (status.state === 'recovering') {
        // Anti-stampede: Allow only 1 probe request during recovery
        if (status.activeRequests < this.maxRecoveringConcurrency) {
          eligibleIds.push(id);
        }
      } else if (status.state === 'available') {
        if (status.activeRequests < this.maxModelConcurrency) {
          eligibleIds.push(id);
        }
      }
    }

    if (eligibleIds.length === 0) {
      return { selectedModelId: null, earliestCooldownMs };
    }

    // Pick candidate via round-robin index
    const pickIndex = (this.roundRobinCounter++) % eligibleIds.length;
    const selected = eligibleIds[pickIndex];
    return { selectedModelId: selected, earliestCooldownMs: 0 };
  }

  /**
   * Main entry point to execute a chat completion with automatic rate-limit failover.
   */
  public async executeChatCompletion(
    req: GroqChatCompletionRequest
  ): Promise<GroqChatCompletionResponse> {
    const startTime = Date.now();
    const totalTimeoutMs = req.timeoutMs || 30000;
    const effectivePool = resolveEffectiveGroqModelPool(req.modelPool);

    if (effectivePool.length === 0) {
      throw new GroqNonRetryableError('No valid Groq models configured in pool.');
    }

    const reqs = detectRequestRequirements(req);
    const failoverHistory: string[] = [];
    const maxAttempts = Math.max(3, effectivePool.length + 1);

    await this.acquireConcurrencySlot(req.signal);

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Check timeout
        const elapsed = Date.now() - startTime;
        if (elapsed >= totalTimeoutMs) {
          throw new GroqTimeoutError(
            `Groq request exceeded total timeout budget of ${totalTimeoutMs}ms after ${attempt - 1} attempts.`
          );
        }

        // Check if organization-wide limit is active
        const now = Date.now();
        if (this.orgRateLimitUntil > now) {
          const waitMs = this.orgRateLimitUntil - now;
          if (elapsed + waitMs > totalTimeoutMs) {
            throw new GroqTimeoutError(
              `Groq organization rate limit active until ${new Date(this.orgRateLimitUntil).toISOString()} (${this.orgRateLimitReason}). Request timeout exceeded.`
            );
          }
          console.warn(
            `[GroqPool] Organization limit active. Waiting ${waitMs}ms before retrying... (reason: ${this.orgRateLimitReason})`
          );
          await this.sleep(waitMs, req.signal);
        }

        // Select candidate model
        let { selectedModelId, earliestCooldownMs } = this.selectCandidateModel(effectivePool, reqs);

        if (!selectedModelId) {
          if (earliestCooldownMs === Infinity || earliestCooldownMs <= 0) {
            throw new GroqNonRetryableError(
              `No compatible Groq models in pool support request requirements (JSON: ${reqs.requiresJson}, Tools: ${reqs.requiresTools}, Vision: ${reqs.requiresVision}, EstTokens: ${reqs.estimatedTokens}). Pool: [${effectivePool.join(', ')}]`
            );
          }

          // All compatible models in cooldown -> wait for earliest model recovery
          const waitMs = Math.max(500, Math.min(earliestCooldownMs, 10000));
          if (Date.now() - startTime + waitMs > totalTimeoutMs) {
            throw new GroqTimeoutError(
              `All compatible Groq models in cooldown. Earliest recovery in ${waitMs}ms exceeds remaining timeout.`
            );
          }

          console.warn(
            `[GroqPool] All compatible models in cooldown. Waiting ${waitMs}ms for earliest model recovery...`
          );
          await this.sleep(waitMs, req.signal);

          // Retry model selection
          const retryCandidate = this.selectCandidateModel(effectivePool, reqs);
          selectedModelId = retryCandidate.selectedModelId;
          if (!selectedModelId) {
            continue;
          }
        }

        const modelState = this.modelStates.get(selectedModelId)!;
        modelState.activeRequests++;
        modelState.lastUsedTimestamp = Date.now();

        console.info(
          `[GroqPool] Selected model "${selectedModelId}" (attempt ${attempt}/${maxAttempts}, active: ${modelState.activeRequests}, state: ${modelState.state})`
        );

        try {
          const res = await this.performSingleModelCall(selectedModelId, req, totalTimeoutMs - (Date.now() - startTime));

          // SUCCESS
          modelState.totalSuccesses++;
          modelState.consecutive429s = 0;
          if (modelState.state === 'recovering') {
            modelState.state = 'available';
            console.info(`[GroqPool] Recovering probe succeeded on "${selectedModelId}". Model fully available.`);
          }

          res._poolMeta = {
            modelUsed: selectedModelId,
            attempts: attempt,
            failoverHistory,
          };

          return res;
        } catch (err: any) {
          modelState.activeRequests = Math.max(0, modelState.activeRequests - 1);

          // Handle permanently unavailable / unentitled model
          if (err?.isModelUnavailable) {
            modelState.state = 'unsupported';
            failoverHistory.push(`${selectedModelId} (unsupported: HTTP ${err.status})`);
            console.warn(
              `[GroqPool] Model "${selectedModelId}" is not available or unentitled (HTTP ${err.status}: ${err.message}). Disabled from session pool. Failing over to next model...`
            );
            continue;
          }

          // If non-retryable error (e.g. 401 invalid key, user abort), don't failover
          if (err instanceof GroqNonRetryableError || err?.name === 'AbortError' || req.signal?.aborted) {
            throw err;
          }

          // Handle 429 Rate Limit
          if (err?.isGroqRateLimit) {
            const rlInfo: GroqRateLimitInfo = err.rateLimitInfo;
            modelState.consecutive429s++;
            modelState.totalFailovers++;
            failoverHistory.push(`${selectedModelId} (429: ${rlInfo.retryAfterMs}ms)`);

            if (rlInfo.scope === 'organization') {
              this.orgRateLimitUntil = Math.max(this.orgRateLimitUntil, rlInfo.resetTimestamp);
              this.orgRateLimitReason = rlInfo.reason;
              console.warn(
                `[GroqPool] Organization-wide rate limit reached: "${rlInfo.reason}". Cooldown: ${rlInfo.retryAfterMs}ms.`
              );
            } else {
              modelState.state = 'cooldown';
              modelState.cooldownUntil = rlInfo.resetTimestamp;
              console.warn(
                `[GroqPool] Model "${selectedModelId}" rate limited (HTTP 429). Cooldown: ${rlInfo.retryAfterMs}ms. Reason: ${rlInfo.reason}. Failing over to next model...`
              );
            }

            // Continue loop to failover to next model
            continue;
          }

          // If other transient network/5xx error, failover if attempts remain
          failoverHistory.push(`${selectedModelId} (${err.message || 'Error'})`);
          console.warn(
            `[GroqPool] Call to "${selectedModelId}" failed: ${sanitizeGroqLogMessage(err.message || String(err))}. Failing over to next candidate...`
          );
        } finally {
          modelState.activeRequests = Math.max(0, modelState.activeRequests - 1);
        }
      }

      throw new Error(
        `Groq pool exhausted after ${maxAttempts} attempts. Failover history: [${failoverHistory.join(' -> ')}]`
      );
    } finally {
      this.releaseConcurrencySlot();
    }
  }

  /**
   * Executes streaming chat completion with interruption safety.
   * If failure happens before any chunks are emitted, it safely fails over.
   * If failure happens AFTER chunks have been emitted, it emits GroqStreamInterruptedError
   * to prevent duplicate replay or corrupt content.
   */
  public async *streamChatCompletion(
    req: GroqChatCompletionRequest
  ): AsyncIterable<GroqStreamChunk> {
    const startTime = Date.now();
    const totalTimeoutMs = req.timeoutMs || 45000;
    const effectivePool = resolveEffectiveGroqModelPool(req.modelPool);

    if (effectivePool.length === 0) {
      throw new GroqNonRetryableError('No valid Groq models configured in pool.');
    }

    const reqs = detectRequestRequirements(req);
    const maxAttempts = Math.max(3, effectivePool.length + 1);

    await this.acquireConcurrencySlot(req.signal);

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= totalTimeoutMs) {
          throw new GroqTimeoutError(`Stream request exceeded total timeout of ${totalTimeoutMs}ms.`);
        }

        // Check candidate model
        const { selectedModelId, earliestCooldownMs } = this.selectCandidateModel(effectivePool, reqs);
        if (!selectedModelId) {
          if (earliestCooldownMs === Infinity || earliestCooldownMs <= 0) {
            throw new GroqNonRetryableError('No compatible models available for streaming request.');
          }
          const waitMs = Math.max(500, Math.min(earliestCooldownMs, 8000));
          await this.sleep(waitMs, req.signal);
          continue;
        }

        const modelState = this.modelStates.get(selectedModelId)!;
        modelState.activeRequests++;
        modelState.lastUsedTimestamp = Date.now();

        console.info(
          `[GroqPool] Streaming with model "${selectedModelId}" (attempt ${attempt}/${maxAttempts})`
        );

        let hasEmittedChunks = false;
        let accumulatedPartial = '';

        try {
          const endpoint = this.resolveEndpoint(req.baseUrl);
          const headers = this.buildHeaders(req.apiKey);

          const payload = {
            ...req,
            model: selectedModelId,
            stream: true,
            apiKey: undefined,
            baseUrl: undefined,
            timeoutMs: undefined,
            signal: undefined,
          };

          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: req.signal,
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            if (res.status === 429) {
              const rlInfo = parseGroqRateLimitResponse(res.headers, errBody, selectedModelId, modelState.consecutive429s + 1);
              const customErr: any = new Error(rlInfo.reason);
              customErr.isGroqRateLimit = true;
              customErr.rateLimitInfo = rlInfo;
              throw customErr;
            }

            const errMsg = errBody.error?.message || `HTTP ${res.status}: ${res.statusText}`;
            const errCode = errBody.error?.code || '';
            const lowerMsg = errMsg.toLowerCase();

            const isModelUnavailable =
              res.status === 404 ||
              errCode === 'model_not_found' ||
              errCode === 'model_decommissioned' ||
              (res.status === 400 && (lowerMsg.includes('model') && (lowerMsg.includes('does not exist') || lowerMsg.includes('not found') || lowerMsg.includes('decommissioned')))) ||
              (res.status === 403 && (lowerMsg.includes('model') || lowerMsg.includes('permission') || lowerMsg.includes('entitled') || lowerMsg.includes('access')));

            if (isModelUnavailable) {
              const customErr: any = new GroqNonRetryableError(errMsg, res.status, errBody);
              customErr.isModelUnavailable = true;
              customErr.unsupportedModelId = selectedModelId;
              throw customErr;
            }

            if (res.status === 401 || res.status === 403 || res.status === 400) {
              throw new GroqNonRetryableError(errMsg, res.status, errBody);
            }
            throw new Error(errMsg);
          }

          if (!res.body) {
            throw new Error('Streaming response body is missing');
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(':')) continue; // comments/keepalive
                if (trimmed === 'data: [DONE]') return;

                if (trimmed.startsWith('data: ')) {
                  try {
                    const chunk: GroqStreamChunk = JSON.parse(trimmed.slice(6));
                    const deltaText = chunk.choices?.[0]?.delta?.content || '';
                    if (deltaText) {
                      accumulatedPartial += deltaText;
                      hasEmittedChunks = true;
                    }
                    yield chunk;
                  } catch {
                    // Ignore JSON chunk parse error
                  }
                }
              }
            }
          } catch (streamErr: any) {
            if (hasEmittedChunks) {
              // Mid-stream interruption: DO NOT replay, emit clear interruption error
              throw new GroqStreamInterruptedError(
                `Groq stream interrupted after partial content was emitted: ${streamErr.message}`,
                accumulatedPartial,
                streamErr.message,
                selectedModelId
              );
            }
            throw streamErr;
          }

          // SUCCESS
          modelState.totalSuccesses++;
          modelState.consecutive429s = 0;
          if (modelState.state === 'recovering') {
            modelState.state = 'available';
          }
          return;
        } catch (err: any) {
          modelState.activeRequests = Math.max(0, modelState.activeRequests - 1);

          if (err instanceof GroqStreamInterruptedError) {
            throw err;
          }

          // If no chunks were emitted yet, handle permanently unavailable model
          if (!hasEmittedChunks && err?.isModelUnavailable) {
            modelState.state = 'unsupported';
            console.warn(
              `[GroqPool] Model "${selectedModelId}" unavailable (HTTP ${err.status}: ${err.message}). Disabled from streaming pool.`
            );
            continue;
          }

          if (err instanceof GroqNonRetryableError) {
            throw err;
          }

          // If no chunks were emitted yet, handle 429 failover
          if (!hasEmittedChunks && err?.isGroqRateLimit) {
            const rlInfo: GroqRateLimitInfo = err.rateLimitInfo;
            modelState.consecutive429s++;
            modelState.totalFailovers++;

            if (rlInfo.scope === 'organization') {
              this.orgRateLimitUntil = Math.max(this.orgRateLimitUntil, rlInfo.resetTimestamp);
              this.orgRateLimitReason = rlInfo.reason;
            } else {
              modelState.state = 'cooldown';
              modelState.cooldownUntil = rlInfo.resetTimestamp;
            }
            continue;
          }

          if (hasEmittedChunks) {
            throw new GroqStreamInterruptedError(
              `Streaming interrupted: ${err.message}`,
              accumulatedPartial,
              err.message,
              selectedModelId
            );
          }

          throw err;
        } finally {
          modelState.activeRequests = Math.max(0, modelState.activeRequests - 1);
        }
      }

      throw new Error(`Streaming failed across all configured Groq models.`);
    } finally {
      this.releaseConcurrencySlot();
    }
  }

  /**
   * Helper to perform a single HTTP call to Groq with specific model and timeout.
   */
  private async performSingleModelCall(
    modelId: string,
    req: GroqChatCompletionRequest,
    timeoutMs: number
  ): Promise<GroqChatCompletionResponse> {
    const endpoint = this.resolveEndpoint(req.baseUrl);
    const headers = this.buildHeaders(req.apiKey);

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new DOMException(`Timeout of ${timeoutMs}ms exceeded`, 'TimeoutError'));
    }, timeoutMs);

    const onExternalAbort = () => {
      controller.abort(req.signal?.reason || new DOMException('Aborted by user', 'AbortError'));
    };

    if (req.signal) {
      req.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      // Build clean OpenAI-compatible payload preserving messages, tools, response_format
      const payload: Record<string, any> = {
        model: modelId,
        messages: req.messages,
        temperature: req.temperature ?? 0.3,
      };

      if (req.max_tokens) payload.max_tokens = req.max_tokens;
      if (req.top_p) payload.top_p = req.top_p;
      if (req.response_format) payload.response_format = req.response_format;
      if (req.tools) payload.tools = req.tools;
      if (req.tool_choice) payload.tool_choice = req.tool_choice;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (controller.signal.aborted || req.signal?.aborted) {
        throw (req.signal?.reason || new DOMException('Aborted by user', 'AbortError'));
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        if (res.status === 429) {
          const rlInfo = parseGroqRateLimitResponse(res.headers, errBody, modelId);
          const customErr: any = new Error(rlInfo.reason);
          customErr.isGroqRateLimit = true;
          customErr.rateLimitInfo = rlInfo;
          throw customErr;
        }

        const errMsg = errBody.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        const errCode = errBody.error?.code || '';
        const lowerMsg = errMsg.toLowerCase();

        // Detect if model does not exist, was decommissioned, or account is unentitled
        const isModelUnavailable =
          res.status === 404 ||
          errCode === 'model_not_found' ||
          errCode === 'model_decommissioned' ||
          (res.status === 400 && (lowerMsg.includes('model') && (lowerMsg.includes('does not exist') || lowerMsg.includes('not found') || lowerMsg.includes('decommissioned')))) ||
          (res.status === 403 && (lowerMsg.includes('model') || lowerMsg.includes('permission') || lowerMsg.includes('entitled') || lowerMsg.includes('access')));

        if (isModelUnavailable) {
          const customErr: any = new GroqNonRetryableError(errMsg, res.status, errBody);
          customErr.isModelUnavailable = true;
          customErr.unsupportedModelId = modelId;
          throw customErr;
        }

        if (res.status === 401 || res.status === 403 || res.status === 400) {
          throw new GroqNonRetryableError(errMsg, res.status, errBody);
        }

        throw new Error(errMsg);
      }

      const data = await res.json();
      return data as GroqChatCompletionResponse;
    } finally {
      clearTimeout(timer);
      if (req.signal) {
        req.signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  private resolveEndpoint(customBaseUrl?: string): string {
    const base = (customBaseUrl || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
    return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
  }

  private buildHeaders(apiKey: string): Record<string, string> {
    const cleanKey = (apiKey || '').trim();
    return {
      'Content-Type': 'application/json',
      ...(cleanKey ? { Authorization: `Bearer ${cleanKey}` } : {}),
      'User-Agent': 'LexiPulse/0.1.0 (GroqMultiModelPool)',
    };
  }
}

/**
 * Global shared singleton instance of the Groq Pool Manager
 */
export const groqPoolManager = new GroqPoolManager();
