import { createServer } from 'node:http';
import { createConnection, type AddressInfo, type Socket } from 'node:net';
import type { Duplex } from 'node:stream';
import { allowedUrl, resolvePublic } from './quizletNetwork.ts';

/** Keep Chromium's TLS/cookies while pinning connections to validated public IPs. */
export async function createQuizletBrowserProxy(signal: AbortSignal) {
  const sockets = new Set<Duplex>();
  let connections = 0;
  let bytes = 0;
  let violation: 'resource_limit' | undefined;
  const server = createServer((_req, res) => { res.writeHead(403); res.end(); });
  const closeSockets = () => { for (const socket of sockets) socket.destroy(); };
  server.on('connection', socket => {
    sockets.add(socket); socket.once('close', () => sockets.delete(socket));
    socket.on('error', () => {});
  });
  server.on('connect', async (req, client, head) => {
    let upstream: Socket | undefined;
    try {
      signal.throwIfAborted();
      if (++connections > 150) { violation = 'resource_limit'; throw new Error(violation); }
      if (!/^[a-z0-9.-]+:443$/i.test(req.url || '')) throw new Error('blocked_resource');
      const url = new URL(`https://${req.url}`);
      // Cloudflare's official challenge frame is only used by the visible browser.
      if (url.hostname !== 'challenges.cloudflare.com') allowedUrl(url.href);
      const addresses = await resolvePublic(url.hostname, AbortSignal.any([signal, AbortSignal.timeout(8000)]));
      signal.throwIfAborted();
      if (client.destroyed) return;
      upstream = createConnection({ host: addresses[0].address, port: 443 });
      sockets.add(upstream);
      upstream.once('close', () => { sockets.delete(upstream!); client.destroy(); });
      upstream.on('error', () => { client.destroy(); });
      client.once('close', () => upstream?.destroy());
      upstream.setTimeout(15000, () => upstream?.destroy());
      const count = (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 32 * 1024 * 1024) { violation = 'resource_limit'; closeSockets(); }
      };
      client.on('data', count); upstream.on('data', count);
      upstream.once('connect', () => {
        if (signal.aborted || client.destroyed) { upstream?.destroy(); return; }
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) { count(head); upstream!.write(head); }
        client.pipe(upstream!); upstream!.pipe(client);
      });
    } catch {
      upstream?.destroy();
      if (!client.destroyed) client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
  });
  const abort = () => { closeSockets(); server.close(); };
  const address = server.address() as AddressInfo;
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) { abort(); signal.throwIfAborted(); }
  return {
    url: `http://127.0.0.1:${address.port}`,
    get violation() { return violation; },
    close: async () => {
      signal.removeEventListener('abort', abort);
      closeSockets();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}
