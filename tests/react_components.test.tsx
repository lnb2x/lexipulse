// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SearchBar } from '../src/components/lookup/SearchBar';
import { Flashcard } from '../src/components/review/Flashcard';
import { LanguageProvider } from '../src/context/LanguageContext';
import type { WordItem } from '../src/types/vocab';

beforeEach(() => {
  vi.clearAllMocks();
  // Mock window.speechSynthesis
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
        getVoices: vi.fn().mockReturnValue([]),
      },
      writable: true,
      configurable: true,
    });
  }
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
    text: async () => '',
  } as unknown as Response);
});

afterEach(() => {
  cleanup();
});

const mockWord: WordItem = {
  id: 'test-word-1',
  word: 'persistent',
  pos: ['adjective'],
  phonetics: { us: '/pərˈsɪs.tənt/', uk: '/pəˈsɪs.tənt/' },
  meanings: [
    {
      pos: 'adjective',
      englishDefinition: 'Continuing firmly or obstinately in a course of action.',
      vietnameseDefinition: 'Kiên trì, bền bỉ, dai dẳng.',
    },
  ],
  collocations: [
    { phrase: 'persistent effort', meaningVi: 'nỗ lực bền bỉ' },
  ],
  examples: [
    { en: 'Success requires persistent effort.', vi: 'Thành công đòi hỏi nỗ lực bền bỉ.', context: 'general' },
  ],
  wordFamily: [
    { word: 'persist', pos: 'verb', meaningVi: 'kiên trì' },
  ],
  tags: ['#toefl', '#ielts'],
  status: 'learning',
  reviewMeta: {
    repetition: 2,
    interval: 3,
    easeFactor: 2.5,
    dueDate: Date.now(),
    lastReviewedDate: Date.now() - 86400000,
    history: [],
  },
  createdAt: Date.now() - 172800000,
  updatedAt: Date.now(),
  source: 'local_dictionary',
  enrichmentStatus: 'enriched',
};

describe('React Component Testing (RTL)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SearchBar Component', () => {
    it('renders input with placeholder and calls onSearch on submit', () => {
      const handleSearch = vi.fn();
      render(
        <LanguageProvider>
          <SearchBar onSearch={handleSearch} isLoading={false} />
        </LanguageProvider>
      );

      const input = screen.getByRole('textbox');
      expect(input).toBeDefined();

      fireEvent.change(input, { target: { value: 'innovation' } });
      expect((input as HTMLInputElement).value).toBe('innovation');

      fireEvent.submit(input.closest('form')!);
      expect(handleSearch).toHaveBeenCalledWith('innovation');
    });

    it('clears query when clear button is clicked', () => {
      const handleSearch = vi.fn();
      render(
        <LanguageProvider>
          <SearchBar onSearch={handleSearch} isLoading={false} />
        </LanguageProvider>
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'collaborate' } });
      expect(input.value).toBe('collaborate');

      const clearBtn = screen.queryByTitle(/Xóa|Clear/i) || screen.queryByLabelText(/Xóa|Clear/i);
      if (clearBtn) {
        fireEvent.click(clearBtn);
        expect(input.value).toBe('');
      }
    });
  });

  describe('Flashcard Component', () => {
    it('renders front card by default and flips on click', () => {
      const handleGrade = vi.fn();
      render(
        <LanguageProvider>
          <Flashcard
            word={mockWord}
            onGrade={handleGrade}
            currentIndex={0}
            totalCards={1}
          />
        </LanguageProvider>
      );

      // Front displays the English word
      const wordHeading = screen.getByRole('heading', { name: 'persistent' });
      expect(wordHeading).toBeDefined();

      // Click card to flip
      fireEvent.click(wordHeading);

      // Rating buttons (Again, Good, Easy) should be present
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('submits rating when rating button is clicked', async () => {
      const handleGrade = vi.fn();
      render(
        <LanguageProvider>
          <Flashcard
            word={mockWord}
            onGrade={handleGrade}
            currentIndex={0}
            totalCards={1}
          />
        </LanguageProvider>
      );

      // Flip card to reveal ratings
      const cardHeading = screen.getByRole('heading', { name: 'persistent' });
      fireEvent.click(cardHeading);

      // Find Good rating button
      const goodBtn = screen.getByText(/Tốt|Good/i).closest('button');
      expect(goodBtn).toBeDefined();
      if (goodBtn) {
        fireEvent.click(goodBtn);
        expect(handleGrade).toHaveBeenCalledWith(2);
      }
    });
  });
});
