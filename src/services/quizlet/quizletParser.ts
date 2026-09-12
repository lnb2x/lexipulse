import type { QuizletCardItem } from '../../types/vocab';

export interface ParsedQuizletUrl {
  isValid: boolean;
  setId: string | null;
  slug: string | null;
  title: string | null;
  cleanUrl: string | null;
  error?: string;
}

export type FetchQuizletErrorType =
  | 'invalid_url'
  | 'backend_offline'
  | 'endpoint_not_found'
  | 'server_error'
  | 'timeout'
  | 'rate_limited'
  | 'quizlet_login_required'
  | 'challenge_blocked'
  | 'no_terms_found'
  | 'cors_or_protected'
  | 'network_error'
  | 'aborted';

export interface FetchQuizletResult {
  success: boolean;
  title?: string;
  setId?: string;
  cleanUrl?: string;
  terms?: QuizletCardItem[];
  errorType?: FetchQuizletErrorType;
  message?: string;
  diagnostics?: string;
}

export interface ParseQuizletExportResult {
  cards: QuizletCardItem[];
  totalLines: number;
  skippedEmpty: number;
}

/**
 * Humanizes slug string (e.g. "btvn-10-flash-cards" -> "BTVN 10 Flash Cards")
 */
export function humanizeSlug(slug: string): string {
  if (!slug) return '';
  return slug
    .split(/[-_]+/)
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .trim();
}

/**
 * Validates and extracts Quizlet Set ID, Slug, and Clean URL without tracking parameters.
 * Example: https://quizlet.com/vn/1205742993/btvn-10-flash-cards/?i=4r9ygv&x=1jqt
 * -> setId: "1205742993", slug: "btvn-10-flash-cards", cleanUrl: "https://quizlet.com/1205742993/btvn-10-flash-cards/"
 */
export function parseQuizletUrl(rawUrl: string): ParsedQuizletUrl {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      isValid: false,
      setId: null,
      slug: null,
      title: null,
      cleanUrl: null,
      error: 'URL không được để trống.',
    };
  }

  const trimmed = rawUrl.trim();
  // Ensure url has protocol for parsing
  const urlWithProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(urlWithProto);
  } catch {
    return {
      isValid: false,
      setId: null,
      slug: null,
      title: null,
      cleanUrl: null,
      error: 'URL không hợp lệ. Vui lòng kiểm tra lại định dạng liên kết.',
    };
  }

  // Only accept the public Quizlet website, not lookalike domains.
  const hostname = parsed.hostname.toLowerCase();
  if (
    !['quizlet.com', 'www.quizlet.com'].includes(hostname) ||
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username || parsed.password || parsed.port
  ) {
    return {
      isValid: false,
      setId: null,
      slug: null,
      title: null,
      cleanUrl: null,
      error: 'Liên kết không thuộc Quizlet. Vui lòng nhập URL từ trang quizlet.com.',
    };
  }

  // Path format: optional /[country-code]/ then set-id, then optional slug
  // e.g. /vn/1205742993/btvn-10-flash-cards/ or /1205742993/btvn-10-flash-cards or /1205742993
  const pathname = parsed.pathname;
  const match = pathname.match(/^(?:\/([a-z]{2}(?:-[a-z]{2})?))?\/(\d+)(?:\/([^/?#]+))?\/?$/i);

  if (!match || !match[2]) {
    return {
      isValid: false,
      setId: null,
      slug: null,
      title: null,
      cleanUrl: null,
      error: 'Không tìm thấy ID bộ từ hợp lệ trong đường dẫn Quizlet (ID gồm các chữ số).',
    };
  }

  const setId = match[2];
  let slug: string | null = null;
  try {
    slug = match[3] ? decodeURIComponent(match[3]).trim() : null;
  } catch {
    return {
      isValid: false, setId: null, slug: null, title: null, cleanUrl: null,
      error: 'URL không hợp lệ. Vui lòng kiểm tra lại định dạng liên kết.',
    };
  }
  // If slug is just 'flash-cards' or 'flashcards', keep as is
  if (slug && slug.endsWith('/')) {
    slug = slug.slice(0, -1);
  }

  const countryPrefix = match[1] ? `/${match[1].toLowerCase()}` : '';
  const humanTitle = slug ? humanizeSlug(slug) : `Bộ thẻ Quizlet #${setId}`;
  const cleanUrl = slug
    ? `https://quizlet.com${countryPrefix}/${setId}/${encodeURIComponent(slug)}/`
    : `https://quizlet.com${countryPrefix}/${setId}/`;

  return {
    isValid: true,
    setId,
    slug,
    title: humanTitle,
    cleanUrl,
  };
}

/**
 * Strips leading numbering or bullet prefixes:
 * e.g. "1. ", "2) ", "- ", "• ", "* "
 */
function stripBulletPrefix(str: string): string {
  return str
    .replace(/^[\d]+[.)]\s+/, '')
    .replace(/^[-*•]\s+/, '')
    .trim();
}

/**
 * Parses Quizlet exported text.
 * Default Quizlet export format is:
 * Term [TAB] Definition per row.
 * Also supports:
 * - Hyphen separated: "term - definition"
 * - Colon separated: "term : definition"
 * - Comma separated: "term,definition"
 * - Swapping term and definition when English words are in definition column.
 */
export function parseQuizletExportText(
  text: string,
  options: { swapTermDef?: boolean } = {}
): ParseQuizletExportResult {
  if (!text || typeof text !== 'string') {
    return { cards: [], totalLines: 0, skippedEmpty: 0 };
  }

  const lines = text.split(/[\r\n]+/);
  const cards: QuizletCardItem[] = [];
  let skippedEmpty = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      skippedEmpty++;
      continue;
    }

    let term = '';
    let definition = '';

    // 1. Quizlet standard export: Tab separated
    if (line.includes('\t')) {
      const parts = line.split('\t');
      term = parts[0].trim();
      definition = parts.slice(1).join(' ').trim();
    }
    // 2. Safe spaced hyphen: "term - definition"
    else if (line.includes(' - ')) {
      const parts = line.split(' - ');
      term = parts[0].trim();
      definition = parts.slice(1).join(' - ').trim();
    }
    // 3. Safe spaced colon: "term : definition"
    else if (line.includes(' : ')) {
      const parts = line.split(' : ');
      term = parts[0].trim();
      definition = parts.slice(1).join(' : ').trim();
    }
    // 4. Comma separated with potential quotes
    else if (line.includes(',')) {
      const commaIdx = line.indexOf(',');
      term = line.slice(0, commaIdx).trim().replace(/^["']|["']$/g, '');
      definition = line.slice(commaIdx + 1).trim().replace(/^["']|["']$/g, '');
    }
    // 5. Fallback single word per line
    else {
      term = line;
      definition = '';
    }

    term = stripBulletPrefix(term);
    definition = stripBulletPrefix(definition);

    if (!term && !definition) {
      skippedEmpty++;
      continue;
    }

    // Apply term/definition swap if requested
    if (options.swapTermDef) {
      const temp = term;
      term = definition;
      definition = temp;
    }

    if (!term) {
      skippedEmpty++;
      continue;
    }

    cards.push({
      term,
      definition,
    });
  }

  return {
    cards,
    totalLines: lines.length,
    skippedEmpty,
  };
}

/**
 * Extracts set title and cards from Quizlet HTML/JSON payload if accessible.
 */
export function extractQuizletFromHtml(html: string): { title?: string; terms: QuizletCardItem[] } {
  const terms: QuizletCardItem[] = [];
  let title: string | undefined;

  // 1. Try extracting title
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitleMatch && ogTitleMatch[1]) {
    title = ogTitleMatch[1].replace(/\s*\|\s*Quizlet.*$/i, '').trim();
  } else {
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTagMatch && titleTagMatch[1]) {
      title = titleTagMatch[1]
        .replace(/\s*\|\s*Quizlet.*$/i, '')
        .replace(/\s*(?:-|–)?\s*Flashcards\s*$/i, '')
        .trim();
    }
  }

  // 2. Try parsing __NEXT_DATA__ json if present in page
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch && nextDataMatch[1]) {
    try {
      const parsedData = JSON.parse(nextDataMatch[1]);

      // Check Redux dehydrated state (verified real Quizlet structure)
      const reduxRaw = parsedData.props?.pageProps?.dehydratedReduxStateKey;
      if (reduxRaw) {
        const redux = typeof reduxRaw === 'string' ? JSON.parse(reduxRaw) : reduxRaw;
        if (redux.setPage?.set?.title) {
          title = String(redux.setPage.set.title).trim();
        }
        const studiableItems = redux.studyModesCommon?.studiableData?.studiableItems;
        if (Array.isArray(studiableItems) && studiableItems.length > 0) {
          for (const item of studiableItems) {
            if (item.isDeleted) continue;
            const wordSide = item.cardSides?.find((s: any) => s.label === 'word') || item.cardSides?.[0];
            const defSide = item.cardSides?.find((s: any) => s.label === 'definition') || item.cardSides?.[1];
            const wordText = wordSide?.media?.find((m: any) => m.type === 1)?.plainText?.trim() || '';
            const defText = defSide?.media?.find((m: any) => m.type === 1)?.plainText?.trim() || '';
            if (wordText || defText) {
              terms.push({ term: wordText, definition: defText });
            }
          }
        }
      }

      // Recursive scan fallback
      if (terms.length === 0) {
        const findTermsInObject = (obj: any): any[] | null => {
          if (!obj || typeof obj !== 'object') return null;
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const found = findTermsInObject(item);
              if (found) return found;
            }
            return null;
          }
          if (Array.isArray(obj.terms) && obj.terms.length > 0) {
            return obj.terms;
          }
          if (Array.isArray(obj.setPageTerms) && obj.setPageTerms.length > 0) {
            return obj.setPageTerms;
          }
          for (const key of Object.keys(obj)) {
            if (typeof obj[key] === 'object') {
              const found = findTermsInObject(obj[key]);
              if (found) return found;
            }
          }
          return null;
        };

        const foundTerms = findTermsInObject(parsedData);
        if (foundTerms && Array.isArray(foundTerms)) {
          for (const t of foundTerms) {
            const word = t.word || t.term || t.text;
            const def = t.definition || t.meaning;
            if (word && typeof word === 'string') {
              terms.push({
                term: word.trim(),
                definition: typeof def === 'string' ? def.trim() : '',
              });
            }
          }
        }
      }
    } catch {
      // Ignore JSON parse errors in Next.js data
    }
  }

  // 3. Regex fallback for term elements in DOM if Next data did not yield terms
  if (terms.length === 0) {
    const termRegex = /class=["'][^"']*(?:SetPageTerm-wordText|TermText)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/gi;
    const defRegex = /class=["'][^"']*(?:SetPageTerm-definitionText)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/gi;

    const words: string[] = [];
    const defs: string[] = [];

    let m: RegExpExecArray | null;
    while ((m = termRegex.exec(html)) !== null) {
      const clean = m[1].replace(/<[^>]+>/g, '').trim();
      if (clean) words.push(clean);
    }
    while ((m = defRegex.exec(html)) !== null) {
      const clean = m[1].replace(/<[^>]+>/g, '').trim();
      if (clean) defs.push(clean);
    }

    const count = Math.min(words.length, defs.length);
    for (let i = 0; i < count; i++) {
      terms.push({
        term: words[i],
        definition: defs[i],
      });
    }
  }

  return { title, terms };
}

/**
 * Attempts network fetch of Quizlet set via the dedicated backend extraction endpoint.
 * Accurately classifies all failure modes:
 * - Backend not running / connection refused
 * - Endpoint 404 or HTML response
 * - Server errors & timeouts
 * - Quizlet 429 rate limit, login required, or challenge blocked
 */
export async function fetchQuizletSet(
  rawUrl: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<FetchQuizletResult> {
  const parsed = parseQuizletUrl(rawUrl);
  if (!parsed.isValid || !parsed.cleanUrl || !parsed.setId) {
    return {
      success: false,
      errorType: 'invalid_url',
      message: parsed.error || 'URL Quizlet không hợp lệ.',
    };
  }

  if (options.signal?.aborted) {
    return {
      success: false,
      errorType: 'aborted',
      message: 'Yêu cầu tải đã bị hủy.',
    };
  }

  const timeoutMs = options.timeoutMs ?? 35000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onParentAbort = () => controller.abort();
  if (options.signal) {
    options.signal.addEventListener('abort', onParentAbort, { once: true });
  }

  try {
    const targetUrl = parsed.cleanUrl || rawUrl.trim();
    console.log(`[Quizlet Fetch] Calling backend endpoint /api/quizlet/fetch for: ${targetUrl}`);

    let backendRes: Response;
    try {
      backendRes = await fetch('/api/quizlet/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ url: targetUrl }),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timer);
      if (fetchErr.name === 'AbortError') {
        if (options.signal?.aborted) {
          return {
            success: false,
            errorType: 'aborted',
            cleanUrl: parsed.cleanUrl || undefined,
            setId: parsed.setId || undefined,
            message: 'Yêu cầu tải đã bị hủy.',
          };
        }
        return {
          success: false,
          errorType: 'timeout',
          cleanUrl: parsed.cleanUrl || undefined,
          setId: parsed.setId || undefined,
          message: `Quá thời gian tải bộ từ (hơn ${Math.round(timeoutMs / 1000)}s). Vui lòng thử lại.`,
          diagnostics: `Client timeout after ${timeoutMs}ms`,
        };
      }
      return {
        success: false,
        errorType: 'backend_offline',
        cleanUrl: parsed.cleanUrl || undefined,
        setId: parsed.setId || undefined,
        message: 'Không thể kết nối đến máy chủ backend (kết nối bị từ chối). Hãy đảm bảo server đang chạy.',
        diagnostics: fetchErr.message || 'Connection refused or network down',
      };
    }

    clearTimeout(timer);

    // Check Content-Type: handle HTML 404 or SPA index.html fallback
    const contentType = backendRes.headers?.get ? (backendRes.headers.get('content-type') || '') : '';
    if (contentType && !contentType.includes('application/json')) {
      const rawText = await backendRes.text().catch(() => '');
      if (backendRes.status === 404) {
        return {
          success: false,
          errorType: 'endpoint_not_found',
          cleanUrl: parsed.cleanUrl || undefined,
          setId: parsed.setId || undefined,
          message: 'Endpoint trích xuất /api/quizlet/fetch không tồn tại (404 Not Found). Kiểm tra lại cấu hình server.',
          diagnostics: `HTTP 404, received ${contentType}: ${rawText.slice(0, 150)}`,
        };
      }
      return {
        success: false,
        errorType: 'server_error',
        cleanUrl: parsed.cleanUrl || undefined,
        setId: parsed.setId || undefined,
        message: `Máy chủ trả về định dạng không hợp lệ (${backendRes.status} ${backendRes.statusText}).`,
        diagnostics: `Expected application/json, received ${contentType}: ${rawText.slice(0, 150)}`,
      };
    }

    const data = await backendRes.json().catch((jsonErr) => ({
      success: false,
      error: `Lỗi đọc dữ liệu JSON từ máy chủ: ${jsonErr.message}`,
    }));

    if (backendRes.ok && data.success && Array.isArray(data.terms) && data.terms.length > 0) {
      return {
        success: true,
        title: data.title || parsed.title || undefined,
        setId: data.setId || parsed.setId,
        cleanUrl: data.cleanUrl || parsed.cleanUrl,
        terms: data.terms,
      };
    }

    // Process backend failure with exact code
    const errorCode = data.code || (backendRes.status === 404 ? 'not_found' : backendRes.status === 429 ? 'rate_limited' : 'server_error');
    const userMsg = data.error || 'Lỗi khi trích xuất dữ liệu từ Quizlet.';

    if (backendRes.status === 429 || errorCode === 'rate_limited') {
      return {
        success: false,
        errorType: 'rate_limited',
        message: 'Quizlet tạm thời giới hạn tần suất truy cập (429 Too Many Requests). Vui lòng thử lại sau ít phút.',
        diagnostics: `HTTP 429: ${userMsg}`,
      };
    }

    if (errorCode === 'login_required') {
      return {
        success: false,
        errorType: 'quizlet_login_required',
        message: 'Bộ từ yêu cầu đăng nhập tài khoản Quizlet hoặc bị giới hạn quyền riêng tư bởi tác giả.',
        diagnostics: userMsg,
      };
    }

    if (errorCode === 'challenge_blocked') {
      return {
        success: false,
        errorType: 'challenge_blocked',
        message: 'Quizlet yêu cầu thử thách xác minh nâng cao mà trình duyệt tự động chưa thể vượt qua.',
        diagnostics: userMsg,
      };
    }

    if (errorCode === 'not_found' || backendRes.status === 404) {
      return {
        success: false,
        errorType: 'not_found' as any,
        message: 'Bộ từ không tồn tại hoặc đã bị xóa trên Quizlet (404 Not Found).',
        diagnostics: userMsg,
      };
    }

    if (errorCode === 'no_terms_found' || (data.terms && data.terms.length === 0)) {
      return {
        success: false,
        errorType: 'no_terms_found',
        message: 'Đã truy cập trang nhưng không tìm thấy thẻ từ vựng nào trong bộ này.',
        diagnostics: userMsg,
      };
    }

    return {
      success: false,
      errorType: 'server_error',
      message: userMsg,
      diagnostics: `HTTP ${backendRes.status}: ${JSON.stringify(data)}`,
    };
  } finally {
    clearTimeout(timer);
    if (options.signal) {
      options.signal.removeEventListener('abort', onParentAbort);
    }
  }
}
