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
  let lastHeight = 0;
  const DEBOUNCE_DELAY = 100;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const sendHeightToParent = () => {
    // Clear any pending debounce
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      const root = document.getElementById('root');
      if (!root) return;

      // Calculate the actual content height
      const height = Math.max(
        root.scrollHeight,
        root.offsetHeight,
        document.body.scrollHeight,
        document.body.offsetHeight
      );

      // Add small padding to prevent scrollbar flicker
      const finalHeight = height + 20;

      // Only send if height changed significantly (more than 5px)
      if (Math.abs(finalHeight - lastHeight) > 5) {
        lastHeight = finalHeight;

        // Send height to parent window
        if (window.parent !== window) {
          window.parent.postMessage(
            {
              type: 'pinger-resize',
              height: finalHeight,
              source: 'onwardseo-pinger'
            },
            '*'
          );
        }
      }
    }, DEBOUNCE_DELAY);
  };

  // Use ResizeObserver for efficient size tracking
  if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(() => {
      sendHeightToParent();
    });

    // Observe the root element
    const root = document.getElementById('root');
    if (root) {
      resizeObserver.observe(root);
    }

    // Also observe body for any changes
    resizeObserver.observe(document.body);
  }

  // Use MutationObserver for DOM changes
  const mutationObserver = new MutationObserver(() => {
    sendHeightToParent();
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });

  // Send initial height after a short delay to ensure content is rendered
  setTimeout(sendHeightToParent, 100);
  setTimeout(sendHeightToParent, 500);
  setTimeout(sendHeightToParent, 1000);

  // Also send on window resize
  window.addEventListener('resize', sendHeightToParent);

  // Send on scroll (in case content loads lazily)
  window.addEventListener('scroll', sendHeightToParent, { passive: true });

  logger.info('Iframe height communication initialized', { component: 'IframeResize' });
};

// Initialize iframe communication
initIframeHeightCommunication();

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