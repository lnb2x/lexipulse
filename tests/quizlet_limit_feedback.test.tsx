// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QuizletImportView } from '../src/components/deck/QuizletImportView';
import { LanguageProvider } from '../src/context/LanguageContext';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });
it.each(['vi', 'en'])('shows a localized busy response and paste fallback in %s', async language => {
  localStorage.setItem('lexipulse_ui_language', language);
  vi.stubGlobal('fetch', async () => Response.json({ success: false, code: 'server_busy' }, { status: 503 }));
  render(<LanguageProvider><QuizletImportView allWords={[]} /></LanguageProvider>);
  fireEvent.change(screen.getByPlaceholderText(/quizlet\.com/i), { target: { value: 'https://quizlet.com/123456/fixture/' } });
  fireEvent.click(screen.getByRole('button', { name: /Tải bộ từ|Fetch Set/i }));
  expect(await screen.findByText(language === 'vi'
    ? 'Máy chủ nhập đang bận. Hãy thử lại sau hoặc dán nội dung bộ thẻ.'
    : 'The import service is busy. Try again later or paste the exported cards.')).toBeDefined();
  expect(screen.getByText(language === 'vi'
    ? 'Phương án thay thế: xuất nội dung từ Quizlet và dán vào ô bên dưới.'
    : 'Alternative: export the cards from Quizlet and paste them below.')).toBeDefined();
});
