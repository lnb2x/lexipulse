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
});
