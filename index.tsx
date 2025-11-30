import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { NotificationProvider } from './contexts/NotificationContext.tsx';
import './index.css';
// import { registerSW } from 'virtual:pwa-register'; // UNCOMMENT FOR PWA DEPLOYMENT

// Polyfill process for libraries that might expect it
if (typeof window !== 'undefined' && (window as any).process === undefined) {
  (window as any).process = { env: {} };
}

// UNCOMMENT THE SECTION BELOW TO ENABLE PWA (Offline Support)
/*
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true);
    }
  },
});
*/

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </ErrorBoundary>
  </React.StrictMode>
);