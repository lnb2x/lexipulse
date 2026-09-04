import { ArrowLeft, BookOpen, Check, HelpCircle, Layers, Loader2, Search, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Header } from './components/common/Header';
import { SettingsModal } from './components/common/SettingsModal';
import { ShortcutsModal } from './components/common/ShortcutsModal';
import { useLiveQuery } from 'dexie-react-hooks';
import { ContributionHeatmap } from './components/deck/ContributionHeatmap';
import { DeckHeader } from './components/deck/DeckHeader';
import { DeckStats } from './components/deck/DeckStats';
import { ImportExportModal } from './components/deck/ImportExportModal';
import { WordDetailModal } from './components/deck/WordDetailModal';
import { WordListItem } from './components/deck/WordListItem';
import { EditableWordModal } from './components/lookup/EditableWordModal';
import { SearchBar } from './components/lookup/SearchBar';
import { WordCard } from './components/lookup/WordCard';
import { Flashcard } from './components/review/Flashcard';
import { ReviewComplete } from './components/review/ReviewComplete';
import { ReviewDashboard } from './components/review/ReviewDashboard';
import { ReviewQuiz } from './components/review/ReviewQuiz';
import { useLanguage } from './context/LanguageContext';
import { useSpacedRepetition } from './hooks/useSpacedRepetition';
import { useTheme } from './hooks/useTheme';
import { useVocabulary } from './hooks/useVocabulary';
import { db, exportDeckToCsv, exportDeckToXlsx, initializeDatabase } from './services/db';
import { lookupWord, warmSearchCache } from './services/dictionary';
import { createInitialReviewMeta } from './services/sm2';
import { formatLocalDate } from './utils/dateUtils';
import type { ClozeQuestion, ReviewRating, WordItem } from './types/vocab';


interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

export function App() {
  const { language, t } = useLanguage();
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

  // Toast Notification System
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Vocabulary Deck Hook
  const {
    words,
    allWords,
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

  // Active Review Session State
  const [reviewState, setReviewState] = useState<{
    inProgress: boolean;
    mode: 'flashcards' | 'cloze';
    cards: WordItem[];
    currentIndex: number;
    clozeQuestions: ClozeQuestion[];
    sessionHistory: Array<{ word: WordItem; rating: number }>;
    isCompleted: boolean;
  }>({
    inProgress: false,
    mode: 'flashcards',
    cards: [],
    currentIndex: 0,
    clozeQuestions: [],
    sessionHistory: [],
    isCompleted: false,
  });

  // Initialize DB on first launch
  useEffect(() => {
    initializeDatabase().then(() => {
      refresh();
    });
  }, [refresh]);

  // Load a default featured word on initial load for lookup and pre-warm search cache
  useEffect(() => {
    if (allWords.length > 0) {
      warmSearchCache(allWords);
      if (!lookupResult) {
        setLookupResult(allWords[0]);
      }
    }
  }, [allWords, lookupResult]);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when user is typing in form inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
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

  // Handle Lookup submission
  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const result = await lookupWord(query);
      if (result) {
        setLookupResult(result);
      } else {
        setSearchError(`No definitions found for "${query}". Try another word!`);
      }
    } catch {
      setSearchError('Error searching word. Please check your network connection.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Saving to Deck
  const handleSaveToDeck = async (wordToSave: WordItem) => {
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
    }
  };

  // Start Review Session
  const handleStartReviewSession = (mode: 'flashcards' | 'cloze', cardsToReview: WordItem[]) => {
    if (cardsToReview.length === 0) return;

    let clozeQuestions: ClozeQuestion[] = [];
    if (mode === 'cloze') {
      clozeQuestions = generateClozeQuestions(cardsToReview);
    }

    setReviewState({
      inProgress: true,
      mode,
      cards: cardsToReview,
      currentIndex: 0,
      clozeQuestions,
      sessionHistory: [],
      isCompleted: false,
    });
  };

  // Handle switching review mode on the fly
  const handleSwitchReviewMode = (newMode: 'flashcards' | 'cloze') => {
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
    showToast(
      language === 'vi'
        ? `Đã chuyển chế độ: ${newMode === 'flashcards' ? 'Thẻ Flashcard' : 'Trắc nghiệm (Quiz)'}`
        : `Switched mode: ${newMode === 'flashcards' ? 'Flashcards' : 'Quiz'}`,
      'info'
    );
  };

  // Handle Review Rating Submission
  const handleGradeReview = async (rating: ReviewRating) => {
    const currentWord = reviewState.cards[reviewState.currentIndex];
    if (!currentWord) return;

    await submitRating(currentWord.id, rating);

    const nextIndex = reviewState.currentIndex + 1;
    const newHistory = [...reviewState.sessionHistory, { word: currentWord, rating }];

    if (nextIndex >= reviewState.cards.length) {
      // Completed session
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
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-[#080B11] dark:text-slate-100 flex flex-col font-sans">
      {/* Toast notifications */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-semibold shadow-xl backdrop-blur-md animate-slide-up ${
              t.type === 'success'
                ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                : t.type === 'error'
                ? 'bg-rose-600 text-white shadow-rose-600/20'
                : 'bg-indigo-600 text-white shadow-indigo-600/20'
            }`}
          >
            <Check className="h-4 w-4" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Main App Navigation Header */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          // If moving away from in-progress review, keep state intact
        }}
        streak={streak}
        totalCards={allWords.length}
        dueCount={dueCards.length}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        {/* TAB 1: LOOKUP */}
        {activeTab === 'lookup' && (
          <div className="space-y-8 animate-fade-in">
            {/* Hero Text */}
            <div className="text-center max-w-xl mx-auto space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                <Sparkles className="h-3.5 w-3.5" />
                {language === 'vi' ? 'Công cụ tra từ thông minh' : 'Intelligent Linguistic Engine'}
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                {t.lookup.title}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t.lookup.subtitle}
              </p>
            </div>

            {/* Search Bar */}
            <SearchBar onSearch={handleSearch} isLoading={isSearching} deckWords={allWords} />

            {/* Error state */}
            {searchError && (
              <div className="max-w-md mx-auto rounded-2xl bg-rose-50 p-4 text-center text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {searchError}
              </div>
            )}

            {/* Word Card */}
            {lookupResult && (
              <WordCard
                word={lookupResult}
                onSaveToDeck={handleSaveToDeck}
                isAlreadyInDeck={isWordInDeck(lookupResult.word)}
                onLookupWord={handleSearch}
                deckWords={allWords}
              />
            )}
          </div>
        )}

        {/* TAB 2: DECK */}
        {activeTab === 'deck' && (
          <div className="space-y-6 animate-fade-in">
            {/* Quick Metrics */}
            <DeckStats stats={deckStats} />

            {/* GitHub-style Contribution Heatmap */}
            <ContributionHeatmap
              words={allWords}
              dailyStats={dailyStats}
              onReviewDateWords={(date) => {
                const dateWords = allWords.filter(
                  (w) => formatLocalDate(w.createdAt) === date
                );
                if (dateWords.length > 0) {
                  setActiveTab('review');
                  handleStartReviewSession('flashcards', dateWords);
                } else {
                  showToast(
                    language === 'vi'
                      ? 'Không có từ mới thêm vào ngày này!'
                      : 'No words found for this date!',
                    'error'
                  );
                }
              }}
              onFilterDate={(date) => {
                setFilterOptions((prev) => ({
                  ...prev,
                  createdDate: prev.createdDate === date ? undefined : date,
                }));
                showToast(
                  language === 'vi'
                    ? `Đã cập nhật bộ lọc từ ngày ${date}`
                    : `Filtered words for ${date}`,
                  'info'
                );
              }}
            />

            {/* Deck Filters & Search */}
            <DeckHeader
              filterOptions={filterOptions}
              onFilterChange={setFilterOptions}
              allTags={allTags}
              availableDates={availableDates}
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
              onReviewDateWords={(date) => {
                const dateWords = allWords.filter(
                  (w) => formatLocalDate(w.createdAt) === date
                );
                if (dateWords.length > 0) {
                  setActiveTab('review');
                  handleStartReviewSession('flashcards', dateWords);
                } else {
                  showToast(
                    language === 'vi'
                      ? 'Không có từ nào trong ngày này!'
                      : 'No words found for this date!',
                    'error'
                  );
                }
              }}
            />

            {/* Word List */}
            {deckLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                <p className="mt-2 text-xs">
                  {language === 'vi' ? 'Đang tải danh sách từ vựng...' : 'Loading vocabulary deck...'}
                </p>
              </div>
            ) : words.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800">
                <BookOpen className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                <h3 className="mt-3 text-base font-bold text-slate-800 dark:text-slate-200">
                  {t.deck.emptyDeckTitle}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t.deck.emptyDeckDesc}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('lookup')}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  <Search className="h-3.5 w-3.5" />
                  {t.deck.exploreLookupBtn}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {words.map((word: WordItem) => (
                  <WordListItem
                    key={word.id}
                    word={word}
                    onClick={() => setDetailWord(word)}
                    onEdit={() => setEditingWord(word)}
                    onDelete={async () => {
                      await deleteWord(word.id);
                      showToast(`Deleted "${word.word}" from deck`, 'info');
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REVIEW */}
        {activeTab === 'review' && (
          <div className="space-y-6 animate-fade-in">
            {reviewState.inProgress ? (
              reviewState.isCompleted ? (
                <ReviewComplete
                  reviewedCount={reviewState.sessionHistory.length}
                  streak={streak}
                  history={reviewState.sessionHistory}
                  onRestart={() => {
                    handleStartReviewSession(reviewState.mode, reviewState.cards);
                  }}
                  onGoToDeck={() => {
                    setReviewState((prev) => ({ ...prev, inProgress: false }));
                    setActiveTab('deck');
                  }}
                />
              ) : (
                <div className="space-y-4">
                  {/* Top Navigation & Mode Switcher Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setReviewState((prev) => ({ ...prev, inProgress: false }))}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>{language === 'vi' ? 'Quay lại Hub Ôn tập' : 'Back to Review Hub'}</span>
                    </button>

                    {/* Quick Mode Switcher */}
                    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm">
                      <button
                        type="button"
                        onClick={() => handleSwitchReviewMode('flashcards')}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                          reviewState.mode === 'flashcards'
                            ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>{language === 'vi' ? 'Thẻ Flashcard' : 'Flashcards'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchReviewMode('cloze')}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                          reviewState.mode === 'cloze'
                            ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span>{language === 'vi' ? 'Trắc nghiệm (Quiz)' : 'Quiz (Cloze)'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Review Mode Content */}
                  {reviewState.mode === 'flashcards' ? (
                    <Flashcard
                      word={reviewState.cards[reviewState.currentIndex]}
                      currentIndex={reviewState.currentIndex}
                      totalCards={reviewState.cards.length}
                      onGrade={handleGradeReview}
                      onPrevCard={
                        reviewState.currentIndex > 0
                          ? () =>
                              setReviewState((prev) => ({
                                ...prev,
                                currentIndex: prev.currentIndex - 1,
                              }))
                          : undefined
                      }
                      onNextCard={
                        reviewState.currentIndex < reviewState.cards.length - 1
                          ? () =>
                              setReviewState((prev) => ({
                                ...prev,
                                currentIndex: prev.currentIndex + 1,
                              }))
                          : undefined
                      }
                    />
                  ) : (
                    reviewState.clozeQuestions[reviewState.currentIndex] && (
                      <ReviewQuiz
                        question={reviewState.clozeQuestions[reviewState.currentIndex]}
                        currentIndex={reviewState.currentIndex}
                        totalQuestions={reviewState.clozeQuestions.length}
                        onAnswer={handleGradeReview}
                      />
                    )
                  )}
                </div>
              )
            ) : (
              <ReviewDashboard
                dueCards={dueCards}
                allWords={allWords}
                availableDates={availableDates}
                reviewedTodayCount={reviewedTodayCount}
                dailyQuota={dailyQuota}
                streak={streak}
                onStartSession={handleStartReviewSession}
              />
            )}
          </div>
        )}
      </main>

      {/* Global Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsUpdated={() => {
          showToast('Settings saved successfully');
          refresh();
        }}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

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
            const fallback: WordItem = {
              id: `word-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              word: w.toLowerCase(),
              pos: ['noun'],
              vietnameseDefinition: `Ý nghĩa của "${w}"`,
              englishDefinition: `Definition for ${w}`,
              meanings: [
                {
                  pos: 'noun',
                  englishDefinition: `Definition for ${w}`,
                  vietnameseDefinition: `Ý nghĩa của "${w}"`,
                },
              ],
              phonetics: { us: `/${w}/`, uk: `/${w}/` },
              collocations: [],
              wordFamily: [],
              examples: [],
              tags: ['#TOEIC', '#WordFamily'],
              status: 'new',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              reviewMeta: createInitialReviewMeta(),
            };
            await handleSaveToDeck(fallback);
          }
        }}
      />

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
    </div>
  );
}

export default App;
