import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  RotateCcw,
  Settings,
  Sparkles,
  Volume2,
  Wifi,
  X,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { AI_PROVIDERS, testAIConnection } from '../../services/ai';
import { getAppSettings, resetDatabaseToDefault, saveAppSettings } from '../../services/db';
import type { AIProvider, AppSettings } from '../../types/vocab';
import { useModalA11y } from '../../hooks/useModalA11y';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated?: () => void;
  onResetDeck?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
  onResetDeck,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const modalRef = useModalA11y({ isOpen, onClose });
  const [settings, setSettings] = useState<AppSettings>({
    aiProvider: 'gemini',
    aiApiKey: '',
    aiBaseUrl: '',
    aiModel: 'gemini-2.5-flash',
    geminiApiKey: '',
    speechRate: 0.95,
    speechPitch: 1.0,
    preferredAccent: 'US',
    dailyQuota: 10,
    theme: 'dark',
  });
  const [showKey, setShowKey] = useState(false);
  const [showBaseUrl, setShowBaseUrl] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message?: string;
  }>({ status: 'idle' });

  useEffect(() => {
    if (isOpen) {
      getAppSettings().then((s) => {
        setSettings(s);
        const providerConfig = AI_PROVIDERS[s.aiProvider || 'gemini'];
        if (s.aiModel && !providerConfig?.models.includes(s.aiModel)) {
          setIsCustomModel(true);
        } else {
          setIsCustomModel(false);
        }
      });
      setIsSaved(false);
      setConfirmReset(false);
      setTestStatus({ status: 'idle' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentProvider = settings.aiProvider || 'gemini';
  const currentProviderConfig = AI_PROVIDERS[currentProvider] || AI_PROVIDERS.gemini;

  const handleProviderChange = (newProvider: AIProvider) => {
    const config = AI_PROVIDERS[newProvider] || AI_PROVIDERS.gemini;
    setSettings((prev) => ({
      ...prev,
      aiProvider: newProvider,
      aiModel: config.defaultModel,
      aiBaseUrl: config.defaultBaseUrl,
    }));
    setIsCustomModel(false);
    setTestStatus({ status: 'idle' });
  };

  const handleTestConnection = async () => {
    setTestStatus({ status: 'testing' });
    const result = await testAIConnection({
      provider: settings.aiProvider,
      apiKey: settings.aiApiKey || settings.geminiApiKey,
      baseUrl: settings.aiBaseUrl,
      model: settings.aiModel,
    });
    setTestStatus({
      status: result.success ? 'success' : 'error',
      message: result.message,
    });
  };

  const handleSave = async () => {
    const toSave: AppSettings = {
      ...settings,
      geminiApiKey: settings.aiApiKey || settings.geminiApiKey,
    };
    await saveAppSettings(toSave);
    setIsSaved(true);
    if (onSettingsUpdated) onSettingsUpdated();
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const handleReset = async () => {
    await resetDatabaseToDefault();
    setConfirmReset(false);
    if (onSettingsUpdated) onSettingsUpdated();
    if (onResetDeck) onResetDeck();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111622] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6 pb-4 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="settings-dialog-title" className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {t.modals.settingsTitle}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure AI, language, speech & quotas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={language === 'vi' ? 'Đóng cài đặt' : 'Close settings'}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-5">
          {/* Language Selection */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Globe className="h-3.5 w-3.5 text-indigo-500" />
              {t.modals.languageLabel}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLanguage('vi')}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2 px-3 text-xs font-semibold transition-all ${
                  language === 'vi'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 shadow-sm dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300'
                    : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400'
                }`}
              >
                <span>🇻🇳</span>
                <span>Tiếng Việt</span>
              </button>

              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2 px-3 text-xs font-semibold transition-all ${
                  language === 'en'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 shadow-sm dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300'
                    : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400'
                }`}
              >
                <span>🇬🇧</span>
                <span>English</span>
              </button>
            </div>
          </div>

          {/* AI Engine Multi-Provider Configuration */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3.5 dark:border-indigo-900/30 dark:bg-indigo-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      {t.modals.aiSectionTitle}
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-2 py-0.5 text-[9px] font-semibold text-indigo-700 dark:border-indigo-800/80 dark:bg-indigo-950/60 dark:text-indigo-300">
                      <Wifi className="h-2.5 w-2.5" />
                      {language === 'vi' ? 'Cần Internet' : 'Requires Internet'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {t.modals.storedLocallyNote}
                  </p>
                </div>
              </div>

              {currentProviderConfig?.docUrl && (
                <a
                  href={currentProviderConfig.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  <span>{t.modals.getKeyLink}</span>
                </a>
              )}
            </div>

            {/* Provider Description */}
            <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-900/60 rounded-xl p-2.5 border border-indigo-100/60 dark:border-indigo-900/40">
              {currentProviderConfig.description}
            </p>

            {/* Provider & Model Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {t.modals.aiProviderLabel}
                </label>
                <select
                  value={settings.aiProvider || 'gemini'}
                  onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 shadow-sm"
                >
                  {Object.values(AI_PROVIDERS).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {t.modals.aiModelLabel}
                </label>
                {isCustomModel ? (
                  <div className="flex gap-1.5 min-w-0">
                    <input
                      type="text"
                      placeholder={t.modals.customModelPlaceholder}
                      value={settings.aiModel || ''}
                      onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
                      className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomModel(false);
                        setSettings({
                          ...settings,
                          aiModel: currentProviderConfig.defaultModel,
                        });
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shrink-0"
                    >
                      {language === 'vi' ? 'Danh sách' : 'Presets'}
                    </button>
                  </div>
                ) : (
                  <select
                    value={settings.aiModel || currentProviderConfig.defaultModel}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomModel(true);
                      } else {
                        setSettings({ ...settings, aiModel: e.target.value });
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 shadow-sm"
                  >
                    {currentProviderConfig.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value="__custom__">+ Tùy chỉnh model khác...</option>
                  </select>
                )}
              </div>
            </div>

            {/* Base URL (for Custom or toggled) */}
            {(settings.aiProvider === 'custom' || showBaseUrl) && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {t.modals.aiBaseUrlLabel}
                </label>
                <input
                  type="text"
                  placeholder={currentProviderConfig.defaultBaseUrl || t.modals.customBaseUrlPlaceholder}
                  value={settings.aiBaseUrl || ''}
                  onChange={(e) => setSettings({ ...settings, aiBaseUrl: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 shadow-sm"
                />
              </div>
            )}

            {/* API Key Input */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {t.modals.aiKeyLabel}
                </label>
                {settings.aiProvider !== 'custom' && (
                  <button
                    type="button"
                    onClick={() => setShowBaseUrl(!showBaseUrl)}
                    className="text-[10px] font-medium text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    {showBaseUrl ? 'Ẩn Endpoint URL' : 'Tùy chỉnh Endpoint URL'}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder={currentProviderConfig.placeholder}
                  value={settings.aiApiKey || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      aiApiKey: e.target.value,
                      geminiApiKey: settings.aiProvider === 'gemini' ? e.target.value : settings.geminiApiKey,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-10 text-xs font-mono text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* API Key Storage Policy & Security Notice */}
              <div className="pt-2 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={!!settings.persistApiKey}
                    onChange={(e) => setSettings({ ...settings, persistApiKey: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-semibold">
                      {language === 'vi' ? 'Lưu API Key vĩnh viễn trên thiết bị này' : 'Persist API Key permanently on this device'}
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {language === 'vi'
                        ? 'Mặc định: Key chỉ lưu trong phiên làm việc (Session Storage). Bật tùy chọn này để lưu vào IndexedDB máy của bạn.'
                        : 'Default: Key is kept in session storage only. Enabling this stores it persistently in local IndexedDB.'}
                    </p>
                  </div>
                </label>

                {/* Security Warning Box */}
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-[11px] text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{language === 'vi' ? 'Cảnh báo an toàn bảo mật API Key' : 'API Key Security Notice'}</span>
                  </p>
                  <p className="mt-1 text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                    {language === 'vi'
                      ? 'API Key trong ứng dụng web (Client-side Frontend) có thể bị đọc bởi mã JavaScript hoặc nếu trang gặp tấn công XSS. Không có giải pháp mã hóa phía client nào đảm bảo an toàn tuyệt đối trước môi trường trình duyệt. Khuyến nghị chỉ dùng API key có đặt giới hạn chi tiêu (quota cap) hoặc chạy trên máy cá nhân tin cậy.'
                      : 'API keys stored in client-side web applications are accessible to JavaScript/XSS scripts. Client-side encryption cannot fully secure secrets in the browser. We recommend using keys with strict usage quotas on trusted personal devices.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Test Connection Button & Status */}
            <div className="pt-1 space-y-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus.status === 'testing'}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50/80 dark:border-indigo-800/80 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40 transition-colors disabled:opacity-50"
              >
                {testStatus.status === 'testing' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                    <span>{t.modals.testingConnection}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{t.modals.testConnectionBtn}</span>
                  </>
                )}
              </button>

              {testStatus.status === 'success' && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 animate-slide-up">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{testStatus.message}</span>
                </div>
              )}

              {testStatus.status === 'error' && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 animate-slide-up">
                  <XCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{testStatus.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Pronunciation & Daily Review Target */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.modals.accentLabel}
              </label>
              <select
                value={settings.preferredAccent}
                onChange={(e) => setSettings({ ...settings, preferredAccent: e.target.value as 'US' | 'UK' })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-100 shadow-sm"
              >
                <option value="US">American English (US)</option>
                <option value="UK">British English (UK)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t.modals.dailyQuotaLabel}
                </label>
                <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {settings.dailyQuota || 10} {language === 'vi' ? 'từ/ngày' : 'cards/day'}
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={settings.dailyQuota || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setSettings({
                      ...settings,
                      dailyQuota: isNaN(val) ? 0 : Math.max(1, Math.min(val, 500)),
                    });
                  }}
                  onBlur={() => {
                    if (!settings.dailyQuota || settings.dailyQuota < 1) {
                      setSettings({ ...settings, dailyQuota: 10 });
                    }
                  }}
                  placeholder="10"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-100 pr-20 shadow-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium pointer-events-none">
                  {language === 'vi' ? 'từ / ngày' : 'cards / day'}
                </span>
              </div>
              {/* Quick preset suggestion chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {[5, 10, 15, 20, 30, 50].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSettings({ ...settings, dailyQuota: val })}
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all ${
                      settings.dailyQuota === val
                        ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Speech Rate */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 text-indigo-500" />
                {t.modals.speechRateLabel}
              </span>
              <span className="text-indigo-600 dark:text-indigo-400">{settings.speechRate}x</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.3"
              step="0.05"
              value={settings.speechRate}
              onChange={(e) => setSettings({ ...settings, speechRate: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0.7x ({language === 'vi' ? 'Chậm' : 'Slower'})</span>
              <span>0.95x ({language === 'vi' ? 'Tự nhiên' : 'Natural'})</span>
              <span>1.3x ({language === 'vi' ? 'Nhanh' : 'Faster'})</span>
            </div>
          </div>

          {/* Reset Deck to Seed Words */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 dark:border-rose-900/40 dark:bg-rose-950/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                  {language === 'vi' ? 'Đặt lại bộ từ mặc định' : 'Reset Vocabulary Deck'}
                </p>
                <p className="text-[11px] text-rose-600 dark:text-rose-400">
                  {language === 'vi' ? 'Khôi phục 12 từ TOEIC cốt lõi ban đầu' : 'Restore default 12 high-yield TOEIC cards'}
                </p>
              </div>
              {confirmReset ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 shadow-sm hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 p-4 sm:p-5 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-[0.99] transition-all"
          >
            {isSaved ? 'Saved!' : t.modals.saveSettingsBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
