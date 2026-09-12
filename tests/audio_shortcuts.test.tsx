// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Flashcard } from '../src/components/review/Flashcard';
import { ReviewChoice } from '../src/components/review/ReviewChoice';
import { ReviewListening } from '../src/components/review/ReviewListening';
import { ShortcutsModal } from '../src/components/common/ShortcutsModal';
import { SettingsModal } from '../src/components/common/SettingsModal';
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

    // Should display P and Shift + P shortcuts
    expect(screen.getByText('P')).toBeDefined();
    expect(screen.getByText(/Phát âm tiếng Anh của từ hiện tại \(1 lần\)/i)).toBeDefined();
    expect(screen.getByText('Shift + P')).toBeDefined();
    expect(screen.getByText(/Bật\/tắt chế độ phát âm lặp lại \(nghỉ 1.5s\)/i)).toBeDefined();
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

  it('Flashcard: plays pronunciation once on key "p"', () => {
    render(
      <LanguageProvider>
        <Flashcard
          word={mockWord}
          currentIndex={0}
          totalCards={2}
          onGrade={vi.fn()}
        />
      </LanguageProvider>
    );

    // Press 'p'
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP' });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(1);
    expect(playPronunciationSpy).toHaveBeenLastCalledWith(
      'persist',
      'US',
      'https://api.dictionary.com/audio/persist-us.mp3'
    );
  });

  it('Flashcard: rapid presses of "p" cancel previous playback and restart without stacking', () => {
    const stopSpy = vi.spyOn(audioService, 'stopPronunciation');

    render(
      <LanguageProvider>
        <Flashcard
          word={mockWord}
          currentIndex={0}
          totalCards={2}
          onGrade={vi.fn()}
        />
      </LanguageProvider>
    );

    // Press 'p' 3 times rapidly
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP' });
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP' });
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP' });

    expect(playPronunciationSpy).toHaveBeenCalledTimes(3);
    // stopPronunciation is called on every attempt to prevent audio overlap
    expect(stopSpy).toHaveBeenCalled();
  });

  it('Flashcard: Shift+P toggles loop mode with ~1.5s interval', async () => {
    vi.useFakeTimers();

    render(
      <LanguageProvider>
        <Flashcard
          word={mockWord}
          currentIndex={0}
          totalCards={2}
          onGrade={vi.fn()}
        />
      </LanguageProvider>
    );

    // Press Shift+P to turn loop ON
    fireEvent.keyDown(window, { key: 'P', code: 'KeyP', shiftKey: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(1);

    // After playback finishes, advance 1499ms: should not have played next iteration yet
    await act(async () => {
      vi.advanceTimersByTime(1499);
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(1);

    // Advance 1ms (total 1500ms): should trigger second playback
    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(2);

    // Advance another 1500ms: should trigger third playback
    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(3);

    // Press Shift+P to turn loop OFF
    fireEvent.keyDown(window, { key: 'P', code: 'KeyP', shiftKey: true });

    // Advance another 3000ms: no more playback should occur
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('Flashcard: when switching card while loop is ON, old audio stops and new word plays', async () => {
    vi.useFakeTimers();
    const stopSpy = vi.spyOn(audioService, 'stopPronunciation');

    const { rerender } = render(
      <LanguageProvider>
        <Flashcard
          word={mockWord}
          currentIndex={0}
          totalCards={2}
          isLooping={true}
          onToggleLoop={vi.fn()}
          onGrade={vi.fn()}
        />
      </LanguageProvider>
    );

    // Card 1 starts playing because isLooping is true
    expect(playPronunciationSpy).toHaveBeenCalledWith(
      'persist',
      'US',
      'https://api.dictionary.com/audio/persist-us.mp3'
    );
    playPronunciationSpy.mockClear();

    const mockWord2: WordItem = {
      ...mockWord,
      id: 'word-persist-2',
      word: 'resilience',
      vietnameseDefinition: 'Sự kiên cường',
      phonetics: {
        us: '/rɪˈzɪl.jəns/',
        uk: '/rɪˈzɪl.jəns/',
        audioUs: 'https://api.dictionary.com/audio/resilience-us.mp3',
      },
    };

    // Switch to Card 2
    rerender(
      <LanguageProvider>
        <Flashcard
          word={mockWord2}
          currentIndex={1}
          totalCards={2}
          isLooping={true}
          onToggleLoop={vi.fn()}
          onGrade={vi.fn()}
        />
      </LanguageProvider>
    );

    // Old audio is stopped
    expect(stopSpy).toHaveBeenCalled();

    // New word starts playing
    expect(playPronunciationSpy).toHaveBeenCalledWith(
      'resilience',
      'US',
      'https://api.dictionary.com/audio/resilience-us.mp3'
    );

    vi.useRealTimers();
  });

  it('Flashcard: opening a modal stops audio and disables loop mode', () => {
    const onToggleLoop = vi.fn();
    const stopSpy = vi.spyOn(audioService, 'stopPronunciation');

    render(
      <LanguageProvider>
        <Flashcard
          word={mockWord}
          currentIndex={0}
          totalCards={2}
          isLooping={true}
          onToggleLoop={onToggleLoop}
          onGrade={vi.fn()}
        />
      </LanguageProvider>
    );

    // Dispatch modal opened event
    window.dispatchEvent(new CustomEvent('lexipulse:modal-opened'));

    expect(stopSpy).toHaveBeenCalled();
    expect(onToggleLoop).toHaveBeenCalledWith(false);
  });

  it('Flashcard Anti-leak: newly switched card displays front side from frame 1 even if previous card was flipped', () => {
    const mockWord2: WordItem = {
      ...mockWord,
      id: 'word-persist-2',
      word: 'resilience',
      vietnameseDefinition: 'Sự kiên cường',
    };

    const { rerender, container } = render(
      <LanguageProvider>
        <Flashcard
          word={mockWord}
          currentIndex={0}
          totalCards={2}
          onGrade={vi.fn()}
        />
      </LanguageProvider>
    );

    // Flip card 1 to back side
    fireEvent.keyDown(window, { code: 'Space' });

    // Verify card 1 container has rotate-y-180
    const cardEl = container.querySelector('.transform-style-3d');
    expect(cardEl?.classList.contains('rotate-y-180')).toBe(true);

    // Switch to card 2
    rerender(
      <LanguageProvider>
        <Flashcard
          word={mockWord2}
          currentIndex={1}
          totalCards={2}
          onGrade={vi.fn()}
        />
      </LanguageProvider>
    );

    // On frame 1 of Card 2:
    // 1. Container must NOT have rotate-y-180
    expect(cardEl?.classList.contains('rotate-y-180')).toBe(false);

    // 2. Back side must be hidden with opacity-0 and invisible
    const backFace = container.querySelector('.backface-hidden.rotate-y-180');
    expect(backFace?.classList.contains('opacity-0')).toBe(true);
    expect(backFace?.classList.contains('invisible')).toBe(true);
    expect(backFace?.getAttribute('aria-hidden')).toBe('true');

    // 3. Front face must display the new word
    const frontHeading = screen.getByRole('heading', { level: 2 });
    expect(frontHeading.textContent).toBe('resilience');

    // 4. Definition of Card 2 is NOT revealed until user intentionally flips
    fireEvent.keyDown(window, { code: 'Space' });
    expect(cardEl?.classList.contains('rotate-y-180')).toBe(true);
    expect(backFace?.classList.contains('opacity-100')).toBe(true);
    expect(backFace?.classList.contains('visible')).toBe(true);
  });

  it('Flashcard: does not trigger P or Shift+P when focused in textarea or contenteditable', () => {
    render(
      <LanguageProvider>
        <div>
          <textarea data-testid="dummy-textarea" />
          <div data-testid="dummy-editable" contentEditable={true} />
          <Flashcard
            word={mockWord}
            currentIndex={0}
            totalCards={2}
            onGrade={vi.fn()}
          />
        </div>
      </LanguageProvider>
    );

    const textarea = screen.getByTestId('dummy-textarea');
    fireEvent.keyDown(textarea, { key: 'p', code: 'KeyP' });
    fireEvent.keyDown(textarea, { key: 'P', code: 'KeyP', shiftKey: true });
    expect(playPronunciationSpy).not.toHaveBeenCalled();

    const editable = screen.getByTestId('dummy-editable');
    fireEvent.keyDown(editable, { key: 'p', code: 'KeyP' });
    fireEvent.keyDown(editable, { key: 'P', code: 'KeyP', shiftKey: true });
    expect(playPronunciationSpy).not.toHaveBeenCalled();
  });

  it('Flashcard: does not trigger shortcuts when a dialog modal is open in the DOM', () => {
    render(
      <LanguageProvider>
        <div>
          <div role="dialog" aria-modal="true">
            Modal Content
          </div>
          <Flashcard
            word={mockWord}
            currentIndex={0}
            totalCards={2}
            onGrade={vi.fn()}
          />
        </div>
      </LanguageProvider>
    );

    fireEvent.keyDown(window, { key: 'p', code: 'KeyP' });
    fireEvent.keyDown(window, { key: 'P', code: 'KeyP', shiftKey: true });
    expect(playPronunciationSpy).not.toHaveBeenCalled();
  });

  it('Flashcard: pressing P cancels active loop mode so it strictly plays once', async () => {
    vi.useFakeTimers();

    render(
      <LanguageProvider>
        <Flashcard
          word={mockWord}
          currentIndex={0}
          totalCards={2}
          onGrade={vi.fn()}
        />
      </LanguageProvider>
    );

    // Turn loop ON with Shift+P
    fireEvent.keyDown(window, { key: 'P', code: 'KeyP', shiftKey: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(1);

    // Press P to play once
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(2);

    // Advance 3000ms: loop must have been cancelled by P, so no more calls occur
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('Flashcard: respects custom loopInterval for repetition delay', async () => {
    vi.useFakeTimers();

    render(
      <LanguageProvider>
        <Flashcard
          word={mockWord}
          currentIndex={0}
          totalCards={2}
          onGrade={vi.fn()}
          loopInterval={0.8}
        />
      </LanguageProvider>
    );

    // Turn loop ON with Shift+P
    fireEvent.keyDown(window, { key: 'P', code: 'KeyP', shiftKey: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(1);

    // After 700ms, second iteration should NOT have fired yet
    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(1);

    // After another 100ms (total 800ms = 0.8s), second iteration fires
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('Flashcard: clicking cycle delay button updates delay and notifies onLoopIntervalChange', () => {
    const handleIntervalChange = vi.fn();
    render(
      <LanguageProvider>
        <Flashcard
          word={mockWord}
          currentIndex={0}
          totalCards={2}
          onGrade={vi.fn()}
          loopInterval={1.5}
          onLoopIntervalChange={handleIntervalChange}
        />
      </LanguageProvider>
    );

    // Find the cycle button (showing 1.5s on front face)
    const cycleBtn = screen.getAllByRole('button', { name: /Pronunciation loop delay|Độ trễ giữa 2 lần loop/i })[0];
    expect(cycleBtn.textContent).toContain('1.5s');

    // Click to cycle to next preset (2.0s)
    fireEvent.click(cycleBtn);
    expect(handleIntervalChange).toHaveBeenCalledWith(2);
  });

  it('SettingsModal: displays loopInterval slider and presets', async () => {
    render(
      <LanguageProvider>
        <SettingsModal
          isOpen={true}
          onClose={vi.fn()}
        />
      </LanguageProvider>
    );

    // Check for loopInterval slider
    const slider = screen.getByRole('slider', { name: /Độ trễ lặp phát âm|Pronunciation Loop Delay/i }) as HTMLInputElement;
    expect(slider).toBeDefined();

    // Check for preset chip e.g. 2s
    const preset2s = screen.getByRole('button', { name: '2s' });
    expect(preset2s).toBeDefined();

    fireEvent.click(preset2s);
    expect(slider.value).toBe('2');
  });
});
