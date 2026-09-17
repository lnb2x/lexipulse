import { useSyncExternalStore } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { applyPwaUpdate, getWaitingUpdate, subscribeToUpdates } from '../../services/pwaUpdates';

export function PwaUpdateNotice({ busy }: { busy: boolean }) {
  const waiting = useSyncExternalStore(subscribeToUpdates, getWaitingUpdate, () => null);
  const { t } = useLanguage();
  if (!waiting) return null;
  return <aside className="border-b border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100">
    <p role="status">{busy ? t.pwa.busy : t.pwa.ready}</p>
    <button type="button" disabled={busy} onClick={applyPwaUpdate}
      className="mt-2 rounded bg-indigo-700 px-3 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-300 disabled:opacity-60">
      {t.pwa.apply}
    </button>
  </aside>;
}
