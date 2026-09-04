export interface AudioOptions {
  rate?: number;
  pitch?: number;
  preferNative?: boolean;
}

let cachedVoices: SpeechSynthesisVoice[] = [];

/**
 * Initializes and caches browser synthesis voices.
 */
export function initSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
      resolve(voices);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    };

    // Fallback timeout in case onvoiceschanged does not fire
    setTimeout(() => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    }, 500);
  });
}

/**
 * Find the most natural voice matching specified accent ('US' or 'UK')
 */
function findVoice(accent: 'US' | 'UK'): SpeechSynthesisVoice | null {
  if (cachedVoices.length === 0 && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    cachedVoices = window.speechSynthesis.getVoices();
  }

  const langCode = accent === 'UK' ? 'en-GB' : 'en-US';

  // 1. Try exact match with high quality voice names (Google, Natural, Siri, Daniel, Samantha, etc.)
  const highQualityMatch = cachedVoices.find(
    (v) =>
      v.lang.toLowerCase().startsWith(langCode.toLowerCase()) &&
      (v.name.includes('Natural') ||
        v.name.includes('Google') ||
        v.name.includes('Premium') ||
        v.name.includes('Online') ||
        v.name.includes('Enhanced'))
  );
  if (highQualityMatch) return highQualityMatch;

  // 2. Try any voice matching langCode
  const langMatch = cachedVoices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(langCode.toLowerCase()));
  if (langMatch) return langMatch;

  // 3. Try any English voice
  const englishFallback = cachedVoices.find((v) => v.lang.toLowerCase().startsWith('en'));
  return englishFallback || null;
}

let activeAudioElement: HTMLAudioElement | null = null;

/**
 * Plays English pronunciation using Web Speech API with fallback to audio element
 */
export function playPronunciation(
  text: string,
  accent: 'US' | 'UK' = 'US',
  remoteAudioUrl?: string,
  options?: AudioOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    // Stop any currently playing audio
    if (activeAudioElement) {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
      activeAudioElement = null;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // If remote audio URL is explicitly provided and preferNative is false, try remote audio first
    if (remoteAudioUrl && options?.preferNative === false) {
      const audio = new Audio(remoteAudioUrl);
      activeAudioElement = audio;
      audio.onended = () => {
        activeAudioElement = null;
        resolve();
      };
      audio.onerror = () => {
        // Fallback to SpeechSynthesis if remote URL fails
        fallbackToSpeechSynthesis(text, accent, options, resolve, reject);
      };
      audio.play().catch(() => {
        fallbackToSpeechSynthesis(text, accent, options, resolve, reject);
      });
      return;
    }

    // Default: use Native Web Speech API for instant zero-latency speech
    fallbackToSpeechSynthesis(text, accent, options, resolve, reject);
  });
}

function fallbackToSpeechSynthesis(
  text: string,
  accent: 'US' | 'UK',
  options: AudioOptions | undefined,
  resolve: () => void,
  _reject: (err: any) => void
) {
  if (!('speechSynthesis' in window)) {
    resolve();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = accent === 'UK' ? 'en-GB' : 'en-US';
  utterance.rate = options?.rate ?? 0.95; // slightly slower for optimal clarity
  utterance.pitch = options?.pitch ?? 1.0;

  const selectedVoice = findVoice(accent);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.onend = () => resolve();
  utterance.onerror = () => resolve(); // Resolve gracefully on cancel/interrupt

  window.speechSynthesis.speak(utterance);
}
