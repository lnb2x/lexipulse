import type React from 'react';
import type { WordStatus } from '../../types/vocab';

interface BadgeProps {
  status: WordStatus;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1 font-medium';

  switch (status) {
    case 'new':
      return (
        <span
          className={`inline-flex items-center rounded-full border border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 ${sizeClasses}`}
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
          New
        </span>
      );
    case 'learning':
      return (
        <span
          className={`inline-flex items-center rounded-full border border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 ${sizeClasses}`}
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
          Learning
        </span>
      );
    case 'review_needed':
      return (
        <span
          className={`inline-flex items-center rounded-full border border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 ${sizeClasses}`}
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
          Review Needed
        </span>
      );
    case 'mastered':
      return (
        <span
          className={`inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ${sizeClasses}`}
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Mastered
        </span>
      );
    default:
      return null;
  }
};
