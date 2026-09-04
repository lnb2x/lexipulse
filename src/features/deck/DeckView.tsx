import React from 'react';
import { BookOpen, Lightbulb, Loader2, Search, X } from 'lucide-react';
import { ContributionHeatmap } from '../../components/deck/ContributionHeatmap';
import { DeckHeader } from '../../components/deck/DeckHeader';
import { DeckStats } from '../../components/deck/DeckStats';
import { WordListItem } from '../../components/deck/WordListItem';
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
  onOpenImportExport: (tab?: 'bulk' | 'export' | 'import') => void;
  onQuickExportCsv: () => void;
  onQuickExportXlsx: () => void;
  onStartReviewSession: (mode: ReviewMode, cards: WordItem[]) => void;
  onNavigateToLookup: () => void;
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
  showToast,
}) => {
  const { language, t } = useLanguage();

  return (
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
            onStartReviewSession('flashcards', dateWords);
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
        onOpenImportExport={onOpenImportExport}
        onQuickExportCsv={onQuickExportCsv}
        onQuickExportXlsx={onQuickExportXlsx}
        onReviewDateWords={(date) => {
          const dateWords = allWords.filter(
            (w) => formatLocalDate(w.createdAt) === date
          );
          if (dateWords.length > 0) {
            onStartReviewSession('flashcards', dateWords);
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
            onClick={onNavigateToLookup}
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
              onClick={() => onOpenDetail(word)}
              onEdit={() => onOpenEdit(word)}
              onDelete={() => onDeleteWord(word.id, word.word)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
