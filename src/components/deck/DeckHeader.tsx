import { ArrowUpDown, Calendar, Database, Download, FileSpreadsheet, Play, Plus, Search, Tag, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { FilterOptions, WordStatus } from '../../types/vocab';

interface DeckHeaderProps {
  filterOptions: FilterOptions;
  onFilterChange: (options: FilterOptions) => void;
  allTags: Array<{ tag: string; count: number }>;
  availableDates?: Array<{ date: string; count: number }>;
  onOpenImportExport: (tab?: 'bulk' | 'export' | 'import') => void;
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

  useEffect(() => {
    setLocalSearch(filterOptions.search);
  }, [filterOptions.search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filterOptions.search) {
        onFilterChange({ ...filterOptions, search: localSearch });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [localSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(e.target.value);
  };

  const handleStatusChange = (status: WordStatus | 'all') => {
    onFilterChange({ ...filterOptions, status });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDate = e.target.value;
    onFilterChange({
      ...filterOptions,
      createdDate: selectedDate === 'all' ? undefined : selectedDate,
    });
  };

  const handleClearDate = () => {
    onFilterChange({ ...filterOptions, createdDate: undefined });
  };

  const handleTagToggle = (tag: string) => {
    const isSelected = filterOptions.tags.includes(tag);
    const newTags = isSelected
      ? filterOptions.tags.filter((t) => t !== tag)
      : [...filterOptions.tags, tag];
    onFilterChange({ ...filterOptions, tags: newTags });
  };

  const handleClearTags = () => {
    onFilterChange({ ...filterOptions, tags: [] });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filterOptions,
      sortBy: e.target.value as any,
    });
  };

  return (
    <div className="space-y-4">
      {/* Search & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search bar */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={handleSearchChange}
            placeholder={t.deck.searchPlaceholder}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
          />
          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch('');
                onFilterChange({ ...filterOptions, search: '' });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Action Buttons: Sort, Date Filter, Bulk Add, Export/Backup */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort Dropdown */}
          <div className="relative flex items-center">
            <ArrowUpDown className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
            <select
              value={filterOptions.sortBy}
              onChange={handleSortChange}
              className="rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-medium text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="urgency">{t.deck.sortUrgency}</option>
              <option value="date_added">{t.deck.sortDateAdded}</option>
              <option value="alpha">{t.deck.sortAlpha}</option>
              <option value="repetition">{t.deck.sortRepetition}</option>
            </select>
          </div>

          {/* Date Added Filter */}
          <div className="relative flex items-center">
            <Calendar className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-indigo-500" />
            <select
              value={filterOptions.createdDate || 'all'}
              onChange={handleDateChange}
              className={`rounded-xl border py-2 pl-9 pr-7 text-xs font-semibold shadow-sm focus:border-indigo-500 focus:outline-none transition-colors ${
                filterOptions.createdDate
                  ? 'border-indigo-300 bg-indigo-50/80 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
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
                className="absolute right-2 p-0.5 text-indigo-500 hover:text-indigo-700 dark:text-indigo-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Direct Add Word Button */}
          {onAddNewWord && (
            <button
              type="button"
              onClick={onAddNewWord}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{language === 'vi' ? 'Thêm từ mới' : 'Add Word'}</span>
            </button>
          )}

          {/* Bulk Import Button */}
          <button
            type="button"
            onClick={() => onOpenImportExport('bulk')}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 active:scale-95"
          >
            <span>{t.deck.bulkAddBtn}</span>
          </button>

          {/* Quick Export Excel button */}
          {onQuickExportXlsx && (
            <button
              type="button"
              onClick={onQuickExportXlsx}
              title={language === 'vi' ? 'Xuất danh sách từ hiện tại ra Excel (.xlsx)' : 'Export current words to Excel (.xlsx)'}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition-all active:scale-95"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">{language === 'vi' ? 'Xuất Excel' : 'Export Excel'}</span>
            </button>
          )}

          {/* Export / Backup button */}
          <button
            type="button"
            onClick={() => onOpenImportExport('export')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Database className="h-3.5 w-3.5 text-indigo-500" />
            <span className="hidden sm:inline">{t.deck.exportBackupBtn}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs: Status & Quick Export if Date Selected */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900/60">
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
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filterOptions.status === tab.id
                  ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
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
            <div className="flex items-center gap-1.5 rounded-lg bg-indigo-50 py-1 px-2.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
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
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
          <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1" />
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
  );
};
