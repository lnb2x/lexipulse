import { Volume2 } from 'lucide-react';
import { useState } from 'react';
import { playPronunciation } from '../../services/audio';

interface AudioButtonProps {
  text: string;
  accent?: 'US' | 'UK';
  audioUrl?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AudioButton: React.FC<AudioButtonProps> = ({
  text,
  accent = 'US',
  audioUrl,
  showLabel = true,
  size = 'md',
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) return;

    setIsPlaying(true);
    try {
      await playPronunciation(text, accent, audioUrl);
    } catch (err) {
      console.warn('Playback error:', err);
    } finally {
      setIsPlaying(false);
    }
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const paddingClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1.5 text-xs',
    lg: 'px-3.5 py-2 text-sm',
  };

  return (
    <button
      type="button"
      onClick={handlePlay}
      disabled={isPlaying}
      title={`Pronounce ${text} (${accent})`}
      className={`inline-flex items-center gap-1.5 rounded-lg border transition-all duration-200 active:scale-95 ${
        accent === 'US'
          ? 'border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60'
          : 'border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60'
      } ${paddingClasses[size]} ${className}`}
    >
      <Volume2 className={`${iconSizes[size]} ${isPlaying ? 'animate-bounce text-indigo-500' : ''}`} />
      {showLabel && (
        <span className="font-semibold tracking-wider text-[11px] uppercase">
          {accent}
        </span>
      )}
    </button>
  );
};
