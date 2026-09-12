import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseQuizletUrl,
  fetchQuizletSet,
  extractQuizletFromHtml,
} from '../src/services/quizlet/quizletParser';

describe('Quizlet URL Parsing & Direct Fetch Tests', () => {
  it('1. Correctly parses example Quizlet URL with tracking parameters and country code', () => {
    const rawUrl = 'https://quizlet.com/vn/1205742993/btvn-10-flash-cards/?i=4r9ygv&x=1jqt';
    const result = parseQuizletUrl(rawUrl);

    expect(result.isValid).toBe(true);
    expect(result.setId).toBe('1205742993');
    expect(result.slug).toBe('btvn-10-flash-cards');
    expect(result.title).toBe('Btvn 10 Flash Cards');
    // Clean URL preserves country prefix like /vn/ while stripping ?i=...&x=... tracking parameters
    expect(result.cleanUrl).toBe('https://quizlet.com/vn/1205742993/btvn-10-flash-cards/');
    expect(result.cleanUrl).not.toContain('?i=');
    expect(result.cleanUrl).not.toContain('&x=');
  });

  it('2. Parses standard Quizlet URLs without country code or trailing slash', () => {
    const url1 = 'https://quizlet.com/1205742993/ielts-vocabulary';
    const res1 = parseQuizletUrl(url1);
    expect(res1.isValid).toBe(true);
    expect(res1.setId).toBe('1205742993');
    expect(res1.title).toBe('Ielts Vocabulary');
    expect(res1.cleanUrl).toBe('https://quizlet.com/1205742993/ielts-vocabulary/');

    const url2 = 'https://www.quizlet.com/987654321';
    const res2 = parseQuizletUrl(url2);
    expect(res2.isValid).toBe(true);
    expect(res2.setId).toBe('987654321');
    expect(res2.cleanUrl).toBe('https://quizlet.com/987654321/');
  });

  it('3. Detects invalid URLs and non-Quizlet domains', () => {
    // Empty
    expect(parseQuizletUrl('').isValid).toBe(false);
    expect(parseQuizletUrl('   ').isValid).toBe(false);

    // Completely malformed
    expect(parseQuizletUrl('not-a-url').isValid).toBe(false);

    // Wrong domain
    const wrongDomain = parseQuizletUrl('https://example.com/1205742993/flashcards');
    expect(wrongDomain.isValid).toBe(false);
    expect(wrongDomain.error).toContain('quizlet.com');

    // Missing numeric set ID
    const missingId = parseQuizletUrl('https://quizlet.com/features/study-modes');
    expect(missingId.isValid).toBe(false);
    expect(missingId.error).toContain('ID');
  });

  describe('Direct fetch error handling & backend classification', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('4. Classifies backend offline / connection refused correctly', async () => {
      // Simulate backend endpoint down
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const res = await fetchQuizletSet(
        'https://quizlet.com/vn/1205742993/btvn-10-flash-cards/?i=4r9ygv&x=1jqt'
      );

      expect(res.success).toBe(false);
      expect(res.errorType).toBe('backend_offline');
      expect(res.terms).toBeUndefined();
      expect(res.cleanUrl).toBe('https://quizlet.com/vn/1205742993/btvn-10-flash-cards/');
      expect(res.message).toContain('kết nối');
    });

    it('5. Handles 404 Not Found cleanly without inventing data', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: false, code: 'not_found', error: 'Set not found' }),
      });

      const res = await fetchQuizletSet('https://quizlet.com/1205742993/deleted-set');
      expect(res.success).toBe(false);
      expect(res.errorType).toBe('not_found');
      expect(res.terms).toBeUndefined();
    });

    it('5b. Handles rate limiting (429) correctly', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: false, code: 'rate_limited', error: 'Too many requests' }),
      });

      const res = await fetchQuizletSet('https://quizlet.com/1205742993/busy-set');
      expect(res.success).toBe(false);
      expect(res.errorType).toBe('rate_limited');
      expect(res.message).toContain('429');
    });

    it('5c. Handles login required correctly without assuming generic CORS', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: false, code: 'login_required', error: 'Private set' }),
      });

      const res = await fetchQuizletSet('https://quizlet.com/1205742993/private-set');
      expect(res.success).toBe(false);
      expect(res.errorType).toBe('quizlet_login_required');
      expect(res.message).toContain('đăng nhập');
    });

    it('5d. Handles HTML response instead of JSON', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        text: () => Promise.resolve('<!DOCTYPE html><html>404 Not Found</html>'),
      });

      const res = await fetchQuizletSet('https://quizlet.com/1205742993/html-set');
      expect(res.success).toBe(false);
      expect(res.errorType).toBe('endpoint_not_found');
    });

    it('5e. Handles request abort signal cleanly', async () => {
      const controller = new AbortController();
      controller.abort();

      const res = await fetchQuizletSet('https://quizlet.com/1205742993/aborted-set', {
        signal: controller.signal,
      });
      expect(res.success).toBe(false);
      expect(res.errorType).toBe('aborted');
    });

    it('6. Extracts cards accurately when page HTML contains terms', () => {
      const mockHtml = `
        <html>
          <head>
            <title>BTVN 10 Vocabulary - Flashcards | Quizlet</title>
          </head>
          <body>
            <script id="__NEXT_DATA__" type="application/json">
              {
                "props": {
                  "pageProps": {
                    "set": {
                      "title": "BTVN 10 Vocabulary",
                      "terms": [
                        { "word": "negotiate", "definition": "đàm phán hợp đồng" },
                        { "word": "feasible", "definition": "khả thi" },
                        { "word": "collaborate", "definition": "hợp tác" }
                      ]
                    }
                  }
                }
              }
            </script>
          </body>
        </html>
      `;

      const extracted = extractQuizletFromHtml(mockHtml);
      expect(extracted.title).toBe('BTVN 10 Vocabulary');
      expect(extracted.terms).toHaveLength(3);
      expect(extracted.terms[0]).toEqual({
        term: 'negotiate',
        definition: 'đàm phán hợp đồng',
      });
      expect(extracted.terms[1]).toEqual({
        term: 'feasible',
        definition: 'khả thi',
      });
      expect(extracted.terms[2]).toEqual({
        term: 'collaborate',
        definition: 'hợp tác',
      });
    });

    it('7. Extracts cards from real Quizlet dehydratedReduxStateKey structure accurately', () => {
      const reduxState = {
        setPage: {
          set: {
            id: 1205742993,
            title: 'BTVN 10',
            numTerms: 3,
          },
        },
        studyModesCommon: {
          studiableData: {
            studiableItems: [
              {
                id: 1,
                isDeleted: false,
                cardSides: [
                  { label: 'word', media: [{ type: 1, plainText: 'detail' }] },
                  { label: 'definition', media: [{ type: 1, plainText: '/ˈdiːteɪl/ : chi tiết' }] },
                ],
              },
              {
                id: 2,
                isDeleted: false,
                cardSides: [
                  { label: 'word', media: [{ type: 1, plainText: 'rental company' }] },
                  { label: 'definition', media: [{ type: 1, plainText: '/ˈrentl ˈkʌmpəni/ : công ty cho thuê' }] },
                ],
              },
            ],
          },
        },
      };

      const mockRealHtml = `
        <html>
          <head><title>BTVN 10 Flashcards | Quizlet</title></head>
          <body>
            <script id="__NEXT_DATA__" type="application/json">
              {
                "props": {
                  "pageProps": {
                    "dehydratedReduxStateKey": ${JSON.stringify(JSON.stringify(reduxState))}
                  }
                }
              }
            </script>
          </body>
        </html>
      `;

      const extracted = extractQuizletFromHtml(mockRealHtml);
      expect(extracted.title).toBe('BTVN 10');
      expect(extracted.terms).toHaveLength(2);
      expect(extracted.terms[0]).toEqual({
        term: 'detail',
        definition: '/ˈdiːteɪl/ : chi tiết',
      });
      expect(extracted.terms[1]).toEqual({
        term: 'rental company',
        definition: '/ˈrentl ˈkʌmpəni/ : công ty cho thuê',
      });
    });

    it('8. Successfully uses backend /api/quizlet/fetch endpoint when available', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === '/api/quizlet/fetch') {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () =>
              Promise.resolve({
                success: true,
                title: 'BTVN 10',
                setId: '1205742993',
                cleanUrl: 'https://quizlet.com/vn/1205742993/btvn-10-flash-cards/',
                terms: [
                  { term: 'detail', definition: '/ˈdiːteɪl/ : chi tiết' },
                  { term: 'rental company', definition: '/ˈrentl ˈkʌmpəni/ : công ty cho thuê' },
                ],
              }),
          });
        }
        return Promise.reject(new TypeError('Failed to fetch'));
      });

      const res = await fetchQuizletSet(
        'https://quizlet.com/vn/1205742993/btvn-10-flash-cards/?i=4r9ygv&x=1jqt'
      );

      expect(res.success).toBe(true);
      expect(res.title).toBe('BTVN 10');
      expect(res.setId).toBe('1205742993');
      expect(res.terms).toHaveLength(2);
      expect(res.terms?.[0].term).toBe('detail');
    });
  });
});
