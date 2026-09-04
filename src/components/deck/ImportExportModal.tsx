import { Calendar, Check, Copy, Download, FileSpreadsheet, Layers, Loader2, Plus, Sparkles, Upload, X } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { db, exportDeckToCsv, exportDeckToJson, exportDeckToXlsx, importDeckFromJson } from '../../services/db';
import { lookupWord } from '../../services/dictionary';
import { createInitialReviewMeta } from '../../services/sm2';
import type { WordItem } from '../../types/vocab';
import { formatLocalDate, parseLocalDateToTimestamp } from '../../utils/dateUtils';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (dateAdded?: string) => void;
  allWords?: WordItem[];
  filteredWords?: WordItem[];
  availableDates?: Array<{ date: string; count: number }>;
  activeFilterDate?: string;
  initialTab?: 'bulk' | 'export' | 'import';
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  allWords = [],
  filteredWords = [],
  availableDates = [],
  activeFilterDate = '',
  initialTab = 'bulk',
}) => {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'bulk' | 'export' | 'import'>(initialTab);
  const [copied, setCopied] = useState(false);

  // Bulk Import state
  const [bulkText, setBulkText] = useState('');
  const [customDate, setCustomDate] = useState<string>(
    activeFilterDate || formatLocalDate()
  );
  const [batchTags, setBatchTags] = useState('#TOEIC');
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; word: string } | null>(null);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);

  // Export state
  const [exportScope, setExportScope] = useState<'all' | 'date' | 'filtered'>(
    activeFilterDate ? 'date' : 'all'
  );
  const [selectedExportDate, setSelectedExportDate] = useState<string>(
    activeFilterDate || (availableDates[0]?.date ?? formatLocalDate())
  );

  // JSON Import state
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  if (!isOpen) return null;

  // Determine words to export based on selected scope
  const getWordsToExport = (): WordItem[] => {
    if (exportScope === 'filtered') {
      return filteredWords;
    }
    if (exportScope === 'date') {
      return allWords.filter(
        (w) => formatLocalDate(w.createdAt) === selectedExportDate
      );
    }
    return allWords;
  };

  const handleDownloadJson = async () => {
    const targetWords = getWordsToExport();
    const json = await exportDeckToJson(targetWords);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = exportScope === 'date' ? `_${selectedExportDate}` : exportScope === 'filtered' ? '_filtered' : '_all';
    a.download = `lexipulse_deck${suffix}_${formatLocalDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadXlsx = async () => {
    const targetWords = getWordsToExport();
    const blob = await exportDeckToXlsx(targetWords);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = exportScope === 'date' ? `_${selectedExportDate}` : exportScope === 'filtered' ? '_filtered' : '_all';
    a.download = `lexipulse_deck${suffix}_${formatLocalDate()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = async () => {
    const targetWords = getWordsToExport();
    const csv = await exportDeckToCsv(targetWords);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = exportScope === 'date' ? `_${selectedExportDate}` : exportScope === 'filtered' ? '_filtered' : '_all';
    a.download = `lexipulse_deck${suffix}_${formatLocalDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = async () => {
    const targetWords = getWordsToExport();
    const json = await exportDeckToJson(targetWords);
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Bulk import processor
  const handleBulkAdd = async () => {
    // Robust parsing: handle newlines and/or commas
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    const rawLines: string[] = [];
    for (const line of lines) {
      // If line does NOT have a definition separator (' - ' or ' : '), but has commas, split by comma!
      if (!line.includes(' - ') && !line.includes(' : ') && line.includes(',')) {
        rawLines.push(...line.split(',').map((w) => w.trim()).filter(Boolean));
      } else {
        rawLines.push(line);
      }
    }

    if (rawLines.length === 0) return;

    setIsProcessing(true);
    setBulkSuccessMsg(null);
    setProgress({ current: 0, total: rawLines.length, word: '' });

    // Parse tag list
    const parsedTags = batchTags
      .split(/[, ]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));
    if (parsedTags.length === 0) parsedTags.push('#TOEIC');

    // Parse date timestamp in local timezone (noon to avoid time-zone day shift)
    const dateTimestamp = parseLocalDateToTimestamp(customDate, 'noon');

    let addedCount = 0;

    const createFallbackItem = (
      wordStr: string,
      meaningStr: string
    ): WordItem => {
      const clean = wordStr.trim();
      return {
        id: `word-${dateTimestamp}-${Math.random().toString(36).slice(2, 7)}`,
        word: clean.toLowerCase(),
        phonetics: { us: `/${clean}/`, uk: `/${clean}/` },
        pos: ['noun'],
        vietnameseDefinition: meaningStr || `Ý nghĩa của "${clean}"`,
        englishDefinition: `Definition for ${clean}`,
        meanings: [
          {
            pos: 'noun',
            englishDefinition: `Definition for ${clean}`,
            example: `This example illustrates the use of ${clean}.`,
          },
        ],
        collocations: [
          { phrase: `${clean} in practice`, meaningVi: 'áp dụng trong thực tế' },
        ],
        wordFamily: [],
        examples: [
          {
            en: `This demonstrates the practical use of ${clean}.`,
            vi: `Điều này thể hiện cách sử dụng thực tế của từ ${clean}.`,
            context: 'general',
          },
        ],
        tags: parsedTags,
        status: 'new',
        createdAt: dateTimestamp,
        updatedAt: dateTimestamp,
        reviewMeta: createInitialReviewMeta(),
      };
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      // Format: "word - meaning" or "word : meaning" or just "word"
      let rawWord = line;
      let userMeaning = '';

      if (line.includes(' - ')) {
        const parts = line.split(' - ');
        rawWord = parts[0].trim();
        userMeaning = parts.slice(1).join(' - ').trim();
      } else if (line.includes(' : ')) {
        const parts = line.split(' : ');
        rawWord = parts[0].trim();
        userMeaning = parts.slice(1).join(' : ').trim();
      } else if (line.includes('-')) {
        const parts = line.split('-');
        rawWord = parts[0].trim();
        userMeaning = parts.slice(1).join('-').trim();
      } else if (line.includes(':')) {
        const parts = line.split(':');
        rawWord = parts[0].trim();
        userMeaning = parts.slice(1).join(':').trim();
      }

      // Strip leading bullet numbers like "1. ", "2) ", "- "
      rawWord = rawWord.replace(/^[\d]+[.)]\s*/, '').replace(/^[-*•]\s*/, '').trim();

      if (!rawWord) continue;
      setProgress({ current: i + 1, total: rawLines.length, word: rawWord });

      try {
        let item: WordItem;

        if (autoEnrich) {
          try {
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 3000)
            );
            const lookedUp = await Promise.race([lookupWord(rawWord), timeoutPromise]);
            item = {
              ...lookedUp,
              word: rawWord.toLowerCase(),
              id: `word-${dateTimestamp}-${Math.random().toString(36).slice(2, 7)}`,
              vietnameseDefinition: userMeaning || lookedUp.vietnameseDefinition,
              createdAt: dateTimestamp,
              updatedAt: dateTimestamp,
              tags: Array.from(new Set([...lookedUp.tags, ...parsedTags])),
            };
          } catch (lookupErr) {
            console.warn(`Lookup failed or timed out for "${rawWord}", using reliable offline fallback:`, lookupErr);
            item = createFallbackItem(rawWord, userMeaning);
          }
        } else {
          item = createFallbackItem(rawWord, userMeaning);
        }

        const normalized = item.word.trim().toLowerCase();
        const existing = await db.words.where('word').equals(normalized).first();
        if (existing) {
          await db.words.put({
            ...existing,
            ...item,
            word: normalized,
            id: existing.id,
            createdAt: dateTimestamp,
            updatedAt: Date.now(),
          });
        } else {
          let safeId = item.id;
          if (await db.words.get(safeId)) {
            safeId = `word-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          }
          await db.words.put({
            ...item,
            id: safeId,
            word: normalized,
            createdAt: dateTimestamp,
            updatedAt: Date.now(),
          });
        }

        addedCount++;
      } catch (err) {
        console.error(`Failed to process word "${rawWord}":`, err);
      }
    }

    setIsProcessing(false);
    setProgress(null);
    setBulkText('');
    setBulkSuccessMsg(
      language === 'vi'
        ? `Đã thêm thành công ${addedCount} từ vào Deck với ngày ghi nhận là ${customDate}!`
        : `Successfully added ${addedCount} words to Deck with date ${customDate}!`
    );
    onImportComplete(customDate);
  };

  const handleImportJsonText = async () => {
    if (!importText.trim()) return;
    const res = await importDeckFromJson(importText.trim());
    setImportResult(res);
    if (res.imported > 0) {
      onImportComplete();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setImportText(content);
      const res = await importDeckFromJson(content);
      setImportResult(res);
      if (res.imported > 0) {
        onImportComplete();
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xl dark:border-slate-800 dark:bg-[#111622]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {t.modals.bulkTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.modals.bulkSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-4 flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => {
              setActiveTab('bulk');
              setBulkSuccessMsg(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              activeTab === 'bulk'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t.modals.bulkTab}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('export');
              setBulkSuccessMsg(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              activeTab === 'export'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t.modals.exportTab}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('import');
              setBulkSuccessMsg(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              activeTab === 'import'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t.modals.backupTab}
          </button>
        </div>

        {/* TAB 1: BULK ADD */}
        {activeTab === 'bulk' && (
          <div className="mt-5 space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.modals.bulkTextareaDesc}
            </p>

            {/* Bulk Textarea */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.modals.bulkListLabel}
              </label>
              <textarea
                rows={5}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={t.modals.bulkPlaceholder}
                disabled={isProcessing}
                className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 font-mono text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:bg-slate-800"
              />
            </div>

            {/* Custom Date & Tags row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                  {t.modals.dateAddedLabel}
                </label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  disabled={isProcessing}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t.modals.tagsLabel}
                </label>
                <input
                  type="text"
                  value={batchTags}
                  onChange={(e) => setBatchTags(e.target.value)}
                  placeholder="#TOEIC, #Unit1"
                  disabled={isProcessing}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Auto enrich toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={autoEnrich}
                onChange={(e) => setAutoEnrich(e.target.checked)}
                disabled={isProcessing}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                {t.modals.autoEnrichLabel}
              </span>
            </label>

            {/* Progress bar */}
            {isProcessing && progress && (
              <div className="space-y-1.5 rounded-2xl bg-indigo-50/80 p-3 dark:bg-indigo-950/40">
                <div className="flex items-center justify-between text-xs font-medium text-indigo-700 dark:text-indigo-300">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t.modals.processingWord} <strong>{progress.word}</strong>
                  </span>
                  <span>{progress.current} / {progress.total}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-200/80 dark:bg-indigo-900">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Success message */}
            {bulkSuccessMsg && (
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{bulkSuccessMsg}</span>
              </div>
            )}

            {/* Submit button */}
            <button
              type="button"
              onClick={handleBulkAdd}
              disabled={isProcessing || !bulkText.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 active:scale-98 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t.modals.bulkProcessingBtn}</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>{t.modals.bulkSubmitBtn} ({bulkText.split(/[\n,]/).filter((l) => l.trim()).length})</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* TAB 2: EXPORT */}
        {activeTab === 'export' && (
          <div className="mt-5 space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.modals.exportDesc}
            </p>

            {/* Scope Selection */}
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportScope === 'all'}
                  onChange={() => setExportScope('all')}
                  className="text-indigo-600"
                />
                <span>{t.modals.exportAllScope} (<strong>{allWords.length}</strong>)</span>
              </label>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportScope === 'date'}
                    onChange={() => setExportScope('date')}
                    className="text-indigo-600"
                  />
                  <span>{t.modals.exportDateScope}</span>
                </label>

                <select
                  value={selectedExportDate}
                  onChange={(e) => {
                    setSelectedExportDate(e.target.value);
                    setExportScope('date');
                  }}
                  className="rounded-lg border border-slate-200 bg-white py-1 px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {availableDates.map((item) => (
                    <option key={item.date} value={item.date}>
                      {item.date} ({item.count})
                    </option>
                  ))}
                  {availableDates.length === 0 && (
                    <option value={formatLocalDate()}>
                      {formatLocalDate()} (0)
                    </option>
                  )}
                </select>
              </div>

              {filteredWords.length !== allWords.length && (
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer pt-1">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportScope === 'filtered'}
                    onChange={() => setExportScope('filtered')}
                    className="text-indigo-600"
                  />
                  <span>{t.modals.exportFilteredScope} (<strong>{filteredWords.length}</strong>)</span>
                </label>
              )}
            </div>

            {/* Target Words Counter */}
            <div className="text-xs text-slate-600 dark:text-slate-400">
              {t.modals.willExport} <strong className="text-indigo-600 dark:text-indigo-400">{getWordsToExport().length} {language === 'vi' ? 'từ' : 'words'}</strong>
            </div>

            {/* Download Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={handleDownloadXlsx}
                className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 p-3 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 active:scale-98 transition-all"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>{t.modals.downloadXlsxBtn}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 active:scale-98 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 transition-all"
              >
                <Download className="h-4 w-4" />
                <span>{t.modals.downloadCsvBtn}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                className="flex items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100 active:scale-98 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 transition-all"
              >
                <Download className="h-4 w-4" />
                <span>{t.modals.downloadJsonBtn}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyJson}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? t.modals.copiedText : t.modals.copyRawJson}</span>
            </button>
          </div>
        )}

        {/* TAB 3: BACKUP / RESTORE */}
        {activeTab === 'import' && (
          <div className="mt-5 space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.modals.backupRestoreDesc}
            </p>

            <div>
              <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-4 text-center cursor-pointer hover:border-indigo-400 dark:border-slate-700 dark:hover:border-indigo-500">
                <Upload className="h-6 w-6 text-slate-400" />
                <span className="mt-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t.modals.selectJsonFile}
                </span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.modals.pasteJsonLabel}
              </label>
              <textarea
                rows={4}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="[ { &quot;word&quot;: &quot;negotiate&quot;, ... } ]"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            {importResult && (
              <div
                className={`rounded-2xl p-3 text-xs ${
                  importResult.imported > 0
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                }`}
              >
                {importResult.imported > 0 ? (
                  <p>
                    {language === 'vi' ? 'Thành công! Đã nhập / cập nhật' : 'Success! Imported / updated'}{' '}
                    <strong>{importResult.imported}</strong> {language === 'vi' ? 'từ vào Deck.' : 'words into Deck.'}
                  </p>
                ) : (
                  <p>
                    {language === 'vi' ? 'Lỗi nhập file:' : 'Import error:'} {importResult.errors[0] || 'Invalid file'}
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleImportJsonText}
              disabled={!importText.trim()}
              className="w-full rounded-2xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50"
            >
              {t.modals.parseRestoreBtn}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
