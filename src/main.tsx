import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorProvider } from './context';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingFallback } from './components/LoadingFallback';
import { logger } from './utils/logger';
import App from './App';
import './index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Failed to find root element');
}

try {
  logger.info('Initializing application', 'AppInit');

  const root = createRoot(container);

  root.render(
    <React.StrictMode>
      <ErrorProvider>
        <ErrorBoundary>
          <React.Suspense fallback={<LoadingFallback />}>
            <App />
          </React.Suspense>
        </ErrorBoundary>
      </ErrorProvider>
    </React.StrictMode>
  );

  logger.info('Application mounted successfully', 'AppInit');
} catch (error) {
  logger.error('Critical application failure', 'AppInit', error instanceof Error ? error : new Error(String(error)));
  
  if (container) {
    container.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; padding: 20px; text-align: center;">
        <div>
          <h1 style="color: #1a202c; font-size: 24px; margin-bottom: 16px;">Unable to Load Application</h1>
          <p style="color: #4a5568; margin-bottom: 16px;">We're sorry, but the application failed to load. Please try refreshing the page.</p>
          <button onclick="window.location.reload()" style="background: #3b82f6; color: white; padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer;">
            Refresh Page
          </button>
        </div>
      </div>
    `;
  }
}