import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

declare global {
  interface Window {
    __mizanAppMounted?: boolean;
    __mizanBootTimer?: number;
  }
}

// Clean up any stale dev Service Worker from earlier sessions so mobile/desktop never hangs
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.DEV) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      regs.forEach((reg) => {
        if (reg.active?.scriptURL.includes('dev-sw') || reg.installing?.scriptURL.includes('dev-sw')) {
          void reg.unregister();
        }
      });
    })
    .catch(() => {});
}

// Safely register production PWA SW without forcing mid-boot reload races on mobile
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  try {
    registerSW({
      immediate: true,
    });
  } catch {
    // Ignore SW registration failure on restricted mobile webviews
  }
}

// Auto-recover once if a mobile browser cached an outdated HTML shell pointing to missing chunks
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    let alreadyTried = false;
    try {
      const key = 'mizan_chunk_reload_once';
      alreadyTried = sessionStorage.getItem(key) === '1';
      if (!alreadyTried) {
        sessionStorage.setItem(key, '1');
      }
    } catch {
      // sessionStorage may be blocked in strict mobile webviews
    }

    if (!alreadyTried) {
      const clearTasks: Promise<unknown>[] = [];
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
          clearTasks.push(
            navigator.serviceWorker
              .getRegistrations()
              .then((regs) => Promise.all(regs.map((r) => r.unregister().catch(() => {}))))
              .catch(() => {})
          );
        }
        if ('caches' in window && caches.keys) {
          clearTasks.push(
            caches
              .keys()
              .then((keys) => Promise.all(keys.map((k) => caches.delete(k).catch(() => {}))))
              .catch(() => {})
          );
        }
      } catch {
        // ignore
      }
      Promise.all(clearTasks).finally(() => {
        window.location.reload();
      });
    }
  });
}

const rootEl = document.getElementById('root');
if (rootEl) {
  if (typeof window !== 'undefined') {
    window.__mizanAppMounted = true;
    if (window.__mizanBootTimer) {
      window.clearTimeout(window.__mizanBootTimer);
    }
    try {
      sessionStorage.removeItem('mizan_boot_recover_once');
      sessionStorage.removeItem('mizan_chunk_reload_once');
    } catch {
      // ignore
    }
  }

  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

