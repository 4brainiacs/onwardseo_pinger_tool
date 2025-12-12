/**
 * Utility to trigger iframe height recalculation.
 * Call this after any action that significantly changes the DOM content height.
 */

const RECALC_EVENT = 'pinger-recalc-height';

/**
 * Dispatches a custom event to trigger height recalculation.
 * Use after: reset, completion, accordion toggle, etc.
 * Fires multiple times with delays to ensure DOM has fully updated.
 */
export function triggerHeightRecalc(): void {
  // Multiple triggers at different intervals to catch all DOM updates
  // React state changes and DOM updates happen asynchronously
  const delays = [0, 50, 100, 200, 350, 500, 750, 1000];

  delays.forEach(delay => {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(RECALC_EVENT));
    }, delay);
  });
}

/**
 * Returns the event name for height recalculation.
 */
export function getRecalcEventName(): string {
  return RECALC_EVENT;
}
