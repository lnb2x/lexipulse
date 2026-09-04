import { Edit3, Tag, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { formatDueText, formatInterval } from '../../services/sm2';
import type { WordItem } from '../../types/vocab';
import { AudioButton } from '../common/AudioButton';
import { Badge } from '../common/Badge';
import { WordFamilyInteractive } from '../common/WordFamilyInteractive';

interface WordDetailModalProps {
  word: WordItem | null;
  onClose: () => void;
  onEdit: (word: WordItem) => void;
  onDelete: (id: string) => void;
  deckWords?: WordItem[];
  onLookupWord?: (word: string) => void;
  onSelectDeckWord?: (word: WordItem) => void;
  onAddWordToDeck?: (word: string) => Promise<void> | void;
}

export const WordDetailModal: React.FC<WordDetailModalProps> = ({
  word,
  onClose,
  onEdit,
  onDelete,
  deckWords = [],
  onLookupWord,
  onSelectDeckWord,
  onAddWordToDeck,
}) => {
  const { language, t } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!word) return null;

  const dueInfo = formatDueText(word.reviewMeta.dueDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="relative my-8 w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-5 dark:border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {word.word}
              </h2>
              <Badge status={word.status} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {word.pos.map((p) => (
                <span
                  key={p}
                  className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 italic"
                >
                  {p}
                </span>
              ))}
              <span className="text-xs text-slate-400">
                US {word.phonetics.us} | UK {word.phonetics.uk || word.phonetics.us}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AudioButton text={word.word} accent="US" audioUrl={word.phonetics.audioUs} size="sm" />
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="mt-5 space-y-5 max-h-[65vh] overflow-y-auto pr-1">
          {/* Vietnamese Definition */}
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {language === 'vi' ? 'Định nghĩa Tiếng Việt' : 'Vietnamese Meaning'}
            </span>
            <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
              {word.vietnameseDefinition}
            </p>
            {word.englishDefinition && (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {word.englishDefinition}
              </p>
            )}
          </div>

          {/* Spaced Repetition Meta Card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {language === 'vi' ? 'Thống kê lặp lại ngắt quãng (SM-2)' : 'Spaced Repetition Stats (SM-2)'}
            </h3>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-xl bg-white p-2.5 shadow-sm dark:bg-slate-900">
                <span className="text-[10px] text-slate-400 font-medium">{t.deck.interval}</span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {formatInterval(word.reviewMeta.interval)}
                </p>
              </div>
              <div className="rounded-xl bg-white p-2.5 shadow-sm dark:bg-slate-900">
                <span className="text-[10px] text-slate-400 font-medium">{t.deck.reps}</span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {word.reviewMeta.repetition}
                </p>
              </div>
              <div className="rounded-xl bg-white p-2.5 shadow-sm dark:bg-slate-900">
                <span className="text-[10px] text-slate-400 font-medium">
                  {language === 'vi' ? 'Hệ số nhớ' : 'Ease Factor'}
                </span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {word.reviewMeta.easeFactor.toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl bg-white p-2.5 shadow-sm dark:bg-slate-900">
                <span className="text-[10px] text-slate-400 font-medium">
                  {language === 'vi' ? 'Hạn ôn tập' : 'Due Date'}
                </span>
                <p
                  className={`text-xs font-bold truncate ${
                    dueInfo.isOverdue ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {dueInfo.text}
                </p>
              </div>
            </div>

            {/* Review History */}
            {word.reviewMeta.history && word.reviewMeta.history.length > 0 && (
              <div className="mt-3 border-t border-slate-200/60 pt-2.5 dark:border-slate-700/60">
                <span className="text-[11px] font-semibold text-slate-500">
                  {language === 'vi' ? 'Lịch sử ôn tập gần đây:' : 'Recent reviews:'}
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {word.reviewMeta.history.slice(-5).map((h, i) => (
                    <span
                      key={i}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                        h.rating === 3
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : h.rating === 2
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {new Date(h.date).toLocaleDateString()}: Rating {h.rating} ({formatInterval(h.interval)})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Collocations & Word Family */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t.lookup.collocations}
              </span>
              <ul className="mt-2 space-y-1.5 text-xs">
                {word.collocations.map((c, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{c.phrase}</span>
                    <span className="text-slate-500">{c.meaningVi}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                {t.lookup.wordFamily}
              </span>
              <WordFamilyInteractive
                wordFamily={word.wordFamily}
                currentWord={word.word}
                deckWords={deckWords}
                onLookupWord={onLookupWord}
                onSelectDeckWord={onSelectDeckWord}
                onAddWordToDeck={onAddWordToDeck}
              />
            </div>
          </div>

          {/* Examples */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.lookup.examples}
            </span>
            {word.examples.map((ex, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">
                    {ex.context}
                  </span>
                  <AudioButton text={ex.en} size="sm" showLabel={false} />
                </div>
                <p className="mt-1 text-xs font-medium text-slate-900 dark:text-slate-100">{ex.en}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{ex.vi}</p>
              </div>
            ))}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            <Tag className="h-3.5 w-3.5 text-indigo-500 mr-1" />
            {word.tags.map((tg) => (
              <span
                key={tg}
                className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
              >
                {tg}
              </span>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          <div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onDelete(word.id)}
                  className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                >
                  {language === 'vi' ? 'Xác nhận xóa' : 'Confirm Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {language === 'vi' ? 'Xóa thẻ' : 'Delete card'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(word)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {language === 'vi' ? 'Chỉnh sửa' : 'Edit'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              {language === 'vi' ? 'Đóng' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
