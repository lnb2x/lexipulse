// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readQuizletPage } from '../public/quizlet-bridge/extractor.js';

beforeEach(() => {
  vi.stubGlobal('location', { protocol: 'https:', hostname: 'quizlet.com', pathname: '/vn/123456/fixture/', origin: 'https://quizlet.com' });
  document.head.innerHTML = '<title>Fixture | Quizlet</title>';
  document.body.innerHTML = '';
});
afterEach(() => vi.unstubAllGlobals());
const payload = (count: number, expected = count, id: number | string = 123456) => {
  const script = document.createElement('script');
  script.id = '__NEXT_DATA__';
  script.type = 'application/json';
  script.textContent = JSON.stringify({ props: { pageProps: { dehydratedReduxStateKey: JSON.stringify({
    setPage: { set: { id, title: 'Bộ kiểm thử', numTerms: expected } },
    studyModesCommon: { studiableData: { studiableItems: Array.from({ length: count }, (_, i) => ({ cardSides: [
      { label: 'definition', media: [{ type: 1, plainText: `nghĩa ${i}` }] },
      { label: 'word', media: [{ type: 1, plainText: `term ${i}` }] },
    ] })) } },
  }) } } });
  document.body.append(script);
};

it('extracts the requested full payload and retains card order and Vietnamese text', () => {
  payload(2);
  expect(readQuizletPage('123456')).toMatchObject({ state: 'success', result: {
    setId: '123456', title: 'Bộ kiểm thử', source: 'payload',
    terms: [{ term: 'term 0', definition: 'nghĩa 0' }, { term: 'term 1', definition: 'nghĩa 1' }],
  } });
});
it('does not silently return a partially loaded set', () => {
  payload(2, 40);
  expect(readQuizletPage('123456')).toEqual({ state: 'waiting', status: 'more_cards' });
});
it('rejects a payload belonging to another set', () => {
  payload(2, 2, 999999);
  expect(readQuizletPage('123456')).toEqual({ state: 'error', code: 'invalid_url' });
});
it('rejects oversized sets instead of truncating them', () => {
  payload(10001);
  expect(readQuizletPage('123456')).toEqual({ state: 'error', code: 'resource_limit' });
});
it.each(['Captcha Challenge…', 'One more step…', 'Access to this page has been denied'])('waits without interacting on %s', title => {
  document.title = title;
  payload(2);
  expect(readQuizletPage('123456')).toEqual({ state: 'waiting', status: 'verification' });
});
it('resumes reading when the user has completed verification', () => {
  document.body.innerHTML = '<div id="px-captcha"></div>';
  expect(readQuizletPage('123456')).toEqual({ state: 'waiting', status: 'verification' });
  document.body.innerHTML = '';
  payload(1);
  expect(readQuizletPage('123456').state).toBe('success');
});
it('reads paired DOM rows without mistaking ordinary words for a challenge', () => {
  document.title = 'Captcha challenge vocabulary | Quizlet';
  document.body.innerHTML = '<div class="SetPageTerm"><span class="SetPageTerm-wordText">captcha</span><span class="SetPageTerm-definitionText">xác minh</span></div>';
  expect(readQuizletPage('123456')).toMatchObject({ state: 'success', result: {
    source: 'dom', terms: [{ term: 'captcha', definition: 'xác minh' }],
  } });
});
it('waits for user login', () => {
  document.body.innerHTML = '<form action="/login"></form>';
  expect(readQuizletPage('123456')).toEqual({ state: 'waiting', status: 'login' });
});
