import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Stub chrome APIs when running as PWA (not in extension context)
if (typeof chrome === 'undefined' || !chrome.storage) {
  (window as unknown as Record<string, unknown>).chrome = {
    storage: {
      local: {
        get: (_keys: unknown, cb: (r: Record<string, unknown>) => void) => cb({}),
        set: (_data: unknown, cb?: () => void) => cb?.(),
        remove: (_key: unknown, cb?: () => void) => cb?.(),
      },
    },
    runtime: {
      sendMessage: () => {},
      lastError: null,
      onMessage: { addListener: () => {} },
    },
    tabs: {
      query: (_opts: unknown, cb: (tabs: unknown[]) => void) => cb([]),
      sendMessage: () => {},
    },
    identity: {
      getRedirectURL: () => window.location.origin + '/auth/callback',
    },
  };
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
