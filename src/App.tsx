import { ArrowLeft, ArrowRight, BookOpen, Check, Headphones, HelpCircle, Layers, Lightbulb, ListChecks, Loader2, Search, Sparkles, X, Zap } from 'lucide-react';
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
import { ReviewChoice } from './components/review/ReviewChoice';
import { ReviewComplete } from './components/review/ReviewComplete';
import { ReviewDashboard } from './components/review/ReviewDashboard';
import { ReviewListening } from './components/review/ReviewListening';
import { ReviewMatch } from './components/review/ReviewMatch';
import { ReviewQuiz } from './components/review/ReviewQuiz';
import { useLanguage } from './context/LanguageContext';
import { useSpacedRepetition } from './hooks/useSpacedRepetition';
import { useTheme } from './hooks/useTheme';
import { useVocabulary } from './hooks/useVocabulary';
import { db, exportDeckToCsv, exportDeckToXlsx, initializeDatabase } from './services/db';
import { WordNotFoundError, lookupWord, warmSearchCache } from './services/dictionary';
import { createInitialReviewMeta } from './services/sm2';
import { formatLocalDate } from './utils/dateUtils';
import type { ClozeQuestion, ReviewMode, ReviewRating, SpellingSuggestion, WordItem } from './types/vocab';


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
  const [reviewState, setReviewState] = useState<{
    inProgress: boolean;
    mode: ReviewMode;
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
    setSearchTypoInfo(null);
    try {
      const result = await lookupWord(query);
      if (result) {
        setLookupResult(result);
      } else {
        setSearchError(`No definitions found for "${query}". Try another word!`);
      }
    } catch (err) {
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
  const handleStartReviewSession = (mode: ReviewMode, cardsToReview: WordItem[]) => {
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
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-[#0b0f19] dark:text-slate-100 flex flex-col font-sans">
      {/* Toast notifications */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
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
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        {/* TAB 1: LOOKUP */}
        {activeTab === 'lookup' && (
          <div className="space-y-7 animate-fade-in">
            {/* Hero Text */}
            <div className="text-center max-w-xl mx-auto space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                {language === 'vi' ? 'Công cụ tra từ thông minh' : 'Intelligent Linguistic Engine'}
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                {t.lookup.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {t.lookup.subtitle}
              </p>
            </div>

            {/* Search Bar */}
            <SearchBar onSearch={handleSearch} isLoading={isSearching} deckWords={allWords} />

            {/* Error state */}
            {searchError && (
              <div className="max-w-md mx-auto rounded-xl border border-rose-200/80 bg-rose-50/80 p-3.5 text-center text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {searchError}
              </div>
            )}

            {/* Typo / Spelling Correction Prompt */}
            {searchTypoInfo && (
              <div className="max-w-2xl mx-auto rounded-2xl border border-amber-200/80 bg-amber-50/70 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20 space-y-4 animate-fade-in">
                {/* Header Notice */}
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                      {t.lookup.noExactMatchFor} <span className="underline decoration-amber-400 decoration-wavy underline-offset-4">"{searchTypoInfo.query}"</span>
                    </h3>
                    <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                      {searchTypoInfo.suggestions.length > 0
                        ? t.lookup.didYouMean
                        : (language === 'vi' ? 'Hãy kiểm tra lại chính tả hoặc thử một từ khóa khác.' : 'Please check your spelling or try another keyword.')}
                    </p>
                  </div>
                </div>

                {/* Primary Recommendation Action Card */}
                {searchTypoInfo.suggestions.length > 0 && (
                  <div className="space-y-3">
                    <div className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200/90 bg-white/95 p-4 shadow-sm transition-all hover:border-indigo-300 dark:border-amber-900/70 dark:bg-slate-900/90">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {searchTypoInfo.suggestions[0].word}
                          </span>
                          {searchTypoInfo.suggestions[0].pos && (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300">
                              {searchTypoInfo.suggestions[0].pos}
                            </span>
                          )}
                          {isWordInDeck(searchTypoInfo.suggestions[0].word) && (
                            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300">
                              {t.lookup.inDeckBadge}
                            </span>
                          )}
                        </div>
                        {searchTypoInfo.suggestions[0].meaningVi && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                            {searchTypoInfo.suggestions[0].meaningVi}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSearch(searchTypoInfo.suggestions[0].word)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-95 transition-all shrink-0"
                      >
                        <span>{language === 'vi' ? `Tra cứu "${searchTypoInfo.suggestions[0].word}"` : `Lookup "${searchTypoInfo.suggestions[0].word}"`}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Secondary Suggestions (Chips) */}
                    {searchTypoInfo.suggestions.length > 1 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800/80 dark:text-amber-400/80">
                          {t.lookup.spellingSuggestions}:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {searchTypoInfo.suggestions.slice(1, 5).map((s) => (
                            <button
                              key={s.word}
                              type="button"
                              onClick={() => handleSearch(s.word)}
                              className="group inline-flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:text-indigo-600 dark:border-amber-900/60 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-indigo-600 dark:hover:text-indigo-400"
                            >
                              <span className="font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{s.word}</span>
                              {s.pos && (
                                <span className="text-[10px] text-slate-400">({s.pos})</span>
                              )}
                              {s.meaningVi && (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[120px] truncate">
                                  — {s.meaningVi}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
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

            {/* Fuzzy Deck Search Notice */}
            {isFuzzyMatch && filterOptions.search.trim() && words.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200 animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                    <Lightbulb className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">
                      {t.deck.fuzzyNotice.replace('{query}', filterOptions.search)}
                    </p>
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
                      {t.deck.didYouMeanInDeck} {words.slice(0, 3).map((w) => w.word).join(', ')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterOptions((prev) => ({ ...prev, search: '' }))}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 shadow-sm hover:bg-amber-50 dark:border-amber-900/80 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-950/50 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>{t.deck.clearSearch}</span>
                </button>
              </div>
            )}

            {/* Word List */}
            {deckLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
                <p className="mt-2 text-xs font-medium">
                  {language === 'vi' ? 'Đang tải danh sách từ vựng...' : 'Loading vocabulary deck...'}
                </p>
              </div>
            ) : words.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-800 bg-white/40 dark:bg-slate-900/20">
                <BookOpen className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" />
                <h3 className="mt-3 font-display text-base font-bold text-slate-800 dark:text-slate-200">
                  {t.deck.emptyDeckTitle}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {t.deck.emptyDeckDesc}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('lookup')}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-[0.99] transition-all"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>{t.deck.exploreLookupBtn}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
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
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 shadow-sm transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>{language === 'vi' ? 'Quay lại Hub Ôn tập' : 'Back to Review Hub'}</span>
                    </button>

                    {/* Quick Mode Switcher */}
                    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm">
                      {(
                        [
                          { id: 'flashcards', labelVi: 'Flashcard', labelEn: 'Flashcards', icon: Layers },
                          { id: 'cloze', labelVi: 'Điền từ', labelEn: 'Cloze', icon: HelpCircle },
                          { id: 'listen', labelVi: 'Nghe chép', labelEn: 'Dictation', icon: Headphones },
                          { id: 'choice', labelVi: '4 Đáp án', labelEn: 'Choice', icon: ListChecks },
                          { id: 'match', labelVi: 'Nối từ', labelEn: 'Match', icon: Zap },
                        ] as const
                      ).map((m) => {
                        const Icon = m.icon;
                        const isActive = reviewState.mode === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSwitchReviewMode(m.id)}
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                              isActive
                                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">
                              {language === 'vi' ? m.labelVi : m.labelEn}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Review Mode Content */}
                  {reviewState.mode === 'flashcards' && (
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
                  )}

                  {reviewState.mode === 'cloze' &&
                    reviewState.clozeQuestions[reviewState.currentIndex] && (
                      <ReviewQuiz
                        question={reviewState.clozeQuestions[reviewState.currentIndex]}
                        currentIndex={reviewState.currentIndex}
                        totalQuestions={reviewState.clozeQuestions.length}
                        onAnswer={handleGradeReview}
                      />
                    )}

                  {reviewState.mode === 'listen' &&
                    reviewState.cards[reviewState.currentIndex] && (
                      <ReviewListening
                        word={reviewState.cards[reviewState.currentIndex]}
                        currentIndex={reviewState.currentIndex}
                        totalCards={reviewState.cards.length}
                        onAnswer={handleGradeReview}
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
                    )}

                  {reviewState.mode === 'choice' &&
                    reviewState.cards[reviewState.currentIndex] && (
                      <ReviewChoice
                        word={reviewState.cards[reviewState.currentIndex]}
                        allWords={allWords}
                        currentIndex={reviewState.currentIndex}
                        totalCards={reviewState.cards.length}
                        onAnswer={handleGradeReview}
                      />
                    )}

                  {reviewState.mode === 'match' && (
                    <ReviewMatch
                      cards={reviewState.cards}
                      onCompleteSession={(history) => {
                        setReviewState((prev) => ({
                          ...prev,
                          sessionHistory: history,
                          isCompleted: true,
                        }));
                      }}
                      onGradeSingleWord={submitRating}
                    />
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
