/**
 * Helpers for taking over the first screen that the build put into #root.
 */

/** The comment React's server renderer puts between two adjacent text pieces: <!-- --> */
const TEXT_SEPARATOR = ' ';

/**
 * Removes React's text separators from a hydrated container.
 *
 * The server markup needs them to keep adjacent text pieces apart, but once
 * React has taken over the text nodes it never looks at them again. Without
 * them the DOM is exactly what a client render produces.
 * Call it only after hydration has finished.
 */
export function removeTextSeparators(container: HTMLElement): void {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
  const separators: Comment[] = [];

  while (walker.nextNode()) {
    const comment = walker.currentNode as Comment;
    if (comment.data === TEXT_SEPARATOR) {
      separators.push(comment);
    }
  }

  separators.forEach(comment => comment.remove());
}
