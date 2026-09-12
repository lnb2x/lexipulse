import http from 'http';
import { URL } from 'url';
import { scrapeQuizletWithPlaywright } from './quizletScraper.ts';

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
}

async function handleTranslate(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    let text = '';
    if (req.method === 'POST') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const bodyStr = Buffer.concat(chunks).toString('utf8');
      try {
        const parsed = JSON.parse(bodyStr);
        text = parsed.text || parsed.q || '';
      } catch {
        text = bodyStr;
      }
    } else {
      const parsedUrl = new URL(req.url || '', `http://${req.headers.host}`);
      text = parsedUrl.searchParams.get('q') || '';
    }

    if (!text || !text.trim()) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ text: '' }));
      return;
    }

    const response = await fetch(
      `https://translate.google.com/m?sl=en&tl=vi&q=${encodeURIComponent(text.trim())}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google Translate responded with ${response.status}`);
    }

    const html = await response.text();
    const match = html.match(/<div class="result-container">([\s\S]*?)<\/div>/i);
    const translated = match ? decodeHtmlEntities(match[1]) : '';

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ text: translated }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message, text: '' }));
  }
}

async function handleQuizletFetch(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const bodyStr = Buffer.concat(chunks).toString('utf8');
    let url = '';
    try {
      const parsed = JSON.parse(bodyStr);
      url = parsed.url || '';
    } catch {
      url = bodyStr;
    }

    if (typeof url !== 'string' || !url.trim()) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'URL không được để trống' }));
      return;
    }

    const result = await scrapeQuizletWithPlaywright(url.trim());

    res.setHeader('Content-Type', 'application/json');
    if (result.success) {
      res.statusCode = 200;
      res.end(JSON.stringify(result));
    } else {
      const status =
        result.code === 'invalid_url'
          ? 400
          : result.code === 'not_found'
          ? 404
          : result.code === 'rate_limited'
          ? 429
          : result.code === 'login_required'
          ? 403
          : 422;
      res.statusCode = status;
      res.end(JSON.stringify(result));
    }
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        code: 'server_error',
        error: err.message || 'Lỗi server khi trích xuất dữ liệu Quizlet',
      })
    );
  }
}

const server = http.createServer(async (req, res) => {
  // Enable CORS for local dev / cross-origin if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const reqUrl = req.url || '';
  if (reqUrl.startsWith('/api/quizlet/fetch')) {
    await handleQuizletFetch(req, res);
  } else if (reqUrl.startsWith('/api/translate')) {
    await handleTranslate(req, res);
  } else if (reqUrl === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', service: 'lexipulse-backend' }));
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '127.0.0.1';

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, HOST, () => {
    console.log(`[LexiPulse Backend] Standalone server listening at http://${HOST}:${PORT}`);
  });
}

export { server };
