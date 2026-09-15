import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GroqPoolManager,
  GroqNonRetryableError,
  GroqStreamInterruptedError,
  GroqTimeoutError,
  detectRequestRequirements,
  isModelCompatible,
} from '../src/services/ai/groqPoolManager';
import {
  parseGroqRateLimitResponse,
  parseDurationStringToMs,
  parseRetryAfterHeader,
  calculateBackoffWithJitter,
  sanitizeGroqLogMessage,
} from '../src/services/ai/groqErrorParser';
import {
  GROQ_KNOWN_MODELS,
  resolveEffectiveGroqModelPool,
} from '../src/config/groqConfig';

describe('Groq Error Parser & Rate Limit Extractor', () => {
  it('parses duration strings accurately', () => {
    expect(parseDurationStringToMs('2m30s')).toBe(150000);
    expect(parseDurationStringToMs('1.5s')).toBe(1500);
    expect(parseDurationStringToMs('500ms')).toBe(500);
    expect(parseDurationStringToMs('45s')).toBe(45000);
    expect(parseDurationStringToMs('10')).toBe(10000);
    expect(parseDurationStringToMs('')).toBeNull();
  });

  it('parses Retry-After header with seconds or date', () => {
    expect(parseRetryAfterHeader('3')).toBe(3000);
    expect(parseRetryAfterHeader('2.5')).toBe(2500);
    expect(parseRetryAfterHeader('')).toBeNull();
  });

  it('distinguishes model rate limit from organization rate limit', () => {
    // Model specific
    const modelErrorBody = {
      error: {
        message: 'Rate limit reached for model `llama-3.3-70b-versatile` in organization `org_abc` on requests per minute (RPM): Limit 30, Used 30. Please try again in 1.25s.',
      },
    };
    const modelParsed = parseGroqRateLimitResponse(null, modelErrorBody, 'llama-3.3-70b-versatile');
    expect(modelParsed.scope).toBe('model');
    expect(modelParsed.modelId).toBe('llama-3.3-70b-versatile');
    expect(modelParsed.retryAfterMs).toBe(1250);

    // Organization specific (e.g. Requests Per Day limit)
    const orgErrorBody = {
      error: {
        message: 'Rate limit reached for organization `org_abc` on requests per day (RPD): Limit 14400, Used 14400. Please try again in 30s.',
      },
    };
    const orgParsed = parseGroqRateLimitResponse(null, orgErrorBody, 'llama-3.1-8b-instant');
    expect(orgParsed.scope).toBe('organization');
    expect(orgParsed.retryAfterMs).toBe(30000);
  });

  it('calculates backoff with jitter within bounded range', () => {
    const b1 = calculateBackoffWithJitter(1, 2000, 60000, 500);
    expect(b1).toBeGreaterThanOrEqual(2000);
    expect(b1).toBeLessThanOrEqual(2500);

    const b2 = calculateBackoffWithJitter(2, 2000, 60000, 500);
    expect(b2).toBeGreaterThanOrEqual(4000);
    expect(b2).toBeLessThanOrEqual(4500);
  });

  it('sanitizes API keys and sensitive tokens from log messages', () => {
    const raw = 'Failed with key gsk_1234567890abcdef and Bearer sk-secrettoken12345';
    const sanitized = sanitizeGroqLogMessage(raw);
    expect(sanitized).not.toContain('gsk_1234567890abcdef');
    expect(sanitized).not.toContain('sk-secrettoken12345');
    expect(sanitized).toContain('gsk_***REDACTED***');
    expect(sanitized).toContain('Bearer ***REDACTED***');
  });
});

describe('Groq Pool Manager Compatibility Detection', () => {
  it('detects json, tools, vision, and token requirements', () => {
    const req = {
      messages: [
        { role: 'user' as const, content: 'Analyze word syntax' },
        {
          role: 'user' as const,
          content: [
            { type: 'text', text: 'image context' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } },
          ],
        },
      ],
      response_format: { type: 'json_object' as const },
      tools: [{ type: 'function', function: { name: 'lookup' } }],
      apiKey: 'gsk_mock',
    };

    const detected = detectRequestRequirements(req);
    expect(detected.requiresJson).toBe(true);
    expect(detected.requiresTools).toBe(true);
    expect(detected.requiresVision).toBe(true);
  });

  it('filters models based on compatibility', () => {
    const reqs = {
      requiresJson: true,
      requiresTools: true,
      requiresVision: true,
      estimatedTokens: 1000,
    };

    // llama-3.3-70b-versatile has no vision -> incompatible
    expect(isModelCompatible(GROQ_KNOWN_MODELS['llama-3.3-70b-versatile'], reqs)).toBe(false);

    // llama-3.2-11b-vision-preview has vision, tools, json -> compatible
    expect(isModelCompatible(GROQ_KNOWN_MODELS['llama-3.2-11b-vision-preview'], reqs)).toBe(true);

    // Request exceeding 32k tokens on mixtral
    const largeReq = {
      requiresJson: true,
      requiresTools: false,
      requiresVision: false,
      estimatedTokens: 40000,
    };
    expect(isModelCompatible(GROQ_KNOWN_MODELS['mixtral-8x7b-32768'], largeReq)).toBe(false);
    expect(isModelCompatible(GROQ_KNOWN_MODELS['llama-3.3-70b-versatile'], largeReq)).toBe(true);
  });
});

describe('Groq Pool Manager End-to-End Orchestration', () => {
  let poolManager: GroqPoolManager;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    poolManager = new GroqPoolManager();
    poolManager.resetState();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('distributes consecutive requests via round-robin among available models', async () => {
    const modelsUsed: string[] = [];

    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body);
      modelsUsed.push(body.model);
      return new Response(
        JSON.stringify({
          id: `chat-${Date.now()}`,
          model: body.model,
          choices: [{ index: 0, message: { role: 'assistant', content: '{"ok":true}' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    // Send 3 requests
    const res1 = await poolManager.executeChatCompletion({
      apiKey: 'gsk_test',
      messages: [{ role: 'user', content: 'test 1' }],
      modelPool: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    });

    const res2 = await poolManager.executeChatCompletion({
      apiKey: 'gsk_test',
      messages: [{ role: 'user', content: 'test 2' }],
      modelPool: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    });

    const res3 = await poolManager.executeChatCompletion({
      apiKey: 'gsk_test',
      messages: [{ role: 'user', content: 'test 3' }],
      modelPool: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    });

    expect(modelsUsed.length).toBe(3);
    // Verified each model received 1 request in round-robin sequence
    expect(modelsUsed[0]).toBe('llama-3.3-70b-versatile');
    expect(modelsUsed[1]).toBe('llama-3.1-8b-instant');
    expect(modelsUsed[2]).toBe('mixtral-8x7b-32768');

    expect(res1._poolMeta?.modelUsed).toBe('llama-3.3-70b-versatile');
    expect(res2._poolMeta?.modelUsed).toBe('llama-3.1-8b-instant');
    expect(res3._poolMeta?.modelUsed).toBe('mixtral-8x7b-32768');
  });

  it('fails over immediately to next model when encountering HTTP 429', async () => {
    const modelsCalled: string[] = [];

    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body);
      modelsCalled.push(body.model);

      if (body.model === 'llama-3.3-70b-versatile') {
        // Return 429 with Retry-After header
        return new Response(
          JSON.stringify({
            error: {
              message: 'Rate limit reached for model `llama-3.3-70b-versatile` on RPM: Limit 30. Try again in 2s.',
            },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'retry-after': '2',
            },
          }
        );
      }

      // Second model succeeds
      return new Response(
        JSON.stringify({
          id: 'chat-failover-success',
          model: body.model,
          choices: [{ index: 0, message: { role: 'assistant', content: 'Success from second model' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const res = await poolManager.executeChatCompletion({
      apiKey: 'gsk_test',
      messages: [{ role: 'user', content: 'test failover' }],
      modelPool: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    });

    expect(modelsCalled).toEqual(['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']);
    expect(res._poolMeta?.modelUsed).toBe('llama-3.1-8b-instant');
    expect(res._poolMeta?.attempts).toBe(2);
    expect(res._poolMeta?.failoverHistory[0]).toContain('llama-3.3-70b-versatile (429');

    // Verify first model is now in cooldown
    const poolStatus = poolManager.getPoolStatus(['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']);
    const m1Status = poolStatus.find((m) => m.modelId === 'llama-3.3-70b-versatile');
    expect(m1Status?.state).toBe('cooldown');
    expect(m1Status?.cooldownUntil).toBeGreaterThan(Date.now());
  });

  it('pauses entire pool and waits when encountering organization-level rate limit', async () => {
    let callCount = 0;
    const modelsCalled: string[] = [];

    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      callCount++;
      const body = JSON.parse(options.body);
      modelsCalled.push(body.model);

      if (callCount === 1) {
        // Return Org 429 with 50ms cooldown
        return new Response(
          JSON.stringify({
            error: {
              message: 'Rate limit reached for organization `org_demo` on requests per day (RPD): Limit 1000. Try again in 0.05s.',
            },
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'retry-after': '0.05' },
          }
        );
      }

      // After cooldown expires, succeeding call
      return new Response(
        JSON.stringify({
          id: 'chat-org-success',
          model: body.model,
          choices: [{ index: 0, message: { role: 'assistant', content: 'Recovered after org pause' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const res = await poolManager.executeChatCompletion({
      apiKey: 'gsk_test',
      messages: [{ role: 'user', content: 'test org limit' }],
      modelPool: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
      timeoutMs: 5000,
    });

    expect(callCount).toBe(2);
    expect(res.choices[0].message.content).toBe('Recovered after org pause');
  });

  it('recovers model through anti-stampede probe ramp-up', async () => {
    let m1Calls = 0;

    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body);

      if (body.model === 'llama-3.3-70b-versatile') {
        m1Calls++;
        if (m1Calls === 1) {
          // First call: 429 with 30ms cooldown
          return new Response(
            JSON.stringify({ error: { message: 'try again in 30ms' } }),
            { status: 429, headers: { 'Content-Type': 'application/json', 'retry-after': '0.03' } }
          );
        }
      }

      return new Response(
        JSON.stringify({
          id: 'chat-rampup',
          model: body.model,
          choices: [{ index: 0, message: { role: 'assistant', content: 'Probe ok' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    // 1. Trigger 429 on model 1 -> fails over to model 2
    await poolManager.executeChatCompletion({
      apiKey: 'gsk_test',
      messages: [{ role: 'user', content: 'req 1' }],
      modelPool: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    });

    // Wait for cooldown to expire (>30ms)
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Next request should probe model 1 in 'recovering' mode
    const res2 = await poolManager.executeChatCompletion({
      apiKey: 'gsk_test',
      messages: [{ role: 'user', content: 'req 2 probe' }],
      modelPool: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    });

    expect(res2._poolMeta?.modelUsed).toBe('llama-3.3-70b-versatile');

    // After probe succeeded, model 1 should be fully 'available'
    const status = poolManager.getPoolStatus(['llama-3.3-70b-versatile']);
    expect(status[0].state).toBe('available');
    expect(status[0].consecutive429s).toBe(0);
  });

  it('fails fast on non-retryable 401 Unauthorized or 400 Bad Request', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          error: { message: 'Invalid API Key provided: gsk_invalid' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    });

    await expect(
      poolManager.executeChatCompletion({
        apiKey: 'gsk_invalid',
        messages: [{ role: 'user', content: 'hello' }],
        modelPool: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
      })
    ).rejects.toThrow(GroqNonRetryableError);

    // Verified only called once without wasteful retries
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('handles cancellation via AbortSignal cleanly', async () => {
    const controller = new AbortController();

    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      // Simulate slow response that aborts on signal
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        }, 500);

        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted by user', 'AbortError'));
          });
        }
      });
    });

    const promise = poolManager.executeChatCompletion({
      apiKey: 'gsk_test',
      messages: [{ role: 'user', content: 'cancel me' }],
      signal: controller.signal,
    });

    // Abort after 10ms
    setTimeout(() => controller.abort(), 10);

    await expect(promise).rejects.toThrow();
  });

  it('safely handles streaming interruption without duplicating content', async () => {
    const chunk1 = 'data: ' + JSON.stringify({ id: '1', model: 'm1', choices: [{ delta: { content: 'Xin chào ' } }] }) + '\n\n';
    const chunk2 = 'data: ' + JSON.stringify({ id: '2', model: 'm1', choices: [{ delta: { content: 'Việt Nam' } }] }) + '\n\n';

    let readCount = 0;
    const mockStream = new ReadableStream({
      pull(controller) {
        readCount++;
        const encoder = new TextEncoder();
        if (readCount === 1) {
          controller.enqueue(encoder.encode(chunk1));
        } else if (readCount === 2) {
          controller.enqueue(encoder.encode(chunk2));
        } else {
          // Mid-stream network error / 429 disconnect
          controller.error(new Error('Connection terminated mid-stream'));
        }
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(mockStream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
    );

    const receivedChunks: string[] = [];
    let caughtInterruptedError: GroqStreamInterruptedError | null = null;

    try {
      for await (const chunk of poolManager.streamChatCompletion({
        apiKey: 'gsk_test',
        messages: [{ role: 'user', content: 'stream' }],
        modelPool: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
      })) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) receivedChunks.push(text);
      }
    } catch (err: any) {
      if (err instanceof GroqStreamInterruptedError) {
        caughtInterruptedError = err;
      }
    }

    expect(receivedChunks).toEqual(['Xin chào ', 'Việt Nam']);
    expect(caughtInterruptedError).not.toBeNull();
    expect(caughtInterruptedError?.partialContent).toBe('Xin chào Việt Nam');
    expect(caughtInterruptedError?.reason).toContain('Connection terminated');
  });

  it('distributes requests among user reference models and verifies exact model ID in request body', async () => {
    const modelsCalled: string[] = [];
    const requestBodies: any[] = [];

    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      const parsedBody = JSON.parse(options.body);
      modelsCalled.push(parsedBody.model);
      requestBodies.push(parsedBody);
      return new Response(
        JSON.stringify({
          id: `chat-${Date.now()}`,
          model: parsedBody.model,
          choices: [{ index: 0, message: { role: 'assistant', content: '{"status":"ok"}' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const userPool = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b'];

    // Send 3 requests
    const res1 = await poolManager.executeChatCompletion({
      apiKey: 'gsk_live_test',
      messages: [{ role: 'user', content: 'req 1' }],
      modelPool: userPool,
    });

    const res2 = await poolManager.executeChatCompletion({
      apiKey: 'gsk_live_test',
      messages: [{ role: 'user', content: 'req 2' }],
      modelPool: userPool,
    });

    const res3 = await poolManager.executeChatCompletion({
      apiKey: 'gsk_live_test',
      messages: [{ role: 'user', content: 'req 3' }],
      modelPool: userPool,
    });

    // Verify round-robin sequence matches user pool
    expect(modelsCalled).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b']);

    // Verify the HTTP request payload strictly received the exact model ID (not aliases)
    expect(requestBodies[0].model).toBe('openai/gpt-oss-120b');
    expect(requestBodies[1].model).toBe('openai/gpt-oss-20b');
    expect(requestBodies[2].model).toBe('qwen/qwen3.6-27b');

    // Verify response meta
    expect(res1._poolMeta?.modelUsed).toBe('openai/gpt-oss-120b');
    expect(res2._poolMeta?.modelUsed).toBe('openai/gpt-oss-20b');
    expect(res3._poolMeta?.modelUsed).toBe('qwen/qwen3.6-27b');
  });

  it('filters out Compound models from JSON-mode requests to prevent 400 Bad Request', async () => {
    const modelsCalled: string[] = [];

    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      const parsedBody = JSON.parse(options.body);
      modelsCalled.push(parsedBody.model);
      return new Response(
        JSON.stringify({
          id: `chat-${Date.now()}`,
          model: parsedBody.model,
          choices: [{ index: 0, message: { role: 'assistant', content: '{"word":"example"}' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    // Pool contains both Compound and standard LLM models
    const mixedPool = ['groq/compound', 'openai/gpt-oss-120b'];

    const res = await poolManager.executeChatCompletion({
      apiKey: 'gsk_test',
      messages: [{ role: 'user', content: 'generate json' }],
      modelPool: mixedPool,
      response_format: { type: 'json_object' }, // LexiPulse vocabulary & morphology requirement
    });

    // Compound should be skipped because supportsJson === false
    expect(modelsCalled).toEqual(['openai/gpt-oss-120b']);
    expect(res._poolMeta?.modelUsed).toBe('openai/gpt-oss-120b');
  });

  it('marks model as unsupported and fails over immediately on HTTP 404 without endless retries', async () => {
    const modelsCalled: string[] = [];

    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      const parsedBody = JSON.parse(options.body);
      modelsCalled.push(parsedBody.model);

      if (parsedBody.model === 'openai/gpt-oss-120b') {
        return new Response(
          JSON.stringify({
            error: {
              message: 'The model `openai/gpt-oss-120b` does not exist or you do not have access to it.',
              type: 'invalid_request_error',
              code: 'model_not_found',
            },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Second model succeeds
      return new Response(
        JSON.stringify({
          id: `chat-${Date.now()}`,
          model: parsedBody.model,
          choices: [{ index: 0, message: { role: 'assistant', content: 'Success' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const res = await poolManager.executeChatCompletion({
      apiKey: 'gsk_test',
      messages: [{ role: 'user', content: 'test 404' }],
      modelPool: ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b'],
    });

    // First model returned 404 -> failed over to second model
    expect(modelsCalled).toEqual(['openai/gpt-oss-120b', 'qwen/qwen3.6-27b']);
    expect(res._poolMeta?.modelUsed).toBe('qwen/qwen3.6-27b');

    // Verify first model is now marked unsupported
    const poolStatus = poolManager.getPoolStatus(['openai/gpt-oss-120b', 'qwen/qwen3.6-27b']);
    const m1Status = poolStatus.find((m) => m.modelId === 'openai/gpt-oss-120b');
    expect(m1Status?.state).toBe('unsupported');

    // Next request should NOT retry openai/gpt-oss-120b, it should directly go to qwen/qwen3.6-27b
    modelsCalled.length = 0;
    const res2 = await poolManager.executeChatCompletion({
      apiKey: 'gsk_test',
      messages: [{ role: 'user', content: 'test follow-up' }],
      modelPool: ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b'],
    });

    expect(modelsCalled).toEqual(['qwen/qwen3.6-27b']);
    expect(res2._poolMeta?.modelUsed).toBe('qwen/qwen3.6-27b');
  });
});
