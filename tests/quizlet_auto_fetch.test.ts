import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchQuizletSet } from '../src/services/quizlet/quizletParser';
import { extractQuizletPayload } from '../server/quizletPayload';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Quizlet automatic import protocol', () => {
  it('polls verification progress until cards arrive and releases the job', async () => {
    vi.useFakeTimers();
    const progress = vi.fn();
    const network = vi.fn()
      .mockResolvedValueOnce(json({ requestId: 'job-1', progress: 'loading' }, 202))
      .mockResolvedValueOnce(json({ requestId: 'job-1', progress: 'verification_required' }, 202))
      .mockResolvedValueOnce(json({ success: true, terms: [{ term: 'store', definition: 'cửa hàng' }] }))
      .mockResolvedValueOnce(json({ code: 'aborted' }));
    vi.stubGlobal('fetch', network);
    const pending = fetchQuizletSet('https://quizlet.com/123/cards/', { onProgress: progress });
    await vi.advanceTimersByTimeAsync(1500);
    expect(await pending).toMatchObject({ success: true, terms: [{ term: 'store', definition: 'cửa hàng' }] });
    expect(progress.mock.calls).toEqual([['loading'], ['verification_required']]);
    expect(network.mock.calls.map(([url]) => url)).toEqual([
      '/api/quizlet/fetch', '/api/quizlet/status', '/api/quizlet/status', '/api/quizlet/cancel',
    ]);
  });

  it('cancels the server job immediately when the URL changes', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const network = vi.fn().mockResolvedValue(json({ requestId: 'job-2', progress: 'loading' }, 202));
    vi.stubGlobal('fetch', network);
    const pending = fetchQuizletSet('https://quizlet.com/123/cards/', { signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    expect(await pending).toMatchObject({ success: false, errorType: 'aborted' });
    expect(network.mock.calls.at(-1)?.[0]).toBe('/api/quizlet/cancel');
    expect(network).toHaveBeenCalledTimes(2);
  });

  it('cleans up a stalled verification job on timeout', async () => {
    vi.useFakeTimers();
    const network = vi.fn().mockResolvedValue(json({ requestId: 'job-3', progress: 'verification_required' }, 202));
    vi.stubGlobal('fetch', network);
    const pending = fetchQuizletSet('https://quizlet.com/123/cards/', { timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toMatchObject({ success: false, errorType: 'timeout' });
    expect(network.mock.calls.at(-1)?.[0]).toBe('/api/quizlet/cancel');
  });
});

describe('Quizlet payload integrity', () => {
  const payload = (id = 123) => ({ props: { pageProps: { dehydratedReduxStateKey: JSON.stringify({
    setPage: { set: { id, title: 'Requested set', numTerms: 2 } },
    studyModesCommon: { studiableData: { studiableItems: [
      { cardSides: [{ label: 'definition', media: [{ type: 1, plainText: ' cửa hàng ' }] }, { label: 'word', media: [{ type: 1, plainText: 'store' }] }] },
      { isDeleted: true, cardSides: [{ media: [{ type: 1, plainText: 'deleted' }] }] },
      { setId: 999, cardSides: [{ media: [{ type: 1, plainText: 'unrelated' }] }] },
    ] } },
  }) } } });
  it('reads word sides by label and reports the expected count to detect partial imports', () => {
    expect(extractQuizletPayload(payload(), '123')).toEqual({ title: 'Requested set', expectedCount: 2, terms: [{ term: 'store', definition: 'cửa hàng' }] });
  });
  it('rejects a payload for a different set', () => {
    expect(extractQuizletPayload(payload(999), '123')).toEqual({ terms: [] });
  });
  it.each([
    [1, 20001], [10001, 1], [106, 20000],
  ])('rejects oversized extracted sets without returning partial cards (%i cards, %i characters)', (count, length) => {
    const data = { props: { pageProps: { dehydratedReduxStateKey: {
      setPage: { set: { id: 123 } },
      studyModesCommon: { studiableData: { studiableItems: Array.from({ length: count }, () => ({
        cardSides: [{ label: 'word', media: [{ type: 1, plainText: 'x'.repeat(length) }] }],
      })) } },
    } } } };
    expect(() => extractQuizletPayload(data, '123')).toThrow('resource_limit');
  });
});
