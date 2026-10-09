import { Volume2 } from 'lucide-react';
import { useState } from 'react';
import { playPronunciation } from '../../services/audio';
import { GlassButton } from './Glass';
import { GlassTooltip } from './GlassTooltip';

interface AudioButtonProps {
  text: string;
  accent?: 'US' | 'UK';
  audioUrl?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  shortcutHint?: string;
  isPlaying?: boolean;
}

export const AudioButton: React.FC<AudioButtonProps> = ({
  text,
  accent = 'US',
  audioUrl,
  showLabel = true,
  size = 'md',
  className = '',
  shortcutHint,
  isPlaying: externalIsPlaying,
}) => {
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;

  const handlePlay = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isPlaying) return;

    setInternalIsPlaying(true);
    try {
      await playPronunciation(text, accent, audioUrl);
    } catch (err) {
      console.warn('Playback error:', err);
    } finally {
      setInternalIsPlaying(false);
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

  const tooltip = `Pronounce ${text} (${accent})${shortcutHint ? ` [${shortcutHint}]` : ''}`;

  return (
    <GlassTooltip label={tooltip}><GlassButton
      type="button"
      onClick={handlePlay}
      disabled={isPlaying}
      busy={isPlaying}
      aria-label={tooltip}
      aria-keyshortcuts={shortcutHint}
      className={`glass-pronunciation-button ${!showLabel ? 'glass-icon-button' : ''} ${paddingClasses[size]} ${className}`}
    >
      <Volume2 className={`${iconSizes[size]} ${isPlaying ? 'animate-bounce text-indigo-500' : ''}`} />
      {showLabel && (
        <span className="font-semibold tracking-wider text-[11px] uppercase">
          {accent}
        </span>
      )}
    </GlassButton></GlassTooltip>
  );
};
