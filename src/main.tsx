import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorProvider } from './context';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingFallback } from './components/LoadingFallback';
import { logger } from './utils/logger';
import { getRecalcEventName } from './utils/iframeHeight';
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

  // Get actual content height by measuring real content bounds
  const getContentHeight = (): number => {
    const root = document.getElementById('root');
    if (!root) return 0;

    // Force layout recalculation
    void root.offsetHeight;

    // Method 1: Get the bounding rect of the root's first child (the actual app container)
    const firstChild = root.firstElementChild as HTMLElement;
    if (firstChild) {
      const childRect = firstChild.getBoundingClientRect();
      const childHeight = childRect.height;

      // Also check offsetHeight which ignores transforms
      const offsetHeight = firstChild.offsetHeight;

      // Use the larger of the two for accuracy
      const actualHeight = Math.max(childHeight, offsetHeight);

      if (actualHeight > 0) {
        // Add small padding for safety
        return Math.ceil(actualHeight) + 20;
      }
    }

    // Method 2: Fallback to computing from all children
    const rootRect = root.getBoundingClientRect();
    let maxBottom = 0;

    // Check all descendant elements to find the actual content extent
    const allElements = root.querySelectorAll('*');
    for (const el of Array.from(allElements)) {
      const rect = (el as HTMLElement).getBoundingClientRect();
      // Calculate position relative to root, not viewport
      const relativeBottom = rect.bottom - rootRect.top;
      if (relativeBottom > maxBottom && rect.height > 0) {
        maxBottom = relativeBottom;
      }
    }

    if (maxBottom > 0) {
      return Math.ceil(maxBottom) + 20;
    }

    // Method 3: Last resort - use scrollHeight but cap it reasonably
    return Math.min(root.scrollHeight, 2000);
  };

  const sendHeightToParent = (force: boolean = false) => {
    // Skip throttle check if forced
    if (!force && isThrottled) return;

    const contentHeight = getContentHeight();
    if (contentHeight === 0) return;

    // Skip min change check if forced (allows shrinking)
    if (!force && Math.abs(contentHeight - lastSentHeight) < MIN_HEIGHT_CHANGE) {
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

    // Throttle to prevent rapid firing (skip if forced)
    if (!force) {
      isThrottled = true;
      setTimeout(() => {
        isThrottled = false;
      }, THROTTLE_DELAY);
    }
  };

  // Force recalculation - bypasses all checks, used for reset/completion
  const forceHeightRecalc = () => {
    // Reset state to ensure fresh measurement
    lastSentHeight = 0;
    isThrottled = false;

    // Multiple measurements with increasing delays to catch DOM updates
    [0, 50, 150, 300, 500, 800].forEach(delay => {
      setTimeout(() => sendHeightToParent(true), delay);
    });
  };

  // Listen for manual recalc events (from reset, completion, etc.)
  window.addEventListener(getRecalcEventName(), forceHeightRecalc);

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
        // Also observe the first child (main app container)
        if (root.firstElementChild) {
          observer.observe(root.firstElementChild);
        }
      }
    };

    // Start observing after DOM is ready
    if (document.readyState === 'complete') {
      startObserving();
    } else {
      window.addEventListener('load', startObserving);
    }
  }

  // Use MutationObserver to detect DOM changes (child additions/removals)
  const mutationObserver = new MutationObserver(() => {
    // Debounce mutation callbacks
    setTimeout(() => sendHeightToParent(), 100);
  });

  const startMutationObserver = () => {
    const root = document.getElementById('root');
    if (root) {
      mutationObserver.observe(root, {
        childList: true,
        subtree: true,
        attributes: false // Don't watch attribute changes (too noisy)
      });
    }
  };

  if (document.readyState === 'complete') {
    startMutationObserver();
  } else {
    window.addEventListener('load', startMutationObserver);
  }

  // Send height after initial render and after content settles
  setTimeout(sendHeightToParent, 500);
  setTimeout(sendHeightToParent, 1500);
  setTimeout(sendHeightToParent, 3000);

  // Also send on window resize
  window.addEventListener('resize', () => sendHeightToParent());

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