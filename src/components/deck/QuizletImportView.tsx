import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Layers,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
  ShieldCheck,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import type {
  QuizletCardItem,
  QuizletReconciledWord,
  QuizletSetRecord,
  QuizletSetRef,
  ReviewMode,
  WordItem,
} from '../../types/vocab';
import {
  fetchQuizletSet,
  parseQuizletExportText,
  parseQuizletUrl,
  type FetchQuizletErrorType,
} from '../../services/quizlet/quizletParser';
import { reconcileQuizletWithDeck } from '../../services/quizlet/quizletReconciler';
import {
  deleteQuizletSet,
  getAllQuizletSets,
  getWordsByQuizletSet,
  linkWordsToQuizletSet,
  resolveNeedsReviewWord,
  saveNewQuizletWords,
  saveQuizletSetMetadata,
} from '../../services/quizlet/quizletRepository';
import { isAiAvailable } from '../../services/ai';
import {
  migrateAndNormalizeExistingDeck,
  inspectTodayWordsScope,
  migrateTodayWords,
  type MigrationProgress,
  type MigrationResult,
  type ScopeInspectionResult,
  type TodayMigrationResult,
} from '../../services/quizlet/quizletMigration';

interface QuizletImportViewProps {
  allWords: WordItem[];
  onImportSuccess?: (message: string) => void;
  onStartReviewSession?: (mode: ReviewMode, cards: WordItem[], sessionType?: 'due' | 'cram') => void;
  onCloseModal?: () => void;
}

export const QuizletImportView: React.FC<QuizletImportViewProps> = ({
  allWords,
  onImportSuccess,
  onStartReviewSession,
  onCloseModal,
}) => {
  const { language, t } = useLanguage();

  // URL state
  const [urlInput, setUrlInput] = useState('');
  const [parsedUrlInfo, setParsedUrlInfo] = useState(() => parseQuizletUrl(''));
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [fetchErrorMessage, setFetchErrorMessage] = useState<string | null>(null);
  const [fetchErrorDiagnostics, setFetchErrorDiagnostics] = useState<string | null>(null);
  const [fetchErrorType, setFetchErrorType] = useState<FetchQuizletErrorType | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showManualFallbackGuidance, setShowManualFallbackGuidance] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Paste / cards state
  const [exportText, setExportText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [swapTermDef, setSwapTermDef] = useState(false);
  const [parsedCards, setParsedCards] = useState<QuizletCardItem[]>([]);
  const [reconciledItems, setReconciledItems] = useState<QuizletReconciledWord[]>([]);
  const [reconciledSummary, setReconciledSummary] = useState({
    newCount: 0,
    existingCount: 0,
    needsReviewCount: 0,
    totalUnique: 0,
    duplicatesInBatch: 0,
  });

  // Processing state
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number; word: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Review scope state (for review actions)
  const [reviewScopeModal, setReviewScopeModal] = useState<{
    isOpen: boolean;
    type: 'existing' | 'all';
    targetWords: WordItem[];
  } | null>(null);

  // Saved sets list
  const [savedSets, setSavedSets] = useState<QuizletSetRecord[]>([]);
  const [showSavedSets, setShowSavedSets] = useState(true);

  // Migration & normalization state for existing deck words
  const [showMigrationPanel, setShowMigrationPanel] = useState(false);
  const [migrationScope, setMigrationScope] = useState<'today' | 'all'>('today');
  const [todayScopeInfo, setTodayScopeInfo] = useState<ScopeInspectionResult | null>(null);
  const [isLoadingScope, setIsLoadingScope] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationUpgradeAi, setMigrationUpgradeAi] = useState(true);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [todayMigrationResult, setTodayMigrationResult] = useState<TodayMigrationResult | null>(null);
  const migrationAbortRef = useRef<AbortController | null>(null);

  // Load saved Quizlet sets on mount
  const refreshSavedSets = async () => {
    const sets = await getAllQuizletSets();
    setSavedSets(sets);
  };

  // Inspect scope for today's words
  const refreshScopeInfo = async () => {
    setIsLoadingScope(true);
    try {
      const scope = await inspectTodayWordsScope();
      setTodayScopeInfo(scope);
    } catch (err) {
      console.error('Failed to inspect scope:', err);
    } finally {
      setIsLoadingScope(false);
    }
  };

  const handleStartMigration = async () => {
    if (isMigrating) return;
    const controller = new AbortController();
    migrationAbortRef.current = controller;
    setIsMigrating(true);
    setMigrationResult(null);
    setTodayMigrationResult(null);
    setMigrationProgress(null);

    try {
      if (migrationScope === 'today') {
        const res = await migrateTodayWords({
          targetDate: todayScopeInfo?.date,
          upgradeToAi: migrationUpgradeAi,
          signal: controller.signal,
          onProgress: (p) => {
            setMigrationProgress(p);
          },
        });
        setTodayMigrationResult(res);
        await refreshScopeInfo();
        setStatusMessage(
          language === 'vi'
            ? `Chuẩn hóa từ hôm nay (${res.date}) hoàn tất: ${res.normalizedCount} chuẩn hóa, ${res.aiUpgradedCount} chuyển AI, ${res.keptIntactCount} giữ nguyên.`
            : `Today migration (${res.date}) complete: ${res.normalizedCount} normalized, ${res.aiUpgradedCount} upgraded to AI, ${res.keptIntactCount} intact.`
        );
      } else {
        const res = await migrateAndNormalizeExistingDeck({
          deckWords: allWords,
          upgradeToAi: migrationUpgradeAi,
          signal: controller.signal,
          onProgress: (p) => {
            setMigrationProgress(p);
          },
        });
        setMigrationResult(res);
        await refreshScopeInfo();
        setStatusMessage(
          language === 'vi'
            ? `Chuẩn hóa hoàn tất: ${res.normalizedCount} từ được chuẩn hóa, ${res.aiUpgradedCount} từ chuyển sang AI, ${res.skippedCount} từ đã chuẩn sẵn.`
            : `Migration complete: ${res.normalizedCount} normalized, ${res.aiUpgradedCount} upgraded to AI, ${res.skippedCount} skipped.`
        );
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setStatusMessage(
          language === 'vi'
            ? `Lỗi trong quá trình chuẩn hóa: ${err?.message || err}`
            : `Error during migration: ${err?.message || err}`
        );
      }
    } finally {
      setIsMigrating(false);
      migrationAbortRef.current = null;
    }
  };

  const handleStopMigration = () => {
    if (migrationAbortRef.current) {
      migrationAbortRef.current.abort();
      migrationAbortRef.current = null;
      setIsMigrating(false);
      setStatusMessage(
        language === 'vi'
          ? 'Đã tạm dừng tiến trình chuẩn hóa. Dữ liệu đã xử lý được lưu an toàn.'
          : 'Migration paused. Processed data safely preserved.'
      );
    }
  };

  useEffect(() => {
    refreshSavedSets();
    refreshScopeInfo();
    isAiAvailable().then((avail) => setMigrationUpgradeAi(avail));
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Real-time URL validation and parsing
  const handleUrlChange = (value: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUrlInput(value);
    const info = parseQuizletUrl(value);
    setParsedUrlInfo(info);

    // Reset status when user edits the URL
    setFetchStatus('idle');
    setFetchErrorMessage(null);
    setFetchErrorDiagnostics(null);
    setFetchErrorType(null);
    setShowDiagnostics(false);
    setShowManualFallbackGuidance(false);
  };

  // Direct fetch attempt from Quizlet via Backend
  const handleFetchFromUrl = async () => {
    const targetUrl = urlInput.trim();
    if (!targetUrl) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Strict state transitions:
    // 1. Enter loading state
    // 2. Clear old error banners, diagnostics, and status messages IMMEDIATELY
    setFetchStatus('loading');
    setFetchErrorMessage(null);
    setFetchErrorDiagnostics(null);
    setFetchErrorType(null);
    setShowDiagnostics(false);
    setShowManualFallbackGuidance(false);
    setStatusMessage(null);

    try {
      const res = await fetchQuizletSet(targetUrl, {
        signal: controller.signal,
        timeoutMs: 35000,
      });

      // If aborted or superseded, do not update UI
      if (controller.signal.aborted) {
        return;
      }

      if (res.success && res.terms && res.terms.length > 0) {
        setFetchStatus('success');
        setParsedCards(res.terms);
        if (res.title) {
          setParsedUrlInfo((prev) => ({ ...prev, title: res.title || prev.title }));
        }
        // Run reconciliation
        const reconciled = reconcileQuizletWithDeck(res.terms, allWords);
        setReconciledItems(reconciled.items);
        setReconciledSummary(reconciled.summary);
        setStatusMessage(
          language === 'vi'
            ? `Tải thành công ${res.terms.length} thẻ từ Quizlet ("${res.title || 'Bộ thẻ'}")!`
            : `Successfully fetched ${res.terms.length} cards from Quizlet ("${res.title || 'Set'}")!`
        );
      } else {
        setFetchStatus('error');
        setFetchErrorMessage(res.message || 'Không thể tải bộ từ từ Quizlet.');
        setFetchErrorDiagnostics(res.diagnostics || null);
        setFetchErrorType(res.errorType || 'server_error');
        if (res.errorType === 'quizlet_login_required' || res.errorType === 'challenge_blocked') {
          setShowManualFallbackGuidance(true);
        }
      }
    } catch (err: any) {
      if (controller.signal.aborted) return;
      setFetchStatus('error');
      setFetchErrorMessage(err.message || 'Lỗi không xác định khi tải bộ từ.');
      setFetchErrorDiagnostics(err.stack || String(err));
      setFetchErrorType('server_error');
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setFetchStatus((curr) => (curr === 'loading' ? 'idle' : curr));
    }
  };

  // Parse pasted export text
  const handleParseExportText = (overrideSwap?: boolean) => {
    const shouldSwap = overrideSwap !== undefined ? overrideSwap : swapTermDef;
    if (!exportText.trim()) return;

    const parsed = parseQuizletExportText(exportText, { swapTermDef: shouldSwap });
    if (parsed.cards.length === 0) {
      setPasteError(
        language === 'vi'
          ? 'Không tìm thấy thẻ từ vựng nào trong văn bản dán. Vui lòng kiểm tra lại định dạng (mỗi thẻ một dòng từ[TAB]nghĩa).'
          : 'No cards found in pasted content. Please check format (term[TAB]definition per line).'
      );
      return;
    }

    setParsedCards(parsed.cards);
    setPasteError(null);

    const reconciled = reconcileQuizletWithDeck(parsed.cards, allWords);
    setReconciledItems(reconciled.items);
    setReconciledSummary(reconciled.summary);
    setStatusMessage(
      language === 'vi'
        ? `Đã phân tích ${reconciled.summary.totalUnique} thẻ từ vựng (${reconciled.summary.duplicatesInBatch} trùng lặp trong nguồn).`
        : `Parsed ${reconciled.summary.totalUnique} cards (${reconciled.summary.duplicatesInBatch} duplicate entries skipped).`
    );
  };

  // Toggle Swap Term and Definition
  const handleToggleSwap = () => {
    const nextSwap = !swapTermDef;
    setSwapTermDef(nextSwap);
    if (exportText.trim()) {
      handleParseExportText(nextSwap);
    }
  };

  // Selection toggles
  const handleToggleItem = (index: number) => {
    setReconciledItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSelectAllNew = () => {
    setReconciledItems((prev) =>
      prev.map((item) => ({
        ...item,
        selected: item.status === 'new',
      }))
    );
  };

  const handleSelectAllExisting = () => {
    setReconciledItems((prev) =>
      prev.map((item) => ({
        ...item,
        selected: item.status === 'existing' || item.status === 'needs_review',
      }))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setReconciledItems((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  // Resolve needs_review item choice
  const handleResolveChoice = (index: number, choice: 'keep_existing' | 'use_quizlet' | 'merge') => {
    setReconciledItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, resolutionChoice: choice } : item))
    );
  };

  // Helper to construct set reference
  const currentSetRef: QuizletSetRef = useMemo(() => {
    const id = parsedUrlInfo.setId || `set-${Date.now()}`;
    const title = parsedUrlInfo.title || (parsedCards[0]?.term ? `Quizlet: ${parsedCards[0].term}...` : `Quizlet Set #${id}`);
    const url = parsedUrlInfo.cleanUrl || (urlInput.trim() || `https://quizlet.com/${id}`);
    return {
      id,
      title,
      url,
      importedAt: Date.now(),
    };
  }, [parsedUrlInfo, urlInput, parsedCards]);

  // ACTION 1: Thêm từ chưa có
  const handleAddNewWords = async () => {
    const selectedNewItems = reconciledItems.filter((i) => i.selected && i.status === 'new');
    if (selectedNewItems.length === 0) {
      setStatusMessage(
        language === 'vi'
          ? 'Chưa có từ mới nào được chọn để thêm vào bộ từ.'
          : 'No new words selected to add to deck.'
      );
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setSaveProgress({ current: 0, total: selectedNewItems.length, word: '' });

    try {
      // 1. Save new words
      const { savedCount } = await saveNewQuizletWords({
        items: selectedNewItems,
        setRef: currentSetRef,
        autoEnrich,
        onProgress: (p) => setSaveProgress(p),
      });

      // 2. Also save needs_review items that user resolved
      const needsReviewSelected = reconciledItems.filter((i) => i.selected && i.status === 'needs_review');
      for (const nr of needsReviewSelected) {
        if (nr.resolutionChoice) {
          await resolveNeedsReviewWord(nr, nr.resolutionChoice, currentSetRef);
        }
      }

      // 3. Save Quizlet set record
      await saveQuizletSetMetadata({
        id: currentSetRef.id,
        title: currentSetRef.title,
        url: currentSetRef.url,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        wordCount: savedCount,
        cardTerms: reconciledItems.map((i) => i.normalizedTerm),
      });

      await refreshSavedSets();

      const successMsg =
        language === 'vi'
          ? `Đã lưu thành công ${savedCount} từ mới từ bộ Quizlet "${currentSetRef.title}"!`
          : `Successfully saved ${savedCount} new words from Quizlet set "${currentSetRef.title}"!`;

      setStatusMessage(successMsg);
      onImportSuccess?.(successMsg);

      // Re-reconcile to reflect new DB state
      const reReconciled = reconcileQuizletWithDeck(parsedCards, [...allWords]);
      setReconciledItems(reReconciled.items);
      setReconciledSummary(reReconciled.summary);
    } catch (err: any) {
      console.error('Failed to save Quizlet words:', err);
      setStatusMessage(`Lỗi: ${err.message || 'Không thể lưu từ vựng'}`);
    } finally {
      setIsSaving(false);
      setSaveProgress(null);
    }
  };

  // Helper to get all existing words matching this set
  const getExistingWordsForSet = async (): Promise<WordItem[]> => {
    // Check in DB by setId
    const fromDb = await getWordsByQuizletSet(currentSetRef.id);
    const existingTerms = new Set(
      reconciledItems
        .filter((i) => i.status === 'existing' || i.status === 'needs_review')
        .map((i) => i.normalizedTerm)
    );

    const fromAllWords = allWords.filter((w) => existingTerms.has(w.word.toLowerCase()));
    const mergedMap = new Map<string, WordItem>();
    for (const w of [...fromDb, ...fromAllWords]) {
      mergedMap.set(w.id, w);
    }
    return Array.from(mergedMap.values());
  };

  // ACTION 2: Ôn từ đã có
  const handleReviewExistingWords = async () => {
    const existingWords = await getExistingWordsForSet();

    if (existingWords.length === 0) {
      setStatusMessage(
        language === 'vi'
          ? 'Không tìm thấy từ nào trong bộ Quizlet này đã có trong bộ từ của bạn.'
          : 'No existing words from this Quizlet set found in your deck.'
      );
      return;
    }

    // Link setRef to existing words idempotently
    await linkWordsToQuizletSet(existingWords, currentSetRef);
    await saveQuizletSetMetadata({
      id: currentSetRef.id,
      title: currentSetRef.title,
      url: currentSetRef.url,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      wordCount: existingWords.length,
    });
    await refreshSavedSets();

    // Open review scope modal
    setReviewScopeModal({
      isOpen: true,
      type: 'existing',
      targetWords: existingWords,
    });
  };

  // ACTION 3: Thêm và ôn cả bộ
  const handleAddAndReviewAll = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      // 1. Save selected new words first
      const selectedNewItems = reconciledItems.filter((i) => i.selected && i.status === 'new');
      if (selectedNewItems.length > 0) {
        await saveNewQuizletWords({
          items: selectedNewItems,
          setRef: currentSetRef,
          autoEnrich,
        });
      }

      // 2. Resolve needs_review items
      const needsReviewSelected = reconciledItems.filter((i) => i.selected && i.status === 'needs_review');
      for (const nr of needsReviewSelected) {
        if (nr.resolutionChoice) {
          await resolveNeedsReviewWord(nr, nr.resolutionChoice, currentSetRef);
        }
      }

      // 3. Link all matching existing words
      const existingWords = await getExistingWordsForSet();
      if (existingWords.length > 0) {
        await linkWordsToQuizletSet(existingWords, currentSetRef);
      }

      // 4. Save metadata
      const allCardsForSet = await getWordsByQuizletSet(currentSetRef.id);
      await saveQuizletSetMetadata({
        id: currentSetRef.id,
        title: currentSetRef.title,
        url: currentSetRef.url,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        wordCount: allCardsForSet.length,
        cardTerms: reconciledItems.map((i) => i.normalizedTerm),
      });
      await refreshSavedSets();

      // Open review scope modal for entire set
      setReviewScopeModal({
        isOpen: true,
        type: 'all',
        targetWords: allCardsForSet,
      });
    } catch (err: any) {
      console.error('Failed to add and review all:', err);
      setStatusMessage(`Lỗi: ${err.message || 'Không thể chuẩn bị bộ từ'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Launch review session with chosen scope
  const handleExecuteReview = (scope: 'due' | 'all') => {
    if (!reviewScopeModal || !onStartReviewSession) return;
    const { targetWords } = reviewScopeModal;

    const now = Date.now();
    const dueWords = targetWords.filter((w) => w.reviewMeta.dueDate <= now);

    if (scope === 'due') {
      if (dueWords.length === 0) {
        // Will be handled in modal UI empty state
        return;
      }
      onCloseModal?.();
      onStartReviewSession('flashcards', dueWords, 'due');
    } else {
      // Review all cards in cram practice mode
      onCloseModal?.();
      onStartReviewSession('flashcards', targetWords, 'cram');
    }
  };

  // Review a saved set directly from the saved list
  const handleReviewSavedSet = async (set: QuizletSetRecord, scope: 'due' | 'all') => {
    const words = await getWordsByQuizletSet(set.id);
    if (words.length === 0) {
      setStatusMessage(
        language === 'vi'
          ? `Không tìm thấy từ vựng nào trong bộ "${set.title}".`
          : `No words found for set "${set.title}".`
      );
      return;
    }

    const now = Date.now();
    const dueWords = words.filter((w) => w.reviewMeta.dueDate <= now);

    if (scope === 'due') {
      if (dueWords.length === 0) {
        setStatusMessage(
          language === 'vi'
            ? `Bộ "${set.title}" hiện không có từ nào đến hạn ôn tập!`
            : `No cards currently due for set "${set.title}".`
        );
        return;
      }
      onCloseModal?.();
      onStartReviewSession?.('flashcards', dueWords, 'due');
    } else {
      onCloseModal?.();
      onStartReviewSession?.('flashcards', words, 'cram');
    }
  };

  // Delete saved set
  const handleDeleteSavedSet = async (setId: string) => {
    const confirmMsg =
      language === 'vi'
        ? 'Bạn có chắc chắn muốn xóa bộ này khỏi danh sách? (Các từ vựng trong Deck sẽ được giữ nguyên)'
        : 'Are you sure you want to remove this set from the list? (Words in your deck will be preserved)';
    if (!window.confirm(confirmMsg)) return;

    await deleteQuizletSet(setId);
    await refreshSavedSets();
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: URL Input & Direct Fetch */}
      <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-indigo-500" />
            <span>{t.modals.quizletUrlLabel}</span>
          </label>
          {parsedUrlInfo.setId && (
            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100/70 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
              ID: {parsedUrlInfo.setId}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder={t.modals.quizletUrlPlaceholder}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="button"
            onClick={handleFetchFromUrl}
            disabled={!urlInput.trim() || !parsedUrlInfo.isValid || fetchStatus === 'loading'}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {fetchStatus === 'loading' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t.modals.quizletFetching}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>{t.modals.quizletFetchBtn}</span>
              </>
            )}
          </button>
        </div>

        {/* Clean URL & Slug info */}
        {parsedUrlInfo.cleanUrl && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Link chuẩn:</span>
            <code className="rounded bg-slate-200/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {parsedUrlInfo.cleanUrl}
            </code>
            {parsedUrlInfo.title && (
              <span className="font-medium text-indigo-600 dark:text-indigo-400">
                ({parsedUrlInfo.title})
              </span>
            )}
          </div>
        )}

        {/* Fetch Error State Banner - ONLY displayed when fetchStatus === 'error' */}
        {fetchStatus === 'error' && fetchErrorMessage && (
          <div className="mt-3 rounded-xl border border-rose-200/90 bg-rose-50/80 p-4 dark:border-rose-900/60 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 text-xs space-y-2.5 animate-fade-in">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-rose-900 dark:text-rose-100">{fetchErrorMessage}</p>
                    {fetchErrorType && (
                      <span className="rounded bg-rose-200/80 dark:bg-rose-900/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-rose-800 dark:text-rose-200">
                        {fetchErrorType === 'backend_offline'
                          ? 'Máy chủ offline'
                          : fetchErrorType === 'quizlet_login_required'
                          ? 'Yêu cầu đăng nhập'
                          : fetchErrorType === 'rate_limited'
                          ? 'Giới hạn 429'
                          : fetchErrorType === 'challenge_blocked'
                          ? 'Thử thách bảo mật'
                          : fetchErrorType === 'endpoint_not_found'
                          ? 'Endpoint 404'
                          : fetchErrorType === 'timeout'
                          ? 'Timeout'
                          : 'Lỗi tải'}
                      </span>
                    )}
                  </div>
                  {fetchErrorDiagnostics && (
                    <button
                      type="button"
                      onClick={() => setShowDiagnostics((v) => !v)}
                      className="text-[11px] font-semibold text-rose-700 underline hover:text-rose-800 dark:text-rose-300 inline-block"
                    >
                      {showDiagnostics ? 'Ẩn chi tiết kỹ thuật' : 'Xem chi tiết chẩn đoán'}
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleFetchFromUrl}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-500 transition-colors shadow-sm shrink-0"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Thử lại</span>
              </button>
            </div>

            {showDiagnostics && fetchErrorDiagnostics && (
              <div className="rounded-lg bg-black/5 dark:bg-black/40 p-2.5 font-mono text-[11px] text-rose-800 dark:text-rose-300 whitespace-pre-wrap break-all border border-rose-200/40 dark:border-rose-900/40">
                {fetchErrorDiagnostics}
              </div>
            )}

            {showManualFallbackGuidance && (
              <div className="mt-2 pt-2 border-t border-rose-200/60 dark:border-rose-900/60 text-slate-700 dark:text-slate-300 space-y-1.5">
                <p className="font-semibold text-xs text-rose-950 dark:text-rose-200">
                  Phương án thay thế: Xuất nội dung từ Quizlet và dán vào ô bên dưới:
                </p>
                <div className="pl-4 space-y-1 text-[11px]">
                  <p>
                    1. Mở bộ từ:{' '}
                    {parsedUrlInfo.cleanUrl ? (
                      <a
                        href={parsedUrlInfo.cleanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 underline hover:text-indigo-700 dark:text-indigo-400 font-medium"
                      >
                        <span>{parsedUrlInfo.title || 'Mở trên Quizlet'}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span>trên Quizlet</span>
                    )}
                  </p>
                  <p>{t.modals.quizletStep2}</p>
                  <p>{t.modals.quizletStep3}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 2: Paste Content Textarea & Swap Options */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {t.modals.quizletPasteLabel}
          </label>
          <button
            type="button"
            onClick={handleToggleSwap}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all ${
              swapTermDef
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300'
            }`}
            title={t.modals.quizletSwapHint}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>{t.modals.quizletSwapBtn}</span>
            {swapTermDef && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
          </button>
        </div>

        <textarea
          rows={4}
          value={exportText}
          onChange={(e) => setExportText(e.target.value)}
          placeholder={t.modals.quizletPastePlaceholder}
          className="w-full rounded-2xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-100"
        />

        {pasteError && (
          <div className="rounded-xl border border-rose-200/90 bg-rose-50/80 p-3 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{pasteError}</span>
          </div>
        )}

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => handleParseExportText()}
            disabled={!exportText.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t.modals.quizletParseBtn}</span>
          </button>
        </div>
      </div>

      {/* SECTION 3: Reconciliation Table & Metrics */}
      {reconciledItems.length > 0 && (
        <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800 animate-fade-in">
          {/* Summary counters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/60 dark:text-indigo-300">
                {t.modals.quizletStatusNew}: {reconciledSummary.newCount}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300">
                {t.modals.quizletStatusExisting}: {reconciledSummary.existingCount}
              </span>
              {reconciledSummary.needsReviewCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300">
                  {t.modals.quizletStatusNeedsReview}: {reconciledSummary.needsReviewCount}
                </span>
              )}
              <span className="text-xs text-slate-500 dark:text-slate-400">
                (Tổng: {reconciledSummary.totalUnique} từ
                {reconciledSummary.duplicatesInBatch > 0 && `, ${reconciledSummary.duplicatesInBatch} trùng lặp đã lọc`}
                )
              </span>
            </div>

            {/* Quick selection buttons */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={handleSelectAllNew}
                className="rounded-lg bg-indigo-50 px-2 py-1 font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 transition-colors"
              >
                {t.modals.quizletSelectAllNew}
              </button>
              <button
                type="button"
                onClick={handleSelectAllExisting}
                className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors"
              >
                {t.modals.quizletSelectAllExisting}
              </button>
              <button
                type="button"
                onClick={() => handleSelectAll(true)}
                className="rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 transition-colors"
              >
                {t.modals.quizletSelectAll}
              </button>
              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                className="rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 transition-colors"
              >
                {t.modals.quizletDeselectAll}
              </button>
            </div>
          </div>

          {/* Cards Table */}
          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50 shadow-inner">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider dark:bg-slate-800 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <CheckSquare className="h-3.5 w-3.5 mx-auto text-slate-400" />
                  </th>
                  <th className="p-3 w-1/3">Từ vựng (Term)</th>
                  <th className="p-3">Định nghĩa (Definition)</th>
                  <th className="p-3 w-28 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {reconciledItems.map((item, idx) => (
                  <tr
                    key={`${item.normalizedTerm}-${idx}`}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                      item.selected ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                    }`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => handleToggleItem(idx)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">
                      {item.term}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">
                      <div>{item.definition || <span className="italic text-slate-400">Không có định nghĩa</span>}</div>

                      {/* Conflict resolution choice if needs_review */}
                      {item.status === 'needs_review' && item.existingDefinition && (
                        <div className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/70 p-2.5 text-[11px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 space-y-1.5">
                          <div className="flex flex-col sm:flex-row gap-1 sm:gap-3">
                            <div>
                              <span className="font-semibold text-slate-500 dark:text-slate-400">Trong Deck: </span>
                              <span className="font-medium">{item.existingDefinition}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-amber-600 dark:text-amber-400">Quizlet: </span>
                              <span className="font-medium">{item.definition}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleResolveChoice(idx, 'keep_existing')}
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold border transition-all ${
                                item.resolutionChoice === 'keep_existing'
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {t.modals.quizletResolutionKeep}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveChoice(idx, 'use_quizlet')}
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold border transition-all ${
                                item.resolutionChoice === 'use_quizlet'
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {t.modals.quizletResolutionQuizlet}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveChoice(idx, 'merge')}
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold border transition-all ${
                                item.resolutionChoice === 'merge'
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {t.modals.quizletResolutionMerge}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {item.status === 'new' && (
                        <span className="inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                          {t.modals.quizletStatusNew}
                        </span>
                      )}
                      {item.status === 'existing' && (
                        <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                          {t.modals.quizletStatusExisting}
                        </span>
                      )}
                      {item.status === 'needs_review' && (
                        <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
                          {t.modals.quizletStatusNeedsReview}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SECTION 4: The 3 Main Actions */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-enrich-quizlet"
                checked={autoEnrich}
                onChange={(e) => setAutoEnrich(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
              />
              <label
                htmlFor="auto-enrich-quizlet"
                className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {t.modals.autoEnrichLabel}
              </label>
            </div>

            {/* Progress indicator */}
            {saveProgress && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 space-y-1 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span>
                    {t.modals.processingWord} <strong className="font-semibold">{saveProgress.word}</strong>
                  </span>
                  <span>
                    {saveProgress.current} / {saveProgress.total}
                  </span>
                </div>
                <div className="w-full bg-indigo-200/60 rounded-full h-1.5 dark:bg-indigo-900">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.round((saveProgress.current / Math.max(1, saveProgress.total)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Status message */}
            {statusMessage && (
              <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/70 p-3 text-xs font-semibold text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200 animate-fade-in">
                {statusMessage}
              </div>
            )}

            {/* 3 Main Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleAddNewWords}
                disabled={isSaving || reconciledSummary.newCount === 0}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>{t.modals.quizletActionAddNew}</span>
              </button>

              <button
                type="button"
                onClick={handleReviewExistingWords}
                disabled={isSaving || (reconciledSummary.existingCount === 0 && reconciledSummary.needsReviewCount === 0)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 transition-all"
              >
                <Play className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t.modals.quizletActionReviewExisting}</span>
              </button>

              <button
                type="button"
                onClick={handleAddAndReviewAll}
                disabled={isSaving || reconciledItems.length === 0}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-400 transition-all"
              >
                <Layers className="h-4 w-4" />
                <span>{t.modals.quizletActionAddAndReviewAll}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: Saved Sets List */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <button
          type="button"
          onClick={() => setShowSavedSets((prev) => !prev)}
          className="flex items-center justify-between w-full text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-600 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>{t.modals.quizletSavedSetsTitle} ({savedSets.length})</span>
          </div>
          {showSavedSets ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>

        {showSavedSets && (
          <div className="space-y-2">
            {savedSets.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">{t.modals.quizletNoSavedSets}</p>
            ) : (
              savedSets.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">{s.title}</span>
                      <span className="rounded bg-slate-200/70 px-1.5 py-0.2 font-mono text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        #{s.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      {s.wordCount !== undefined && <span>{s.wordCount} từ trong Deck</span>}
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          <span>Quizlet</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleReviewSavedSet(s, 'due')}
                      className="rounded-lg bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 transition-colors"
                      title="Chỉ ôn các từ đến hạn FSRS"
                    >
                      {t.modals.quizletReviewScopeDue}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewSavedSet(s, 'all')}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 transition-colors"
                      title="Ôn toàn bộ từ (Cram practice)"
                    >
                      {t.modals.quizletReviewScopeAll}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedSet(s.id)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
                      title={t.modals.quizletDeleteSetBtn}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* SECTION 6: Normalization & AI Migration Tool */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <button
          type="button"
          onClick={() => {
            setShowMigrationPanel((prev) => {
              const next = !prev;
              if (next) refreshScopeInfo();
              return next;
            });
          }}
          className="flex items-center justify-between w-full text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-600 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Wand2 className="h-4 w-4 text-indigo-500" />
            <span>
              {language === 'vi'
                ? 'Công cụ Chuẩn hóa & Nâng cấp AI cho từ đã lưu'
                : 'Normalize & Upgrade Deck to AI'}
            </span>
          </div>
          {showMigrationPanel ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {showMigrationPanel && (
          <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20 space-y-3.5 text-xs">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-white">
                  {language === 'vi'
                    ? 'Chuẩn hóa định dạng từ & Chuyển sang bản dịch AI'
                    : 'Normalize Word Formatting & Upgrade to AI'}
                </h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  {language === 'vi'
                    ? 'Tách từ loại trong ngoặc như (v), (n) thành trường riêng; tách phiên âm IPA trong nghĩa; xóa bỏ placeholder; và bổ sung bản dịch AI theo schema chuẩn. Bảo toàn 100% ID, liên kết bộ từ, lịch sử học và tiến độ FSRS.'
                    : 'Separates part of speech tags like (v) from words, extracts IPA from definitions, removes placeholders, and converts dictionary/quizlet definitions to AI. Preserves 100% of IDs, deck links, and FSRS progress.'}
                </p>
              </div>
            </div>

            {/* Scope selection */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMigrationScope('today')}
                className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  migrationScope === 'today'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400'
                }`}
              >
                <Calendar className="h-4 w-4 text-indigo-500" />
                <span>
                  {language === 'vi'
                    ? `Chỉ từ thêm hôm nay (${todayScopeInfo?.date || 'Đang tính'})`
                    : `Today only (${todayScopeInfo?.date || 'Calculating'})`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMigrationScope('all')}
                className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  migrationScope === 'all'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400'
                }`}
              >
                <Layers className="h-4 w-4 text-slate-500" />
                <span>
                  {language === 'vi'
                    ? `Toàn bộ kho từ (${allWords.length} từ)`
                    : `All Deck (${allWords.length} words)`}
                </span>
              </button>
            </div>

            {/* Scope inspection banner */}
            {migrationScope === 'today' && (
              <div className="rounded-xl border border-indigo-200 bg-white/80 p-3 dark:border-indigo-900/40 dark:bg-slate-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                    <Calendar className="h-4 w-4 text-indigo-500" />
                    <span>
                      {language === 'vi'
                        ? `Phạm vi: Ngày ${todayScopeInfo?.date || '...'} (Múi giờ địa phương)`
                        : `Scope: Date ${todayScopeInfo?.date || '...'} (Local Timezone)`}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                    {isLoadingScope && <Loader2 className="h-3 w-3 animate-spin text-indigo-600 dark:text-indigo-400" />}
                    <span>{todayScopeInfo?.todayWords.length ?? 0} từ trong phạm vi</span>
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {language === 'vi'
                    ? 'Hệ thống chỉ lọc theo ngày thêm ban đầu (createdAt) theo múi giờ thiết bị; tuyệt đối không dùng ngày cập nhật hay ôn tập; không sửa từ thuộc ngày khác.'
                    : 'Filters strictly by initial createdAt in local timezone; never relies on updated or review timestamps; touches no other days.'}
                </div>

                {todayScopeInfo?.unreliableDateWords && todayScopeInfo.unreliableDateWords.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>
                        {language === 'vi'
                          ? `Có ${todayScopeInfo.unreliableDateWords.length} bản ghi thiếu ngày thêm đáng tin cậy (được tách riêng, không xử lý & không suy đoán):`
                          : `${todayScopeInfo.unreliableDateWords.length} words with unreliable/missing createdAt (isolated, not touched):`}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-amber-800 dark:text-amber-300">
                      {todayScopeInfo.unreliableDateWords.map((w) => `${w.word} (${w.id})`).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={migrationUpgradeAi}
                  onChange={(e) => setMigrationUpgradeAi(e.target.checked)}
                  disabled={isMigrating}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                  {language === 'vi'
                    ? 'Nâng cấp lên bản dịch AI (sử dụng Gemini AI)'
                    : 'Upgrade to AI translation (using configured Gemini AI)'}
                </span>
              </label>

              <div className="flex items-center gap-2">
                {isMigrating ? (
                  <button
                    type="button"
                    onClick={handleStopMigration}
                    className="flex items-center gap-1 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 transition-all"
                  >
                    <span>{language === 'vi' ? 'Dừng lại' : 'Stop'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartMigration}
                    disabled={
                      migrationScope === 'today'
                        ? (todayScopeInfo?.todayWords.length ?? 0) === 0
                        : allWords.length === 0
                    }
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>
                      {migrationScope === 'today'
                        ? language === 'vi'
                          ? `Chuẩn hóa từ thêm hôm nay (${todayScopeInfo?.todayWords.length ?? 0})`
                          : `Normalize Today Words (${todayScopeInfo?.todayWords.length ?? 0})`
                        : language === 'vi'
                          ? 'Bắt đầu chuẩn hóa toàn bộ'
                          : 'Start Full Normalization'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Migration progress */}
            {isMigrating && migrationProgress && (
              <div className="space-y-2 rounded-xl border border-indigo-200 bg-white/80 p-3 dark:border-indigo-900/60 dark:bg-slate-900/60 animate-fade-in">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                    Đang xử lý: <code className="font-mono text-indigo-600 dark:text-indigo-300">{migrationProgress.currentWord}</code>
                  </span>
                  <span>
                    {migrationProgress.processed} / {migrationProgress.total} (
                    {Math.round((migrationProgress.processed / (migrationProgress.total || 1)) * 100)}%)
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-200"
                    style={{
                      width: `${Math.round(
                        (migrationProgress.processed / (migrationProgress.total || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-center pt-1">
                  <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <div className="font-bold">{migrationProgress.normalizedCount}</div>
                    <div>Đã chuẩn hóa</div>
                  </div>
                  <div className="rounded-lg bg-indigo-50 p-1.5 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                    <div className="font-bold">{migrationProgress.aiUpgradedCount}</div>
                    <div>Đã chuyển AI</div>
                  </div>
                  <div className="rounded-lg bg-slate-100 p-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <div className="font-bold">{migrationProgress.skippedCount}</div>
                    <div>Đã chuẩn sẵn</div>
                  </div>
                  <div className="rounded-lg bg-rose-50 p-1.5 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                    <div className="font-bold">{migrationProgress.failedCount}</div>
                    <div>Lỗi</div>
                  </div>
                </div>
              </div>
            )}

            {/* Today Migration Result */}
            {todayMigrationResult && !isMigrating && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {language === 'vi'
                        ? `Chuẩn hóa thành công ngày ${todayMigrationResult.date}!`
                        : `Migration succeeded for ${todayMigrationResult.date}!`}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300">
                    Backup: {todayMigrationResult.backupKey}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-center">
                  <div className="rounded-lg bg-white/70 dark:bg-slate-900/50 p-1.5">
                    <span className="font-bold">{todayMigrationResult.normalizedCount}</span> chuẩn hóa
                  </div>
                  <div className="rounded-lg bg-white/70 dark:bg-slate-900/50 p-1.5">
                    <span className="font-bold">{todayMigrationResult.aiUpgradedCount}</span> chuyển sang AI
                  </div>
                  <div className="rounded-lg bg-white/70 dark:bg-slate-900/50 p-1.5">
                    <span className="font-bold">{todayMigrationResult.keptIntactCount}</span> giữ nguyên
                  </div>
                  <div className="rounded-lg bg-white/70 dark:bg-slate-900/50 p-1.5">
                    <span className="font-bold">{todayMigrationResult.failedCount}</span> lỗi / {todayMigrationResult.conflictCount} trùng
                  </div>
                </div>

                {todayMigrationResult.conflictCount > 0 && (
                  <div className="rounded-lg bg-amber-100/70 p-2 text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    ⚠️ Phát hiện {todayMigrationResult.conflictCount} từ trùng lặp sau chuẩn hóa. Đã gắn tag <code className="font-mono font-bold">#can-xem-xet-trung</code> và bảo toàn dữ liệu gốc, không tự gộp hay xóa.
                  </div>
                )}

                {todayMigrationResult.examplesBeforeAfter.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40">
                    <div className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                      Ví dụ trước / sau chuẩn hóa:
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {todayMigrationResult.examplesBeforeAfter.slice(0, 10).map((ex) => (
                        <div
                          key={ex.id}
                          className="rounded-lg border border-slate-200 bg-white/90 p-2.5 text-[11px] space-y-1 dark:border-slate-800 dark:bg-slate-900/60"
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="text-slate-900 dark:text-white">
                              <span className="text-rose-600 line-through dark:text-rose-400 mr-1.5">{ex.wordBefore}</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{ex.wordAfter}</span>
                            </span>
                            {ex.aiUpgraded && (
                              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                AI Enriched
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 text-[10px]">
                            <span>Từ loại: </span>
                            <span className="font-mono text-slate-700 dark:text-slate-300">{ex.posAfter.join(', ') || 'none'}</span>
                            {ex.ipaAfter && (
                              <span className="ml-2 font-mono text-indigo-600 dark:text-indigo-300">{ex.ipaAfter}</span>
                            )}
                          </div>
                          <div className="text-slate-600 dark:text-slate-300 line-clamp-2">
                            <span className="font-medium">Nghĩa: </span>
                            {ex.defAfter}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Full Deck Migration completion result */}
            {migrationResult && !isMigrating && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200 space-y-2 animate-fade-in">
                <div className="flex items-center gap-1.5 font-bold">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {language === 'vi' ? 'Chuẩn hóa toàn bộ hoàn tất!' : 'Full Migration Complete!'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-center">
                  <div className="rounded-lg bg-white/70 dark:bg-slate-900/50 p-1.5">
                    <span className="font-bold">{migrationResult.normalizedCount}</span> từ chuẩn hóa
                  </div>
                  <div className="rounded-lg bg-white/70 dark:bg-slate-900/50 p-1.5">
                    <span className="font-bold">{migrationResult.aiUpgradedCount}</span> chuyển sang AI
                  </div>
                  <div className="rounded-lg bg-white/70 dark:bg-slate-900/50 p-1.5">
                    <span className="font-bold">{migrationResult.skippedCount}</span> đã chuẩn sẵn
                  </div>
                  <div className="rounded-lg bg-white/70 dark:bg-slate-900/50 p-1.5">
                    <span className="font-bold">{migrationResult.failedCount}</span> lỗi
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Review Scope Choice Modal */}
      {reviewScopeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#121824] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {language === 'vi' ? 'Chọn chế độ ôn tập bộ Quizlet' : 'Choose Review Mode'}
              </h3>
            </div>

            {(() => {
              const now = Date.now();
              const dueCount = reviewScopeModal.targetWords.filter((w) => w.reviewMeta.dueDate <= now).length;
              const totalCount = reviewScopeModal.targetWords.length;

              return (
                <div className="space-y-4 text-xs">
                  <p className="text-slate-600 dark:text-slate-300">
                    Bộ từ có <strong className="font-bold text-slate-900 dark:text-white">{totalCount}</strong> từ
                    (trong đó có <strong className="font-bold text-indigo-600 dark:text-indigo-400">{dueCount}</strong> từ đến hạn ôn tập FSRS).
                  </p>

                  {dueCount === 0 ? (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/30 space-y-2">
                      <p className="font-bold text-indigo-900 dark:text-indigo-200">
                        {t.modals.quizletEmptyDueTitle}
                      </p>
                      <p className="text-indigo-800/90 dark:text-indigo-300/90 leading-relaxed">
                        {t.modals.quizletEmptyDueDesc}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={dueCount === 0}
                      onClick={() => handleExecuteReview('due')}
                      className="w-full flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/80 p-3.5 font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-indigo-900/60 dark:bg-indigo-950/60 dark:text-indigo-200 transition-all text-left"
                    >
                      <div>
                        <div className="font-bold">{t.modals.quizletReviewScopeDue} ({dueCount} thẻ)</div>
                        <div className="text-[11px] font-normal text-indigo-700 dark:text-indigo-300">
                          {language === 'vi' ? 'Chế độ SRS chính thức, cập nhật lịch giãn cách FSRS' : 'Official SRS mode, updates FSRS intervals'}
                        </div>
                      </div>
                      <Play className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExecuteReview('all')}
                      className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white transition-all text-left"
                    >
                      <div>
                        <div className="font-bold">{t.modals.quizletReviewScopeAll} ({totalCount} thẻ)</div>
                        <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          {language === 'vi' ? 'Chế độ luyện tập thêm (Cram), bảo toàn lịch FSRS hiện có' : 'Extra practice mode (Cram), preserves official FSRS schedule'}
                        </div>
                      </div>
                      <Play className="h-4 w-4 text-slate-500 shrink-0" />
                    </button>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setReviewScopeModal(null)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                    >
                      {language === 'vi' ? 'Quay lại' : 'Back'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
