import { randomUUID } from 'node:crypto';
import { scrapeQuizletOnDesktop } from './quizletDesktop.ts';
import { scrapeQuizletWithPlaywright, type ScrapedQuizletResult } from './quizletScraper.ts';

interface Job {
  controller: AbortController;
  progress: 'loading' | 'verification_required';
  result?: ScrapedQuizletResult;
}
const jobs = new Map<string, Job>();
let activeTasks = 0;
const cache = new Map<string, { savedAt: number; result: ScrapedQuizletResult }>();
export const quizletResultStatus = (result: ScrapedQuizletResult) => result.success ? 200 : result.code === 'timeout' ? 504
  : result.code === 'not_found' ? 404 : result.code === 'rate_limited' ? 429 : result.code === 'login_required' ? 403 : 422;

export function beginQuizletJob(url: string, localDesktop: boolean) {
  const setId = new URL(url).pathname.match(/\d+/)![0];
  const cached = cache.get(setId);
  if (cached && Date.now() - cached.savedAt < 15 * 60 * 1000) return { status: 200, body: { ...cached.result, cleanUrl: url } };
  if (activeTasks >= 2 || jobs.size >= 8) {
    return { status: 503, body: { success: false, code: 'server_busy' } };
  }
  const requestId = randomUUID();
  const job: Job = { controller: new AbortController(), progress: 'loading' };
  jobs.set(requestId, job);
  activeTasks++;
  const timeout = setTimeout(() => job.controller.abort(), 150000); timeout.unref();
  const desktop = localDesktop && (process.platform === 'win32' || process.platform === 'darwin' || !!process.env.DISPLAY);
  const task = desktop ? scrapeQuizletOnDesktop(url, {
    signal: job.controller.signal, onProgress: progress => { job.progress = progress; },
  }) : scrapeQuizletWithPlaywright(url, { signal: job.controller.signal });
  void task.then(result => {
    job.result = result;
    if (!job.controller.signal.aborted && result.success && result.terms?.length) {
      if (cache.size >= 32) cache.delete(cache.keys().next().value!);
      cache.set(setId, { savedAt: Date.now(), result });
    }
  }).catch(() => { job.result = { success: false, code: 'server_error' }; }).finally(() => { activeTasks--; clearTimeout(timeout); });
  const expiry = setTimeout(() => { job.controller.abort(); jobs.delete(requestId); }, 300000); expiry.unref();
  return { status: 202, body: { success: false, requestId, progress: job.progress } };
}

export function inspectQuizletJob(requestId: unknown, cancel = false) {
  const job = typeof requestId === 'string' ? jobs.get(requestId) : undefined;
  if (!job) return { status: 404, body: { success: false, code: 'server_error', error: 'Phiên tải đã kết thúc. Dán link để tải lại.' } };
  if (cancel) {
    job.controller.abort(); jobs.delete(requestId as string);
    return { status: 200, body: { success: false, code: 'aborted' } };
  }
  if (job.result) return { status: quizletResultStatus(job.result), body: job.result };
  return { status: 202, body: { success: false, requestId, progress: job.progress } };
}
