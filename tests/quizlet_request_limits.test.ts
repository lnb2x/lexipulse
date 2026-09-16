import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { server } from '../server/index';

let endpoint: string;
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/quizlet/fetch`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

it('rejects oversized JSON before launching a browser', async () => {
  const response = await fetch(endpoint, { method: 'POST', body: JSON.stringify({ url: 'x'.repeat(10000) }) });
  expect(response.status).toBe(413);
  expect(await response.json()).toMatchObject({ success: false, code: 'request_too_large' });
});

it('bounds concurrent incomplete uploads and releases admission on disconnect', async () => {
  const uploads = [0, 1].map(() => {
    const req = http.request(endpoint, { method: 'POST' });
    req.on('error', () => {}); req.write(' '); return req;
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    const busy = await fetch(endpoint, { method: 'POST', body: '{}' });
    expect(busy.status).toBe(503);
    expect(await busy.json()).toMatchObject({ code: 'server_busy' });
  } finally { uploads.forEach(req => req.destroy()); }
  await new Promise(resolve => setTimeout(resolve, 100));
  expect((await fetch(endpoint, { method: 'POST', body: '{}' })).status).toBe(400);
});
