// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playPronunciation, stopPronunciation } from '../src/services/audio';

class MockAudio {
  static instances: MockAudio[] = [];
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  currentTime = 0;
  playbackRate = 1;
  pause = vi.fn();
  rejectPlay!: (error: Error) => void;
  play = vi.fn(() => new Promise<void>((_, reject) => { this.rejectPlay = reject; }));
  constructor() { MockAudio.instances.push(this); }
}

describe('Pronunciation playback isolation', () => {
  const speak = vi.fn();
  beforeEach(() => {
    MockAudio.instances = [];
    speak.mockClear();
    vi.stubGlobal('Audio', MockAudio);
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] });
  });
  afterEach(() => {
    stopPronunciation();
    vi.unstubAllGlobals();
  });

  it('starts the fallback only once when both media error paths fire', async () => {
    const playback = playPronunciation('apple', 'US', '/apple.mp3', { preferNative: false });
    const audio = MockAudio.instances[0];
    audio.onerror!();
    audio.rejectPlay(new Error('Media failed'));
    await Promise.resolve();
    expect(speak).toHaveBeenCalledTimes(1);
    speak.mock.calls[0][0].onend();
    await playback;
  });

  it('does not restart canceled audio when its play promise rejects late', async () => {
    const oldPlayback = playPronunciation('apple', 'US', '/apple.mp3', { preferNative: false });
    const oldAudio = MockAudio.instances[0];
    const playback = playPronunciation('pear', 'US', '/pear.mp3', { preferNative: false });
    oldAudio.rejectPlay(new Error('Interrupted'));
    await oldPlayback;
    expect(speak).not.toHaveBeenCalled();
    MockAudio.instances[1].onended!();
    await playback;
  });

  it('ignores a stale speech completion when stopping newer remote audio', async () => {
    const oldPlayback = playPronunciation('apple');
    const oldUtterance = speak.mock.calls[0][0];
    const playback = playPronunciation('pear', 'US', '/pear.mp3', { preferNative: false });
    oldUtterance.onend();
    stopPronunciation();
    expect(MockAudio.instances[0].pause).toHaveBeenCalledTimes(1);
    await Promise.all([oldPlayback, playback]);
  });

  it('applies the requested slow speed to recorded audio', () => {
    void playPronunciation('apple', 'US', '/apple.mp3', { preferNative: false, rate: 0.75 });
    expect(MockAudio.instances[0].playbackRate).toBe(0.75);
  });
});
