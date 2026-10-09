import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
const { scrape } = vi.hoisted(() => ({ scrape: vi.fn() }));
vi.mock('../server/quizletDesktop.ts', () => ({ scrapeQuizletOnDesktop: scrape }));
import { server } from '../server/index';

describe('Quizlet backend import jobs', () => {
  let baseUrl: string;
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
  beforeEach(() => { scrape.mockReset(); });
  const post = (route: string, body: unknown) => fetch(`${baseUrl}/api/quizlet/${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  it('returns progress promptly, then cards through polling and releases the job', async () => {
    let finish!: (value: unknown) => void;
    scrape.mockImplementation((_url, options) => {
      options.onProgress('verification_required');
      return new Promise((resolve) => { finish = resolve; });
    });
    const start = await post('fetch', { url: 'https://quizlet.com/123/cards/', async: true });
    expect(start.status).toBe(202);
    const { requestId } = await start.json();
    const progress = await post('status', { requestId });
    expect(progress.status).toBe(202);
    expect(await progress.json()).toMatchObject({ progress: 'verification_required' });
    finish({ success: true, terms: [{ term: 'store', definition: 'cửa hàng' }] });
    const completed = await post('status', { requestId });
    expect(completed.status).toBe(200);
    expect(await completed.json()).toMatchObject({ success: true, terms: [{ term: 'store', definition: 'cửa hàng' }] });
    await post('cancel', { requestId });
    expect((await post('status', { requestId })).status).toBe(404);
    const repeated = await post('fetch', { url: 'https://quizlet.com/123/cards/', async: true });
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toMatchObject({ success: true });
    expect(scrape).toHaveBeenCalledOnce();
  });

  it('propagates cancellation to the scraper', async () => {
    let signal!: AbortSignal;
    scrape.mockImplementation((_url, options) => {
      signal = options.signal;
      return new Promise((resolve) => signal.addEventListener('abort', () => resolve({ success: false, code: 'aborted' })));
    });
    const start = await post('fetch', { url: 'https://quizlet.com/456/cards/', async: true });
    const { requestId } = await start.json();
    expect(signal.aborted).toBe(false);
    expect((await post('cancel', { requestId })).status).toBe(200);
    expect(signal.aborted).toBe(true);
  });

  it('holds capacity until canceled browsers finish cleanup', async () => {
    const finishers: ((value: unknown) => void)[] = [];
    scrape.mockImplementation(() => new Promise(resolve => finishers.push(resolve)));
    const first = await post('fetch', { url: 'https://quizlet.com/789/cards/', async: true });
    const second = await post('fetch', { url: 'https://quizlet.com/790/cards/', async: true });
    const firstJob = await first.json(); const secondJob = await second.json();
    await post('cancel', { requestId: firstJob.requestId });
    await post('cancel', { requestId: secondJob.requestId });
    expect((await post('fetch', { url: 'https://quizlet.com/791/cards/', async: true })).status).toBe(503);
    finishers.forEach(finish => finish({ success: false, code: 'aborted' }));
    await post('status', { requestId: firstJob.requestId });
    const third = await post('fetch', { url: 'https://quizlet.com/791/cards/', async: true });
    expect(third.status).toBe(202);
    const thirdJob = await third.json();
    finishers[2]({ success: false, code: 'aborted' });
    await post('cancel', { requestId: thirdJob.requestId });
  });

  it.each([null, [], { url: 'https://quizlet.com.evil.example/123/cards/', async: true }])('rejects malformed requests before starting the browser: %j', async (body) => {
    expect((await post('fetch', body)).status).toBe(400);
    expect(scrape).not.toHaveBeenCalled();
  });
});
