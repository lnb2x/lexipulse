import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

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

function translationPlugin(): Plugin {
  return {
    name: 'translation-middleware',
    configureServer(server) {
      server.middlewares.use('/api/translate', async (req, res) => {
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
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            text = url.searchParams.get('q') || '';
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
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), translationPlugin()],
})
