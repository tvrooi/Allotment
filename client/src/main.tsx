import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
// Self-hosted so the app never contacts Google Fonts (privacy, and a stricter CSP)
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import 'react-grid-layout/css/styles.css';
import './index.css';
import { initTheme } from './utils/applyTheme';
import { restoreOfflineCopy, startOfflineCopy } from './offline/snapshot';
import { loadOutbox } from './offline/outbox';
import { IS_DEMO, startDemoApi } from './demo/demoApi';

initTheme();
// The macOS desktop app has no title bar: `mac-window:` styles add the drag strips. Its
// local budget says so through the preload; a server window, which has none, through its
// user agent (MAC_WINDOW_AGENT in electron/macWindow.ts)
if (window.__PLATFORM__ === 'darwin' || navigator.userAgent.includes(' FlyBudgetMacWindow/1'))
  document.documentElement.classList.add('mac-window');

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  }),
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const render = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );

if (IS_DEMO) {
  // The demo's data lives in a worker on this page: no offline copy or waiting transactions
  startDemoApi();
  render();
} else {
  // Load this device's offline copy and waiting transactions first, so the app opens with
  // data even when the server can't be reached (both give up quickly if storage is slow)
  const withinMs = (p: Promise<unknown>, ms: number) =>
    Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
  void Promise.all([restoreOfflineCopy(queryClient), withinMs(loadOutbox(), 1_500)])
    .catch(() => {}) // Start without them rather than not at all
    .then(() => {
      startOfflineCopy(queryClient);
      render();
    });
}

// Self-hosted servers: keep the app itself on the device too (public/sw.js), so it can open
// while the server is down. Not in dev (Vite serves the page) or the desktop app.
if (
  import.meta.env.PROD &&
  import.meta.env.MODE !== 'electron' &&
  !IS_DEMO &&
  !window.__API_BASE__ &&
  'serviceWorker' in navigator
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
