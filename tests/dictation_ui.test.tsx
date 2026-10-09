// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { ReviewListening } from '../src/components/review/ReviewListening';
import { LanguageProvider } from '../src/context/LanguageContext';
import * as audioService from '../src/services/audio';
import type { WordItem } from '../src/types/vocab';

const mockWordApple: WordItem = {
  id: 'word-apple-1',
  word: 'apple',
  pos: ['noun'],
  phonetics: {
    us: '/ˈæp.əl/',
    uk: '/ˈæp.əl/',
    audioUs: 'https://api.dictionary.com/audio/apple-us.mp3',
    audioUk: 'https://api.dictionary.com/audio/apple-uk.mp3',
  },
  vietnameseDefinition: 'Quả táo',
  englishDefinition: 'The round fruit of a tree of the rose family.',
  meanings: [],
  collocations: [],
  examples: [{ en: 'He ate an apple.', vi: 'Anh ấy ăn một quả táo.', context: 'general' }],
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

describe('ReviewListening UI & Interactive Flow Tests', () => {
  let playPronunciationSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    playPronunciationSpy = vi.spyOn(audioService, 'playPronunciation').mockResolvedValue();

    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          speak: vi.fn(),
          cancel: vi.fn(),
          getVoices: vi.fn().mockReturnValue([]),
        },
        writable: true,
      });
    }
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
  });

  it('1. Keeps typed content and refocuses input when incorrect; does NOT advance card', () => {
    const onAnswer = vi.fn();
    render(
      <LanguageProvider>
        <ReviewListening
          word={mockWordApple}
          currentIndex={0}
          totalCards={1}
          onAnswer={onAnswer}
        />
      </LanguageProvider>
    );

    const input = screen.getByPlaceholderText('Nhập từ tiếng Anh...') as HTMLInputElement;

    // Type incorrect spelling: "aple" (missing 'p')
    fireEvent.change(input, { target: { value: 'aple' } });
    expect(input.value).toBe('aple');

    // Submit by clicking Check / Enter
    const checkBtn = screen.getByText('Kiểm tra đáp án');
    fireEvent.click(checkBtn);

    // Verify onAnswer was NOT called
    expect(onAnswer).not.toHaveBeenCalled();

    // Verify input value is STILL "aple" (not wiped)
    expect(input.value).toBe('aple');

    // Run timers for autofocus
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(document.activeElement).toBe(input);

    // Verify visual alignment diff shows missing character position
    expect(screen.getByText('Vị trí ký tự cần sửa:')).toBeDefined();
    expect(screen.getByText('Thiếu')).toBeDefined();
  });

  it('2. Missing letter does NOT disclose the correct character on initial error', () => {
    render(
      <LanguageProvider>
        <ReviewListening
          word={mockWordApple}
          currentIndex={0}
          totalCards={1}
          onAnswer={vi.fn()}
        />
      </LanguageProvider>
    );

    const input = screen.getByPlaceholderText('Nhập từ tiếng Anh...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'aple' } });
    fireEvent.click(screen.getByText('Kiểm tra đáp án'));

    // Character '+' is shown for missing, not 'p'
    expect(screen.getByText('+')).toBeDefined();
    // Answer explanation is not revealed yet
    expect(screen.queryByText('Đáp án chính xác:')).toBeNull();
  });

  it('3. Clicking "Gợi ý" reveals the character at the first error position', () => {
    render(
      <LanguageProvider>
        <ReviewListening
          word={mockWordApple}
          currentIndex={0}
          totalCards={1}
          onAnswer={vi.fn()}
        />
      </LanguageProvider>
    );

    const input = screen.getByPlaceholderText('Nhập từ tiếng Anh...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'aple' } });
    fireEvent.click(screen.getByText('Kiểm tra đáp án'));

    // Click "Gợi ý chữ cái"
    const hintBtn = screen.getByText('Gợi ý chữ cái');
    fireEvent.click(hintBtn);

    // Banner indicates position 3 is letter 'p'
    expect(screen.getByText(/Gợi ý: Ký tự tại vị trí 3 là chữ "p"/)).toBeDefined();
  });

  it('4. Correct on first attempt awards Easy (Rating 4) upon clicking Tiếp tục', () => {
    const onAnswer = vi.fn();
    render(
      <LanguageProvider>
        <ReviewListening
          word={mockWordApple}
          currentIndex={0}
          totalCards={1}
          onAnswer={onAnswer}
        />
      </LanguageProvider>
    );

    const input = screen.getByPlaceholderText('Nhập từ tiếng Anh...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'apple' } });
    fireEvent.click(screen.getByText('Kiểm tra đáp án'));

    // Should show success feedback and rating badge
    expect(screen.getByText('Chính xác! Làm tốt lắm.')).toBeDefined();
    expect(screen.getByText(/Độ nhớ cao \(FSRS: Dễ/)).toBeDefined();

    // Click Continue (Tiếp tục)
    const continueBtn = screen.getByText('Tiếp tục');
    fireEvent.click(continueBtn);

    expect(onAnswer).toHaveBeenCalledWith(4, expect.any(Object));
  });

  it('5. Minor error self-corrected without hints awards Good (Rating 3)', () => {
    const onAnswer = vi.fn();
    render(
      <LanguageProvider>
        <ReviewListening
          word={mockWordApple}
          currentIndex={0}
          totalCards={1}
          onAnswer={onAnswer}
        />
      </LanguageProvider>
    );

    const input = screen.getByPlaceholderText('Nhập từ tiếng Anh...') as HTMLInputElement;

    // 1st attempt: "aple" (1 missing letter)
    fireEvent.change(input, { target: { value: 'aple' } });
    fireEvent.click(screen.getByText('Kiểm tra đáp án'));

    // User modifies input to "apple" themselves without clicking hint
    fireEvent.change(input, { target: { value: 'apple' } });
    fireEvent.click(screen.getByText('Kiểm tra đáp án'));

    // Success with Good rating (3)
    expect(screen.getByText('Chính xác! Làm tốt lắm.')).toBeDefined();
    expect(screen.getByText(/Độ nhớ khá \(FSRS: Nhớ/)).toBeDefined();

    fireEvent.click(screen.getByText('Tiếp tục'));
    expect(onAnswer).toHaveBeenCalledWith(3, expect.any(Object));
  });

  it('6. Correct after using hint awards Hard (Rating 2)', () => {
    const onAnswer = vi.fn();
    render(
      <LanguageProvider>
        <ReviewListening
          word={mockWordApple}
          currentIndex={0}
          totalCards={1}
          onAnswer={onAnswer}
        />
      </LanguageProvider>
    );

    const input = screen.getByPlaceholderText('Nhập từ tiếng Anh...') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'aple' } });
    fireEvent.click(screen.getByText('Kiểm tra đáp án'));

    // Request hint
    fireEvent.click(screen.getByText('Gợi ý chữ cái'));

    // Fix and submit
    fireEvent.change(input, { target: { value: 'apple' } });
    fireEvent.click(screen.getByText('Kiểm tra đáp án'));

    expect(screen.getByText(/Độ nhớ thấp \(FSRS: Khó/)).toBeDefined();

    fireEvent.click(screen.getByText('Tiếp tục'));
    expect(onAnswer).toHaveBeenCalledWith(2, expect.any(Object));
  });

  it('7. Clicking "Xem đáp án" reveals answer and locks rating to Again (Rating 1)', () => {
    const onAnswer = vi.fn();
    render(
      <LanguageProvider>
        <ReviewListening
          word={mockWordApple}
          currentIndex={0}
          totalCards={1}
          onAnswer={onAnswer}
        />
      </LanguageProvider>
    );

    // Click "Xem đáp án"
    const showAnswerBtn = screen.getByText('Xem đáp án');
    fireEvent.click(showAnswerBtn);

    expect(screen.getByText('Đáp án chính xác:')).toBeDefined();
    expect(screen.getByText('Quả táo')).toBeDefined();

    // Click Tiếp tục
    const continueBtn = screen.getByText('Tiếp tục');
    fireEvent.click(continueBtn);

    expect(onAnswer).toHaveBeenCalledWith(1, expect.any(Object));
  });

  it('8. Supports Enter key to check when typing, and Enter key to Continue when finished', () => {
    const onAnswer = vi.fn();
    render(
      <LanguageProvider>
        <ReviewListening
          word={mockWordApple}
          currentIndex={0}
          totalCards={1}
          onAnswer={onAnswer}
        />
      </LanguageProvider>
    );

    const input = screen.getByPlaceholderText('Nhập từ tiếng Anh...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'apple' } });

    // Submit via form Enter
    fireEvent.submit(input.closest('form')!);

    expect(screen.getByText('Chính xác! Làm tốt lắm.')).toBeDefined();

    // Now press submit/Enter again to Continue
    fireEvent.submit(input.closest('form')!);
    expect(onAnswer).toHaveBeenCalledWith(4, expect.any(Object));
  });

  it('9. Toggling loop button starts recursive loop playback with interval', async () => {
    render(
      <LanguageProvider>
        <ReviewListening
          word={mockWordApple}
          currentIndex={0}
          totalCards={1}
          onAnswer={vi.fn()}
        />
      </LanguageProvider>
    );

    // Initial render auto-plays once
    expect(playPronunciationSpy).toHaveBeenCalledTimes(1);

    // Click Loop button (Phát lặp lại)
    const loopBtn = screen.getByTitle(/Phát âm lặp lại/i);
    fireEvent.click(loopBtn);

    // Allow first loop audio iteration promise to resolve and set loop timer
    await act(async () => {
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(2);

    // After playback finishes, advance 1499ms: should not have played next iteration yet
    await act(async () => {
      vi.advanceTimersByTime(1499);
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(2);

    // Advance 1ms (total 1500ms): should trigger next loop playback
    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(3);

    // Turn loop OFF
    fireEvent.click(loopBtn);

    // Advance another 3000ms: no more playback should occur
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(3);
  });

  it('10. Clicking "Lặp 3 lần" plays 3 iterations with intervals then stops', async () => {
    render(
      <LanguageProvider>
        <ReviewListening
          word={mockWordApple}
          currentIndex={0}
          totalCards={1}
          onAnswer={vi.fn()}
        />
      </LanguageProvider>
    );

    // Initial render auto-plays 1x
    expect(playPronunciationSpy).toHaveBeenCalledTimes(1);

    // Click "Lặp 3 lần"
    const repeat3xBtn = screen.getByText('Lặp 3 lần');
    fireEvent.click(repeat3xBtn);

    // Allow 1st of the 3 iterations promise to resolve
    await act(async () => {
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(2);

    // Advance 1500ms: 2nd iteration
    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(3);

    // Advance 1500ms: 3rd iteration
    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(4);

    // Advance another 3000ms: stops after 3 iterations
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(4);
  });

  it('11. Shift+P shortcut toggles loop mode in ReviewListening', async () => {
    render(
      <LanguageProvider>
        <ReviewListening
          word={mockWordApple}
          currentIndex={0}
          totalCards={1}
          onAnswer={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(playPronunciationSpy).toHaveBeenCalledTimes(1);

    // Press Shift+P outside input to turn loop ON
    fireEvent.keyDown(window, { key: 'P', code: 'KeyP', shiftKey: true });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(2);

    // Turn loop OFF with Shift+P
    fireEvent.keyDown(window, { key: 'P', code: 'KeyP', shiftKey: true });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(2);
  });

  it('preserves the answer and does not replay when the same word object is refreshed', () => {
    const props = { word: mockWordApple, currentIndex: 0, totalCards: 1, onAnswer: vi.fn() };
    const { rerender } = render(<LanguageProvider><ReviewListening {...props} /></LanguageProvider>);
    const input = screen.getByPlaceholderText('Nhập từ tiếng Anh...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'appl' } });
    rerender(<LanguageProvider><ReviewListening {...props} word={{ ...mockWordApple }} /></LanguageProvider>);
    expect(input.value).toBe('appl');
    expect(playPronunciationSpy).toHaveBeenCalledTimes(1);
  });

  it('single replay turns off loop mode and does not resume looping', async () => {
    render(<LanguageProvider><ReviewListening word={mockWordApple} currentIndex={0} totalCards={1} onAnswer={vi.fn()} /></LanguageProvider>);
    fireEvent.keyDown(window, { key: 'P', code: 'KeyP', shiftKey: true });
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByText(/Phát âm thanh \(1\.0x\)/i));
    expect(screen.getByRole('button', { pressed: false })).toBeDefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(3);
  });

  it('12. Multiple replays increment audio counter without downgrading retention score', () => {
    const onAnswer = vi.fn();
    render(
      <LanguageProvider>
        <ReviewListening
          word={mockWordApple}
          currentIndex={0}
          totalCards={1}
          onAnswer={onAnswer}
        />
      </LanguageProvider>
    );

    // Click 1.0x replay twice
    const play1xBtn = screen.getByText(/Phát âm thanh \(1\.0x\)/i);
    fireEvent.click(play1xBtn);
    fireEvent.click(play1xBtn);

    // Click slow 0.75x replay once
    const playSlowBtn = screen.getByText(/Nghe chậm/i);
    fireEvent.click(playSlowBtn);

    // Counter shows total replays (1 auto-play + 3 manual clicks = 4)
    expect(screen.getByText(/Đã nghe: 4 lần/i)).toBeDefined();

    // Type correct answer on 1st submission
    const input = screen.getByPlaceholderText('Nhập từ tiếng Anh...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'apple' } });
    fireEvent.click(screen.getByText('Kiểm tra đáp án'));

    // Memory score is still Easy (Rating 4) despite multiple replays!
    expect(screen.getByText(/Độ nhớ cao \(FSRS: Dễ/i)).toBeDefined();

    fireEvent.click(screen.getByText('Tiếp tục'));
    expect(onAnswer).toHaveBeenCalledWith(4, expect.any(Object));
  });

  it('allows restarting from the main button while audio is still playing', () => {
    playPronunciationSpy.mockImplementation(() => new Promise(() => {}));
    render(<LanguageProvider><ReviewListening word={mockWordApple} currentIndex={0} totalCards={1} onAnswer={vi.fn()} /></LanguageProvider>);
    const button = screen.getByRole('button', { name: 'Phát âm thanh', exact: true });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(playPronunciationSpy).toHaveBeenCalledTimes(3);
  });

  it('ignores held shortcut keys instead of repeatedly restarting audio', () => {
    render(<LanguageProvider><ReviewListening word={mockWordApple} currentIndex={0} totalCards={1} onAnswer={vi.fn()} /></LanguageProvider>);
    fireEvent.keyDown(window, { code: 'Space', ctrlKey: true, repeat: true });
    fireEvent.keyDown(window, { key: 'P', code: 'KeyP', shiftKey: true, repeat: true });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(1);
  });

  it('continuous listening never submits a grade or reduces the final score', async () => {
    const onAnswer = vi.fn();
    render(<LanguageProvider><ReviewListening word={mockWordApple} currentIndex={0} totalCards={1} onAnswer={onAnswer} /></LanguageProvider>);
    fireEvent.keyDown(window, { key: 'P', code: 'KeyP', shiftKey: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(playPronunciationSpy.mock.calls.length).toBeGreaterThan(10);
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('Nhập từ tiếng Anh...'), { target: { value: 'apple' } });
    fireEvent.click(screen.getByText('Kiểm tra đáp án'));
    fireEvent.click(screen.getByText('Tiếp tục'));
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(4, expect.any(Object));
  });

  it.each(['correct', 'reveal'] as const)('keeps looping on the next word after %s, without restarting old audio', async (finish) => {
    const completions: Array<() => void> = [];
    playPronunciationSpy.mockImplementation(() => new Promise<void>((resolve) => completions.push(resolve)));
    const pear = { ...mockWordApple, id: 'pear', word: 'pear' };
    const onAnswer = vi.fn();
    function Session() {
      const [index, setIndex] = React.useState(0);
      const [looping, setLooping] = React.useState(false);
      return <ReviewListening
        word={index === 0 ? mockWordApple : pear}
        currentIndex={index}
        totalCards={2}
        isLooping={looping}
        onToggleLoop={setLooping}
        onAnswer={(rating) => { onAnswer(rating); setIndex(1); }}
      />;
    }
    render(<LanguageProvider><Session /></LanguageProvider>);
    fireEvent.keyDown(window, { key: 'P', code: 'KeyP', shiftKey: true });
    if (finish === 'correct') {
      fireEvent.change(screen.getByPlaceholderText('Nhập từ tiếng Anh...'), { target: { value: 'apple' } });
      fireEvent.click(screen.getByText('Kiểm tra đáp án'));
    } else {
      fireEvent.click(screen.getByText('Xem đáp án'));
    }
    expect(screen.getByRole('button', { pressed: true })).toBeDefined();
    const callsBeforeContinue = playPronunciationSpy.mock.calls.length;
    await act(async () => {
      completions.forEach((complete) => complete());
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(callsBeforeContinue);
    fireEvent.click(screen.getByText('Tiếp tục'));
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(finish === 'correct' ? 4 : 1);
    expect(screen.getByRole('button', { pressed: true })).toBeDefined();
    expect(playPronunciationSpy).toHaveBeenLastCalledWith('pear', 'US', expect.any(String), expect.any(Object));
    await act(async () => {
      completions.at(-1)!();
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(playPronunciationSpy).toHaveBeenCalledTimes(callsBeforeContinue + 2);
    expect(playPronunciationSpy).toHaveBeenLastCalledWith('pear', 'US', expect.any(String), expect.any(Object));
  });

  it('20. Displays Vietnamese meaning by default during dictation and supports hide/show toggle', () => {
    render(
      <LanguageProvider>
        <ReviewListening
          word={mockWordApple}
          currentIndex={0}
          totalCards={1}
          onAnswer={vi.fn()}
        />
      </LanguageProvider>
    );

    // Header label for Vietnamese meaning is visible
    expect(screen.getByText('Nghĩa tiếng Việt')).toBeDefined();
    expect(screen.getByText('Quả táo')).toBeDefined();
    expect(screen.getByText('noun')).toBeDefined();

    // Click "Ẩn nghĩa" button
    const hideBtn = screen.getByText('Ẩn nghĩa');
    fireEvent.click(hideBtn);

    // Meaning text is hidden, placeholder is displayed
    expect(screen.queryByText('Quả táo')).toBeNull();
    expect(screen.getByText(/Nghĩa tiếng Việt đang ẩn/)).toBeDefined();

    // Click "Hiện nghĩa" button
    const showBtn = screen.getByText('Hiện nghĩa');
    fireEvent.click(showBtn);

    // Meaning is visible again
    expect(screen.getByText('Quả táo')).toBeDefined();
  });

  it('21. Displays multi-sense numbered definitions cleanly in dictation review', () => {
    const multiSenseWord: WordItem = {
      ...mockWordApple,
      id: 'word-pool',
      word: 'pool',
      vietnameseDefinition: '1. Hồ bơi; 2. Nhóm người, quỹ chung',
    };

    render(
      <LanguageProvider>
        <ReviewListening
          word={multiSenseWord}
          currentIndex={0}
          totalCards={1}
          onAnswer={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(screen.getByText('Hồ bơi')).toBeDefined();
    expect(screen.getByText('Nhóm người, quỹ chung')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });
});
