/**
 * Utility to trigger iframe height recalculation.
 * Call this after any action that significantly changes the DOM content height.
 */

const RECALC_EVENT = 'pinger-recalc-height';

/**
 * Dispatches a custom event to trigger height recalculation.
 * Use after: reset, completion, accordion toggle, etc.
 */
export function triggerHeightRecalc(): void {
  // Small delay to allow DOM to settle after state changes
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(RECALC_EVENT));
  }, 50);

  // Second trigger after animations complete
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(RECALC_EVENT));
  }, 300);
}

/**
 * Returns the event name for height recalculation.
 */
export function getRecalcEventName(): string {
  return RECALC_EVENT;
}
