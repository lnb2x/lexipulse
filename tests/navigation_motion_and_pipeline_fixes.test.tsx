// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { mergePipelineSources } from '../src/services/enrichmentPipeline';
import { Header } from '../src/components/common/Header';
import { DeckView } from '../src/features/deck/DeckView';
import { LanguageProvider } from '../src/context/LanguageContext';
import { App } from '../src/App';
import { ReviewComplete } from '../src/components/review/ReviewComplete';
import type { WordItem } from '../src/types/vocab';
import confetti from 'canvas-confetti';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
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
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
    text: async () => '',
  } as unknown as Response);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Defect Fixes: mergePipelineSources', () => {
  it('Bug A Fix: Does NOT unconditionally assign "noun" to verbs or adjectives', () => {
    // Scenario 1: A verb lookup (e.g. "wrote" or "negotiate") where dictionary and morphology indicate verb
    const verbResult = mergePipelineSources({
      query: 'wrote',
      analysis: {
        originalQuery: 'wrote',
        normalizedQuery: 'wrote',
        isInflected: true,
        selectedLemma: 'write',
        formLabels: ['Quá khứ đơn (V2)'],
        partOfSpeech: ['verb'],
        inflections: [],
        confidence: 1.0,
      },
      dictResult: {
        id: 'write-dict',
        word: 'write',
        pos: ['verb'],
        phonetics: { us: '/raɪt/', uk: '/raɪt/' },
        meanings: [{ pos: 'verb', englishDefinition: 'Mark letters', vietnameseDefinition: 'Viết' }],
        examples: [],
        status: 'new',
        createdAt: 1000,
        reviewMeta: { repetition: 0, interval: 0, easeFactor: 2.5 },
      },
      prioritizeAI: false,
    });

    // Must NOT contain 'noun'!
    expect(verbResult.word.pos).toEqual(['verb']);
    expect(verbResult.word.pos).not.toContain('noun');

    // Scenario 2: An adjective lookup where morphology indicates adjective and dictionary has no POS
    const adjResult = mergePipelineSources({
      query: 'beautiful',
      analysis: {
        originalQuery: 'beautiful',
        normalizedQuery: 'beautiful',
        isInflected: false,
        selectedLemma: 'beautiful',
        formLabels: ['Tính từ nguyên mẫu'],
        partOfSpeech: ['adjective'],
        inflections: [],
        confidence: 0.95,
      },
      dictResult: null,
      prioritizeAI: false,
    });

    expect(adjResult.word.pos).toEqual(['adjective']);
    expect(adjResult.word.pos).not.toContain('noun');

    // Scenario 3: Unknown word with no dictionary POS and no morphology POS falls back to ['noun']
    const unknownResult = mergePipelineSources({
      query: 'xyzunknown',
      analysis: {
        originalQuery: 'xyzunknown',
        normalizedQuery: 'xyzunknown',
        isInflected: false,
        selectedLemma: 'xyzunknown',
        formLabels: [],
        partOfSpeech: [],
        inflections: [],
        confidence: 0.1,
      },
      dictResult: null,
      prioritizeAI: false,
    });

    expect(unknownResult.word.pos).toEqual(['noun']);
  });

  it('Bug B Fix: Does NOT attach Vietnamese translation of an unrelated AI example to user context sentence', () => {
    const userContext = 'The board rejected the preliminary proposal.';

    // AI returns an unrelated example with its own Vietnamese translation
    const result = mergePipelineSources({
      query: 'proposal',
      contextSentence: userContext,
      analysis: {
        originalQuery: 'proposal',
        normalizedQuery: 'proposal',
        isInflected: false,
        selectedLemma: 'proposal',
        formLabels: ['Danh từ nguyên mẫu'],
        partOfSpeech: ['noun'],
        inflections: [],
        confidence: 1.0,
      },
      aiResult: {
        vietnameseDefinition: 'Đề xuất, bản kiến nghị',
        examples: [
          {
            en: 'She accepted his marriage proposal with tears of joy.',
            vi: 'Cô ấy đã chấp nhận lời cầu hôn của anh ấy trong niềm vui nghẹn ngào.',
            context: 'general',
          },
        ],
      },
      prioritizeAI: true,
    });

    // The first example is the user's custom context sentence
    const contextExample = result.word.examples[0];
    expect(contextExample).toBeDefined();
    expect(contextExample.en).toBe(userContext);

    // CRITICAL: The user's sentence must NOT borrow "Cô ấy đã chấp nhận lời cầu hôn của anh ấy..."
    expect(contextExample.vi).toBe('');
    expect(contextExample.vi).not.toContain('cầu hôn');

    // The second example is the AI's separate example with its own translation
    expect(result.word.examples.length).toBe(2);
    expect(result.word.examples[1].en).toContain('marriage proposal');
    expect(result.word.examples[1].vi).toContain('cầu hôn');
  });

  it('Bug B Fix: Accurately attaches Vietnamese translation when AI DOES provide a matching translation for context sentence', () => {
    const userContext = 'The board rejected the preliminary proposal.';

    const result = mergePipelineSources({
      query: 'proposal',
      contextSentence: userContext,
      analysis: {
        originalQuery: 'proposal',
        normalizedQuery: 'proposal',
        isInflected: false,
        selectedLemma: 'proposal',
        formLabels: ['Danh từ'],
        partOfSpeech: ['noun'],
        inflections: [],
        confidence: 1.0,
      },
      aiResult: {
        vietnameseDefinition: 'Đề xuất',
        examples: [
          {
            en: 'The board rejected the preliminary proposal.',
            vi: 'Hội đồng quản trị đã bác bỏ đề xuất sơ bộ.',
            context: 'general',
          },
        ],
      },
      prioritizeAI: true,
    });

    const contextExample = result.word.examples[0];
    expect(contextExample.en).toBe(userContext);
    expect(contextExample.vi).toBe('Hội đồng quản trị đã bác bỏ đề xuất sơ bộ.');
  });
});

describe('Navigation Motion: Header Shared Sliding Active Indicator', () => {
  it('renders tablist and tabs with correct accessible ARIA roles and sliding indicators', () => {
    const onTabChange = vi.fn();

    render(
      <LanguageProvider>
        <Header
          activeTab="lookup"
          onTabChange={onTabChange}
          streak={5}
          totalCards={12}
          dueCount={3}
          theme="light"
          onToggleTheme={vi.fn()}
          onOpenSettings={vi.fn()}
          onOpenShortcuts={vi.fn()}
        />
      </LanguageProvider>
    );

    // Desktop and mobile tablists exist
    const tablists = screen.getAllByRole('tablist');
    expect(tablists.length).toBeGreaterThanOrEqual(1);

    // Desktop sliding indicator exists with aria-hidden
    const desktopIndicator = screen.getByTestId('desktop-active-indicator');
    expect(desktopIndicator).toBeDefined();
    expect(desktopIndicator.getAttribute('aria-hidden')).toBe('true');

    // Mobile sliding indicator exists with aria-hidden
    const mobileIndicator = screen.getByTestId('mobile-active-indicator');
    expect(mobileIndicator).toBeDefined();
    expect(mobileIndicator.getAttribute('aria-hidden')).toBe('true');

    // Active tab button has aria-selected="true"
    const lookupTabs = screen.getAllByRole('tab', { name: /Tra từ|Lookup/i });
    expect(lookupTabs[0].getAttribute('aria-selected')).toBe('true');

    const deckTabs = screen.getAllByRole('tab', { name: /Bộ từ vựng|Deck/i });
    expect(deckTabs[0].getAttribute('aria-selected')).toBe('false');

    // Click deck tab triggers onTabChange
    fireEvent.click(deckTabs[0]);
    expect(onTabChange).toHaveBeenCalledWith('deck');
  });

  it('supports roving keyboard arrow navigation inside the desktop tablist', () => {
    const onTabChange = vi.fn();

    render(
      <LanguageProvider>
        <Header
          activeTab="lookup"
          onTabChange={onTabChange}
          streak={3}
          totalCards={10}
          dueCount={2}
          theme="light"
          onToggleTheme={vi.fn()}
          onOpenSettings={vi.fn()}
          onOpenShortcuts={vi.fn()}
        />
      </LanguageProvider>
    );

    const desktopNav = screen.getAllByRole('tablist')[0];

    // ArrowRight moves to 'deck'
    fireEvent.keyDown(desktopNav, { key: 'ArrowRight' });
    expect(onTabChange).toHaveBeenCalledWith('deck');

    // End moves to 'review'
    fireEvent.keyDown(desktopNav, { key: 'End' });
    expect(onTabChange).toHaveBeenCalledWith('review');

    // Home moves to 'lookup'
    fireEvent.keyDown(desktopNav, { key: 'Home' });
    expect(onTabChange).toHaveBeenCalledWith('lookup');
  });

  it('disables active indicator sliding transition when prefers-reduced-motion is active', () => {
    // Mock matchMedia for prefers-reduced-motion: reduce
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <LanguageProvider>
        <Header
          activeTab="lookup"
          onTabChange={vi.fn()}
          streak={2}
          totalCards={5}
          dueCount={0}
          theme="dark"
          onToggleTheme={vi.fn()}
          onOpenSettings={vi.fn()}
          onOpenShortcuts={vi.fn()}
        />
      </LanguageProvider>
    );

    const desktopIndicator = screen.getByTestId('desktop-active-indicator');
    expect(desktopIndicator.style.transition).toBe('none');
  });
});

describe('State Preservation & Navigation Transitions in App', () => {
  it('preserves unsubmitted search query and context sentence when navigating across tabs and back', async () => {
    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>
    );

    // Initial view is Lookup
    const searchInput = screen.getByPlaceholderText(/Tra cứu từ tiếng Anh|Lookup any English word/i) as HTMLInputElement;
    expect(searchInput).toBeDefined();

    // Type a query
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'collaborative' } });
    });
    expect(searchInput.value).toBe('collaborative');

    // Toggle and type a context sentence
    const contextBtn = screen.getByText(/Thêm câu ngữ cảnh|Add context sentence/i);
    act(() => {
      fireEvent.click(contextBtn);
    });

    const contextInput = screen.getByPlaceholderText(/Nhập câu chứa từ|Enter a sentence with the word/i) as HTMLInputElement;
    act(() => {
      fireEvent.change(contextInput, { target: { value: 'We need a collaborative approach.' } });
    });
    expect(contextInput.value).toBe('We need a collaborative approach.');

    // Switch to Deck view (Alt+2)
    act(() => {
      fireEvent.keyDown(window, { key: '2', altKey: true });
    });

    // Confirm we transitioned to Deck view (Lookup search input is gone, Deck tab selected)
    expect(screen.queryByPlaceholderText(/Tra cứu từ tiếng Anh|Lookup any English word/i)).toBeNull();

    // Switch back to Lookup view (Alt+1)
    act(() => {
      fireEvent.keyDown(window, { key: '1', altKey: true });
    });

    // Search query and context sentence MUST be preserved!
    const restoredSearchInput = screen.getByPlaceholderText(/Tra cứu từ tiếng Anh|Lookup any English word/i) as HTMLInputElement;
    expect(restoredSearchInput.value).toBe('collaborative');

    const restoredContextInput = screen.getByPlaceholderText(/Nhập câu chứa từ|Enter a sentence with the word/i) as HTMLInputElement;
    expect(restoredContextInput.value).toBe('We need a collaborative approach.');
  });

  it('does not restart motion or alter state on same-tab clicks', async () => {
    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>
    );

    const lookupTabs = screen.getAllByRole('tab', { name: /Tra từ|Lookup/i });
    const desktopLookupTab = lookupTabs[0];

    // Clicking already active tab 'lookup' should be a clean no-op
    act(() => {
      fireEvent.click(desktopLookupTab);
    });

    // Panel remains lookup with no unmounting or flickering
    expect(screen.getByPlaceholderText(/Tra cứu từ tiếng Anh|Lookup any English word/i)).toBeDefined();
  });

  it('rapid repeated destination switches settle cleanly on the final destination', async () => {
    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>
    );

    // Rapidly press Alt+2, Alt+3, Alt+1
    act(() => {
      fireEvent.keyDown(window, { key: '2', altKey: true });
      fireEvent.keyDown(window, { key: '3', altKey: true });
      fireEvent.keyDown(window, { key: '1', altKey: true });
    });

    // Settles immediately on the latest requested tab ('lookup')
    expect(screen.getByPlaceholderText(/Tra cứu từ tiếng Anh|Lookup any English word/i)).toBeDefined();
  });
});

describe('Reduced Motion: Confetti and Pulsing', () => {
  it('confetti in ReviewComplete respects prefers-reduced-motion: reduce', () => {
    // Enable reduced motion
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <LanguageProvider>
        <ReviewComplete
          reviewedCount={5}
          streak={4}
          history={[]}
          onRestart={vi.fn()}
          onGoToDeck={vi.fn()}
        />
      </LanguageProvider>
    );

    // confetti should NOT be called when reduced motion is preferred
    expect(confetti).not.toHaveBeenCalled();
  });

  it('confetti triggers when prefers-reduced-motion is false', () => {
    // Normal motion
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

    render(
      <LanguageProvider>
        <ReviewComplete
          reviewedCount={5}
          streak={4}
          history={[]}
          onRestart={vi.fn()}
          onGoToDeck={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 80,
      })
    );
  });

  it('renders DeckView with progressive batching (initial 30 items) to prevent UI hitch on large decks', () => {
    class MockIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null = null;
      readonly rootMargin: string = '';
      readonly thresholds: ReadonlyArray<number> = [];
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn().mockReturnValue([]);
    }
    window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

    // Generate 70 mock words to test progressive rendering threshold
    const mockWords: WordItem[] = Array.from({ length: 70 }, (_, i) => ({
      id: `mock-${i}`,
      word: `word_${i}`,
      lemma: `word_${i}`,
      phonetics: { us: `/word_${i}/` },
      pos: ['noun'],
      vietnameseDefinition: `Định nghĩa từ số ${i}`,
      englishDefinition: `Definition of word ${i}`,
      examples: [],
      collocations: [],
      tags: ['batch-test'],
      status: 'new',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reviewMeta: {
        state: 0,
        stability: 2,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 1,
        reps: 0,
        lapses: 0,
        dueDate: Date.now() + 86400000,
        lastReview: Date.now(),
        interval: 1,
        easeFactor: 2.5,
        repetition: 0,
        history: [],
      },
    }));

    render(
      <LanguageProvider>
        <DeckView
          words={mockWords}
          allWords={mockWords}
          dailyStats={[]}
          deckStats={{ total: 70, due: 0, new: 70, learning: 0, mastered: 0 }}
          deckLoading={false}
          filterOptions={{ search: '', tags: [], status: 'all', sortBy: 'urgency', sortDirection: 'asc' }}
          setFilterOptions={vi.fn()}
          allTags={[]}
          availableDates={[]}
          isFuzzyMatch={false}
          onOpenDetail={vi.fn()}
          onOpenEdit={vi.fn()}
          onDeleteWord={vi.fn()}
          onOpenImportExport={vi.fn()}
          onQuickExportCsv={vi.fn()}
          onQuickExportXlsx={vi.fn()}
          onStartReviewSession={vi.fn()}
          onNavigateToLookup={vi.fn()}
          showToast={vi.fn()}
        />
      </LanguageProvider>
    );

    // Initial batch must be 30 items to keep mount time < 16ms
    expect(screen.getByText('word_0')).toBeDefined();
    expect(screen.getByText('word_29')).toBeDefined();
    // Item 35 must not be rendered yet in initial DOM batch
    expect(screen.queryByText('word_35')).toBeNull();

    // Sentinel / load all button should be visible
    const showAllBtn = screen.getByRole('button', { name: /Hiển thị tất cả|Show all/i });
    expect(showAllBtn).toBeDefined();

    // Clicking "Hiển thị tất cả" renders the rest
    fireEvent.click(showAllBtn);
    expect(screen.getByText('word_35')).toBeDefined();
    expect(screen.getByText('word_69')).toBeDefined();
  });
});
