import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { render as prerender } from '../prerender';
import { AppRoot } from '../AppRoot';
import { removeTextSeparators } from '../utils/hydration';

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
      roots.push(hydrateRoot(target, <AppRoot onMounted={() => removeTextSeparators(target)} />));
    });
  }

  test('contains the first screen and no comments except text separators', () => {
    const markup = prerender();

    expect(markup).toContain('Ping Website URLs &amp; Backlinks');
    expect(markup).toContain('placeholder="Enter up to 5 URLs (one per line)"');
    expect(markup).toContain('Start Pinging');
    // Any other comment node would stay in the DOM after hydration
    expect(markup.replace(/<!-- -->/g, '')).not.toContain('<!--');
  });

  test('removeTextSeparators removes only the separators', () => {
    container.innerHTML = '<p>(<!-- -->3<!-- -->/<!-- -->3)<!--keep--><span>a<!-- -->b</span></p>';

    removeTextSeparators(container);

    expect(container.innerHTML).toBe('<p>(3/3)<!--keep--><span>ab</span></p>');
    // The text pieces stay separate nodes, as in a client render
    expect(container.querySelector('p')?.childNodes.length).toBe(6);
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
    expect(container.innerHTML).not.toContain('<!--');
  });

  test('hydrates without warnings into the same DOM as a client render', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    const warnSpy = vi.spyOn(console, 'warn');

    container.innerHTML = prerender();
    await hydrate(container);

    // The pre-built markup spells the style attribute the browser's way
    // ("font-size: 14px;"), so the DOM equals a client render. Development
    // React notes that spelling difference; production React does not check it.
    const unexpected = errorSpy.mock.calls.filter(
      call => !(String(call[0]).includes('Prop `%s` did not match') && call[1] === 'style')
    );
    expect(unexpected).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();

    const clientContainer = document.createElement('div');
    document.body.appendChild(clientContainer);
    await act(async () => {
      const root = createRoot(clientContainer);
      roots.push(root);
      root.render(<AppRoot />);
    });

    expect(container.innerHTML).toBe(clientContainer.innerHTML);
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
