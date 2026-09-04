import { Bookmark, BookmarkCheck, Edit3, Sparkles, Tag } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { WordItem } from '../../types/vocab';
import { lookupWord } from '../../services/dictionary';
import { createInitialReviewMeta } from '../../services/sm2';
import { AudioButton } from '../common/AudioButton';
import { WordFamilyInteractive } from '../common/WordFamilyInteractive';
import { EditableWordModal } from './EditableWordModal';

interface WordCardProps {
  word: WordItem;
  onSaveToDeck: (word: WordItem) => void;
  isAlreadyInDeck: boolean;
  onLookupWord?: (word: string) => void;
  deckWords?: WordItem[];
}

const COMMON_TAGS = ['#TOEIC', '#Office', '#Tech', '#Business', '#IELTS', '#Finance'];

export const WordCard: React.FC<WordCardProps> = ({
  word,
  onSaveToDeck,
  isAlreadyInDeck,
  onLookupWord,
  deckWords = [],
}) => {
  const { language, t } = useLanguage();
  const [currentWord, setCurrentWord] = useState<WordItem>(word);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Sync state when word prop changes
  React.useEffect(() => {
    setCurrentWord(word);
    setIsSaved(false);
  }, [word]);

  const handleToggleTag = (tag: string) => {
    const exists = currentWord.tags.includes(tag);
    const updatedTags = exists
      ? currentWord.tags.filter((t) => t !== tag)
      : [...currentWord.tags, tag];

    const updated = { ...currentWord, tags: updatedTags };
    setCurrentWord(updated);
  };

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagInput.trim()) return;
    const formatted = newTagInput.startsWith('#') ? newTagInput.trim() : `#${newTagInput.trim()}`;
    if (!currentWord.tags.includes(formatted)) {
      setCurrentWord({ ...currentWord, tags: [...currentWord.tags, formatted] });
    }
    setNewTagInput('');
  };

  const handleSave = async () => {
    try {
      await onSaveToDeck(currentWord);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch {
      // toast shown in parent
    }
  };

  const handleSaveFromModal = async (updated: WordItem) => {
    try {
      setCurrentWord(updated);
      await onSaveToDeck(updated);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch {
      // toast shown in parent
    }
  };

  const handleAddFamilyMemberToDeck = async (familyWord: string) => {
    try {
      const enriched = await lookupWord(familyWord);
      await onSaveToDeck(enriched);
    } catch {
      await onSaveToDeck({
        id: `word-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        word: familyWord.toLowerCase(),
        pos: ['noun'],
        vietnameseDefinition: `Ý nghĩa của "${familyWord}"`,
        englishDefinition: `Definition for ${familyWord}`,
        meanings: [
          {
            pos: 'noun',
            englishDefinition: `Definition for ${familyWord}`,
            vietnameseDefinition: `Ý nghĩa của "${familyWord}"`,
          },
        ],
        phonetics: { us: `/${familyWord}/`, uk: `/${familyWord}/` },
        collocations: [],
        wordFamily: [],
        examples: [],
        tags: ['#TOEIC', '#WordFamily'],
        status: 'new',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reviewMeta: createInitialReviewMeta(),
      });
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xl shadow-slate-100/60 dark:border-slate-800 dark:bg-[#111622] dark:shadow-none animate-slide-up">
      {/* Top Banner: Word + Phonetics + POS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 dark:border-slate-800/80">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {currentWord.word}
            </h1>

            {/* Part of Speech Badges */}
            <div className="flex flex-wrap gap-1.5">
              {currentWord.pos.map((pos) => (
                <span
                  key={pos}
                  className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 italic"
                >
                  {pos}
                </span>
              ))}
            </div>
          </div>

          {/* Phonetic IPA + Audio Buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {/* US Audio & IPA */}
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 dark:bg-slate-800/60">
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                US {currentWord.phonetics.us || `/${currentWord.word}/`}
              </span>
              <AudioButton
                text={currentWord.word}
                accent="US"
                audioUrl={currentWord.phonetics.audioUs}
                size="sm"
                showLabel={false}
              />
            </div>

            {/* UK Audio & IPA */}
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 dark:bg-slate-800/60">
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                UK {currentWord.phonetics.uk || currentWord.phonetics.us || `/${currentWord.word}/`}
              </span>
              <AudioButton
                text={currentWord.word}
                accent="UK"
                audioUrl={currentWord.phonetics.audioUk}
                size="sm"
                showLabel={false}
              />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Edit3 className="h-3.5 w-3.5 text-slate-400" />
            <span>{t.lookup.editWord}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold text-white shadow-md transition-all active:scale-95 ${
              isSaved || isAlreadyInDeck
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
            }`}
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="h-4 w-4" />
                <span>{language === 'vi' ? 'Đã lưu vào Deck!' : 'Saved to Deck!'}</span>
              </>
            ) : isAlreadyInDeck ? (
              <>
                <BookmarkCheck className="h-4 w-4" />
                <span>{t.lookup.alreadyInDeck}</span>
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                <span>{t.lookup.saveToDeck}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Core Vietnamese Definition Card */}
      <div className="mt-6 rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/70 via-emerald-50/30 to-transparent p-5 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-emerald-950/10">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          <Sparkles className="h-4 w-4" />
          <span>{t.lookup.meaningLabel}</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {currentWord.vietnameseDefinition.includes(';') ? (
            currentWord.vietnameseDefinition.split(';').map((part, idx) => (
              <p key={idx} className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-start gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                <span>{part.trim()}</span>
              </p>
            ))
          ) : (
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {currentWord.vietnameseDefinition}
            </p>
          )}
        </div>
        {currentWord.englishDefinition && (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {currentWord.englishDefinition}
          </p>
        )}
      </div>

      {/* Grid: Collocations & Word Family */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Collocations */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/40">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t.lookup.collocations}
          </h3>
          <ul className="mt-3 space-y-2">
            {currentWord.collocations.slice(0, 4).map((c, idx) => (
              <li key={idx} className="flex items-start justify-between text-xs">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {c.phrase}
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-right">
                  {c.meaningVi}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Word Family */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/40">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            {t.lookup.wordFamily}
          </h3>
          <WordFamilyInteractive
            wordFamily={currentWord.wordFamily}
            currentWord={currentWord.word}
            deckWords={deckWords}
            onLookupWord={onLookupWord}
            onAddWordToDeck={handleAddFamilyMemberToDeck}
          />
        </div>
      </div>

      {/* Practical Example Sentences (1 General + 1 TOEIC/Workplace) */}
      <div className="mt-6 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t.lookup.examples}
        </h3>
        <div className="space-y-3">
          {currentWord.examples.map((ex, idx) => (
            <div
              key={idx}
              className={`rounded-2xl border p-4 transition-all ${
                ex.context === 'toeic'
                  ? 'border-indigo-200 bg-indigo-50/40 dark:border-indigo-900/50 dark:bg-indigo-950/20'
                  : 'border-slate-200/80 bg-slate-50/50 dark:border-slate-800/80 dark:bg-slate-900/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    ex.context === 'toeic'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {ex.context === 'toeic' ? t.lookup.toeicContext : t.lookup.generalContext}
                </span>
                <AudioButton text={ex.en} size="sm" showLabel={false} />
              </div>
              <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                {ex.en}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {ex.vi}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tag Assignment Controls */}
      <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800/80">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Tag className="h-3.5 w-3.5 text-indigo-500" />
          <span>{t.lookup.tagsLabel}</span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {COMMON_TAGS.map((tag) => {
            const isSelected = currentWord.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleToggleTag(tag)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {tag}
              </button>
            );
          })}

          {/* Custom tags already attached to word */}
          {currentWord.tags
            .filter((t) => !COMMON_TAGS.includes(t))
            .map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleToggleTag(t)}
                className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white"
              >
                {t} ×
              </button>
            ))}

          {/* Add custom tag input */}
          <form onSubmit={handleAddCustomTag} className="flex items-center">
            <input
              type="text"
              placeholder="+ custom tag"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </form>
        </div>
      </div>

      {/* Edit Modal */}
      <EditableWordModal
        isOpen={isEditModalOpen}
        word={currentWord}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveFromModal}
      />
    </div>
  );
};
