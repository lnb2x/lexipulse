// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { App } from '../src/App';
import { LanguageProvider } from '../src/context/LanguageContext';
import { db } from '../src/services/db';
import { createInitialReviewMeta } from '../src/services/fsrs/fsrsService';
import type { WordItem } from '../src/types/vocab';

beforeEach(async () => {
  vi.clearAllMocks();
  await db.words.clear();
  await db.dailyStats.clear();

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
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
});

afterEach(() => {
  cleanup();
});

const seedWordsForDate = async (count: number, timestamp: number, prefix: string = 'word') => {
  const words: WordItem[] = [];
  for (let i = 0; i < count; i++) {
    words.push({
      id: `${prefix}-${i}`,
      word: `${prefix}_${i}`,
      pos: ['noun'],
      phonetics: { us: `/${prefix}_${i}/` },
      vietnameseDefinition: `Định nghĩa của ${prefix}_${i}`,
      englishDefinition: `Definition of ${prefix}_${i}`,
      meanings: [],
      collocations: [],
      wordFamily: [],
      examples: [
        { en: `Example sentence for ${prefix}_${i}.`, vi: `Câu ví dụ cho ${prefix}_${i}.`, context: 'general' },
      ],
      tags: ['#date-review'],
      status: 'learning',
      reviewMeta: createInitialReviewMeta(timestamp),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  await db.words.bulkPut(words);
  return words;
};

describe('Heatmap Review Navigation & UI Freeze Regression', () => {
  it('correctly transitions from Deck tab to ReviewView when clicking "Ôn tập từ ngày này" in ContributionHeatmap', async () => {
    const today = Date.now();
    await seedWordsForDate(5, today, 'cohort');

    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>
    );

    // 1. Start on Deck tab
    act(() => {
      fireEvent.keyDown(window, { key: '2', altKey: true });
    });

    const deckTabs = screen.getAllByRole('tab', { name: /Bộ từ vựng|Deck/i });
    expect(deckTabs[0].getAttribute('aria-selected')).toBe('true');

    // Wait for Dexie query to populate
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // 2. Locate and click today's active day cell in ContributionHeatmap
    const heatmapContainer = document.querySelector('.min-w-\\[720px\\]');
    expect(heatmapContainer).not.toBeNull();

    const dayCells = heatmapContainer?.querySelectorAll('div[class*="rounded-[2.5px]"]');
    expect(dayCells?.length).toBeGreaterThan(0);

    const activeCell = Array.from(dayCells || []).find((c) => !c.className.includes('bg-[#ebedf0]') && !c.className.includes('bg-slate-100'));
    expect(activeCell).toBeDefined();

    act(() => {
      fireEvent.click(activeCell!);
    });

    const reviewBtn = screen.getByRole('button', { name: /Ôn tập từ ngày này|Review words from this date/i });
    expect(reviewBtn).not.toBeNull();

    // 3. Click "Ôn tập từ ngày này"
    act(() => {
      fireEvent.click(reviewBtn);
    });

    // Await tab transition and lazy-loaded Flashcard component
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    // 4. Assert:
    // - Review tab is now selected in navigation
    const reviewTabs = screen.getAllByRole('tab', { name: /Ôn tập SRS|Review/i });
    expect(reviewTabs[0].getAttribute('aria-selected')).toBe('true');

    // - Displayed content actually changed to ReviewView (Deck search input is unmounted)
    expect(screen.queryByPlaceholderText(/Tìm từ theo tên/i)).toBeNull();

    // - First word from selected date is visible in the active Flashcard heading
    expect(await screen.findByRole('heading', { name: 'cohort_0' })).toBeDefined();

    // - Flashcard front label is visible
    expect(screen.getByText(/Mặt trước|Front Card/i)).toBeDefined();

    // - UI remains interactive: Space key flips the flashcard
    act(() => {
      fireEvent.keyDown(window, { code: 'Space' });
    });

    // After flipping, Vietnamese definition of cohort_0 is visible
    expect(await screen.findByText('Định nghĩa của cohort_0')).toBeDefined();
  });

  it('handles 25+ words from a date without synchronous performance stall or dropped navigation', async () => {
    const today = Date.now();
    await seedWordsForDate(25, today, 'bulk_date');

    const startTime = performance.now();

    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>
    );

    // Switch to Deck tab
    act(() => {
      fireEvent.keyDown(window, { key: '2', altKey: true });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // Select date cell and start review
    const heatmapContainer = document.querySelector('.min-w-\\[720px\\]');
    const dayCells = heatmapContainer?.querySelectorAll('div[class*="rounded-[2.5px]"]');

    const activeCell = Array.from(dayCells || []).find((c) => !c.className.includes('bg-[#ebedf0]') && !c.className.includes('bg-slate-100'));
    expect(activeCell).toBeDefined();

    act(() => {
      fireEvent.click(activeCell!);
    });

    const reviewBtn = screen.getByRole('button', { name: /Ôn tập từ ngày này|Review words from this date/i });
    expect(reviewBtn).not.toBeNull();

    const transitionStart = performance.now();
    act(() => {
      fireEvent.click(reviewBtn);
    });
    const transitionDuration = performance.now() - transitionStart;

    // Transition must be fast (< 250ms), not stalled by large card lists
    expect(transitionDuration).toBeLessThan(250);

    // Await tab transition and lazy-loaded Flashcard component
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    // Review session accurately initialized with first card heading
    expect(await screen.findByRole('heading', { name: 'bulk_date_0' })).toBeDefined();
    expect(screen.getByText(/Mặt trước|Front Card/i)).toBeDefined();

    // Interactive flip check
    act(() => {
      fireEvent.keyDown(window, { code: 'Space' });
    });
    expect(await screen.findByText('Định nghĩa của bulk_date_0')).toBeDefined();
  });
});
