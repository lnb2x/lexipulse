import { Command, X } from 'lucide-react';
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useModalA11y } from '../../hooks/useModalA11y';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const { language, t } = useLanguage();
  const modalRef = useModalA11y({ isOpen, onClose });

  if (!isOpen) return null;

  const shortcuts = language === 'vi' ? [
    { key: 'Enter', description: 'Tra cứu từ vựng hoặc nộp đáp án câu hỏi' },
    { key: 'Space', description: 'Lật qua lại giữa mặt trước & sau flashcard' },
    { key: 'R / A', description: 'Phát âm thanh từ vựng (Shift + R: giọng Anh)' },
    { key: 'Ctrl + Space', description: 'Nghe lại âm thanh từ vựng (kể cả khi đang nhập)' },
    { key: '1', description: 'Đánh giá "Lặp lại" (chưa nhớ từ)' },
    { key: '2', description: 'Đánh giá "Khó" (nhớ nhưng vất vả)' },
    { key: '3', description: 'Đánh giá "Nhớ / Tốt" (khoảng cách chuẩn)' },
    { key: '4', description: 'Đánh giá "Dễ nhớ" (tăng khoảng cách tối đa)' },
    { key: 'Alt + 1', description: 'Chuyển nhanh sang tab Tra từ' },
    { key: 'Alt + 2', description: 'Chuyển nhanh sang tab Bộ từ vựng' },
    { key: 'Alt + 3', description: 'Chuyển nhanh sang tab Ôn tập SRS' },
  ] : [
    { key: 'Enter', description: 'Search dictionary word or submit answers' },
    { key: 'Space', description: 'Flip flashcard between Front & Back' },
    { key: 'R / A', description: 'Play word pronunciation (Shift + R: UK accent)' },
    { key: 'Ctrl + Space', description: 'Replay audio pronunciation (even while typing)' },
    { key: '1', description: 'Rate card as "Again" (forgot word)' },
    { key: '2', description: 'Rate card as "Hard" (recalled with difficulty)' },
    { key: '3', description: 'Rate card as "Good" (standard interval)' },
    { key: '4', description: 'Rate card as "Easy" (maximum interval)' },
    { key: 'Alt + 1', description: 'Switch to Lookup tab' },
    { key: 'Alt + 2', description: 'Switch to Deck tab' },
    { key: 'Alt + 3', description: 'Switch to Review tab' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xl dark:border-slate-800 dark:bg-[#111622]"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Command className="h-5 w-5" />
            </div>
            <div>
              <h2 id="shortcuts-dialog-title" className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {t.modals.shortcutsTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'vi' ? 'Tăng tốc độ học và ghi nhớ' : 'Boost your study efficiency'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={language === 'vi' ? 'Đóng cửa sổ phím tắt' : 'Close shortcuts modal'}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between py-2.5 text-xs sm:text-sm">
              <span className="text-slate-600 dark:text-slate-300 font-medium">{s.description}</span>
              <kbd className="kbd-shortcut font-semibold">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-[0.99] transition-all"
          >
            {language === 'vi' ? 'Đã hiểu' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
