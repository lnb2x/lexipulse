import { useSyncExternalStore } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { applyPwaUpdate, getWaitingUpdate, subscribeToUpdates } from '../../services/pwaUpdates';

export function PwaUpdateNotice({ busy }: { busy: boolean }) {
  const waiting = useSyncExternalStore(subscribeToUpdates, getWaitingUpdate, () => null);
  const { t } = useLanguage();
  if (!waiting) return null;
  return <aside className="pwa-update-notice study-panel px-4 py-3 text-sm">
    <p role="status">{busy ? t.pwa.busy : t.pwa.ready}</p>
    <button type="button" disabled={busy} onClick={applyPwaUpdate}
      className="btn-primary mt-2">
      {t.pwa.apply}
    </button>
  </aside>;
}
