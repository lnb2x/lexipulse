import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './context/LanguageContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)

// Minimal PWA offline shell support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const registerAndCache = async () => {
    try {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if ('caches' in window) {
        const cache = await caches.open('lexipulse-shell-v1');
        const assetUrls = Array.from(
          document.querySelectorAll<HTMLLinkElement | HTMLScriptElement>(
            'link[rel="stylesheet"], link[rel="modulepreload"], script[src]'
          )
        )
          .map((el) => ('href' in el ? el.href : el.src))
          .filter((url) => Boolean(url) && url.startsWith(window.location.origin));

        await Promise.all(
          assetUrls.map(async (url) => {
            try {
              const resp = await fetch(url);
              if (resp.ok) {
                await cache.put(url, resp);
              }
            } catch {
              // ignore
            }
          })
        );
      }
    } catch (err) {
      console.warn('PWA service worker registration failed:', err);
    }
  };

  if (document.readyState === 'complete') {
    registerAndCache();
  } else {
    window.addEventListener('load', registerAndCache);
  }
}

