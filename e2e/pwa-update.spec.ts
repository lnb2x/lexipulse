import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

test('update waits for consent and preserves an active review in another tab', async ({ context }) => {
  let release = 'A';
  const root = path.resolve('dist');
  const server = createServer((req, res) => {
    const pathname = new URL(req.url!, 'http://localhost').pathname;
    res.setHeader('Cache-Control', 'no-store');
    if (pathname.startsWith('/assets/legacy-')) {
      if (pathname === `/assets/legacy-${release}.js`) res.end(release);
      else { res.statusCode = 404; res.end(); } return;
    }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.statusCode = 404; res.end(); return; }
    try {
      let content = readFileSync(file);
      if (pathname === '/sw.js') content = Buffer.from(`// fixture ${release}\n${content}`);
      if (pathname === '/sw-precache.js') {
        const manifest = JSON.parse(content.toString().replace(/^self.LEXIPULSE_PRECACHE = /, '').replace(/;\s*$/, ''));
        manifest.version = `fixture-${release}`; manifest.urls.push(`/assets/legacy-${release}.js`);
        content = Buffer.from(`self.LEXIPULSE_PRECACHE = ${JSON.stringify(manifest)};`);
      }
      if (file.endsWith('index.html')) content = Buffer.from(content.toString().replace('<head>', `<head><meta name="fixture-release" content="${release}">`));
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : file.endsWith('.json') ? 'application/json' : 'image/svg+xml');
      res.end(content);
    } catch { res.statusCode = 404; res.end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await context.addInitScript(() => localStorage.setItem('lexipulse_ui_language', 'en'));
  const first = await context.newPage(); const second = await context.newPage();
  try {
    await first.goto(url);
    await first.evaluate(async () => { await navigator.serviceWorker.ready; });
    await first.waitForFunction(() => !!navigator.serviceWorker.controller);
    await second.goto(url);
    await second.evaluate(async () => {
      (window as any).__reviewMarker = 'keep';
      await caches.open('unrelated-app');
      await (window as any).__db.words.put({ id: 'update-card', word: 'resilience', pos: [], phonetics: {},
        vietnameseDefinition: 'kiên cường', meanings: [], collocations: [], examples: [], wordFamily: [], tags: [],
        createdAt: Date.now(), updatedAt: Date.now(), status: 'learning',
        reviewMeta: { repetition: 1, interval: 1, easeFactor: 2.5, dueDate: Date.now() - 1000, lastReviewedDate: null, history: [] } });
    });
    await second.getByRole('tab', { name: /Review/i }).click();
    await second.getByRole('button', { name: /Review 1 Cards Due Today/i }).click();
    await expect(second.getByText('Front Card')).toBeVisible();
    release = 'B';
    await first.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
    await expect.poll(() => first.evaluate(async () => !!(await navigator.serviceWorker.ready).waiting)).toBe(true);
    await expect(first.locator('meta[name="fixture-release"]')).toHaveAttribute('content', 'A');
    await expect(second.getByRole('button', { name: 'Reload to update' })).toBeDisabled();
    await first.getByRole('button', { name: 'Reload to update' }).click();
    await expect(first.locator('meta[name="fixture-release"]')).toHaveAttribute('content', 'B');
    expect(await second.evaluate(() => (window as any).__reviewMarker)).toBe('keep');
    expect(await second.evaluate(() => caches.has('unrelated-app'))).toBe(true);
    await context.setOffline(true);
    expect(await second.evaluate(async () => (await fetch('/assets/legacy-A.js')).text())).toBe('A');
    await second.keyboard.press('Space');
    await second.getByRole('button', { name: /Good.*3/i }).click();
    await expect.poll(() => second.evaluate(async () => (await (window as any).__db.words.get('update-card')).reviewMeta.history.length)).toBe(1);
  } finally {
    await context.setOffline(false); await first.close(); await second.close();
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
