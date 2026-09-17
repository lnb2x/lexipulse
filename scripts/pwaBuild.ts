import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/** Include every emitted route chunk, including nested lazy review modes. */
export function pwaPrecache(): Plugin {
  return {
    name: 'lexipulse-precache',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter(name => name.startsWith('assets/')).sort();
      const hash = createHash('sha256').update(readFileSync('public/sw.js'));
      for (const file of files) {
        const output = bundle[file];
        hash.update(output.type === 'chunk' ? output.code : output.source);
      }
      for (const file of ['index.html', 'public/manifest.json', 'public/favicon.svg']) hash.update(readFileSync(file));
      const manifest = { version: hash.digest('hex').slice(0, 20),
        urls: ['/', '/index.html', '/manifest.json', '/favicon.svg', ...files.map(file => `/${file}`)] };
      this.emitFile({ type: 'asset', fileName: 'sw-precache.js', source: `self.LEXIPULSE_PRECACHE = ${JSON.stringify(manifest)};\n` });
    },
  };
}
