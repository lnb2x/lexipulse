// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuizletImportView } from '../src/components/deck/QuizletImportView';
import { LanguageProvider } from '../src/context/LanguageContext';
import * as bridge from '../src/services/quizlet/quizletBrowserBridge';
import * as parser from '../src/services/quizlet/quizletParser';
import type { FetchQuizletResult } from '../src/services/quizlet/quizletParser';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('keeps a newer browser request loading when an aborted request resolves late', async () => {
  vi.spyOn(bridge, 'detectQuizletBrowserBridge').mockResolvedValue(true);
  const backend = vi.spyOn(parser, 'fetchQuizletSet');
  const resolves: ((result: FetchQuizletResult) => void)[] = [];
  const browser = vi.spyOn(bridge, 'fetchQuizletFromBrowser').mockImplementation(() => new Promise(resolve => resolves.push(resolve)));
  render(<LanguageProvider><QuizletImportView allWords={[]} /></LanguageProvider>);
  const url = screen.getByPlaceholderText(/https:\/\/quizlet.com/);
  fireEvent.change(url, { target: { value: 'https://quizlet.com/123456/first/' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tải bộ từ' }));
  await waitFor(() => expect(browser).toHaveBeenCalledTimes(1));
  const oldSignal = browser.mock.calls[0][1]?.signal;
  fireEvent.change(url, { target: { value: 'https://quizlet.com/654321/second/' } });
  expect(oldSignal?.aborted).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Tải bộ từ' }));
  await waitFor(() => expect(browser).toHaveBeenCalledTimes(2));
  resolves[0]({ success: true, terms: [{ term: 'stale', definition: 'cũ' }] });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Hủy tải' })).toBeDefined());
  expect(screen.queryByText('stale')).toBeNull();
  resolves[1]({ success: true, title: 'Second', terms: [{ term: 'current', definition: 'hiện tại' }] });
  expect(await screen.findByText('current')).toBeDefined();
  expect(screen.queryByText('stale')).toBeNull();
  expect(backend).not.toHaveBeenCalled();
  fireEvent.change(url, { target: { value: 'https://quizlet.com/333333/third/' } });
  expect(screen.queryByText('current')).toBeNull();
});
