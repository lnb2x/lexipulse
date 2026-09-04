import { Check } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Header } from './components/common/Header';
import { useLanguage } from './context/LanguageContext';
import { DeckView } from './features/deck/DeckView';
import { LookupView } from './features/lookup/LookupView';
import { ReviewView, type ReviewSessionState } from './features/review/ReviewView';
import { useSpacedRepetition } from './hooks/useSpacedRepetition';
import { useTheme } from './hooks/useTheme';
import { useVocabulary } from './hooks/useVocabulary';
import { db, exportDeckToCsv, exportDeckToXlsx, initializeDatabase } from './services/db';
import { WordNotFoundError, lookupWord, warmSearchCache } from './services/dictionary';
import { formatLocalDate } from './utils/dateUtils';
import type { ClozeQuestion, ReviewMode, ReviewRating, SpellingSuggestion, WordItem } from './types/vocab';

// Code-split heavy modals to keep the initial app bundle light (< 500 kB)
const SettingsModal = lazy(() =>
  import('./components/common/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const ShortcutsModal = lazy(() =>
  import('./components/common/ShortcutsModal').then((m) => ({ default: m.ShortcutsModal }))
);
const ImportExportModal = lazy(() =>
  import('./components/deck/ImportExportModal').then((m) => ({ default: m.ImportExportModal }))
);
const WordDetailModal = lazy(() =>
  import('./components/deck/WordDetailModal').then((m) => ({ default: m.WordDetailModal }))
);
const EditableWordModal = lazy(() =>
  import('./components/lookup/EditableWordModal').then((m) => ({ default: m.EditableWordModal }))
);

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

export function App() {
  const { language } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  // Navigation tab: 'lookup' | 'deck' | 'review'
  const [activeTab, setActiveTab] = useState<'lookup' | 'deck' | 'review'>('lookup');

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [importExportTab, setImportExportTab] = useState<'bulk' | 'export' | 'import'>('bulk');
  const [editingWord, setEditingWord] = useState<WordItem | null>(null);
  const [detailWord, setDetailWord] = useState<WordItem | null>(null);

  // Synchronize document.documentElement.lang
  useEffect(() => {
    document.documentElement.lang = language || 'en';
  }, [language]);

  // Toast Notification System
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  // Vocabulary Deck Hook
  const {
    words,
    allWords,
    isFuzzyMatch,
    loading: deckLoading,
    filterOptions,
    setFilterOptions,
    allTags,
    availableDates,
    stats: deckStats,
    addWord,
    updateWord,
    deleteWord,
    isWordInDeck,
    refresh,
  } = useVocabulary();

  // Spaced Repetition Hook
  const {
    dueCards,
    streak,
    reviewedTodayCount,
    dailyQuota,
    submitRating,
    generateClozeQuestions,
  } = useSpacedRepetition(allWords);

  // Live query all daily activity stats for contribution heatmap
  const dailyStats = useLiveQuery(async () => {
    return await db.dailyStats.toArray();
  }, []) || [];

  // Lookup state
  const [lookupResult, setLookupResult] = useState<WordItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchTypoInfo, setSearchTypoInfo] = useState<{
    query: string;
    suggestions: SpellingSuggestion[];
  } | null>(null);

  // Active Review Session State
  const [reviewState, setReviewState] = useState<ReviewSessionState>({
    inProgress: false,
    mode: 'flashcards',
    cards: [],
    currentIndex: 0,
    clozeQuestions: [],
    sessionHistory: [],
    isCompleted: false,
  });

  // Latest request wins tracking
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const searchIdRef = useRef<number>(0);
  const hasSetInitialWord = useRef(false);
  const hasWarmedCache = useRef(false);

  // Initialize DB on first launch
  useEffect(() => {
    initializeDatabase().then(() => {
      refresh();
    });
  }, [refresh]);

  // Set initial default word only once when deck loads
  useEffect(() => {
    if (!hasSetInitialWord.current && allWords.length > 0) {
      hasSetInitialWord.current = true;
      setLookupResult((prev) => prev ?? allWords[0]);
    }
  }, [allWords]);

  // Warm search cache only once on initial deck load
  useEffect(() => {
    if (!hasWarmedCache.current && allWords.length > 0) {
      hasWarmedCache.current = true;
      warmSearchCache(allWords);
    }
  }, [allWords]);

  // Global Keyboard shortcuts with strict input/contenteditable suppression
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      ) {
        return;
      }

      if (e.altKey && e.key === '1') {
        e.preventDefault();
        setActiveTab('lookup');
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        setActiveTab('deck');
      } else if (e.altKey && e.key === '3') {
        e.preventDefault();
        setActiveTab('review');
      } else if (e.key === '?' || (e.ctrlKey && e.key === 'k') || (e.metaKey && e.key === 'k')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Lookup submission with two-stage enrichment, cancellation & latest request wins
  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    // Abort previous search request
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    searchAbortControllerRef.current = abortController;

    const currentSearchId = ++searchIdRef.current;

    setIsSearching(true);
    setSearchError(null);
    setSearchTypoInfo(null);

    try {
      const result = await lookupWord(trimmed, {
        signal: abortController.signal,
        onEnriched: (enrichedWord) => {
          if (
            currentSearchId === searchIdRef.current &&
            !abortController.signal.aborted
          ) {
            setLookupResult((prev) => {
              if (!prev || prev.word.toLowerCase() !== enrichedWord.word.toLowerCase()) {
                return prev;
              }
              return {
                ...prev,
                phonetics: {
                  us: (prev.phonetics.us && prev.phonetics.us !== `/${prev.word}/`) ? prev.phonetics.us : enrichedWord.phonetics.us,
                  uk: (prev.phonetics.uk && prev.phonetics.uk !== `/${prev.word}/`) ? prev.phonetics.uk : enrichedWord.phonetics.uk,
                  audioUs: prev.phonetics.audioUs || enrichedWord.phonetics.audioUs,
                  audioUk: prev.phonetics.audioUk || enrichedWord.phonetics.audioUk,
                },
                collocations: prev.collocations.length > 0 ? prev.collocations : enrichedWord.collocations,
                wordFamily: prev.wordFamily.length > 0 ? prev.wordFamily : enrichedWord.wordFamily,
                examples: prev.examples.length > 0 ? prev.examples : enrichedWord.examples,
                meanings: (prev.meanings && prev.meanings.length > 1) ? prev.meanings : (enrichedWord.meanings || prev.meanings),
                vietnameseDefinition: prev.vietnameseDefinition || enrichedWord.vietnameseDefinition,
                englishDefinition: prev.englishDefinition || enrichedWord.englishDefinition,
              };
            });
          }
        },
      });

      if (currentSearchId !== searchIdRef.current || abortController.signal.aborted) {
        return;
      }

      if (result) {
        setLookupResult(result);
      } else {
        setSearchError(`No definitions found for "${trimmed}". Try another word!`);
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      if (currentSearchId !== searchIdRef.current) {
        return;
      }

      if (err instanceof WordNotFoundError) {
        setSearchTypoInfo({
          query: err.query,
          suggestions: err.suggestions,
        });
        setLookupResult(null);
      } else {
        setSearchError(
          language === 'vi'
            ? 'Lỗi khi tra cứu từ. Vui lòng kiểm tra kết nối mạng.'
            : 'Error searching word. Please check your network connection.'
        );
      }
    } finally {
      if (currentSearchId === searchIdRef.current) {
        setIsSearching(false);
      }
    }
  }, [language]);

  // Handle Saving to Deck
  const handleSaveToDeck = useCallback(async (wordToSave: WordItem) => {
    try {
      const isUpdate = isWordInDeck(wordToSave.word);
      await addWord(wordToSave);
      showToast(
        isUpdate
          ? (language === 'vi' ? `Đã cập nhật "${wordToSave.word}" trong deck!` : `Updated "${wordToSave.word}" in deck!`)
          : (language === 'vi' ? `Đã lưu "${wordToSave.word}" vào deck thành công!` : `Saved "${wordToSave.word}" to deck!`)
      );
    } catch (err) {
      console.error('Failed to save word to deck:', err);
      showToast(
        language === 'vi'
          ? `Lỗi khi lưu từ: ${err instanceof Error ? err.message : 'Vui lòng thử lại'}`
          : `Failed to save word: ${err instanceof Error ? err.message : 'Please try again'}`,
        'error'
      );
      throw err;
    }
  }, [addWord, isWordInDeck, language, showToast]);

  // Start Review Session
  const handleStartReviewSession = (mode: ReviewMode, cardsToReview?: WordItem[]) => {
    const targetCards = cardsToReview && cardsToReview.length > 0 ? cardsToReview : (dueCards.length > 0 ? dueCards : allWords);
    if (targetCards.length === 0) return;

    let clozeQuestions: ClozeQuestion[] = [];
    if (mode === 'cloze') {
      clozeQuestions = generateClozeQuestions(targetCards);
    }

    setReviewState({
      inProgress: true,
      mode,
      cards: targetCards,
      currentIndex: 0,
      clozeQuestions,
      sessionHistory: [],
      isCompleted: false,
    });
    setActiveTab('review');
  };

  // Switch review mode on the fly
  const handleSwitchReviewMode = (newMode: ReviewMode) => {
    if (reviewState.mode === newMode) return;
    let questions = reviewState.clozeQuestions;
    if (newMode === 'cloze' && questions.length === 0) {
      questions = generateClozeQuestions(reviewState.cards);
    }
    setReviewState((prev) => ({
      ...prev,
      mode: newMode,
      clozeQuestions: questions,
    }));

    const modeLabels: Record<ReviewMode, { vi: string; en: string }> = {
      flashcards: { vi: 'Thẻ Flashcard', en: 'Flashcards' },
      cloze: { vi: 'Điền từ ngữ cảnh', en: 'Cloze Quiz' },
      listen: { vi: 'Chính tả phát âm', en: 'Listening Dictation' },
      choice: { vi: 'Trắc nghiệm 4 đáp án', en: 'Multiple Choice' },
      match: { vi: 'Nối từ siêu tốc', en: 'Speed Match' },
    };

    showToast(
      language === 'vi'
        ? `Đã chuyển chế độ: ${modeLabels[newMode]?.vi || newMode}`
        : `Switched mode: ${modeLabels[newMode]?.en || newMode}`,
      'info'
    );
  };

  // Grade review item
  const handleGradeReview = async (rating: ReviewRating) => {
    const currentWord = reviewState.cards[reviewState.currentIndex];
    if (!currentWord) return;

    await submitRating(currentWord.id, rating);

    const nextIndex = reviewState.currentIndex + 1;
    const newHistory = [...reviewState.sessionHistory, { word: currentWord, rating }];

    if (nextIndex >= reviewState.cards.length) {
      setReviewState((prev) => ({
        ...prev,
        sessionHistory: newHistory,
        isCompleted: true,
      }));
      showToast('Session finished! Great job!');
    } else {
      setReviewState((prev) => ({
        ...prev,
        currentIndex: nextIndex,
        sessionHistory: newHistory,
      }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-[#0b0f19] dark:text-slate-100 flex flex-col font-sans">
      {/* Toast notifications with live region */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold shadow-lg backdrop-blur-md animate-slide-up border ${
              t.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20'
                : t.type === 'error'
                ? 'bg-rose-600 text-white border-rose-500 shadow-rose-900/20'
                : 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-900/20'
            }`}
          >
            <Check className="h-4 w-4 shrink-0" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Main App Navigation Header */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        streak={streak}
        totalCards={allWords.length}
        dueCount={dueCards.length}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        {/* TAB 1: LOOKUP */}
        {activeTab === 'lookup' && (
          <LookupView
            lookupResult={lookupResult}
            isSearching={isSearching}
            searchError={searchError}
            searchTypoInfo={searchTypoInfo}
            allWords={allWords}
            isWordInDeck={isWordInDeck}
            onSearch={handleSearch}
            onSaveToDeck={handleSaveToDeck}
          />
        )}

        {/* TAB 2: DECK */}
        {activeTab === 'deck' && (
          <DeckView
            words={words}
            allWords={allWords}
            dailyStats={dailyStats}
            deckStats={deckStats}
            deckLoading={deckLoading}
            filterOptions={filterOptions}
            setFilterOptions={setFilterOptions}
            allTags={allTags}
            availableDates={availableDates}
            isFuzzyMatch={isFuzzyMatch}
            onOpenDetail={(w) => setDetailWord(w)}
            onOpenEdit={(w) => setEditingWord(w)}
            onDeleteWord={async (id, wordStr) => {
              await deleteWord(id);
              showToast(`Deleted "${wordStr}" from deck`, 'info');
            }}
            onOpenImportExport={(tab = 'export') => {
              setImportExportTab(tab);
              setIsImportExportOpen(true);
            }}
            onQuickExportCsv={async () => {
              const csv = await exportDeckToCsv(words);
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const suffix = filterOptions.createdDate ? `_${filterOptions.createdDate}` : `_${formatLocalDate()}`;
              a.download = `lexipulse_words${suffix}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              showToast(
                language === 'vi'
                  ? `Đã xuất ${words.length} từ ra file CSV!`
                  : `Exported ${words.length} words to CSV!`
              );
            }}
            onQuickExportXlsx={async () => {
              const blob = await exportDeckToXlsx(words);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const suffix = filterOptions.createdDate ? `_${filterOptions.createdDate}` : `_${formatLocalDate()}`;
              a.download = `lexipulse_words${suffix}.xlsx`;
              a.click();
              URL.revokeObjectURL(url);
              showToast(
                language === 'vi'
                  ? `Đã xuất ${words.length} từ ra file Excel (.xlsx)!`
                  : `Exported ${words.length} words to Excel (.xlsx)!`
              );
            }}
            onStartReviewSession={(mode, cards) => handleStartReviewSession(mode, cards)}
            onNavigateToLookup={() => setActiveTab('lookup')}
            showToast={showToast}
          />
        )}

        {/* TAB 3: REVIEW */}
        {activeTab === 'review' && (
          <ReviewView
            allWords={allWords}
            dueCards={dueCards}
            streak={streak}
            reviewedTodayCount={reviewedTodayCount}
            dailyQuota={dailyQuota}
            availableDates={availableDates}
            reviewState={reviewState}
            setReviewState={setReviewState}
            onStartReviewSession={handleStartReviewSession}
            onSwitchReviewMode={handleSwitchReviewMode}
            onGradeReview={handleGradeReview}
            onGradeSingleWord={submitRating}
            onGoToDeck={() => {
              setReviewState((prev) => ({ ...prev, inProgress: false }));
              setActiveTab('deck');
            }}
          />
        )}
      </main>

      {/* Global Modals - Lazy loaded with Suspense */}
      <Suspense fallback={null}>
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onSettingsUpdated={() => {
              showToast('Settings saved successfully');
              refresh();
            }}
          />
        )}

        {isShortcutsOpen && (
          <ShortcutsModal
            isOpen={isShortcutsOpen}
            onClose={() => setIsShortcutsOpen(false)}
          />
        )}

        {isImportExportOpen && (
          <ImportExportModal
            isOpen={isImportExportOpen}
            initialTab={importExportTab}
            onClose={() => setIsImportExportOpen(false)}
            allWords={allWords}
            filteredWords={words}
            availableDates={availableDates}
            activeFilterDate={filterOptions.createdDate}
            onImportComplete={(addedDate?: string) => {
              showToast(
                language === 'vi'
                  ? 'Dữ liệu từ vựng đã được cập nhật thành công!'
                  : 'Vocabulary data updated successfully!'
              );
              if (addedDate) {
                setFilterOptions((prev) => ({
                  ...prev,
                  createdDate: addedDate,
                  search: '',
                }));
              }
              refresh();
              setIsImportExportOpen(false);
            }}
          />
        )}

        {detailWord && (
          <WordDetailModal
            word={detailWord}
            onClose={() => setDetailWord(null)}
            onEdit={(w) => {
              setDetailWord(null);
              setEditingWord(w);
            }}
            onDelete={async (id) => {
              await deleteWord(id);
              setDetailWord(null);
              showToast('Word deleted from deck', 'info');
            }}
            deckWords={allWords}
            onSelectDeckWord={(w) => setDetailWord(w)}
            onLookupWord={(w) => {
              setDetailWord(null);
              setActiveTab('lookup');
              handleSearch(w);
            }}
            onAddWordToDeck={async (w) => {
              try {
                const enriched = await lookupWord(w);
                await handleSaveToDeck(enriched);
              } catch {
                // If lookup fails completely, do not add with fake definitions
                showToast(`Unable to lookup "${w}".`, 'error');
              }
            }}
          />
        )}

        {editingWord && (
          <EditableWordModal
            isOpen={!!editingWord}
            word={editingWord}
            onClose={() => setEditingWord(null)}
            onSave={async (updated) => {
              await updateWord(updated);
              setEditingWord(null);
              showToast(`Updated "${updated.word}"!`);
            }}
          />
        )}
      </Suspense>
    </div>
  );
}

export default App;
