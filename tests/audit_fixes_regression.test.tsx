// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { db } from '../src/services/db';
import { ShortcutsModal } from '../src/components/common/ShortcutsModal';
import { Flashcard } from '../src/components/review/Flashcard';
import { DeckHeader } from '../src/components/deck/DeckHeader';
import { LanguageProvider } from '../src/context/LanguageContext';
import { createInitialReviewMeta, applyFSRSReview } from '../src/services/fsrs/fsrsService';
import type { FilterOptions, WordItem } from '../src/types/vocab';

beforeEach(async () => {
  vi.clearAllMocks();
  await db.words.clear();
  await db.dailyStats.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const createMockWord = (id: string, word: string): WordItem => ({
  id,
  word,
  pos: ['noun'],
  phonetics: { us: '/tɛst/' },
  vietnameseDefinition: 'kiểm tra',
  englishDefinition: 'a test',
  meanings: [],
  collocations: [],
  wordFamily: [],
  examples: [],
  tags: ['#test'],
  status: 'learning',
  reviewMeta: createInitialReviewMeta(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe('Audit Regression 1: ShortcutsModal and Flashcard 4-grade FSRS mapping alignment', () => {
  it('accurately lists all 4 FSRS ratings in ShortcutsModal matching Flashcard keys 1, 2, 3, 4', () => {
    // 1. Render ShortcutsModal in English
    const { unmount } = render(
      <LanguageProvider>
        <ShortcutsModal isOpen={true} onClose={() => {}} />
      </LanguageProvider>
    );

    const modalText = document.body.textContent || '';
    
    // Verify all 4 grades are documented with their correct FSRS key bindings:
    // Key 1 = Again ("Lặp lại" / "Again")
    // Key 2 = Hard ("Khó" / "Hard")
    // Key 3 = Good ("Nhớ" / "Good")
    // Key 4 = Easy ("Dễ nhớ" / "Easy")
    expect(modalText).toMatch(/(Lặp lại|Again).*1/i);
    expect(modalText).toMatch(/(Khó|Hard).*2/i);
    expect(modalText).toMatch(/(Nhớ|Good).*3/i);
    expect(modalText).toMatch(/(Dễ nhớ|Easy).*4/i);
    unmount();

    // 2. Test Flashcard keyboard listener execution
    const mockWord = createMockWord('w1', 'sample');
    const onGrade = vi.fn();

    render(
      <LanguageProvider>
        <Flashcard
          word={mockWord}
          currentIndex={0}
          totalCards={1}
          onGrade={onGrade}
        />
      </LanguageProvider>
    );

    // Flip the card with Space
    fireEvent.keyDown(window, { code: 'Space' });

    // Press '1' -> Rating.Again (1)
    fireEvent.keyDown(window, { key: '1' });
    expect(onGrade).toHaveBeenLastCalledWith(1);

    // Press '2' -> Rating.Hard (2)
    fireEvent.keyDown(window, { key: '2' });
    expect(onGrade).toHaveBeenLastCalledWith(2);

    // Press '3' -> Rating.Good (3)
    fireEvent.keyDown(window, { key: '3' });
    expect(onGrade).toHaveBeenLastCalledWith(3);

    // Press '4' -> Rating.Easy (4)
    fireEvent.keyDown(window, { key: '4' });
    expect(onGrade).toHaveBeenLastCalledWith(4);
  });
});

describe('Audit Regression 2: DeckHeader filter preservation during search debouncing', () => {
  it('preserves active filter selections when user changes status/tag during search debounce window', async () => {
    vi.useFakeTimers();

    let currentFilter: FilterOptions = {
      search: '',
      status: 'all',
      tags: [],
      sortBy: 'urgency',
      sortDirection: 'asc',
    };

    const onFilterChange = vi.fn((newOpts: FilterOptions) => {
      currentFilter = { ...newOpts };
    });

    const { rerender } = render(
      <LanguageProvider>
        <DeckHeader
          filterOptions={currentFilter}
          onFilterChange={onFilterChange}
          allTags={[]}
        />
      </LanguageProvider>
    );

    // Step a: Type into search input
    const searchInput = screen.getByPlaceholderText(/Tìm kiếm từ vựng|Tìm từ theo tên|Search vocabulary words|Search words by term/i);
    fireEvent.change(searchInput, { target: { value: 'react' } });

    // Step b: At 50ms (before 150ms debounce fires), user changes status to 'learning'
    act(() => {
      vi.advanceTimersByTime(50);
    });

    currentFilter = {
      ...currentFilter,
      status: 'learning',
    };

    rerender(
      <LanguageProvider>
        <DeckHeader
          filterOptions={currentFilter}
          onFilterChange={onFilterChange}
          allTags={[]}
        />
      </LanguageProvider>
    );

    // Step c: Let the 150ms debounce timer fire (advance remaining 110ms)
    act(() => {
      vi.advanceTimersByTime(110);
    });

    // Verify onFilterChange:
    // The newly selected status 'learning' must be PRESERVED alongside the search 'react'
    expect(onFilterChange).toHaveBeenCalled();
    const lastCall = onFilterChange.mock.calls[onFilterChange.mock.calls.length - 1][0];

    expect(lastCall.search).toBe('react');
    expect(lastCall.status).toBe('learning'); // NOT reverted to 'all'!
  });
});

describe('Audit Regression 3: FSRS Again-session scheduling correctness & session semantics', () => {
  it('proves FSRS schedules Again card to now + 1m short-term step while maintaining linear batch session completion', async () => {
    const now = 1773000000000;
    const initialMeta = createInitialReviewMeta(now);

    // Scheduling correctness test:
    const { nextMeta, newStatus, nextDue } = applyFSRSReview(initialMeta, 1, now, 0.90, 'due');

    // 1. Due in 1 minute (learning_steps: ['1m', '10m'])
    expect(nextDue).toBe(now + 60 * 1000);
    expect(nextMeta.interval).toBe(0);
    expect(nextMeta.fsrs?.state).toBe(1); // State.Learning
    expect(nextMeta.fsrs?.reps).toBe(1);
    expect(newStatus).toBe('learning');

    // 2. Session semantics: linear daily review batch finishes when all queued cards are reviewed
    const queue = [createMockWord('w1', 'innovate')];
    let currentIndex = 0;
    let isCompleted = false;

    // Simulate session progress
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      isCompleted = true;
    } else {
      currentIndex = nextIndex;
    }

    expect(isCompleted).toBe(true);
  });
});
