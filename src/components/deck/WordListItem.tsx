import { Calendar, ChevronRight, Clock, Edit3, Trash2 } from 'lucide-react';
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { formatDueText, formatInterval } from '../../services/sm2';
import type { WordItem } from '../../types/vocab';
import { AudioButton } from '../common/AudioButton';
import { Badge } from '../common/Badge';

interface WordListItemProps {
  word: WordItem;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const WordListItem: React.FC<WordListItemProps> = ({
  word,
  onClick,
  onEdit,
  onDelete,
}) => {
  const { language, t } = useLanguage();
  const dueInfo = formatDueText(word.reviewMeta.dueDate);
  const createdDateStr = new Date(
    word.createdAt && !isNaN(word.createdAt) ? word.createdAt : Date.now()
  ).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-subtle transition-all duration-150 hover:border-indigo-300 hover:shadow-card dark:border-slate-800 dark:bg-[#121824] dark:hover:border-slate-700 cursor-pointer"
    >
      {/* Left side: Word, POS, IPA, Vietnamese Definition */}
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors dark:text-white dark:group-hover:text-indigo-400">
            {word.word}
          </h3>

          {word.phonetics.us && word.phonetics.us !== `/${word.word}/` ? (
            <span className="text-xs font-mono text-slate-400">
              {word.phonetics.us || word.phonetics.uk}
            </span>
          ) : null}

          <div className="flex gap-1">
            {word.pos.map((p) => (
              <span
                key={p}
                className="rounded-md border border-slate-200/70 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 italic"
              >
                {p}
              </span>
            ))}
          </div>

          <Badge status={word.status} size="sm" />
        </div>

        {/* Vietnamese definition */}
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 line-clamp-1">
          {word.vietnameseDefinition}
        </p>

        {/* Collocations & Tags preview */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {word.collocations.slice(0, 2).map((c, i) => (
            <span
              key={i}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-400"
            >
              {c.phrase}
            </span>
          ))}

          {word.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded border border-indigo-100 bg-indigo-50/60 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              {t}
            </span>
          ))}

          <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
            <Calendar className="h-2.5 w-2.5" />
            {createdDateStr}
          </span>
        </div>
      </div>

      {/* Right side: SRS info & Actions */}
      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 border-t sm:border-t-0 border-slate-100 pt-2.5 sm:pt-0 dark:border-slate-800/60">
        {/* Interval & Due text */}
        <div className="text-left sm:text-right">
          <div className="flex items-center sm:justify-end gap-1 text-xs font-semibold">
            <Clock className="h-3 w-3 text-slate-400" />
            <span className={dueInfo.isOverdue ? 'text-rose-500 font-bold' : 'text-slate-500 dark:text-slate-400'}>
              {dueInfo.text}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            {t.deck.interval} {formatInterval(word.reviewMeta.interval)} ({word.reviewMeta.repetition} {t.deck.reps})
          </p>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <AudioButton
            text={word.word}
            accent="US"
            audioUrl={word.phonetics.audioUs}
            size="sm"
            showLabel={false}
          />

          <button
            type="button"
            onClick={onEdit}
            title="Chỉnh sửa từ này"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onDelete}
            title="Xóa khỏi bộ từ"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          <div className="hidden sm:block text-slate-300 dark:text-slate-600">
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
};
