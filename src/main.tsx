import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorProvider } from './context';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingFallback } from './components/LoadingFallback';
import { logger } from './utils/logger';
import { getRecalcEventName } from './utils/iframeHeight';
import App from './App';
import './index.css';

// =============================================
// IFRAME DYNAMIC HEIGHT COMMUNICATION
// NASA-Level Precision Height Measurement
// =============================================

const CONFIG = {
  THROTTLE_DELAY: 250,
  MIN_HEIGHT_CHANGE: 5,
  MIN_HEIGHT: 400,
  MAX_HEIGHT: 5000,
  DEBOUNCE_DELAY: 100,
} as const;

const initIframeHeightCommunication = () => {
  // Only run if inside an iframe
  if (window.parent === window) {
    return;
  }

  let lastSentHeight = 0;
  let lastContentSignature = '';
  let isThrottled = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Generate a signature of actual content to detect real changes
  const getContentSignature = (root: HTMLElement): string => {
    const contentElements = root.querySelectorAll(
      'h1, h2, h3, h4, p, span, label, button, input, textarea, a, li, td, th'
    );
    let signature = '';
    for (const el of Array.from(contentElements).slice(0, 50)) {
      const text = (el as HTMLElement).innerText || '';
      if (text.trim()) {
        signature += text.slice(0, 20);
      }
    }
    return signature;
  };

  // Get actual content height by measuring ONLY content elements (not containers)
  const getContentHeight = (): number => {
    const root = document.getElementById('root');
    if (!root) return CONFIG.MIN_HEIGHT;

    // Force layout recalculation
    void root.offsetHeight;

    // Find all visible content elements (NOT containers which can have inflated min-height)
    const contentSelectors = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'span', 'label', 'a',
      'button', 'input', 'textarea', 'select',
      'img', 'svg', 'canvas',
      'table', 'tr', 'td', 'th',
      'li', 'ul', 'ol',
      '[role="button"]', '[role="listitem"]',
      '.result-item', '.ping-result', '.category-chip'
    ].join(', ');

    const contentElements = root.querySelectorAll(contentSelectors);
    const rootRect = root.getBoundingClientRect();
    let maxBottom = 0;

    for (const el of Array.from(contentElements)) {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);

      // Skip invisible elements
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        continue;
      }

      const rect = htmlEl.getBoundingClientRect();

      // Skip elements with no size
      if (rect.height === 0 || rect.width === 0) {
        continue;
      }

      // Calculate position relative to root
      const relativeBottom = rect.bottom - rootRect.top;

      if (relativeBottom > maxBottom) {
        maxBottom = relativeBottom;
      }
    }

    // Add padding for visual breathing room
    const calculatedHeight = Math.ceil(maxBottom) + 40;

    // Apply sanity bounds - never go below MIN or above MAX
    const boundedHeight = Math.max(CONFIG.MIN_HEIGHT, Math.min(CONFIG.MAX_HEIGHT, calculatedHeight));

    return boundedHeight;
  };

  const sendHeightToParent = (force: boolean = false) => {
    // Skip throttle check if forced
    if (!force && isThrottled) return;

    const root = document.getElementById('root');
    if (!root) return;

    // Check if content actually changed
    const currentSignature = getContentSignature(root);
    const contentChanged = currentSignature !== lastContentSignature;

    if (!force && !contentChanged) {
      return;
    }

    lastContentSignature = currentSignature;

    const contentHeight = getContentHeight();

    // Skip if height change is too small (unless forced)
    if (!force && Math.abs(contentHeight - lastSentHeight) < CONFIG.MIN_HEIGHT_CHANGE) {
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
      }, CONFIG.THROTTLE_DELAY);
    }
  };

  // Debounced height update for DOM mutations
  const debouncedHeightUpdate = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      sendHeightToParent();
      debounceTimer = null;
    }, CONFIG.DEBOUNCE_DELAY);
  };

  // Force recalculation - bypasses all checks, used for reset/completion
  const forceHeightRecalc = () => {
    // Reset state to ensure fresh measurement
    lastSentHeight = 0;
    lastContentSignature = '';
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
      debouncedHeightUpdate();
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
    debouncedHeightUpdate();
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
  window.addEventListener('resize', () => debouncedHeightUpdate());

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
