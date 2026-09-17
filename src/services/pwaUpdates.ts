let waiting: ServiceWorker | null = null;
let registration: ServiceWorkerRegistration | undefined;
const listeners = new Set<() => void>();
const publish = () => {
  waiting = registration?.waiting ?? null;
  listeners.forEach(listener => listener());
};
export const getWaitingUpdate = () => waiting;
export const subscribeToUpdates = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export async function registerPwa(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    publish();
    const watchInstalling = () => registration?.installing?.addEventListener('statechange', publish);
    watchInstalling();
    registration.addEventListener('updatefound', watchInstalling);
    navigator.serviceWorker.addEventListener('controllerchange', publish);
    const check = () => { void registration?.update().then(publish).catch(() => {}); };
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    check();
  } catch { /* Local data remains usable if worker installation is unavailable. */ }
}

export function applyPwaUpdate(): void {
  if (!waiting) return;
  // Only the tab whose user accepted the update reloads.
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
}
