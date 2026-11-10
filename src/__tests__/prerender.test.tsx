import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { render as prerender } from '../prerender';
import { AppRoot } from '../AppRoot';

/**
 * The structure of a container, without comment nodes and with every style
 * attribute in the browser's own spelling. React's server markup has
 * `<!-- -->` between adjacent text pieces and writes `font-size:14px` where a
 * client render gives `font-size: 14px;`; neither changes what is shown.
 */
function structureOf(source: HTMLElement): string {
  const copy = source.cloneNode(true) as HTMLElement;
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) {
    comments.push(walker.currentNode);
  }
  comments.forEach(comment => comment.parentNode?.removeChild(comment));
  copy.querySelectorAll<HTMLElement>('[style]').forEach(element => {
    element.setAttribute('style', element.style.cssText);
  });
  return copy.innerHTML;
}

describe('pre-built first screen', () => {
  let container: HTMLDivElement;
  let roots: Root[];

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    roots = [];
  });

  afterEach(() => {
    act(() => roots.forEach(root => root.unmount()));
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Same call as src/main.tsx
  async function hydrate(target: HTMLElement) {
    await act(async () => {
      roots.push(hydrateRoot(target, <AppRoot />));
    });
  }

  test('contains the first screen and no comments except text separators', () => {
    const markup = prerender();

    expect(markup).toContain('Ping Website URLs &amp; Backlinks');
    expect(markup).toContain('placeholder="Enter up to 5 URLs (one per line)"');
    expect(markup).toContain('Start Pinging');
    // Any other comment would be a Suspense marker: a fallback instead of the screen
    expect(markup.replace(/<!-- -->/g, '')).not.toContain('<!--');
  });

  test('the counters still update after hydration', async () => {
    container.innerHTML = prerender();
    await hydrate(container);
    expect(container.textContent).toContain('(3/3 services)');

    const twingly = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.startsWith('Twingly')
    ) as HTMLButtonElement;
    await act(async () => {
      twingly.click();
    });

    expect(container.textContent).toContain('(2/3 services)');
    expect(container.textContent).toContain('(1/2)');
  });

  test('hydrates without warnings into the same structure as a client render', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    const warnSpy = vi.spyOn(console, 'warn');

    container.innerHTML = prerender();
    await hydrate(container);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    const clientContainer = document.createElement('div');
    document.body.appendChild(clientContainer);
    await act(async () => {
      const root = createRoot(clientContainer);
      roots.push(root);
      root.render(<AppRoot />);
    });

    expect(structureOf(container)).toBe(structureOf(clientContainer));
    clientContainer.remove();
  });

  test('keeps text typed before hydration and enables Start with it', async () => {
    container.innerHTML = prerender();
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const startButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(startButton.disabled).toBe(true);

    // The visitor types while the JS bundle is still loading
    textarea.value = 'https://example.com';
    await hydrate(container);

    expect(textarea.value).toBe('https://example.com');
    expect(container.querySelector('textarea')).toBe(textarea);
    expect(startButton.disabled).toBe(false);
  });

  test('shows the validation message for invalid text typed before hydration', async () => {
    container.innerHTML = prerender();
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    textarea.value = 'not a url';
    await hydrate(container);

    expect(container.textContent).toContain('Invalid URL: not a url');
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });
});
