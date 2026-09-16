import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';

const HOSTS = new Set(['quizlet.com', 'www.quizlet.com', 'assets.quizlet.com', 'quizletstatic.com', 'assets.quizletstatic.com']);
const privateIPs = new BlockList();
for (const [ip, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]] as const) privateIPs.addSubnet(ip, bits);
const globalV6 = new BlockList(); globalV6.addSubnet('2000::', 3, 'ipv6');
privateIPs.addSubnet('2001::', 23, 'ipv6');
privateIPs.addSubnet('2001:db8::', 32, 'ipv6');
privateIPs.addSubnet('2002::', 16, 'ipv6');

function allowedUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !HOSTS.has(url.hostname) || url.port || url.username || url.password) throw new Error('blocked_resource');
  return url;
}

async function resolvePublic(host: string, signal: AbortSignal) {
  signal.throwIfAborted();
  let abort!: () => void;
  try {
    const addresses = await Promise.race([lookup(host, { all: true }), new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true });
    })]);
    if (!addresses.length || addresses.some(({ address }) => {
      const family = isIP(address);
      return family === 4 ? privateIPs.check(address) : family !== 6
        || !globalV6.check(address, 'ipv6') || privateIPs.check(address, 'ipv6');
    })) throw new Error('blocked_resource');
    return addresses;
  } finally { signal.removeEventListener('abort', abort); }
}

/** Each job owns a bounded transport; DNS is pinned on the TLS socket to prevent rebinding. */
export function createQuizletTransport(parentSignal: AbortSignal) {
  let requests = 0;
  let totalBytes = 0;
  return async function load(raw: string, redirects = 0): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
    if (++requests > 150 || redirects > 3) throw new Error('resource_limit');
    const url = allowedUrl(raw);
    const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(8000)]);
    const addresses = await resolvePublic(url.hostname, signal);
    const pinnedLookup: LookupFunction = (_host, options, callback) => {
      const address = addresses.find(a => !options.family || a.family === options.family) ?? addresses[0];
      if (options.all) callback(null, addresses);
      else callback(null, address.address, address.family);
    };
    const result = await new Promise<{ status: number; location?: string; headers: Record<string, string>; body: Buffer }>((resolve, reject) => {
      const req = request(url, { lookup: pinnedLookup, signal, agent: false,
        headers: { 'Accept-Encoding': 'identity', 'User-Agent': 'Mozilla/5.0 LexiPulse/1.0', Accept: '*/*' } }, res => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on('error', reject);
        if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') {
          res.destroy(new Error('resource_limit')); return;
        }
        res.on('data', (chunk: Buffer) => {
          bytes += chunk.length; totalBytes += chunk.length;
          if (bytes > 8 * 1024 * 1024 || totalBytes > 32 * 1024 * 1024) { res.destroy(new Error('resource_limit')); return; }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 502, location: res.headers.location,
          headers: { 'content-type': res.headers['content-type'] ?? 'application/octet-stream' }, body: Buffer.concat(chunks) }));
      });
      req.on('error', reject); req.end();
    });
    if (result.status >= 300 && result.status < 400 && result.location) {
      return load(new URL(result.location, url).href, redirects + 1);
    }
    return result;
  };
}
