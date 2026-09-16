import * as dns from 'node:dns/promises';
import * as https from 'node:https';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { createQuizletTransport } from '../server/quizletNetwork';

vi.mock('node:dns/promises', async original => ({ ...await original<object>(), lookup: vi.fn() }));
vi.mock('node:https', async original => ({ ...await original<object>(), request: vi.fn() }));

afterEach(() => vi.restoreAllMocks());
it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', '2001:db8::1'])
  ('rejects a private or reserved DNS answer %s before connecting', async address => {
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address, family: address.includes(':') ? 6 : 4 }] as never);
    const request = vi.spyOn(https, 'request');
    await expect(createQuizletTransport(new AbortController().signal)('https://quizlet.com/123456/fixture/')).rejects.toThrow('blocked_resource');
    expect(request).not.toHaveBeenCalled();
  });

it.each(['redirect', 'oversize', 'success'])('handles %s with pinned DNS and bounded responses', async scenario => {
  vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
  let pinned: unknown;
  const request = vi.spyOn(https, 'request').mockImplementation((_url, options, callback) => {
    options.lookup('quizlet.com', { all: true }, (_error, addresses) => { pinned = addresses; });
    const req = new EventEmitter();
    Object.assign(req, { end() {
      const res = Readable.from([Buffer.alloc(scenario === 'oversize' ? 8 * 1024 * 1024 + 1 : 2)]);
      Object.assign(res, { statusCode: scenario === 'redirect' ? 302 : 200,
        headers: scenario === 'redirect' ? { location: 'http://127.0.0.1/admin' } : {} });
      callback(res);
    } });
    return req as never;
  });
  const result = createQuizletTransport(new AbortController().signal)('https://quizlet.com/123456/fixture/');
  if (scenario === 'success') expect((await result).status).toBe(200);
  else await expect(result).rejects.toThrow(scenario === 'redirect' ? 'blocked_resource' : 'resource_limit');
  expect(pinned).toEqual([{ address: '93.184.216.34', family: 4 }]);
  expect(request).toHaveBeenCalledTimes(1);
});
