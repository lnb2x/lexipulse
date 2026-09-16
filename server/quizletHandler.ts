import type { IncomingMessage, ServerResponse } from 'node:http';
import { normalizeQuizletUrl } from './quizletUrl.ts';
import { scrapeQuizletWithPlaywright } from './quizletScraper.ts';

const MAX_BODY_BYTES = 8192;
let activeRequests = 0;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    const finish = (error?: Error) => {
      clearTimeout(timer);
      req.off('data', onData); req.off('end', onEnd); req.off('aborted', onAbort); req.off('error', finish);
      if (error) { req.resume(); reject(error); }
      else resolve(Buffer.concat(chunks).toString('utf8'));
    };
    const onData = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) finish(new Error('request_too_large'));
      else chunks.push(chunk);
    };
    const onEnd = () => finish();
    const onAbort = () => finish(new Error('aborted'));
    const timer = setTimeout(() => finish(new Error('timeout')), 5000);
    req.on('data', onData); req.once('end', onEnd); req.once('aborted', onAbort); req.once('error', finish);
  });
}

export async function handleQuizletFetch(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const send = (status: number, body: object) => {
    if (res.destroyed) return;
    res.writeHead(status, { 'Content-Type': 'application/json', 'Connection': 'close' });
    res.end(JSON.stringify(body));
  };
  const fail = (status: number, code: string) => send(status, { success: false, code });
  if (req.method !== 'POST') { fail(405, 'method_not_allowed'); return; }
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) { fail(413, 'request_too_large'); return; }
  if (activeRequests >= 2) { res.setHeader('Retry-After', '5'); fail(503, 'server_busy'); return; }
  activeRequests++;
  try {
    const body = await readBody(req);
    let input: unknown = body;
    try { input = JSON.parse(body)?.url; } catch { /* Accept a plain URL for compatibility. */ }
    const url = normalizeQuizletUrl(input);
    if (!url) { fail(400, 'invalid_url'); return; }
    const result = await scrapeQuizletWithPlaywright(url);
    const status = result.success ? 200 : result.code === 'not_found' ? 404
      : result.code === 'rate_limited' ? 429 : result.code === 'login_required' ? 403 : 422;
    send(status, result);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'request_too_large') fail(413, code);
    else if (code === 'timeout') fail(408, code);
    else fail(500, 'server_error');
  } finally { activeRequests--; }
}
