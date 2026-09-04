import { Eye, EyeOff, Globe, Key, RotateCcw, Settings, Volume2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { getAppSettings, resetDatabaseToDefault, saveAppSettings } from '../../services/db';
import type { AppSettings } from '../../types/vocab';

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
  const [settings, setSettings] = useState<AppSettings>({
    geminiApiKey: '',
    speechRate: 0.95,
    speechPitch: 1.0,
    preferredAccent: 'US',
    dailyQuota: 10,
    theme: 'dark',
  });
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getAppSettings().then(setSettings);
      setIsSaved(false);
      setConfirmReset(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await saveAppSettings(settings);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.modals.settingsTitle}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure AI enrichment, speech, language & quotas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-4">
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
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400'
                }`}
              >
                <span>🇻🇳</span>
                <span>Tiếng Việt (Vietnamese)</span>
              </button>

              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2 px-3 text-xs font-semibold transition-all ${
                  language === 'en'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400'
                }`}
              >
                <span>🇬🇧</span>
                <span>English (Tiếng Anh)</span>
              </button>
            </div>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-indigo-500" />
                {t.modals.geminiKeyLabel}
              </span>
              <span className="text-[11px] font-normal text-slate-400">Stored locally in browser</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="AIzaSy..."
                value={settings.geminiApiKey}
                onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Pronunciation & Daily Review Target */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.modals.accentLabel}
              </label>
              <select
                value={settings.preferredAccent}
                onChange={(e) => setSettings({ ...settings, preferredAccent: e.target.value as 'US' | 'UK' })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-100"
              >
                <option value="US">American (US) 🇺🇸</option>
                <option value="UK">British (UK) 🇬🇧</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.modals.dailyQuotaLabel}
              </label>
              <select
                value={settings.dailyQuota}
                onChange={(e) => setSettings({ ...settings, dailyQuota: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-100"
              >
                <option value={5}>5 {language === 'vi' ? 'từ / ngày' : 'words / day'}</option>
                <option value={10}>10 {language === 'vi' ? 'từ / ngày (Chuẩn)' : 'words / day (Standard)'}</option>
                <option value={15}>15 {language === 'vi' ? 'từ / ngày (Nâng cao)' : 'words / day (Intensive)'}</option>
                <option value={25}>25 {language === 'vi' ? 'từ / ngày (Chuyên sâu)' : 'words / day (Mastery)'}</option>
              </select>
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
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 active:scale-98"
          >
            {isSaved ? 'Saved!' : t.modals.saveSettingsBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
