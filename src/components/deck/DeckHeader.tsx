import { ArrowUpDown, Calendar, Download, FileSpreadsheet, Play, Search, Tag, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { FilterOptions, WordStatus } from '../../types/vocab';
import { DeckActions } from './DeckActions';
import { GlassDropdown } from '../common/GlassDropdown';
import { GlassSearchField } from '../common/Glass';

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
  onOpenTranslationAudit?: () => void;
  showActions?: boolean;
}

export const DeckHeader: React.FC<DeckHeaderProps> = ({ filterOptions, onFilterChange, allTags, availableDates = [], onOpenImportExport, onAddNewWord, onQuickExportCsv, onQuickExportXlsx, onReviewDateWords, onOpenTranslationAudit, showActions = true }) => {
  const { language, t } = useLanguage();
  const [localSearch, setLocalSearch] = useState(filterOptions.search);
  const filterOptionsRef = useRef(filterOptions);
  filterOptionsRef.current = filterOptions;
  useEffect(() => { setLocalSearch(filterOptions.search); }, [filterOptions.search]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filterOptionsRef.current.search) onFilterChange({ ...filterOptionsRef.current, search: localSearch });
    }, 150);
    return () => clearTimeout(timer);
  }, [localSearch, onFilterChange]);
  const updateFilter = (patch: Partial<FilterOptions>) => onFilterChange({ ...filterOptionsRef.current, search: localSearch, ...patch });
  const handleTagToggle = (tag: string) => {
    const tags = filterOptionsRef.current.tags;
    updateFilter({ tags: tags.includes(tag) ? tags.filter(item => item !== tag) : [...tags, tag] });
  };
  const statuses: Array<{ id: WordStatus | 'all'; label: string }> = [
    { id: 'all', label: t.deck.allCardsTab }, { id: 'review_needed', label: t.deck.reviewNeededTab },
    { id: 'learning', label: t.deck.learningTab }, { id: 'new', label: t.deck.newTab }, { id: 'mastered', label: t.deck.masteredTab },
  ];
  return <div className="deck-filter-header">
    {showActions && <DeckActions {...{ onOpenImportExport, onAddNewWord, onQuickExportCsv, onQuickExportXlsx, onOpenTranslationAudit }} />}
    <div className="deck-toolbar">
      <GlassSearchField className="deck-search">
        <Search size={17} aria-hidden="true" />
        <input type="search" value={localSearch} onChange={event => setLocalSearch(event.target.value)} placeholder={t.deck.searchPlaceholder} aria-label={t.deck.searchPlaceholder} />
        {localSearch && <button type="button" title={t.deck.clearSearch} onClick={() => { setLocalSearch(''); updateFilter({ search: '' }); }}><X size={15} /></button>}
      </GlassSearchField>
      <GlassDropdown icon={<ArrowUpDown size={15} aria-hidden="true" />} label={language === 'vi' ? 'Sắp xếp từ' : 'Sort words'}
        value={filterOptions.sortBy} onChange={value => updateFilter({ sortBy: value as FilterOptions['sortBy'] })}
        options={[{ value: 'urgency', label: t.deck.sortUrgency }, { value: 'date_added', label: t.deck.sortDateAdded }, { value: 'alpha', label: t.deck.sortAlpha }, { value: 'repetition', label: t.deck.sortRepetition }]} />
      <GlassDropdown icon={<Calendar size={15} aria-hidden="true" />} label={t.deck.allDates}
        value={filterOptions.createdDate || 'all'} onChange={value => updateFilter({ createdDate: value === 'all' ? undefined : value })}
        options={[{ value: 'all', label: t.deck.allDates }, ...availableDates.map(({ date, count }) => ({ value: date, label: `${date} (${count} ${t.deck.wordsCount})` }))]} />
    </div>
    <div className="deck-status-tabs" aria-label={language === 'vi' ? 'Lọc theo trạng thái' : 'Filter by status'}>
      {statuses.map(tab => <button key={tab.id} type="button" aria-pressed={filterOptions.status === tab.id} onClick={() => updateFilter({ status: tab.id })}>{tab.label}</button>)}
    </div>
    {filterOptions.createdDate && <div className="deck-date-actions">
      <span><Calendar size={14} />{filterOptions.createdDate}</span>
      <button type="button" title={t.deck.clearDateFilter} onClick={() => updateFilter({ createdDate: undefined })}><X size={14} /></button>
      {onReviewDateWords && <button type="button" onClick={() => onReviewDateWords(filterOptions.createdDate!)}><Play size={14} />{t.review.reviewDateWords}</button>}
      {onQuickExportXlsx && <button type="button" onClick={onQuickExportXlsx}><FileSpreadsheet size={14} />{t.deck.quickExportXlsx}</button>}
      {onQuickExportCsv && <button type="button" onClick={onQuickExportCsv}><Download size={14} />{t.deck.quickExportDate}</button>}
    </div>}
    {allTags.length > 0 && <details className="deck-tags">
      <summary><Tag size={14} />{language === 'vi' ? 'Chủ đề' : 'Topics'}<span>{filterOptions.tags.length > 0 ? `${filterOptions.tags.length} ${language === 'vi' ? 'đã chọn' : 'selected'}` : allTags.length}</span></summary>
      <div className="deck-tag-options">
        {allTags.map(({ tag, count }) => <button key={tag} type="button" aria-pressed={filterOptions.tags.includes(tag)} onClick={() => handleTagToggle(tag)}>{tag}<span>{count}</span></button>)}
      </div>
    </details>}
    {filterOptions.tags.length > 0 && <div className="deck-selected-tags">
      {filterOptions.tags.map(tag => <button key={tag} type="button" onClick={() => handleTagToggle(tag)}>{tag}<X size={12} /></button>)}
      <button type="button" onClick={() => updateFilter({ tags: [] })}>{t.deck.clearTagsFilter} ({filterOptions.tags.length})</button>
    </div>}
  </div>;
};
