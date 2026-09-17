import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerPwa } from './services/pwaUpdates'
import { LanguageProvider } from './context/LanguageContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)

// Registration succeeds only after the complete build precache can be installed.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const register = () => { void registerPwa(); };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
