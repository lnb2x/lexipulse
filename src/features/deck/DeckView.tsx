import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BarChart3, BookOpen, List, Lightbulb, Loader2, Search, ShieldCheck, X } from 'lucide-react';
import { ContributionHeatmap } from '../../components/deck/ContributionHeatmap';
import { SlidingSelection } from '../../components/common/SlidingSelection';
import { GlassButton } from '../../components/common/Glass';
import { ModalPresence } from '../../components/common/ModalPresence';
import { DeckHeader } from '../../components/deck/DeckHeader';
import { DeckActions } from '../../components/deck/DeckActions';
import { WeeklyActivity } from '../../components/deck/WeeklyActivity';
import { DeckStats } from '../../components/deck/DeckStats';
import { WordListItem } from '../../components/deck/WordListItem';
import { TranslationAuditModal } from '../../components/deck/TranslationAuditModal';
import { useLanguage } from '../../context/LanguageContext';
import { formatLocalDate } from '../../utils/dateUtils';
import type { DailyStats, FilterOptions, ReviewMode, WordItem } from '../../types/vocab';

export interface DeckViewProps {
  words: WordItem[];
  allWords: WordItem[];
  dailyStats: DailyStats[];
  deckStats: {
    total: number;
    due: number;
    new: number;
    learning: number;
    mastered: number;
  };
  deckLoading: boolean;
  filterOptions: FilterOptions;
  setFilterOptions: React.Dispatch<React.SetStateAction<FilterOptions>>;
  allTags: Array<{ tag: string; count: number }>;
  availableDates: Array<{ date: string; count: number }>;
  isFuzzyMatch: boolean;
  onOpenDetail: (word: WordItem) => void;
  onOpenEdit: (word: WordItem) => void;
  onDeleteWord: (id: string, word: string) => void;
  onOpenImportExport: (tab?: 'bulk' | 'quizlet' | 'export' | 'import') => void;
  onQuickExportCsv: () => void;
  onQuickExportXlsx: () => void;
  onStartReviewSession: (mode: ReviewMode, cards: WordItem[]) => void;
  onNavigateToLookup: () => void;
  onNavigateToReview?: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const DeckView: React.FC<DeckViewProps> = ({
  words,
  allWords,
  dailyStats,
  deckStats,
  deckLoading,
  filterOptions,
  setFilterOptions,
  allTags,
  availableDates,
  isFuzzyMatch,
  onOpenDetail,
  onOpenEdit,
  onDeleteWord,
  onOpenImportExport,
  onQuickExportCsv,
  onQuickExportXlsx,
  onStartReviewSession,
  onNavigateToLookup,
  onNavigateToReview,
  showToast,
}) => {
  const { language, t } = useLanguage();
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'list' | 'stats'>('list');
  const sectionTabsRef = useRef<HTMLDivElement>(null);
  const shouldScrollSection = useRef(false);
  const selectSection = (section: 'list' | 'stats') => {
    if (section === activeSection) return;
    shouldScrollSection.current = true;
    setActiveSection(section);
  };
  useLayoutEffect(() => {
    if (!shouldScrollSection.current) return;
    shouldScrollSection.current = false;
    document.getElementById(`deck-tab-${activeSection}`)?.focus({ preventScroll: true });
    sectionTabsRef.current?.parentElement?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }, [activeSection]);

  // Progressive rendering for instantaneous mount & silky smooth 60fps transitions
  const INITIAL_BATCH = 30;
  const BATCH_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset pagination when search query or filters change
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH);
  }, [
    filterOptions.search,
    filterOptions.status,
    filterOptions.createdDate,
    filterOptions.tags,
    filterOptions.sortBy,
    filterOptions.sortDirection,
  ]);

  // Progressive infinite scroll: load subsequent batches as user scrolls down
  useEffect(() => {
    if (visibleCount >= words.length) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisibleCount(words.length);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, words.length));
        }
      },
      { rootMargin: '300px' }
    );

    const el = sentinelRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [visibleCount, words.length, activeSection]);

  const visibleWords = useMemo(() => {
    return words.slice(0, visibleCount);
  }, [words, visibleCount]);

  const handleReviewDateWords = useCallback(
    (date: string) => {
      const dateWords = allWords.filter(
        (w) => formatLocalDate(w.createdAt) === date
      );
      if (dateWords.length > 0) {
        onStartReviewSession('flashcards', dateWords);
      } else {
        showToast(
          language === 'vi'
            ? 'Không có từ mới thêm vào ngày này!'
            : 'No words found for this date!',
          'error'
        );
      }
    },
    [allWords, onStartReviewSession, showToast, language]
  );

  const handleFilterDate = useCallback(
    (date: string) => {
      shouldScrollSection.current = true;
      setActiveSection('list');
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
    },
    [setFilterOptions, showToast, language]
  );

  return (
    <div className="deck-workspace">
      <div className="study-page-heading">
        <div>
          <div className="study-title-line"><h1>{language === 'vi' ? 'Bộ từ vựng' : 'Your vocabulary'}</h1></div>
          <p>{language === 'vi' ? 'Tìm từ, nghe phát âm và theo dõi lịch ôn.' : 'Find words, hear pronunciation and keep track of reviews.'}</p>
        </div>
        <DeckActions
          onOpenImportExport={onOpenImportExport}
          onAddNewWord={onNavigateToLookup}
          onQuickExportCsv={onQuickExportCsv}
          onQuickExportXlsx={onQuickExportXlsx}
          onOpenTranslationAudit={() => setIsAuditModalOpen(true)}
        />
      </div>
      <DeckStats stats={deckStats} />
      <div className="deck-section-navigation" ref={sectionTabsRef}>
        <SlidingSelection value={activeSection} role="tablist" aria-label={language === 'vi' ? 'Nội dung bộ từ' : 'Deck sections'} className="workspace-tabs" onKeyDown={event => {
          if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          const next = event.key === 'Home' ? 'list' : event.key === 'End' ? 'stats' : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? (activeSection === 'list' ? 'stats' : 'list') : null;
          if (!next) return;
          event.preventDefault();
          selectSection(next);
          document.getElementById(`deck-tab-${next}`)?.focus();
        }}>
          <button type="button" role="tab" id="deck-tab-list" aria-controls="deck-panel-list" aria-selected={activeSection === 'list'} tabIndex={activeSection === 'list' ? 0 : -1} onClick={() => selectSection('list')}><List size={17} />{language === 'vi' ? 'Danh sách từ' : 'Word list'}</button>
          <button type="button" role="tab" id="deck-tab-stats" aria-controls="deck-panel-stats" aria-selected={activeSection === 'stats'} tabIndex={activeSection === 'stats' ? 0 : -1} onClick={() => selectSection('stats')}><BarChart3 size={17} />{language === 'vi' ? 'Thống kê' : 'Statistics'}</button>
        </SlidingSelection>
        {onNavigateToReview && <GlassButton className="deck-review-link" onClick={onNavigateToReview}>{language === 'vi' ? 'Ôn tập ngay' : 'Review now'}<ArrowRight size={16} /></GlassButton>}
      </div>
      <section role="tabpanel" id="deck-panel-list" aria-labelledby="deck-tab-list" hidden={activeSection !== 'list'} tabIndex={0}>
      {activeSection === 'list' && <div className="study-panel deck-list-panel">
      <DeckHeader
        showActions={false}
        filterOptions={filterOptions}
        onFilterChange={setFilterOptions}
        allTags={allTags}
        availableDates={availableDates}
        onOpenImportExport={onOpenImportExport}
        onAddNewWord={onNavigateToLookup}
        onQuickExportCsv={onQuickExportCsv}
        onQuickExportXlsx={onQuickExportXlsx}
        onReviewDateWords={handleReviewDateWords}
        onOpenTranslationAudit={() => setIsAuditModalOpen(true)}
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
            {allWords.length === 0 ? t.deck.emptyDeckTitle : t.deck.noFilterMatchesTitle}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {allWords.length === 0 ? t.deck.emptyDeckDesc : t.deck.noFilterMatchesDesc}
          </p>
          <button
            type="button"
            onClick={allWords.length === 0 ? onNavigateToLookup : () => setFilterOptions(prev => ({
              ...prev, search: '', tags: [], status: 'all', createdDate: undefined,
            }))}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-[0.99] transition-all"
          >
            {allWords.length === 0 ? <Search className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            <span>{allWords.length === 0 ? t.deck.exploreLookupBtn : t.deck.clearFilters}</span>
          </button>
        </div>
      ) : (
        <div className="deck-word-list">
          <div className="deck-list-labels" aria-hidden="true"><span>{language === 'vi' ? 'Từ vựng' : 'Word'}</span><span>{language === 'vi' ? 'Ý nghĩa' : 'Meaning'}</span><span>{language === 'vi' ? 'Lịch ôn' : 'Review'}</span><span /></div>
          {visibleWords.map((word: WordItem) => (
            <WordListItem
              key={word.id}
              word={word}
              onClick={() => onOpenDetail(word)}
              onEdit={() => onOpenEdit(word)}
              onDelete={() => onDeleteWord(word.id, word.word)}
            />
          ))}

          {/* Progressive infinite loading sentinel */}
          {visibleCount < words.length && (
            <div
              ref={sentinelRef}
              className="flex flex-col sm:flex-row items-center justify-center gap-2 py-6 text-xs text-slate-400 dark:text-slate-500"
            >
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span>
                  {language === 'vi'
                    ? `Đang hiển thị ${visibleWords.length} / ${words.length} từ...`
                    : `Showing ${visibleWords.length} of ${words.length} words...`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setVisibleCount(words.length)}
                className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 underline cursor-pointer"
              >
                {language === 'vi' ? 'Hiển thị tất cả' : 'Show all'}
              </button>
            </div>
          )}
        </div>
      )}

      {words.length > 0 && <div className="deck-list-footer">{language === 'vi' ? `${words.length} từ khớp bộ lọc · Chọn một từ để xem chi tiết` : `${words.length} matching words · Select a word for details`}</div>}
      </div>}
      </section>
      <section role="tabpanel" id="deck-panel-stats" aria-labelledby="deck-tab-stats" hidden={activeSection !== 'stats'} tabIndex={0}>
        {activeSection === 'stats' && <div className="deck-statistics-grid">
          <ContributionHeatmap words={allWords} dailyStats={dailyStats} onReviewDateWords={handleReviewDateWords} onFilterDate={handleFilterDate} />
          <aside className="study-sidebar">
            <WeeklyActivity dailyStats={dailyStats} />
            <div className="deck-storage-note"><ShieldCheck size={19} /><p>{language === 'vi' ? 'Bộ từ được lưu trên thiết bị này. Xuất bản sao lưu để bảo vệ tiến độ của bạn.' : 'Your deck is saved on this device. Export a backup to protect your progress.'}</p></div>
          </aside>
        </div>}
      </section>

      {/* Translation Audit & Backfill Modal */}
      <ModalPresence open={isAuditModalOpen}>
      {isAuditModalOpen && <TranslationAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        allWords={allWords}
        onEnrichmentComplete={() => {
          showToast(
            language === 'vi'
              ? 'Đã hoàn tất kiểm tra và bổ sung bản dịch!'
              : 'Translation audit and backfill completed!',
            'success'
          );
        }}
      />}
      </ModalPresence>
    </div>
  );
};
