import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

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

// Safely register production PWA SW with immediate refresh when a newer version deploys
try {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true);
    },
  });
} catch {
  // Ignore SW registration failure on restricted mobile webviews
}

// Auto-recover once if a mobile browser cached an outdated HTML shell pointing to missing chunks
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    const key = 'mizan_chunk_reload_once';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
