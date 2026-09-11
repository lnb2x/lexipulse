// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { db, saveAppSettings, getTodayStats } from '../src/services/db';
import { LanguageProvider } from '../src/context/LanguageContext';
import { Flashcard } from '../src/components/review/Flashcard';
import App from '../src/App';
import type { WordItem } from '../src/types/vocab';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('Review Idempotency & Rapid Input Protection Regression Suite', () => {
  const seedDueCard: WordItem = {
    id: 'word-idempotency-1',
    word: 'resilience',
    pos: ['noun'],
    phonetics: { us: '/rɪˈzɪl.jəns/', uk: '/rɪˈzɪl.jəns/' },
    vietnameseDefinition: 'Sự kiên cường',
    englishDefinition: 'The capacity to recover quickly from difficulties.',
    meanings: [],
    collocations: [],
    examples: [{ en: 'She showed great resilience.', vi: 'Cô ấy đã thể hiện sự kiên cường to lớn.', context: 'general' }],
    wordFamily: [],
    tags: ['#Test'],
    status: 'learning',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    reviewMeta: {
      repetition: 0,
      interval: 0,
      easeFactor: 2.5,
      dueDate: Date.now() - 10000, // strictly due in the past
      lastReviewedDate: null,
      history: [],
      fsrs: {
        due: Date.now() - 10000,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: 0, // State.New
        last_review: 0,
      },
      schedulerVersion: 'fsrs-v5',
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.words.clear();
    await db.dailyStats.clear();
    await db.settingsTable.clear();

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

  it('1. Exactly one due card: double click + keyboard shortcut "3" updates FSRS once, adds 1 history entry, increments cardsReviewed once, and advances session', async () => {
    await db.words.put({ ...seedDueCard });
    await saveAppSettings({ desiredRetention: 0.9 });

    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const reviewTabButton = document.getElementById('tab-desktop-review')!;
    act(() => {
      fireEvent.click(reviewTabButton);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const panel = document.getElementById('panel-review')!;
    const buttons = panel.querySelectorAll('button');
    const startBtn = buttons[0];
    act(() => {
      fireEvent.click(startBtn);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    // Spacebar to flip card
    act(() => {
      fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const goodButton = panel.querySelector('button[title="Good"]') as HTMLButtonElement;
    expect(goodButton).not.toBeNull();
    expect(goodButton.disabled).toBe(false);

    // Trigger rapid double click + keydown '3' near-simultaneously
    await act(async () => {
      fireEvent.click(goodButton);
      fireEvent.click(goodButton);
      fireEvent.keyDown(window, { key: '3' });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });

    const finalWord = await db.words.get('word-idempotency-1');
    const finalStats = await getTodayStats();

    // Verify FSRS state updated exactly once
    expect(finalWord).toBeDefined();
    expect(finalWord?.reviewMeta.fsrs?.reps).toBe(1);
    expect(finalWord?.reviewMeta.repetition).toBe(1);

    // Verify history gained exactly one entry
    expect(finalWord?.reviewMeta.history.length).toBe(1);
    expect(finalWord?.reviewMeta.history[0].rating).toBe(3);

    // Verify dailyStats cardsReviewed incremented exactly once
    expect(finalStats.cardsReviewed).toBe(1);

    // Verify streak is not incremented twice
    expect(finalStats.streak).toBe(1);

    // Verify next due date calculated once (in the future)
    expect(finalWord?.reviewMeta.dueDate).toBeGreaterThan(Date.now());
  });

  it('2. Multiple cards in queue: rapid double click on Card 1 advances to Card 2 without double-grading or skipping', async () => {
    const card1: WordItem = {
      ...seedDueCard,
      id: 'word-card-1',
      word: 'resilience',
    };
    const card2: WordItem = {
      ...seedDueCard,
      id: 'word-card-2',
      word: 'perseverance',
    };

    await db.words.bulkPut([card1, card2]);
    await saveAppSettings({ desiredRetention: 0.9 });

    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const reviewTabButton = document.getElementById('tab-desktop-review')!;
    act(() => {
      fireEvent.click(reviewTabButton);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const panel = document.getElementById('panel-review')!;
    const buttons = panel.querySelectorAll('button');
    const startBtn = buttons[0];
    act(() => {
      fireEvent.click(startBtn);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    // Spacebar to flip card 1
    act(() => {
      fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const goodButton = panel.querySelector('button[title="Good"]') as HTMLButtonElement;
    expect(goodButton).not.toBeNull();

    // Double-click Good on Card 1
    await act(async () => {
      fireEvent.click(goodButton);
      fireEvent.click(goodButton);
      fireEvent.keyDown(window, { key: '3' });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });

    const w1 = await db.words.get('word-card-1');
    const w2 = await db.words.get('word-card-2');
    const stats = await getTodayStats();

    // Card 1 graded exactly once
    expect(w1?.reviewMeta.history.length).toBe(1);
    // Card 2 not yet graded
    expect(w2?.reviewMeta.history.length).toBe(0);
    // Daily stats incremented exactly once
    expect(stats.cardsReviewed).toBe(1);

    // Review session cleanly advanced to Card 2
    expect(panel.textContent).toContain('Thẻ 2 / 2');
    expect(panel.textContent).toContain('perseverance');
  });

  it('3. ReviewQuiz Cloze: rapid repeated Enter and Next clicks are idempotent', async () => {
    const card: WordItem = {
      ...seedDueCard,
      id: 'word-cloze-1',
      word: 'resilience',
      examples: [{ en: 'Her resilience helped her survive.', vi: 'Sự kiên cường giúp cô ấy sống sót.', context: 'toeic' }],
    };

    await db.words.put(card);
    await saveAppSettings({ desiredRetention: 0.9 });

    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const reviewTabButton = document.getElementById('tab-desktop-review')!;
    act(() => {
      fireEvent.click(reviewTabButton);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // Select Cloze Quiz mode
    const clozeModeCard = screen.getByText(/điền từ ngữ cảnh|quiz/i);
    act(() => {
      fireEvent.click(clozeModeCard);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const panel = document.getElementById('panel-review')!;
    const startBtn = panel.querySelector('button.bg-indigo-600') as HTMLButtonElement;
    act(() => {
      fireEvent.click(startBtn);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    // In Cloze quiz, choose the option
    const optionBtn = await screen.findByRole('button', { name: /resilience/i });
    act(() => {
      fireEvent.click(optionBtn);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // Rapidly trigger Next button twice and press Enter
    const nextBtn = screen.getByRole('button', { name: /câu tiếp theo|next question/i });
    await act(async () => {
      fireEvent.click(nextBtn);
      fireEvent.click(nextBtn);
      fireEvent.keyDown(window, { key: 'Enter' });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });

    const w = await db.words.get('word-cloze-1');
    const stats = await getTodayStats();

    expect(w?.reviewMeta.history.length).toBe(1);
    expect(stats.cardsReviewed).toBe(1);
  });
});
