import { Bookmark, BookmarkCheck, Edit3, Sparkles, Tag } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { WordItem } from '../../types/vocab';
import { lookupWord } from '../../services/dictionary';
import { createInitialReviewMeta } from '../../services/sm2';
import { AudioButton } from '../common/AudioButton';
import { WordFamilyInteractive } from '../common/WordFamilyInteractive';
import { parseMultipleMeanings } from '../../utils/definitionUtils';

const EditableWordModal = React.lazy(() =>
  import('./EditableWordModal').then((m) => ({ default: m.EditableWordModal }))
);

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
  const [isSaving, setIsSaving] = useState(false);

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
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSaveToDeck(currentWord);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch {
      // toast shown in parent
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFromModal = async (updated: WordItem) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      setCurrentWord(updated);
      await onSaveToDeck(updated);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch {
      // toast shown in parent
    } finally {
      setIsSaving(false);
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
    <div className="w-full max-w-3xl mx-auto rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-card dark:border-slate-800 dark:bg-[#121824] animate-slide-up space-y-6">
      {/* Top Banner: Word + Phonetics + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800/80">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              {currentWord.word}
            </h1>

            {/* Part of Speech Badges */}
            <div className="flex flex-wrap gap-1">
              {currentWord.pos.map((pos) => (
                <span
                  key={pos}
                  className="rounded-md border border-indigo-100 bg-indigo-50/70 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300 italic"
                >
                  {pos}
                </span>
              ))}
            </div>
          </div>

          {/* Phonetic IPA + Audio Buttons */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-xs">
            {/* US Audio & IPA */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-1 dark:border-slate-700/60 dark:bg-slate-800/60">
              {currentWord.phonetics.us &&
              currentWord.phonetics.us !== `/${currentWord.word}/` &&
              currentWord.phonetics.us !== `/${currentWord.word.toLowerCase()}/` ? (
                <span className="font-mono text-slate-600 dark:text-slate-300 font-medium">
                  US {currentWord.phonetics.us}
                </span>
              ) : (
                <span className="font-mono text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                  US
                </span>
              )}
              <AudioButton
                text={currentWord.word}
                accent="US"
                audioUrl={currentWord.phonetics.audioUs}
                size="sm"
                showLabel={false}
              />
            </div>

            {/* UK Audio & IPA */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-1 dark:border-slate-700/60 dark:bg-slate-800/60">
              {(currentWord.phonetics.uk || currentWord.phonetics.us) &&
              (currentWord.phonetics.uk || currentWord.phonetics.us) !== `/${currentWord.word}/` &&
              (currentWord.phonetics.uk || currentWord.phonetics.us) !== `/${currentWord.word.toLowerCase()}/` ? (
                <span className="font-mono text-slate-600 dark:text-slate-300 font-medium">
                  UK {currentWord.phonetics.uk || currentWord.phonetics.us}
                </span>
              ) : (
                <span className="font-mono text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                  UK
                </span>
              )}
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
            className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-subtle transition-all hover:bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/80"
          >
            <Edit3 className="h-3.5 w-3.5 text-slate-400" />
            <span>{t.lookup.editWord}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
              isSaved || isAlreadyInDeck
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
            }`}
          >
            {isSaving ? (
              <>
                <Bookmark className="h-4 w-4 animate-spin" />
                <span>{language === 'vi' ? 'Đang lưu...' : 'Saving...'}</span>
              </>
            ) : isSaved ? (
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
      <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 sm:p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{t.lookup.meaningLabel}</span>
        </div>
        {(() => {
          const senses = parseMultipleMeanings(currentWord.vietnameseDefinition);
          if (senses.length > 1) {
            return (
              <div className="mt-2.5 space-y-2">
                {senses.map((sense) => (
                  <div key={sense.index} className="flex items-start gap-2.5">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                      {sense.index}
                    </span>
                    <p className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                      {sense.text}
                    </p>
                  </div>
                ))}
              </div>
            );
          }
          return (
            <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              {currentWord.vietnameseDefinition}
            </p>
          );
        })()}
        {currentWord.englishDefinition && (
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {currentWord.englishDefinition}
          </p>
        )}
      </div>

      {/* Grid: Collocations & Word Family */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Collocations */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/40 min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t.lookup.collocations}
          </h3>
          <ul className="mt-2.5 space-y-2">
            {currentWord.collocations.slice(0, 4).map((c, idx) => (
              <li key={idx} className="flex items-start justify-between text-xs gap-2 min-w-0">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
                  {c.phrase}
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-right line-clamp-1 min-w-0">
                  {c.meaningVi}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Word Family */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/40 min-w-0">
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
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t.lookup.examples}
        </h3>
        <div className="space-y-2.5">
          {currentWord.examples.map((ex, idx) => (
            <div
              key={idx}
              className={`rounded-xl border p-3.5 transition-all ${
                ex.context === 'toeic'
                  ? 'border-indigo-200/80 bg-indigo-50/30 dark:border-indigo-900/50 dark:bg-indigo-950/20'
                  : 'border-slate-200/80 bg-slate-50/40 dark:border-slate-800/80 dark:bg-slate-900/30'
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
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {ex.vi}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tag Assignment Controls */}
      <div className="border-t border-slate-100 pt-4 dark:border-slate-800/80">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Tag className="h-3.5 w-3.5 text-indigo-500" />
          <span>{t.lookup.tagsLabel}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {COMMON_TAGS.map((tag) => {
            const isSelected = currentWord.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleToggleTag(tag)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
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
                className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white"
              >
                {t} ×
              </button>
            ))}

          {/* Add custom tag input */}
          <form onSubmit={handleAddCustomTag} className="flex items-center">
            <input
              type="text"
              placeholder="+ tag mới"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </form>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <React.Suspense fallback={null}>
          <EditableWordModal
            isOpen={isEditModalOpen}
            word={currentWord}
            onClose={() => setIsEditModalOpen(false)}
            onSave={handleSaveFromModal}
          />
        </React.Suspense>
      )}
    </div>
  );
};
