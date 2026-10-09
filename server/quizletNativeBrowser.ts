import { spawn } from 'node:child_process';
import { createServer, type AddressInfo } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, type Browser } from '@playwright/test';

/** Open the installed browser normally; CDP is local and lives only for this import. */
export async function openQuizletBrowser(executablePath: string, profile: string, proxy: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const reservation = createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve);
  });
  const port = (reservation.address() as AddressInfo).port;
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  signal?.throwIfAborted();
  const child = spawn(executablePath, [
    `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
    `--proxy-server=${proxy}`, '--proxy-bypass-list=<-loopback>', '--disable-quic',
    '--no-first-run', '--no-default-browser-check',
    ...(process.platform === 'win32' ? ['--start-minimized'] : []), 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  let launchError: Error | undefined;
  child.once('error', error => { launchError = error; });
  let browser: Browser | undefined;
  let closing: Promise<void> | undefined;
  const close = () => closing ||= (async () => {
    if (browser?.isConnected()) {
      try {
        const session = await browser.newBrowserCDPSession();
        await session.send('Browser.close');
      } catch { /* The browser may have been closed by the user. */ }
      await browser.close().catch(() => {});
    }
    if (child.exitCode === null) child.kill();
  })();
  const abort = () => { void close(); };
  signal?.addEventListener('abort', abort, { once: true });
  const deadline = Date.now() + 15000;
  try {
    while (!browser && Date.now() < deadline) {
      signal?.throwIfAborted();
      if (launchError) throw launchError;
      if (child.exitCode !== null) throw new Error('browser_closed');
      try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1000 }); }
      catch { await delay(250, undefined, { signal }); }
    }
    if (!browser) throw new Error('browser_launch_timeout');
    signal?.throwIfAborted();
    const context = browser.contexts()[0];
    if (!context) throw new Error('browser_context_missing');
    return { context, close: async () => { signal?.removeEventListener('abort', abort); await close(); } };
  } catch (error) {
    signal?.removeEventListener('abort', abort); await close(); throw error;
  }
}
