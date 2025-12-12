import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorProvider } from './context';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingFallback } from './components/LoadingFallback';
import { logger } from './utils/logger';
import App from './App';
import './index.css';

// ============================================
// IFRAME DYNAMIC HEIGHT COMMUNICATION
// ============================================
const initIframeHeightCommunication = () => {
  // Only run if inside an iframe
  if (window.parent === window) {
    return;
  }

  let lastSentHeight = 0;
  let isThrottled = false;
  const THROTTLE_DELAY = 250;
  const MIN_HEIGHT_CHANGE = 10;

  const sendHeightToParent = () => {
    if (isThrottled) return;

    const root = document.getElementById('root');
    if (!root) return;

    // Get the actual rendered height of content
    const contentHeight = root.scrollHeight;

    // Only send if height changed meaningfully
    if (Math.abs(contentHeight - lastSentHeight) < MIN_HEIGHT_CHANGE) {
      return;
    }

    lastSentHeight = contentHeight;

    // Send height to parent window
    window.parent.postMessage(
      {
        type: 'pinger-resize',
        height: contentHeight,
        source: 'onwardseo-pinger'
      },
      '*'
    );

    // Throttle to prevent rapid firing
    isThrottled = true;
    setTimeout(() => {
      isThrottled = false;
    }, THROTTLE_DELAY);
  };

  // Use ResizeObserver - only on root element
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      sendHeightToParent();
    });

    // Wait for root to be available, then observe
    const startObserving = () => {
      const root = document.getElementById('root');
      if (root) {
        observer.observe(root);
      }
    };

    // Start observing after DOM is ready
    if (document.readyState === 'complete') {
      startObserving();
    } else {
      window.addEventListener('load', startObserving);
    }
  }

  // Send height after initial render and after content settles
  setTimeout(sendHeightToParent, 500);
  setTimeout(sendHeightToParent, 1500);
  setTimeout(sendHeightToParent, 3000);

  // Also send on window resize
  window.addEventListener('resize', sendHeightToParent);

  logger.info('Iframe height communication initialized', { component: 'IframeResize' });
};

// Initialize iframe communication after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIframeHeightCommunication);
} else {
  initIframeHeightCommunication();
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Failed to find root element');
}

try {
  logger.info('Initializing application', { component: 'AppInit' });

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

  logger.info('Application mounted successfully', { component: 'AppInit' });
} catch (error) {
  logger.error('Critical application failure', { 
    component: 'AppInit',
    error: error instanceof Error ? error : new Error(String(error))
  });
  
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