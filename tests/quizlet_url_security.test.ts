import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { server } from '../server/index';
import { normalizeQuizletUrl } from '../server/quizletUrl';
import { parseQuizletUrl } from '../src/services/quizlet/quizletParser';

const invalidUrls = [
  'https://quizlet.com.evil.example/123456/cards',
  'https://notquizlet.com/123456/cards',
  'https://quizlet.com@127.0.0.1/123456/cards',
  'https://user:password@quizlet.com/123456/cards',
  'https://quizlet.com:8443/123456/cards',
  'file:///123456/cards',
  'http://127.0.0.1/123456/cards',
  'https://quizlet.com/unrelated/path/123456/cards',
  'https://quizlet.com/123456/%E0%A4%A',
];

describe('Quizlet URL trust boundary', () => {
  it.each(invalidUrls)('rejects unsafe or malformed input: %s', (url) => {
    expect(normalizeQuizletUrl(url)).toBeNull();
    expect(parseQuizletUrl(url).isValid).toBe(false);
  });

  it('keeps valid set paths and removes tracking', () => {
    expect(normalizeQuizletUrl('https://www.quizlet.com/vn/123456/my-cards/?i=abc#top'))
      .toBe('https://www.quizlet.com/vn/123456/my-cards/');
    expect(parseQuizletUrl('quizlet.com/123456/my%20cards').cleanUrl)
      .toBe('https://quizlet.com/123456/my%20cards/');
  });

  it.each([null, undefined, 42, {}, [], ''])('rejects non-URL API values: %j', (value) => {
    expect(normalizeQuizletUrl(value)).toBeNull();
  });
});

describe('Standalone backend input validation', () => {
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it('serves a health response without external services', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', service: 'lexipulse-backend' });
  });

  it.each([42, {}, 'http://127.0.0.1/123456/cards', 'https://quizlet.com.evil.example/123456/cards'])
    ('returns 400 for invalid URLs before launching Chromium: %j', async (url) => {
      const response = await fetch(`${baseUrl}/api/quizlet/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ success: false });
    });
});
