import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Languages,
  Loader2,
  RefreshCw,
  Sparkles,
  StopCircle,
  X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useModalA11y } from '../../hooks/useModalA11y';
import type { WordItem } from '../../types/vocab';
import {
  auditDeckTranslations,
  backfillMissingTranslations,
  exportBackupAsJson,
  type DeckTranslationAuditSummary,
  type BackfillProgress,
  type BackfillResult,
} from '../../services/missingTranslationEnricher';

interface TranslationAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  allWords: WordItem[];
  onEnrichmentComplete: () => void;
}

export const TranslationAuditModal: React.FC<TranslationAuditModalProps> = ({
  isOpen,
  onClose,
  allWords,
  onEnrichmentComplete,
}) => {
  const { language } = useLanguage();
  const modalRef = useModalA11y({ isOpen, onClose });

  const [auditSummary, setAuditSummary] = useState<DeckTranslationAuditSummary | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BackfillProgress | null>(null);
  const [lastResult, setLastResult] = useState<BackfillResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Run audit when modal opens
  useEffect(() => {
    if (isOpen) {
      runAudit();
    } else {
      setLastResult(null);
      setProgress(null);
      setStatusMessage(null);
    }
  }, [isOpen]);

  const runAudit = async () => {
    setIsAuditing(true);
    setStatusMessage(null);
    try {
      const summary = await auditDeckTranslations(allWords);
      setAuditSummary(summary);
    } catch (err: any) {
      setStatusMessage(err?.message || 'Lỗi khi quét từ vựng');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleDownloadBackup = () => {
    if (!auditSummary || auditSummary.affectedWords.length === 0) return;
    const wordsToBackup = auditSummary.affectedWords.map((item) => item.word);
    const jsonStr = exportBackupAsJson(wordsToBackup);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lexipulse_translation_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleStartBackfill = async () => {
    if (!auditSummary || auditSummary.affectedWords.length === 0) return;

    setIsProcessing(true);
    setLastResult(null);
    setStatusMessage(null);
    abortControllerRef.current = new AbortController();

    try {
      const wordsToFix = auditSummary.affectedWords.map((a) => a.word);
      const res = await backfillMissingTranslations({
        words: wordsToFix,
        concurrency: 2,
        maxRetries: 2,
        signal: abortControllerRef.current.signal,
        onProgress: (p) => {
          setProgress(p);
        },
      });

      setLastResult(res);
      onEnrichmentComplete();
      // Re-run audit to display updated numbers
      await runAudit();
    } catch (err: any) {
      setStatusMessage(err?.message || 'Quá trình bổ sung bản dịch bị gián đoạn');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleCancelBackfill = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatusMessage(language === 'vi' ? 'Đã gửi yêu cầu dừng...' : 'Stopping...');
    }
  };

  if (!isOpen) return null;

  const affectedCount = auditSummary?.wordsWithIssuesCount ?? 0;
  const totalCount = auditSummary?.totalWords ?? allWords.length;
  const percentAffected = totalCount > 0 ? Math.round((affectedCount / totalCount) * 100) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#121824] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <Languages className="h-5 w-5" />
            </div>
            <div>
              <h2 id="audit-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {language === 'vi' ? 'Kiểm tra & Bổ sung Bản dịch Còn thiếu' : 'Translation Audit & Backfill'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'vi'
                  ? 'Quét và bổ sung chính xác từng nghĩa, loại từ và ngữ cảnh cho dữ liệu đã lưu'
                  : 'Scan and accurately backfill missing definitions, meanings, and word families'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Status Message */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Audit Loading Indicator */}
          {isAuditing && !auditSummary && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
              <p className="text-sm font-medium">{language === 'vi' ? 'Đang quét toàn bộ từ vựng...' : 'Auditing vocabulary deck...'}</p>
            </div>
          )}

          {/* Audit Summary Dashboard */}
          {auditSummary && (
            <>
              {/* Top Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {language === 'vi' ? 'Tổng số từ' : 'Total Words'}
                  </span>
                  <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {totalCount}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    {language === 'vi' ? 'Cần bổ sung' : 'Needs Backfill'}
                  </span>
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                    {affectedCount} <span className="text-xs font-normal">({percentAffected}%)</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {language === 'vi' ? 'Nghĩa con thiếu' : 'Missing Senses'}
                  </span>
                  <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {auditSummary.missingMeaningCount}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {language === 'vi' ? 'Họ từ thiếu' : 'Missing WordFamily'}
                  </span>
                  <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {auditSummary.missingWordFamilyCount}
                  </div>
                </div>
              </div>

              {/* Progress Indicator when Processing */}
              {isProcessing && progress && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                      {language === 'vi' ? 'Đang bổ sung:' : 'Processing:'}{' '}
                      <span className="font-bold underline">{progress.currentWord}</span>
                    </span>
                    <span>
                      {progress.current} / {progress.total} (
                      {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full rounded-full bg-indigo-200/80 dark:bg-indigo-900/50 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-200"
                      style={{
                        width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-indigo-700 dark:text-indigo-300">
                    <span>
                      {language === 'vi' ? 'Thành công:' : 'Succeeded:'} {progress.succeeded} |{' '}
                      {language === 'vi' ? 'Thất bại:' : 'Failed:'} {progress.failed}
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelBackfill}
                      className="flex items-center gap-1 font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      <StopCircle className="h-3.5 w-3.5" />
                      {language === 'vi' ? 'Dừng lại' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}

              {/* Last Result Summary */}
              {lastResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs ${
                    lastResult.failed === 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/60 dark:text-emerald-300'
                      : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {language === 'vi'
                        ? `Hoàn thành đợt bổ sung: ${lastResult.succeeded} từ cập nhật thành công`
                        : `Backfill finished: ${lastResult.succeeded} words updated successfully`}
                      {lastResult.cancelled ? (language === 'vi' ? ' (Đã dừng sớm)' : ' (Stopped early)') : ''}
                    </span>
                  </div>
                  {lastResult.failed > 0 && (
                    <p className="mt-1">
                      {language === 'vi'
                        ? `Có ${lastResult.failed} từ không thể dịch do lỗi API hoặc không có kết nối. Dữ liệu cũ đã được giữ nguyên an toàn.`
                        : `${lastResult.failed} words could not be translated. Original data preserved.`}
                    </p>
                  )}
                </div>
              )}

              {/* Sample list of affected words */}
              {affectedCount > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {language === 'vi' ? 'Danh sách từ cần bổ sung' : 'Words Needing Backfill'} (
                      {auditSummary.affectedWords.length})
                    </h3>
                    <button
                      type="button"
                      onClick={handleDownloadBackup}
                      className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {language === 'vi' ? 'Tải file sao lưu JSON' : 'Export Backup JSON'}
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-900/30 divide-y divide-slate-200/60 dark:divide-slate-800/60">
                    {auditSummary.affectedWords.slice(0, 30).map(({ word, audit }) => (
                      <div key={word.id} className="py-2 px-1 text-xs flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">{word.word}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              ({word.pos?.join(', ') || 'noun'})
                            </span>
                          </div>
                          {audit.sampleIssues[0] && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 line-clamp-1">
                              {audit.sampleIssues[0]}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {audit.missingFields.map((f) => (
                            <span
                              key={f}
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {auditSummary.affectedWords.length > 30 && (
                      <div className="py-2 text-center text-xs text-slate-500">
                        {language === 'vi'
                          ? `...và còn ${auditSummary.affectedWords.length - 30} từ khác`
                          : `...and ${auditSummary.affectedWords.length - 30} more`}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {affectedCount === 0 && !isAuditing && (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-center text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-10 w-10" />
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'vi'
                      ? 'Tuyệt vời! Toàn bộ từ vựng đã có bản dịch tiếng Việt đầy đủ.'
                      : 'Great! All words in your deck have complete Vietnamese translations.'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                    {language === 'vi'
                      ? 'Không phát hiện mục nào bị trống, placeholder hoặc thiếu nghĩa con.'
                      : 'No placeholders, empty fields, or missing sub-senses found.'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 shrink-0">
          <button
            type="button"
            onClick={runAudit}
            disabled={isProcessing || isAuditing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
            <span>{language === 'vi' ? 'Quét lại' : 'Re-scan'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {language === 'vi' ? 'Đóng' : 'Close'}
            </button>

            {affectedCount > 0 && (
              <button
                type="button"
                onClick={handleStartBackfill}
                disabled={isProcessing || isAuditing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all disabled:opacity-50 active:scale-95"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{language === 'vi' ? 'Đang bổ sung...' : 'Backfilling...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>
                      {language === 'vi'
                        ? `Bổ sung ${affectedCount} từ còn thiếu`
                        : `Backfill ${affectedCount} Words`}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
