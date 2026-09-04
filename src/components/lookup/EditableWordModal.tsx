import { Calendar, Plus, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { WordItem } from '../../types/vocab';
import { formatLocalDate, parseLocalDateToTimestamp } from '../../utils/dateUtils';

interface EditableWordModalProps {
  isOpen: boolean;
  word: WordItem;
  isNew?: boolean;
  onClose: () => void;
  onSave: (updatedWord: WordItem) => void;
}

export const EditableWordModal: React.FC<EditableWordModalProps> = ({
  isOpen,
  word,
  isNew = false,
  onClose,
  onSave,
}) => {
  const { language } = useLanguage();
  const [editedWord, setEditedWord] = useState<WordItem>({ ...word });
  const [newTag, setNewTag] = useState('');

  // Sync state whenever modal opens or target word changes
  React.useEffect(() => {
    if (isOpen) {
      setEditedWord({
        ...word,
        createdAt: word.createdAt && !isNaN(word.createdAt) ? word.createdAt : Date.now(),
      });
      setNewTag('');
    }
  }, [isOpen, word]);

  if (!isOpen) return null;

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const tagFormatted = newTag.startsWith('#') ? newTag.trim() : `#${newTag.trim()}`;
    if (!editedWord.tags.includes(tagFormatted)) {
      setEditedWord({
        ...editedWord,
        tags: [...editedWord.tags, tagFormatted],
      });
    }
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditedWord({
      ...editedWord,
      tags: editedWord.tags.filter((t) => t !== tagToRemove),
    });
  };

  const handleAddCollocation = () => {
    setEditedWord({
      ...editedWord,
      collocations: [...editedWord.collocations, { phrase: '', meaningVi: '' }],
    });
  };

  const handleUpdateCollocation = (index: number, field: 'phrase' | 'meaningVi', value: string) => {
    const updated = [...editedWord.collocations];
    updated[index] = { ...updated[index], [field]: value };
    setEditedWord({ ...editedWord, collocations: updated });
  };

  const handleRemoveCollocation = (index: number) => {
    setEditedWord({
      ...editedWord,
      collocations: editedWord.collocations.filter((_, i) => i !== index),
    });
  };

  const handleAddWordFamily = () => {
    setEditedWord({
      ...editedWord,
      wordFamily: [...(editedWord.wordFamily || []), { word: '', pos: 'noun', meaningVi: '' }],
    });
  };

  const handleUpdateWordFamily = (index: number, field: 'word' | 'pos' | 'meaningVi', value: string) => {
    const updated = [...(editedWord.wordFamily || [])];
    updated[index] = { ...updated[index], [field]: value };
    setEditedWord({ ...editedWord, wordFamily: updated });
  };

  const handleRemoveWordFamily = (index: number) => {
    setEditedWord({
      ...editedWord,
      wordFamily: (editedWord.wordFamily || []).filter((_, i) => i !== index),
    });
  };

  const handleAddExample = () => {
    setEditedWord({
      ...editedWord,
      examples: [...editedWord.examples, { en: '', vi: '', context: 'toeic' }],
    });
  };

  const handleUpdateExample = (index: number, field: 'en' | 'vi', value: string) => {
    const updated = [...editedWord.examples];
    updated[index] = { ...updated[index], [field]: value };
    setEditedWord({ ...editedWord, examples: updated });
  };

  const handleRemoveExample = (index: number) => {
    const updated = editedWord.examples.filter((_, i) => i !== index);
    setEditedWord({ ...editedWord, examples: updated });
  };

  const handleTogglePos = (posChoice: string) => {
    const current = editedWord.pos || [];
    if (current.includes(posChoice)) {
      if (current.length > 1) {
        setEditedWord({ ...editedWord, pos: current.filter((p) => p !== posChoice) });
      }
    } else {
      setEditedWord({ ...editedWord, pos: [...current, posChoice] });
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedWord.word.trim()) return;
    onSave({
      ...editedWord,
      word: editedWord.word.trim().toLowerCase(),
    });
    onClose();
  };

  const isCreating = isNew || !word.word;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="relative my-8 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {isCreating
                ? (language === 'vi' ? 'Thêm từ vựng mới vào Deck' : 'Add New Word to Deck')
                : (
                  <>
                    {language === 'vi' ? 'Chỉnh sửa từ vựng:' : 'Edit Vocabulary Entry:'}{' '}
                    <span className="text-indigo-600 dark:text-indigo-400">{editedWord.word || word.word}</span>
                  </>
                )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'vi'
                ? 'Tùy chỉnh từ vựng, định nghĩa, collocations, ví dụ, ngày thêm và thẻ phân loại.'
                : 'Customize word, definitions, collocations, examples, date added, and tags.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="mt-5 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Word Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {language === 'vi' ? 'Từ vựng / Cụm từ (Tiếng Anh)' : 'English Word / Phrase'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={editedWord.word}
              onChange={(e) => setEditedWord({ ...editedWord, word: e.target.value })}
              placeholder={language === 'vi' ? 'Ví dụ: facility, funding, secure funding...' : 'e.g. facility, funding...'}
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Part of Speech Badges */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {language === 'vi' ? 'Từ loại (Part of Speech)' : 'Part of Speech'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {['noun', 'verb', 'adjective', 'adverb', 'phrase', 'preposition'].map((pos) => {
                const active = (editedWord.pos || []).includes(pos);
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => handleTogglePos(pos)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {pos}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vietnamese Definition */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {language === 'vi' ? 'Nghĩa cốt lõi Tiếng Việt' : 'Core Vietnamese Meaning'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={editedWord.vietnameseDefinition}
              onChange={(e) => setEditedWord({ ...editedWord, vietnameseDefinition: e.target.value })}
              placeholder={language === 'vi' ? 'Ví dụ: Cơ sở, tiện nghi, điều kiện thuận lợi' : 'Vietnamese translation'}
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* English Definition */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {language === 'vi' ? 'Định nghĩa Tiếng Anh' : 'English Definition'}
            </label>
            <textarea
              rows={2}
              value={editedWord.englishDefinition}
              onChange={(e) => setEditedWord({ ...editedWord, englishDefinition: e.target.value })}
              placeholder={language === 'vi' ? 'Định nghĩa chi tiết bằng tiếng Anh...' : 'English definition...'}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Date Added row */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-indigo-500" />
              {language === 'vi' ? 'Ngày thêm vào Deck' : 'Date Added to Deck'}
            </label>
            <input
              type="date"
              value={
                editedWord.createdAt && !isNaN(editedWord.createdAt)
                  ? formatLocalDate(editedWord.createdAt)
                  : formatLocalDate()
              }
              onChange={(e) => {
                if (e.target.value) {
                  const parsed = parseLocalDateToTimestamp(e.target.value, 'noon');
                  if (!isNaN(parsed)) {
                    setEditedWord({ ...editedWord, createdAt: parsed });
                  }
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Collocations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {language === 'vi' ? 'Collocations thông dụng' : 'High-yield Collocations'}
              </label>
              <button
                type="button"
                onClick={handleAddCollocation}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                <Plus className="h-3 w-3" /> {language === 'vi' ? 'Thêm cụm' : 'Add phrase'}
              </button>
            </div>
            {editedWord.collocations.map((c, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={language === 'vi' ? 'Cụm từ tiếng Anh' : 'English phrase'}
                  value={c.phrase}
                  onChange={(e) => handleUpdateCollocation(idx, 'phrase', e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <input
                  type="text"
                  placeholder={language === 'vi' ? 'Nghĩa tiếng Việt' : 'Vietnamese meaning'}
                  value={c.meaningVi}
                  onChange={(e) => handleUpdateCollocation(idx, 'meaningVi', e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveCollocation(idx)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Word Family */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {language === 'vi' ? 'Gia đình từ (Word Family)' : 'Word Family (Derivatives)'}
              </label>
              <button
                type="button"
                onClick={handleAddWordFamily}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                <Plus className="h-3 w-3" /> {language === 'vi' ? 'Thêm dạng từ' : 'Add form'}
              </button>
            </div>
            {(editedWord.wordFamily || []).length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                {language === 'vi' ? 'Chưa có từ phái sinh nào' : 'No word family members'}
              </p>
            ) : (
              (editedWord.wordFamily || []).map((wf, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-900/40"
                >
                  <input
                    type="text"
                    placeholder={language === 'vi' ? 'Từ phái sinh (ví dụ: facilitate)' : 'Derivative (e.g. facilitate)'}
                    value={wf.word}
                    onChange={(e) => handleUpdateWordFamily(idx, 'word', e.target.value)}
                    className="w-full sm:w-1/3 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <select
                    value={wf.pos}
                    onChange={(e) => handleUpdateWordFamily(idx, 'pos', e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="noun">{language === 'vi' ? 'Danh từ (n)' : 'Noun'}</option>
                    <option value="verb">{language === 'vi' ? 'Động từ (v)' : 'Verb'}</option>
                    <option value="adjective">{language === 'vi' ? 'Tính từ (adj)' : 'Adjective'}</option>
                    <option value="adverb">{language === 'vi' ? 'Trạng từ (adv)' : 'Adverb'}</option>
                  </select>
                  <input
                    type="text"
                    placeholder={language === 'vi' ? 'Nghĩa tiếng Việt (ví dụ: tạo điều kiện thuận lợi)' : 'Vietnamese meaning'}
                    value={wf.meaningVi || ''}
                    onChange={(e) => handleUpdateWordFamily(idx, 'meaningVi', e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveWordFamily(idx)}
                    title={language === 'vi' ? 'Xóa dạng từ này' : 'Remove this form'}
                    className="self-end sm:self-center rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Examples */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {language === 'vi' ? 'Câu ví dụ ngữ cảnh' : 'Context Examples'}
              </label>
              <button
                type="button"
                onClick={handleAddExample}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                <Plus className="h-3 w-3" /> {language === 'vi' ? 'Thêm ví dụ' : 'Add example'}
              </button>
            </div>
            {editedWord.examples.map((ex, idx) => (
              <div key={idx} className="space-y-1.5 rounded-xl border border-slate-200/70 p-2.5 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    {language === 'vi' ? 'Ví dụ' : 'Example'} {idx + 1} ({ex.context})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveExample(idx)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder={language === 'vi' ? 'Câu tiếng Anh' : 'English sentence'}
                  value={ex.en}
                  onChange={(e) => handleUpdateExample(idx, 'en', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <input
                  type="text"
                  placeholder={language === 'vi' ? 'Bản dịch tiếng Việt' : 'Vietnamese translation'}
                  value={ex.vi}
                  onChange={(e) => handleUpdateExample(idx, 'vi', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            ))}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {language === 'vi' ? 'Thẻ phân loại (Tags)' : 'Deck Tags'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {editedWord.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-indigo-400 hover:text-indigo-700 dark:hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={language === 'vi' ? 'Thêm thẻ (vd: #Contract, #Office)...' : 'Add tag (e.g. #Contract, #Office)...'}
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
              >
                {language === 'vi' ? 'Thêm' : 'Add'}
              </button>
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500"
            >
              {isCreating
                ? (language === 'vi' ? 'Thêm vào Deck' : 'Add to Deck')
                : (language === 'vi' ? 'Lưu thay đổi' : 'Save changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
