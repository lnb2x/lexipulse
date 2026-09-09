// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WordCard } from '../src/components/lookup/WordCard';
import { WordDetailModal } from '../src/components/deck/WordDetailModal';
import { WordListItem } from '../src/components/deck/WordListItem';
import { SearchBar } from '../src/components/lookup/SearchBar';
import { LanguageProvider } from '../src/context/LanguageContext';
import type { WordItem } from '../src/types/vocab';

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

const mockInflectedWord: WordItem = {
  id: 'word-went-123',
  word: 'went',
  originalInput: 'went',
  lemma: 'go',
  formLabels: ['past tense / v2'],
  linkedVariants: ['went', 'gone', 'going', 'goes'],
  pos: ['verb'],
  phonetics: { us: '/wɛnt/', uk: '/wɛnt/' },
  vietnameseDefinition: 'Đã đi, di chuyển (thì quá khứ của go)',
  englishDefinition: 'Past tense of go.',
  contextSentence: 'She went to the regional office for the annual inspection.',
  meanings: [
    {
      pos: 'verb',
      vietnameseDefinition: 'Đã đi, di chuyển',
      englishDefinition: 'Past tense of go',
    },
  ],
  collocations: [
    { phrase: 'went ahead', meaningVi: 'tiến hành' },
  ],
  examples: [
    {
      en: 'She went to the regional office.',
      vi: 'Cô ấy đã đến văn phòng khu vực.',
      context: 'business',
    },
  ],
  wordFamily: [
    { word: 'go', pos: 'verb', meaningVi: 'đi' },
  ],
  inflections: [
    { form: 'base', word: 'go' },
    { form: 'past', word: 'went' },
    { form: 'pastParticiple', word: 'gone' },
    { form: 'gerund', word: 'going' },
  ],
  tags: ['#toeic', '#verb'],
  status: 'learning',
  reviewMeta: {
    repetition: 1,
    interval: 1,
    easeFactor: 2.5,
    dueDate: Date.now(),
    history: [],
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
  source: 'ai',
  enrichmentStatus: 'enriched',
};

describe('Morphology & Context UI Integration', () => {
  describe('WordCard Component', () => {
    it('renders morphological callout with lemma button and form labels', () => {
      const handleLookup = vi.fn();
      render(
        <LanguageProvider>
          <WordCard
            word={mockInflectedWord}
            isInDeck={false}
            onAddToDeck={vi.fn()}
            onLookupWord={handleLookup}
          />
        </LanguageProvider>
      );

      // Check lemma display
      expect(screen.getByText(/Từ nguyên mẫu: go|Lemma: go/i)).toBeDefined();
      expect(screen.getByText('past tense / v2')).toBeDefined();

      // Check context sentence display
      expect(
        screen.getByText(/She went to the regional office for the annual inspection./i)
      ).toBeDefined();

      // Check inflections table
      expect(screen.getByText(/Bảng biến thể ngữ pháp|Grammatical Inflections/i)).toBeDefined();
      expect(screen.getByText('pastParticiple')).toBeDefined();

      // Clicking "Xem từ gốc" button triggers lookup of lemma
      const viewLemmaBtn = screen.getByRole('button', { name: /Xem từ gốc "go"|View lemma "go"/i });
      fireEvent.click(viewLemmaBtn);
      expect(handleLookup).toHaveBeenCalledWith('go');
    });
  });

  describe('WordDetailModal Component', () => {
    it('displays lemma, variants, context sentence, and inflections', () => {
      render(
        <LanguageProvider>
          <WordDetailModal
            word={mockInflectedWord}
            onClose={vi.fn()}
            onDelete={vi.fn()}
          />
        </LanguageProvider>
      );

      // Lemma badge
      expect(screen.getByText(/Từ gốc: go|Lemma: go/i)).toBeDefined();

      // Variants
      expect(screen.getByText(/Biến thể:|Variants:/i)).toBeDefined();
      expect(screen.getAllByText('gone').length).toBeGreaterThanOrEqual(1);

      // Context sentence
      expect(
        screen.getByText(/She went to the regional office for the annual inspection./i)
      ).toBeDefined();

      // Inflections
      expect(screen.getByText(/Bảng biến thể từ|Word Inflections/i)).toBeDefined();
      expect(screen.getByText('gerund')).toBeDefined();
    });
  });

  describe('WordListItem Component', () => {
    it('displays grammatical form badge and root lemma indicator', () => {
      render(
        <LanguageProvider>
          <WordListItem
            word={mockInflectedWord}
            onClick={vi.fn()}
            onDelete={vi.fn()}
          />
        </LanguageProvider>
      );

      // Form label badge
      expect(screen.getByText('past tense / v2')).toBeDefined();

      // Root lemma badge
      expect(screen.getByText(/Gốc: go|Root: go/i)).toBeDefined();
    });
  });

  describe('SearchBar Component with Morphology Detection', () => {
    it('suggests root lemma when user types inflected form like "went"', () => {
      const handleSearch = vi.fn();
      render(
        <LanguageProvider>
          <SearchBar onSearch={handleSearch} isLoading={false} />
        </LanguageProvider>
      );

      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'went' } });

      // Check that morphological suggestion appears by unambiguous action label
      const lemmaSuggestion = screen.getByRole('button', { name: /Tra cứu từ gốc|Lookup root/i });
      expect(lemmaSuggestion).toBeDefined();

      // Clicking suggestion looks up the lemma 'go'
      fireEvent.click(lemmaSuggestion);
      expect(handleSearch).toHaveBeenCalledWith('go');
    });
  });
});
