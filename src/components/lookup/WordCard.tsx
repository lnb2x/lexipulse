import { Bookmark, BookmarkCheck, Edit3, Loader2, Sparkles, Tag } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { WordItem } from '../../types/vocab';
import { lookupWord } from '../../services/dictionary';
import { playPronunciation } from '../../services/audio';
import { createInitialReviewMeta } from '../../services/sm2';
import { AudioButton } from '../common/AudioButton';
import { GlassButton } from '../common/Glass';
import { ModalPresence } from '../common/ModalPresence';
import { WordFamilyInteractive } from '../common/WordFamilyInteractive';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import { parseMultipleMeanings } from '../../utils/definitionUtils';
import { withCleanDefinitions } from '../../services/definitionCleanup';
import { isPlaceholderDefinition } from '../../services/quizlet/quizletNormalizer';

const EditableWordModal = React.lazy(() =>
  import('./EditableWordModal').then((m) => ({ default: m.EditableWordModal }))
);

interface WordCardProps {
  word: WordItem;
  onSaveToDeck: (word: WordItem) => void;
  isAlreadyInDeck: boolean;
  onLookupWord?: (word: string, contextSentence?: string) => void;
  onReTranslateWithAI?: (word: WordItem) => Promise<void> | void;
  deckWords?: WordItem[];
}

const COMMON_TAGS = ['#TOEIC', '#Office', '#Tech', '#Business', '#IELTS', '#Finance'];

export const WordCard: React.FC<WordCardProps> = ({
  word,
  onSaveToDeck,
  isAlreadyInDeck,
  onLookupWord,
  onReTranslateWithAI,
  deckWords = [],
}) => {
  const { language, t } = useLanguage();
  const [currentWord, setCurrentWord] = useState<WordItem>(word);
  const cleanDefinition = withCleanDefinitions(currentWord).vietnameseDefinition;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playingAccent, setPlayingAccent] = useState<'US' | 'UK'>('US');
  const [isReTranslating, setIsReTranslating] = useState(false);

  const handleReTranslate = async () => {
    if (!onReTranslateWithAI || isReTranslating) return;
    setIsReTranslating(true);
    try {
      await onReTranslateWithAI(currentWord);
    } finally {
      setIsReTranslating(false);
    }
  };

  // Sync state when word prop changes
  React.useEffect(() => {
    setCurrentWord(word);
    setIsSaved(false);
  }, [word]);

  const handlePlayWordAudio = useCallback(async (preferredAccent: 'US' | 'UK' = 'US') => {
    setIsPlayingAudio(true);
    setPlayingAccent(preferredAccent);
    try {
      const audioUrl = preferredAccent === 'UK'
        ? (currentWord.phonetics.audioUk || currentWord.phonetics.audioUs)
        : (currentWord.phonetics.audioUs || currentWord.phonetics.audioUk);
      await playPronunciation(currentWord.word, preferredAccent, audioUrl);
    } catch (err) {
      console.warn('WordCard audio playback error:', err);
    } finally {
      setIsPlayingAudio(false);
    }
  }, [currentWord]);

  // Keyboard shortcut listener: R / A / Ctrl+Space for audio playback
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      const isAudioShortcut =
        (!isInput && (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'a') && !isCtrlOrMeta && !e.altKey) ||
        (isCtrlOrMeta && e.code === 'Space');

      if (isAudioShortcut) {
        e.preventDefault();
        const accent: 'US' | 'UK' = e.shiftKey ? 'UK' : 'US';
        handlePlayWordAudio(accent);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayWordAudio]);

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
        vietnameseDefinition: '',
        englishDefinition: '',
        meanings: [],
        phonetics: { us: '', uk: '' },
        collocations: [],
        wordFamily: [],
        examples: [],
        tags: ['#TOEIC', '#WordFamily'],
        status: 'new',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reviewMeta: createInitialReviewMeta(),
        vietnameseDefinitionProvenance: { source: 'unknown' },
      });
    }
  };

  return (
    <section className="dictionary-entry animate-slide-up" aria-label={currentWord.word}>
      <div className="dictionary-entry-content space-y-6">
      {/* Top Banner: Word + Phonetics + Actions */}
      <div className="dictionary-word-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="dictionary-word-title flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              {currentWord.word}
            </h1>

            {/* Part of Speech Badges */}
            <div className="dictionary-pos-tags flex flex-wrap gap-2">
              {currentWord.pos.map((pos) => (
                <span
                  key={pos}
                  className="dictionary-label px-2 py-0.5 text-xs font-semibold italic"
                >
                  {pos}
                </span>
              ))}
            </div>
          </div>

          {/* Phonetic IPA + Audio Buttons */}
          <div className="dictionary-pronunciations flex flex-wrap items-center gap-2.5 text-xs">
            {/* US Audio & IPA */}
            <div data-glass data-glass-variant="thin" className="liquid-glass glass-control glass-pill dictionary-pronunciation">
              <span className="dictionary-accent-label">US</span>
              {currentWord.phonetics.us &&
              currentWord.phonetics.us !== `/${currentWord.word}/` &&
              currentWord.phonetics.us !== `/${currentWord.word.toLowerCase()}/` ? (
                <span className="font-mono text-slate-600 dark:text-slate-300 font-medium">
                  {currentWord.phonetics.us}
                </span>
              ) : null}
              <AudioButton
                text={currentWord.word}
                accent="US"
                audioUrl={currentWord.phonetics.audioUs}
                size="sm"
                showLabel={false}
                shortcutHint="R"
                isPlaying={isPlayingAudio && playingAccent === 'US'}
              />
            </div>

            {/* UK Audio & IPA */}
            <div data-glass data-glass-variant="thin" className="liquid-glass glass-control glass-pill dictionary-pronunciation">
              <span className="dictionary-accent-label">UK</span>
              {(currentWord.phonetics.uk || currentWord.phonetics.us) &&
              (currentWord.phonetics.uk || currentWord.phonetics.us) !== `/${currentWord.word}/` &&
              (currentWord.phonetics.uk || currentWord.phonetics.us) !== `/${currentWord.word.toLowerCase()}/` ? (
                <span className="font-mono text-slate-600 dark:text-slate-300 font-medium">
                  {currentWord.phonetics.uk || currentWord.phonetics.us}
                </span>
              ) : null}
              <AudioButton
                text={currentWord.word}
                accent="UK"
                audioUrl={currentWord.phonetics.audioUk}
                size="sm"
                showLabel={false}
                shortcutHint="Shift+R"
                isPlaying={isPlayingAudio && playingAccent === 'UK'}
              />
            </div>
            {/* Missing phonetics indicator */}
            {!currentWord.phonetics.us && !currentWord.phonetics.uk && (
              <span className="text-[11px] text-slate-400 italic py-1">
                {language === 'vi' ? 'Chưa có phiên âm' : 'No phonetics'}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="dictionary-toolbar flex items-center gap-2 self-start sm:self-center">
          <GlassButton
            type="button"
            onClick={() => setIsEditModalOpen(true)}
          >
            <Edit3 className="h-3.5 w-3.5 text-slate-400" />
            <span>{t.lookup.editWord}</span>
          </GlassButton>

          <GlassButton
            type="button"
            prominent={!(isSaved || isAlreadyInDeck)}
            busy={isSaving}
            onClick={handleSave}
            disabled={isSaving}
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
          </GlassButton>
        </div>
      </div>

      {/* Morphological Analysis Callout (Lemma & Grammatical Form) */}
      {currentWord.lemma &&
        (currentWord.lemma.toLowerCase() !== currentWord.word.toLowerCase() ||
          (currentWord.originalInput && currentWord.originalInput.toLowerCase() !== currentWord.word.toLowerCase())) && (
          <div className="content-surface dictionary-notice p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="dictionary-label inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold">
                  💡 {language === 'vi' ? 'Từ nguyên mẫu:' : 'Lemma:'} {currentWord.lemma}
                </span>
                {currentWord.formLabels &&
                  currentWord.formLabels.map((lbl, idx) => (
                    <span
                      key={idx}
                      className="dictionary-label px-2 py-0.5 text-[10px] font-semibold"
                    >
                      {lbl}
                    </span>
                  ))}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {language === 'vi'
                  ? `Được tra cứu từ dạng: "${currentWord.originalInput || currentWord.word}". Học từ gốc giúp mở rộng vốn từ TOEIC hiệu quả nhất.`
                  : `Queried from variant: "${currentWord.originalInput || currentWord.word}". Learning root forms accelerates TOEIC progress.`}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {currentWord.word.toLowerCase() !== currentWord.lemma.toLowerCase() ? (
                <button
                  type="button"
                  data-glass
                  onClick={() => onLookupWord?.(currentWord.lemma!)}
                  className="glass-button glass-prominent inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                >
                  <span>{language === 'vi' ? `Xem từ gốc "${currentWord.lemma}"` : `View lemma "${currentWord.lemma}"`}</span>
                </button>
              ) : currentWord.originalInput &&
                currentWord.originalInput.toLowerCase() !== currentWord.word.toLowerCase() ? (
                <button
                  type="button"
                  data-glass
                  onClick={() => onLookupWord?.(currentWord.originalInput!)}
                  className="glass-button inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                >
                  <span>{language === 'vi' ? `Xem dạng "${currentWord.originalInput}"` : `View form "${currentWord.originalInput}"`}</span>
                </button>
              ) : null}
            </div>
          </div>
        )}

      {/* Core Vietnamese Definition Card */}
      <div className="content-surface dictionary-definition">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="dictionary-meaning-title">{t.lookup.meaningLabel}</h3>
          <div className="flex items-center gap-2">
            {onReTranslateWithAI && (
              <button
                type="button"
                data-glass
                onClick={handleReTranslate}
                disabled={isReTranslating}
                className="glass-button dictionary-retranslate inline-flex items-center gap-1 text-[11px] font-semibold disabled:opacity-50"
                title={language === 'vi' ? 'Làm rõ nghĩa và cách dùng bằng AI' : 'Clarify the meaning and usage with AI'}
              >
                {isReTranslating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                <span>
                  {isReTranslating
                    ? (language === 'vi' ? 'Đang dịch AI...' : 'Translating...')
                    : (language === 'vi' ? 'Dịch lại bằng AI' : 'Re-translate AI')}
                </span>
              </button>
            )}
            <ProvenanceBadge provenance={currentWord.vietnameseDefinitionProvenance} />
          </div>
        </div>
        {(() => {
          if (!currentWord.vietnameseDefinition || !currentWord.vietnameseDefinition.trim()) {
            return (
              <p className="mt-2 text-sm italic text-slate-400 dark:text-slate-500">
                {language === 'vi' ? 'Chưa có bản dịch tiếng Việt' : 'No Vietnamese translation available'}
              </p>
            );
          }
          const senses = parseMultipleMeanings(cleanDefinition);
          if (senses.length > 1) {
            return (
              <div className="dictionary-senses">
                {senses.map((sense) => (
                  <div key={sense.index} className="dictionary-sense">
                    <span className="dictionary-sense-number">
                      {sense.index}
                    </span>
                    <p className="dictionary-meaning-text">
                      {sense.text}
                    </p>
                  </div>
                ))}
              </div>
            );
          }
          return (
            <p className="dictionary-meaning-text">
              {cleanDefinition}
            </p>
          );
        })()}
        {currentWord.englishDefinition && !isPlaceholderDefinition(currentWord.englishDefinition) && (
          <p className="dictionary-english-definition">
            {currentWord.englishDefinition}
          </p>
        )}
        {currentWord.usageNoteVi?.trim() && (
          <div className="mt-4 space-y-1.5 border-t border-slate-200/70 pt-4 dark:border-slate-700/70">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {language === 'vi' ? 'Cách dùng' : 'Usage'}
            </h4>
            <p className="text-sm font-normal leading-relaxed text-slate-600 dark:text-slate-300">
              {currentWord.usageNoteVi.trim()}
            </p>
          </div>
        )}

        {/* Provided Context Sentence if any */}
        {currentWord.contextSentence && (
          <div className="dictionary-context mt-3 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                {language === 'vi' ? 'Ngữ cảnh câu tra cứu:' : 'Provided Context Sentence:'}
              </span>
              {onLookupWord && (
                <button
                  type="button"
                  data-glass
                  onClick={() => onLookupWord(currentWord.originalInput || currentWord.word, currentWord.contextSentence)}
                  className="glass-button dictionary-retranslate text-[10px] font-semibold"
                >
                  {language === 'vi' ? 'Dịch lại theo câu này' : 'Re-translate with this sentence'}
                </button>
              )}
            </div>
            <p className="text-slate-800 dark:text-slate-200 font-medium italic">
              "{currentWord.contextSentence}"
            </p>
          </div>
        )}
      </div>

      {/* Inflections Grid */}
      {currentWord.inflections && currentWord.inflections.length > 0 && (
        <div className="content-surface dictionary-section dictionary-inflections space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {language === 'vi' ? 'Bảng biến thể ngữ pháp (Inflections)' : 'Grammatical Inflections'}
          </h3>
          <div className="inflection-values">
            {currentWord.inflections.map((inf, idx) => (
              <div
                key={idx}
              >
                <span>
                  {inf.label || inf.form}
                </span>
                <p>
                  {inf.word || inf.form}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Collocations & Word Family */}
      {(() => {
        const distinctWordFamily = (currentWord.wordFamily || []).filter(
          (wf) => wf.word.trim().toLowerCase() !== currentWord.word.trim().toLowerCase()
        );
        const hasWordFamily = distinctWordFamily.length > 0;
        const hasCollocations = (currentWord.collocations || []).length > 0;

        if (!hasCollocations && !hasWordFamily) return null;

        return (
          <div className={`grid gap-4 ${hasCollocations && hasWordFamily ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Collocations */}
            {hasCollocations && (
              <div className="content-surface dictionary-section min-w-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t.lookup.collocations}
                </h3>
                <ul className="mt-2.5 space-y-2">
                  {currentWord.collocations.slice(0, 4).map((c, idx) => (
                    <li key={idx} className="flex items-start justify-between text-xs gap-2 min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 shrink-0">
                        {c.phrase}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-right line-clamp-1 min-w-0">
                        {c.meaningVi}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Word Family */}
            {hasWordFamily && (
              <div className="content-surface dictionary-section min-w-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  {t.lookup.wordFamily}
                </h3>
                <WordFamilyInteractive
                  wordFamily={distinctWordFamily}
                  currentWord={currentWord.word}
                  deckWords={deckWords}
                  onLookupWord={onLookupWord}
                  onAddWordToDeck={handleAddFamilyMemberToDeck}
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* Practical Example Sentences (1 General + 1 TOEIC/Workplace) */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t.lookup.examples}
        </h3>
        <div className="dictionary-examples">
          {currentWord.examples.map((ex, idx) => (
            <div
              key={idx}
              className="content-surface dictionary-example"
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

        <div className="dictionary-tags mt-3 flex flex-wrap items-center gap-2">
          {COMMON_TAGS.map((tag) => {
            const isSelected = currentWord.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                data-glass
                data-glass-variant="thin"
                aria-pressed={isSelected}
                onClick={() => handleToggleTag(tag)}
                className="glass-pill dictionary-tag"
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
                data-glass
                data-glass-variant="thin"
                aria-pressed="true"
                aria-label={`${language === 'vi' ? 'Xóa nhãn' : 'Remove tag'} ${t}`}
                onClick={() => handleToggleTag(t)}
                className="glass-pill dictionary-tag"
              >
                {t} ×
              </button>
            ))}

          {/* Add custom tag input */}
          <form onSubmit={handleAddCustomTag} className="flex items-center">
            <input
              type="text"
              data-glass
              aria-label={language === 'vi' ? 'Thêm nhãn mới' : 'Add a new tag'}
              placeholder={language === 'vi' ? '+ tag mới' : '+ new tag'}
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              className="liquid-glass glass-control dictionary-custom-tag px-2 py-0.5 text-xs"
            />
          </form>
        </div>
      </div>

      {/* Edit Modal */}
      <ModalPresence open={isEditModalOpen}>
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
      </ModalPresence>
      </div>
    </section>
  );
};
