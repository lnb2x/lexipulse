// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QuizletImportView } from '../src/components/deck/QuizletImportView';
import { LanguageProvider } from '../src/context/LanguageContext';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('shows the backend challenge reason and allows exported cards to be parsed after a blocked fetch', async () => {
  const url = 'https://quizlet.com/vn/1067700985/camp-bomb-rc-lesson-2-flash-cards/';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    success: false,
    code: 'challenge_blocked',
    error: 'Quizlet chặn truy cập tự động hoặc yêu cầu xác minh bảo mật. HTTP 403; Captcha Challenge…',
  }), { status: 422, headers: { 'Content-Type': 'application/json' } })));
  render(<LanguageProvider><QuizletImportView allWords={[]} /></LanguageProvider>);
  fireEvent.change(screen.getByPlaceholderText(/quizlet\.com/i), { target: { value: url } });
  fireEvent.click(screen.getByRole('button', { name: /Tải bộ từ|Fetch Cards/i }));

  expect(await screen.findByText('Thử thách bảo mật')).toBeDefined();
  expect(screen.getByText(/Chưa hoàn tất xác minh trong cửa sổ Quizlet/)).toBeDefined();
  expect(screen.getByText(/Không cần cài tiện ích/)).toBeDefined();
  expect(screen.queryByText(/Đã truy cập trang nhưng không tìm thấy/)).toBeNull();
  expect(screen.getByRole('link', { name: /Camp Bomb Rc Lesson 2/ }).getAttribute('href')).toBe(url);
  fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết chẩn đoán' }));
  expect(screen.getByText(/HTTP 403; Captcha Challenge/)).toBeDefined();

  // Synthetic export sample; these are not claimed to be cards from the live set.
  fireEvent.click(screen.getByRole('button', { name: 'Nhập văn bản thủ công (tùy chọn)' }));
  const textarea = document.querySelector('textarea')!;
  fireEvent.change(textarea, { target: { value: 'fixtureword\tnghĩa kiểm thử' } });
  fireEvent.click(screen.getByRole('button', { name: /Đối chiếu kho từ/i }));
  expect(await screen.findByText('fixtureword')).toBeDefined();
  expect(screen.getByText('nghĩa kiểm thử')).toBeDefined();
});
