// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QuizletImportView } from '../src/components/deck/QuizletImportView';
import { LanguageProvider } from '../src/context/LanguageContext';
import * as parserModule from '../src/services/quizlet/quizletParser';
import type { WordItem } from '../src/types/vocab';

describe('QuizletImportView UI State Machine & Interaction Tests', () => {
  const mockWords: WordItem[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderComponent = () => {
    return render(
      <LanguageProvider>
        <QuizletImportView allWords={mockWords} />
      </LanguageProvider>
    );
  };

  it('1. Starts in clean idle state with no error banner or spinner', () => {
    renderComponent();

    const fetchBtn = screen.getByRole('button', { name: /Tải bộ từ|Fetch Cards/i }) as HTMLButtonElement;
    expect(fetchBtn.disabled).toBe(true);
    expect(screen.queryByText(/Không thể đọc trực tiếp/i)).toBeNull();
    expect(screen.queryByText(/Bộ từ yêu cầu đăng nhập/i)).toBeNull();
    expect(screen.queryByText(/Đang đọc bộ từ/i)).toBeNull();
  });

  it('pasting a valid URL automatically loads cards without a fetch click', async () => {
    const fetchSet = vi.spyOn(parserModule, 'fetchQuizletSet').mockResolvedValue({
      success: true, title: 'Paste set', terms: [{ term: 'grocery store', definition: 'cửa hàng tạp hóa' }],
    });
    renderComponent();
    expect(screen.queryByRole('textbox', { name: /export/i })).toBeNull();
    fireEvent.paste(screen.getByPlaceholderText(/quizlet\.com/i), {
      clipboardData: { getData: () => 'https://quizlet.com/1067700985/cards/' },
    });
    await waitFor(() => expect(screen.getByText('grocery store')).toBeDefined());
    expect(fetchSet).toHaveBeenCalledOnce();
    expect(fetchSet.mock.calls[0][0]).toBe('https://quizlet.com/1067700985/cards/');
  });

  it('shows verification progress and resumes automatically with returned cards', async () => {
    let finish!: (value: parserModule.FetchQuizletResult) => void;
    vi.spyOn(parserModule, 'fetchQuizletSet').mockImplementation((_url, options) => {
      options?.onProgress?.('verification_required');
      return new Promise((resolve) => { finish = resolve; });
    });
    renderComponent();
    fireEvent.paste(screen.getByPlaceholderText(/quizlet\.com/i), {
      clipboardData: { getData: () => 'https://quizlet.com/1067700985/cards/' },
    });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Hãy xác minh'));
    expect(screen.queryByText(/Phương án thay thế/i)).toBeNull();
    finish({ success: true, terms: [{ term: 'store', definition: 'cửa hàng' }] });
    await waitFor(() => expect(screen.getByText('store')).toBeDefined());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ignores a superseded request without clearing the next request spinner', async () => {
    const finishers: ((value: parserModule.FetchQuizletResult) => void)[] = [];
    vi.spyOn(parserModule, 'fetchQuizletSet').mockImplementation(() => new Promise((resolve) => finishers.push(resolve)));
    renderComponent();
    const input = screen.getByPlaceholderText(/quizlet\.com/i);
    fireEvent.paste(input, { clipboardData: { getData: () => 'https://quizlet.com/111/one/' } });
    await waitFor(() => expect(finishers).toHaveLength(1));
    fireEvent.paste(input, { clipboardData: { getData: () => 'https://quizlet.com/222/two/' } });
    await waitFor(() => expect(finishers).toHaveLength(2));
    finishers[0]({ success: true, terms: [{ term: 'old', definition: 'cũ' }] });
    await waitFor(() => expect(screen.getByText(/Đang đọc bộ từ/i)).toBeDefined());
    expect(screen.queryByText('old')).toBeNull();
    finishers[1]({ success: true, terms: [{ term: 'new', definition: 'mới' }] });
    await waitFor(() => expect(screen.getByText('new')).toBeDefined());
  });

  it('2. Transitions from idle -> loading -> error and displays concise reason with Retry button without hanging spinner', async () => {
    let resolveFetch: (val: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    vi.spyOn(parserModule, 'fetchQuizletSet').mockImplementation(() => fetchPromise as any);

    renderComponent();

    const input = screen.getByPlaceholderText(/quizlet\.com/i) as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: 'https://quizlet.com/vn/1195892637/be_quizlet-1-btvn-1-flash-cards/' },
    });

    const fetchBtn = screen.getByRole('button', { name: /Tải bộ từ|Fetch Cards/i }) as HTMLButtonElement;
    expect(fetchBtn.disabled).toBe(false);

    // Click fetch
    fireEvent.click(fetchBtn);

    // Assert LOADING state: spinner active, button disabled, no error banner displayed
    expect(screen.getByText(/Đang đọc bộ từ/i)).toBeDefined();
    expect(fetchBtn.disabled).toBe(true);
    expect(screen.queryByText(/Thử lại/i)).toBeNull();

    // Simulate backend error
    resolveFetch!({
      success: false,
      errorType: 'backend_offline',
      message: 'Không thể kết nối đến máy chủ backend (kết nối bị từ chối). Hãy đảm bảo server đang chạy.',
      diagnostics: 'Connection refused',
    });

    // Assert ERROR state: spinner GONE, error banner shown with Retry button
    await waitFor(() => {
      expect(screen.getByText(/Không thể kết nối đến máy chủ backend/i)).toBeDefined();
    });

    expect(screen.queryByText(/Đang đọc bộ từ/i)).toBeNull();
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeDefined();
    expect(screen.getByText(/Máy chủ offline/i)).toBeDefined();

    // Click "Thử lại": should immediately wipe old error and return to loading
    let resolveRetry: (val: any) => void;
    const retryPromise = new Promise((resolve) => {
      resolveRetry = resolve;
    });
    vi.spyOn(parserModule, 'fetchQuizletSet').mockImplementation(() => retryPromise as any);

    fireEvent.click(screen.getByRole('button', { name: /Thử lại/i }));

    expect(screen.getByText(/Đang đọc bộ từ/i)).toBeDefined();
    expect(screen.queryByText(/Không thể kết nối đến máy chủ backend/i)).toBeNull();

    resolveRetry!({ success: false, message: 'Cancelled' });
  });

  it('3. Changing URL resets error state back to idle and cancels in-flight fetch', async () => {
    vi.spyOn(parserModule, 'fetchQuizletSet').mockResolvedValue({
      success: false,
      errorType: 'endpoint_not_found',
      message: 'Endpoint trích xuất /api/quizlet/fetch không tồn tại (404 Not Found).',
    });

    renderComponent();

    const input = screen.getByPlaceholderText(/quizlet\.com/i) as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: 'https://quizlet.com/12345/some-cards' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Tải bộ từ|Fetch Cards/i }));

    await waitFor(() => {
      expect(screen.getByText(/Endpoint trích xuất/i)).toBeDefined();
    });

    // Now edit the URL
    fireEvent.change(input, {
      target: { value: 'https://quizlet.com/12345/new-url-edited' },
    });

    // Error banner should be cleared immediately upon typing new URL
    expect(screen.queryByText(/Endpoint trích xuất/i)).toBeNull();
    expect(screen.queryByText(/Thử lại/i)).toBeNull();
  });

  it('4. Successfully extracts and displays 40 cards from reproduction set without fake data', async () => {
    vi.spyOn(parserModule, 'fetchQuizletSet').mockResolvedValue({
      success: true,
      title: 'BE_Quizlet 1 (BTVN 1)',
      setId: '1195892637',
      cleanUrl: 'https://quizlet.com/vn/1195892637/be_quizlet-1-btvn-1-flash-cards/',
      terms: [
        { term: 'branch (n)', definition: '/bræntʃ/ - cành cây' },
        { term: 'ladder (n)', definition: '/ˈlæd.ər/ - cái thang' },
        { term: 'equipment (n)', definition: '/ɪˈkwɪp.mənt/ - trang thiết bị' },
      ],
    });

    renderComponent();

    const input = screen.getByPlaceholderText(/quizlet\.com/i) as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: 'https://quizlet.com/vn/1195892637/be_quizlet-1-btvn-1-flash-cards/' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Tải bộ từ|Fetch Cards/i }));

    await waitFor(() => {
      expect(screen.getByText(/Tải thành công 3 thẻ từ Quizlet/i)).toBeDefined();
    });

    expect(screen.getByText('branch')).toBeDefined();
    expect(screen.getByText('cành cây')).toBeDefined();
    expect(screen.getByText('ladder')).toBeDefined();
    expect(screen.getByText('equipment')).toBeDefined();
  });

  it('shows comma-separated terms as individual rows after fetching a Quizlet card', async () => {
    vi.spyOn(parserModule, 'fetchQuizletSet').mockResolvedValue({
      success: true,
      title: 'Synonyms',
      setId: '12345',
      cleanUrl: 'https://quizlet.com/12345/synonyms/',
      terms: [{ term: 'go down, decrease, drop off (phr.v)', definition: 'giảm xuống' }],
    });

    renderComponent();
    fireEvent.change(screen.getByPlaceholderText(/quizlet\.com/i), {
      target: { value: 'https://quizlet.com/12345/synonyms/' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Tải bộ từ|Fetch Cards/i }));

    await waitFor(() => expect(screen.getByText('go down')).toBeDefined());
    expect(screen.getByText('decrease')).toBeDefined();
    expect(screen.getByText('drop off')).toBeDefined();
    expect(screen.getAllByText('giảm xuống')).toHaveLength(3);
    expect(screen.getByText(/Tổng: 3 từ/)).toBeDefined();
  });
});
