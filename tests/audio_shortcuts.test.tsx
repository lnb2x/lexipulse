// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Flashcard } from '../src/components/review/Flashcard';
import { ReviewChoice } from '../src/components/review/ReviewChoice';
import { ReviewListening } from '../src/components/review/ReviewListening';
import { ShortcutsModal } from '../src/components/common/ShortcutsModal';
import { AudioButton } from '../src/components/common/AudioButton';
import { LanguageProvider } from '../src/context/LanguageContext';
import * as audioService from '../src/services/audio';
import type { WordItem } from '../src/types/vocab';

const mockWord: WordItem = {
  id: 'word-persist-1',
  word: 'persist',
  pos: ['verb'],
  phonetics: {
    us: '/pərˈsɪst/',
    uk: '/pəˈsɪst/',
    audioUs: 'https://api.dictionary.com/audio/persist-us.mp3',
    audioUk: 'https://api.dictionary.com/audio/persist-uk.mp3',
  },
  vietnameseDefinition: 'Kiên trì, bền bỉ',
  englishDefinition: 'Continue firmly or obstinately in an opinion or course of action.',
  meanings: [],
  collocations: [],
  examples: [{ en: 'She persisted with her studies.', vi: 'Cô ấy kiên trì với việc học.', context: 'general' }],
  wordFamily: [],
  tags: ['#TOEIC'],
  status: 'learning',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  reviewMeta: {
    repetition: 1,
    interval: 1,
    easeFactor: 2.5,
    dueDate: Date.now(),
    state: 2,
    stability: 2,
    difficulty: 5,
  },
};

describe('Audio Keyboard Shortcuts', () => {
  let playPronunciationSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    playPronunciationSpy = vi.spyOn(audioService, 'playPronunciation').mockResolvedValue();

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
  });

  afterEach(() => {
    cleanup();
    playPronunciationSpy?.mockRestore();
  });

  it('Flashcard: plays US audio on "r", "a", or "Ctrl+Space"', () => {
    render(
      <LanguageProvider>
        <Flashcard
          word={mockWord}
          currentIndex={0}
          totalCards={1}
          onGrade={vi.fn()}
        />
      </LanguageProvider>
    );

    // Press 'r'
    fireEvent.keyDown(window, { key: 'r', code: 'KeyR' });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(1);
    expect(playPronunciationSpy).toHaveBeenLastCalledWith(
      'persist',
      'US',
      'https://api.dictionary.com/audio/persist-us.mp3'
    );

    // Press 'a'
    fireEvent.keyDown(window, { key: 'a', code: 'KeyA' });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(2);
    expect(playPronunciationSpy).toHaveBeenLastCalledWith(
      'persist',
      'US',
      'https://api.dictionary.com/audio/persist-us.mp3'
    );

    // Press 'Ctrl + Space'
    fireEvent.keyDown(window, { code: 'Space', ctrlKey: true });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(3);
    expect(playPronunciationSpy).toHaveBeenLastCalledWith(
      'persist',
      'US',
      'https://api.dictionary.com/audio/persist-us.mp3'
    );
  });

  it('Flashcard: plays UK audio on "Shift + R"', () => {
    render(
      <LanguageProvider>
        <Flashcard
          word={mockWord}
          currentIndex={0}
          totalCards={1}
          onGrade={vi.fn()}
        />
      </LanguageProvider>
    );

    fireEvent.keyDown(window, { key: 'R', code: 'KeyR', shiftKey: true });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(1);
    expect(playPronunciationSpy).toHaveBeenLastCalledWith(
      'persist',
      'UK',
      'https://api.dictionary.com/audio/persist-uk.mp3'
    );
  });

  it('Flashcard: does not trigger audio shortcut when user is focused inside an input', () => {
    render(
      <LanguageProvider>
        <div>
          <input data-testid="dummy-input" />
          <Flashcard
            word={mockWord}
            currentIndex={0}
            totalCards={1}
            onGrade={vi.fn()}
          />
        </div>
      </LanguageProvider>
    );

    const input = screen.getByTestId('dummy-input');
    fireEvent.keyDown(input, { key: 'r', code: 'KeyR' });
    expect(playPronunciationSpy).not.toHaveBeenCalled();
  });

  it('ReviewChoice: plays audio on "r" or "Ctrl+Space" without affecting option selection', () => {
    render(
      <LanguageProvider>
        <ReviewChoice
          word={mockWord}
          allWords={[mockWord]}
          currentIndex={0}
          totalCards={1}
          onAnswer={vi.fn()}
        />
      </LanguageProvider>
    );

    fireEvent.keyDown(window, { key: 'r', code: 'KeyR' });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(1);
    expect(playPronunciationSpy).toHaveBeenLastCalledWith(
      'persist',
      'US',
      'https://api.dictionary.com/audio/persist-us.mp3'
    );
  });

  it('ReviewListening: handles "Ctrl+Space", "Alt+R", and slow speed on "Shift"', () => {
    render(
      <LanguageProvider>
        <ReviewListening
          word={mockWord}
          currentIndex={0}
          totalCards={1}
          onAnswer={vi.fn()}
        />
      </LanguageProvider>
    );

    // Initial render auto-plays 1.0x
    expect(playPronunciationSpy).toHaveBeenCalled();
    playPronunciationSpy.mockClear();

    // Replay with Ctrl+Space (1.0x)
    fireEvent.keyDown(window, { code: 'Space', ctrlKey: true });
    expect(playPronunciationSpy).toHaveBeenCalledWith(
      'persist',
      'US',
      'https://api.dictionary.com/audio/persist-us.mp3',
      expect.objectContaining({ rate: 1.0 })
    );

    playPronunciationSpy.mockClear();

    // Replay with Ctrl+Shift+Space (slow 0.75x)
    fireEvent.keyDown(window, { code: 'Space', ctrlKey: true, shiftKey: true });
    expect(playPronunciationSpy).toHaveBeenCalledWith(
      'persist',
      'US',
      'https://api.dictionary.com/audio/persist-us.mp3',
      expect.objectContaining({ rate: 0.75 })
    );

    playPronunciationSpy.mockClear();

    // Replay with Alt+R
    fireEvent.keyDown(window, { key: 'r', altKey: true });
    expect(playPronunciationSpy).toHaveBeenCalledWith(
      'persist',
      'US',
      'https://api.dictionary.com/audio/persist-us.mp3',
      expect.objectContaining({ rate: 1.0 })
    );
  });

  it('ShortcutsModal: displays audio shortcut row', () => {
    render(
      <LanguageProvider>
        <ShortcutsModal isOpen={true} onClose={vi.fn()} />
      </LanguageProvider>
    );

    // Should display R / A shortcut
    expect(screen.getByText('R / A')).toBeDefined();
    expect(screen.getByText(/Phát âm thanh từ vựng/i)).toBeDefined();
  });

  it('AudioButton: exposes shortcutHint in title and aria-keyshortcuts', () => {
    render(
      <AudioButton
        text="persist"
        accent="US"
        shortcutHint="R"
      />
    );

    const button = screen.getByRole('button');
    expect(button.getAttribute('title')).toContain('[R]');
    expect(button.getAttribute('aria-keyshortcuts')).toBe('R');
  });
});
