import { renderToString } from 'react-dom/server';
import { AppRoot } from './AppRoot';

/**
 * Build-time entry: returns the markup of the tool's first screen.
 * build/prerender-first-screen.ts writes it into #root of dist/index.html,
 * and src/main.tsx hydrates it in the browser.
 */
export function render(): string {
  return renderToString(<AppRoot />);
}
