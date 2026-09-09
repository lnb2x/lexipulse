import { Calendar, Plus, Sparkles, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useModalA11y } from '../../hooks/useModalA11y';
import type { WordItem } from '../../types/vocab';
import { formatLocalDate, parseLocalDateToTimestamp } from '../../utils/dateUtils';
import { enrichWordWithAI } from '../../services/ai';
import { getAppSettings } from '../../services/db/statsRepo';

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
  const modalRef = useModalA11y({ isOpen, onClose });
  const [editedWord, setEditedWord] = useState<WordItem>({ ...word });
  const [newTag, setNewTag] = useState('');

  const [isReEnriching, setIsReEnriching] = useState(false);

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

  const handleReEnrichWithAI = async () => {
    if (!editedWord.word.trim() || !editedWord.contextSentence?.trim() || isReEnriching) return;
    setIsReEnriching(true);
    try {
      const settings = await getAppSettings();
      const apiKey = (settings.aiApiKey || settings.geminiApiKey || '').trim();
      const aiRes = await enrichWordWithAI(
        editedWord.word,
        editedWord.pos?.[0] || 'noun',
        {
          provider: settings.aiProvider || 'gemini',
          apiKey,
          baseUrl: settings.aiBaseUrl,
          model: settings.aiModel,
          timeoutMs: 8000,
        },
        editedWord.contextSentence
      );
      if (aiRes) {
        setEditedWord((prev) => ({
          ...prev,
          vietnameseDefinition: aiRes.vietnameseDefinition || prev.vietnameseDefinition,
          vietnameseDefinitionProvenance: {
            source: 'ai',
            provider: settings.aiProvider || 'gemini',
            model: settings.aiModel,
            createdAt: Date.now(),
          },
          collocations: aiRes.collocations?.length ? aiRes.collocations : prev.collocations,
          examples: aiRes.examples?.length ? aiRes.examples : prev.examples,
          lemma: aiRes.lemma || prev.lemma,
          formLabels: aiRes.formLabels?.length ? aiRes.formLabels : prev.formLabels,
          phonetics: {
            ...prev.phonetics,
            us: aiRes.ipaUs || prev.phonetics.us,
            uk: aiRes.ipaUk || prev.phonetics.uk,
          },
        }));
      }
    } catch (err) {
      console.warn('Re-enrichment failed:', err);
    } finally {
      setIsReEnriching(false);
    }
  };

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

    const trimmedWord = editedWord.word.trim().toLowerCase();
    const lemma = editedWord.lemma?.trim().toLowerCase() || trimmedWord;
    const originalInput = editedWord.originalInput?.trim() || trimmedWord;
    const linkedVariants = Array.from(
      new Set([
        ...(editedWord.linkedVariants || []),
        ...(originalInput.toLowerCase() !== trimmedWord ? [originalInput.toLowerCase()] : []),
      ])
    );

    onSave({
      ...editedWord,
      word: trimmedWord,
      lemma,
      originalInput,
      linkedVariants,
    });
    onClose();
  };

  const isCreating = isNew || !word.word;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editable-word-dialog-title"
        className="relative my-8 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xl dark:border-slate-800 dark:bg-[#111622]"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 id="editable-word-dialog-title" className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {isCreating
                ? (language === 'vi' ? 'Thêm từ vựng mới vào Deck' : 'Add New Word to Deck')
                : (
                  <>
                    {language === 'vi' ? 'Chỉnh sửa từ vựng:' : 'Edit Vocabulary Entry:'}{' '}
                    <span className="text-indigo-600 dark:text-indigo-400">{editedWord.word || word.word}</span>
                  </>
                )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'vi'
                ? 'Tùy chỉnh từ vựng, định nghĩa, collocations, ví dụ, ngày thêm và thẻ phân loại.'
                : 'Customize word, definitions, collocations, examples, date added, and tags.'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={language === 'vi' ? 'Đóng cửa sổ chỉnh sửa từ' : 'Close word editor'}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="mt-5 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Morphological Lemma Banner */}
          {editedWord.lemma && (
            <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/70 p-3.5 dark:border-indigo-900/60 dark:bg-indigo-950/30 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  <span>💡 {language === 'vi' ? 'Nhận diện từ nguyên mẫu (Lemma):' : 'Identified Lemma:'}</span>
                  <span className="font-mono underline text-indigo-700 dark:text-indigo-300">{editedWord.lemma}</span>
                </div>
                {editedWord.formLabels && editedWord.formLabels.length > 0 && (
                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                    {editedWord.formLabels.join(', ')}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  {language === 'vi' ? 'Lưu vào Deck dưới dạng:' : 'Save to Deck as:'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const original = editedWord.originalInput || editedWord.word;
                    const lem = editedWord.lemma!;
                    setEditedWord({
                      ...editedWord,
                      word: lem,
                      originalInput: original,
                      linkedVariants: Array.from(new Set([...(editedWord.linkedVariants || []), original.toLowerCase()])),
                    });
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    editedWord.word.toLowerCase() === editedWord.lemma.toLowerCase()
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  {language === 'vi' ? `Từ gốc: "${editedWord.lemma}" (Khuyên dùng TOEIC)` : `Lemma: "${editedWord.lemma}" (Recommended)`}
                </button>
                {editedWord.originalInput && editedWord.originalInput.toLowerCase() !== editedWord.lemma.toLowerCase() && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditedWord({
                        ...editedWord,
                        word: editedWord.originalInput!,
                      });
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      editedWord.word.toLowerCase() === editedWord.originalInput.toLowerCase()
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    {language === 'vi' ? `Dạng biến thể: "${editedWord.originalInput}"` : `Variant: "${editedWord.originalInput}"`}
                  </button>
                )}
              </div>
            </div>
          )}

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
              onChange={(e) => {
                const newVal = e.target.value;
                setEditedWord({
                  ...editedWord,
                  vietnameseDefinition: newVal,
                  vietnameseDefinitionProvenance:
                    newVal !== word.vietnameseDefinition
                      ? {
                          source: 'user_edit',
                          isUserEdited: true,
                          originalSource: word.vietnameseDefinitionProvenance?.source,
                          createdAt: Date.now(),
                        }
                      : editedWord.vietnameseDefinitionProvenance,
                });
              }}
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

          {/* Context Sentence */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {language === 'vi' ? 'Ngữ cảnh câu thực tế (Context sentence)' : 'Context Sentence / Usage'}
              </label>
              {editedWord.contextSentence?.trim() && (
                <button
                  type="button"
                  onClick={handleReEnrichWithAI}
                  disabled={isReEnriching}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>
                    {isReEnriching
                      ? (language === 'vi' ? 'Đang dịch AI...' : 'Translating...')
                      : (language === 'vi' ? 'Dịch lại bằng AI theo câu này' : 'Re-translate with AI')}
                  </span>
                </button>
              )}
            </div>
            <textarea
              rows={2}
              value={editedWord.contextSentence || ''}
              onChange={(e) => setEditedWord({ ...editedWord, contextSentence: e.target.value })}
              placeholder={language === 'vi' ? 'Câu tiếng Anh có chứa từ cần học để lưu và ôn tập đúng ngữ cảnh...' : 'Sentence containing the word for accurate context...'}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              {language === 'vi'
                ? 'Lưu văn bản đơn thuần sẽ giữ nguyên bản dịch hiện tại. Bấm "Dịch lại bằng AI" nếu muốn AI cập nhật nghĩa theo câu mới.'
                : 'Saving text only keeps current translation. Click "Re-translate with AI" to generate a contextual definition.'}
            </p>
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
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-[0.99] transition-all"
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
