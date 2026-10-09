import { request } from 'node:http';
import * as dns from 'node:dns/promises';
import { afterEach, expect, it, vi } from 'vitest';
import { createQuizletBrowserProxy } from '../server/quizletBrowserProxy';

vi.mock('node:dns/promises', async original => ({ ...await original<object>(), lookup: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
async function connect(proxy: string, target: string) {
  const address = new URL(proxy);
  return new Promise<number>((resolve, reject) => {
    const req = request({ hostname: address.hostname, port: address.port, method: 'CONNECT', path: target });
    req.on('connect', (response, socket) => { socket.destroy(); resolve(response.statusCode!); });
    req.on('error', reject); req.end();
  });
}

it.each(['127.0.0.1:443', 'localhost:443', 'evil.example:443', 'quizlet.com:80', 'quizlet.com:443/other'])
  ('rejects an untrusted tunnel target without DNS lookup: %s', async target => {
    const lookup = vi.spyOn(dns, 'lookup');
    const proxy = await createQuizletBrowserProxy(new AbortController().signal);
    try { expect(await connect(proxy.url, target)).toBe(403); expect(lookup).not.toHaveBeenCalled(); }
    finally { await proxy.close(); }
  });

it.each(['127.0.0.1', '10.0.0.2', '::1', '::ffff:127.0.0.1'])
  ('rejects Quizlet DNS rebinding to a private address: %s', async address => {
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address, family: address.includes(':') ? 6 : 4 }] as never);
    const proxy = await createQuizletBrowserProxy(new AbortController().signal);
    try { expect(await connect(proxy.url, 'quizlet.com:443')).toBe(403); }
    finally { await proxy.close(); }
  });

it('bounds the number of browser tunnels in a job', async () => {
  const proxy = await createQuizletBrowserProxy(new AbortController().signal);
  try {
    for (let index = 0; index < 151; index++) await connect(proxy.url, 'evil.example:443');
    expect(proxy.violation).toBe('resource_limit');
  } finally { await proxy.close(); }
});
