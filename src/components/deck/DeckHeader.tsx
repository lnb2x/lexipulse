import { ArrowUpDown, Calendar, Database, Download, FileSpreadsheet, Play, Plus, Search, Tag, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { FilterOptions, WordStatus } from '../../types/vocab';

interface DeckHeaderProps {
  filterOptions: FilterOptions;
  onFilterChange: (options: FilterOptions) => void;
  allTags: Array<{ tag: string; count: number }>;
  availableDates?: Array<{ date: string; count: number }>;
  onOpenImportExport: (tab?: 'bulk' | 'quizlet' | 'export' | 'import') => void;
  onAddNewWord?: () => void;
  onQuickExportCsv?: () => void;
  onQuickExportXlsx?: () => void;
  onReviewDateWords?: (date: string) => void;
}

export const DeckHeader: React.FC<DeckHeaderProps> = ({
  filterOptions,
  onFilterChange,
  allTags,
  availableDates = [],
  onOpenImportExport,
  onAddNewWord,
  onQuickExportCsv,
  onQuickExportXlsx,
  onReviewDateWords,
}) => {
  const { language, t } = useLanguage();
  const [localSearch, setLocalSearch] = useState(filterOptions.search);
  const filterOptionsRef = useRef(filterOptions);
  filterOptionsRef.current = filterOptions;

  useEffect(() => {
    setLocalSearch(filterOptions.search);
  }, [filterOptions.search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filterOptionsRef.current.search) {
        onFilterChange({ ...filterOptionsRef.current, search: localSearch });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [localSearch, onFilterChange]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(e.target.value);
  };

  const handleStatusChange = (status: WordStatus | 'all') => {
    onFilterChange({ ...filterOptionsRef.current, search: localSearch, status });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDate = e.target.value;
    onFilterChange({
      ...filterOptionsRef.current,
      search: localSearch,
      createdDate: selectedDate === 'all' ? undefined : selectedDate,
    });
  };

  const handleClearDate = () => {
    onFilterChange({ ...filterOptionsRef.current, search: localSearch, createdDate: undefined });
  };

  const handleTagToggle = (tag: string) => {
    const isSelected = filterOptionsRef.current.tags.includes(tag);
    const newTags = isSelected
      ? filterOptionsRef.current.tags.filter((t) => t !== tag)
      : [...filterOptionsRef.current.tags, tag];
    onFilterChange({ ...filterOptionsRef.current, search: localSearch, tags: newTags });
  };

  const handleClearTags = () => {
    onFilterChange({ ...filterOptionsRef.current, search: localSearch, tags: [] });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filterOptionsRef.current,
      search: localSearch,
      sortBy: e.target.value as any,
    });
  };

  return (
    <div className="space-y-4">
      {/* TOOLBAR SECTION: Two distinct rows */}
      <div className="space-y-2.5 sm:space-y-3">
        {/* ROW 1: Search & Filter Controls (Sort, Date) */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 sm:gap-3">
          {/* Search bar: Auto-expanding, min 280px on desktop */}
          <div className="relative flex-1 min-w-0 sm:min-w-[280px] lg:min-w-[340px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={localSearch}
              onChange={handleSearchChange}
              placeholder={t.deck.searchPlaceholder}
              className="h-[44px] w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-9 text-xs sm:text-sm text-slate-900 placeholder-slate-400 shadow-subtle transition-all duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:border-slate-800 dark:bg-[#121824] dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/30"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  onFilterChange({ ...filterOptions, search: '' });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title={t.deck.clearSearch || 'Xóa tìm kiếm'}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Controls (Sort & Date): 2 columns on mobile, auto-width on tablet/desktop */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Sort Dropdown */}
            <div className="relative flex items-center min-w-0 w-full sm:w-auto">
              <ArrowUpDown className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <select
                value={filterOptions.sortBy}
                onChange={handleSortChange}
                className="h-[44px] w-full sm:w-auto rounded-xl border border-slate-200/90 bg-white py-2 pl-10 pr-8 text-xs sm:text-sm font-medium text-slate-700 shadow-subtle transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:border-slate-800 dark:bg-[#121824] dark:text-slate-300 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/30 cursor-pointer truncate"
              >
                <option value="urgency">{t.deck.sortUrgency}</option>
                <option value="date_added">{t.deck.sortDateAdded}</option>
                <option value="alpha">{t.deck.sortAlpha}</option>
                <option value="repetition">{t.deck.sortRepetition}</option>
              </select>
            </div>

            {/* Date Added Filter Dropdown */}
            <div className="relative flex items-center min-w-0 w-full sm:w-auto">
              <Calendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500 shrink-0" />
              <select
                value={filterOptions.createdDate || 'all'}
                onChange={handleDateChange}
                className={`h-[44px] w-full sm:w-auto sm:max-w-[210px] md:max-w-[230px] rounded-xl border py-2 pl-10 pr-8 text-xs sm:text-sm font-medium shadow-subtle transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:focus:ring-indigo-500/30 cursor-pointer truncate ${
                  filterOptions.createdDate
                    ? 'border-indigo-300 bg-indigo-50/80 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'border-slate-200/90 bg-white text-slate-700 dark:border-slate-800 dark:bg-[#121824] dark:text-slate-300'
                }`}
              >
                <option value="all">{t.deck.allDates}</option>
                {availableDates.map(({ date, count }) => (
                  <option key={date} value={date}>
                    {date} ({count} {t.deck.wordsCount})
                  </option>
                ))}
              </select>
              {filterOptions.createdDate && (
                <button
                  type="button"
                  onClick={handleClearDate}
                  title={t.deck.clearDateFilter}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-indigo-500 hover:text-indigo-700 dark:text-indigo-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Thêm từ mới (Direct Add Word Button) */}
          {onAddNewWord && (
            <button
              type="button"
              onClick={onAddNewWord}
              className="h-[44px] flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-[0.98] transition-all shrink-0"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>{language === 'vi' ? 'Thêm từ mới' : 'Add Word'}</span>
            </button>
          )}

          {/* Nhập từ / Nhập nhiều từ (Bulk Import Button) */}
          <button
            type="button"
            onClick={() => onOpenImportExport('bulk')}
            className="h-[44px] flex items-center justify-center gap-2 rounded-xl border border-indigo-200/90 bg-indigo-50/70 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold text-indigo-700 shadow-subtle hover:bg-indigo-100/80 active:scale-[0.98] dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition-all shrink-0"
          >
            <Plus className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>{t.deck.bulkAddBtn}</span>
          </button>

          {/* Nhập Quizlet (Quizlet Button) */}
          <button
            type="button"
            onClick={() => onOpenImportExport('quizlet')}
            className="h-[44px] flex items-center justify-center gap-2 rounded-xl border border-sky-200/90 bg-sky-50/70 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold text-sky-700 shadow-subtle hover:bg-sky-100/80 active:scale-[0.98] dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/50 transition-all shrink-0"
          >
            <Database className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>{t.deck.quizletBtn}</span>
          </button>

          {/* Xuất Excel (Quick Export Excel button) */}
          {onQuickExportXlsx && (
            <button
              type="button"
              onClick={onQuickExportXlsx}
              title={language === 'vi' ? 'Xuất danh sách từ hiện tại ra Excel (.xlsx)' : 'Export current words to Excel (.xlsx)'}
              className="h-[44px] flex items-center justify-center gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50/70 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold text-emerald-700 shadow-subtle hover:bg-emerald-100/80 active:scale-[0.98] dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition-all shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{language === 'vi' ? 'Xuất Excel' : 'Export Excel'}</span>
            </button>
          )}

          {/* Xuất & Sao lưu (Export / Backup button) */}
          <button
            type="button"
            onClick={() => onOpenImportExport('export')}
            className="h-[44px] flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700 shadow-subtle hover:bg-slate-50 active:scale-[0.98] dark:border-slate-800 dark:bg-[#121824] dark:text-slate-300 dark:hover:bg-slate-800/80 transition-all shrink-0"
          >
            <Download className="h-4 w-4 text-indigo-500 shrink-0" />
            <span>{t.deck.exportBackupBtn}</span>
          </button>
        </div>
      </div>

      {/* VISUAL SEPARATION: DIVIDER TO STATUS TABS & TAGS */}
      <div className="pt-2.5 sm:pt-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-3">

      {/* Filter Tabs: Status & Quick Export if Date Selected */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900/80">
          {(
            [
              { id: 'all', label: t.deck.allCardsTab },
              { id: 'review_needed', label: t.deck.reviewNeededTab },
              { id: 'learning', label: t.deck.learningTab },
              { id: 'new', label: t.deck.newTab },
              { id: 'mastered', label: t.deck.masteredTab },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleStatusChange(tab.id)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                filterOptions.status === tab.id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Filter Status & Quick Export Button */}
        <div className="flex items-center gap-2">
          {filterOptions.createdDate && (
            <div className="flex items-center gap-1.5 rounded-lg bg-indigo-50/80 py-1 px-2.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50">
              <Calendar className="h-3.5 w-3.5 text-indigo-500" />
              <span>{language === 'vi' ? 'Ngày' : 'Date'}: {filterOptions.createdDate}</span>
              {onReviewDateWords && (
                <button
                  type="button"
                  onClick={() => onReviewDateWords(filterOptions.createdDate!)}
                  className="ml-1 flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-500 active:scale-95"
                >
                  <Play className="h-3 w-3 fill-white" />
                  {t.review.reviewDateWords}
                </button>
              )}
              {onQuickExportXlsx && (
                <button
                  type="button"
                  onClick={onQuickExportXlsx}
                  className="ml-1 flex items-center gap-1 rounded bg-teal-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-teal-500"
                  title="Xuất file Excel (.xlsx)"
                >
                  <FileSpreadsheet className="h-3 w-3" />
                  {t.deck.quickExportXlsx}
                </button>
              )}
              {onQuickExportCsv && (
                <button
                  type="button"
                  onClick={onQuickExportCsv}
                  className="ml-1 flex items-center gap-1 rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-indigo-500"
                >
                  <Download className="h-3 w-3" />
                  {t.deck.quickExportDate}
                </button>
              )}
            </div>
          )}

          {/* Selected tags indicator */}
          {filterOptions.tags.length > 0 && (
            <button
              type="button"
              onClick={handleClearTags}
              className="flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-600"
            >
              {t.deck.clearTagsFilter} ({filterOptions.tags.length})
            </button>
          )}
        </div>
      </div>

      {/* Tags Carousel / Pills */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-xs">
          <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-0.5" />
          {allTags.map(({ tag, count }) => {
            const isSelected = filterOptions.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagToggle(tag)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                <span>{tag}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};
