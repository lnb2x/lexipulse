import { Command, X } from 'lucide-react';
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const { language, t } = useLanguage();
  if (!isOpen) return null;

  const shortcuts = language === 'vi' ? [
    { key: 'Enter', description: 'Tra cứu từ vựng hoặc nộp đáp án câu hỏi' },
    { key: 'Space', description: 'Lật qua lại giữa mặt trước & sau flashcard' },
    { key: '1', description: 'Đánh giá "Lặp lại" (ôn lại sau 1 ngày)' },
    { key: '2', description: 'Đánh giá "Tốt" (tăng khoảng cách 3+ ngày)' },
    { key: '3', description: 'Đánh giá "Dễ nhớ" (tăng khoảng cách 7+ ngày)' },
    { key: 'Alt + 1', description: 'Chuyển nhanh sang tab Tra từ' },
    { key: 'Alt + 2', description: 'Chuyển nhanh sang tab Bộ từ vựng' },
    { key: 'Alt + 3', description: 'Chuyển nhanh sang tab Ôn tập SRS' },
  ] : [
    { key: 'Enter', description: 'Search dictionary word or submit answers' },
    { key: 'Space', description: 'Flip flashcard between Front & Back' },
    { key: '1', description: 'Rate card as "Again" (1 day interval)' },
    { key: '2', description: 'Rate card as "Good" (3+ days interval)' },
    { key: '3', description: 'Rate card as "Easy" (7+ days interval)' },
    { key: 'Alt + 1', description: 'Switch to Lookup tab' },
    { key: 'Alt + 2', description: 'Switch to Deck tab' },
    { key: 'Alt + 3', description: 'Switch to Review tab' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20">
              <Command className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.modals.shortcutsTitle}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'vi' ? 'Tăng tốc độ học và ghi nhớ' : 'Boost your study efficiency'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-slate-600 dark:text-slate-300">{s.description}</span>
              <kbd className="min-w-[28px] rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-center font-mono text-xs font-semibold text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {language === 'vi' ? 'Đã hiểu' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
