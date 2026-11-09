import { renderToString } from 'react-dom/server';
import { AppRoot } from './AppRoot';

/**
 * React writes a style attribute as `a:b;c:d` on the server, while the
 * browser's DOM (and so a client render) says `a: b; c: d;`. Hydration keeps
 * the attribute as delivered, so write it the browser's way to keep the DOM
 * identical to a client render.
 */
function toBrowserStyle(style: string): string {
  // Only plain `property:value` pairs are rewritten. Escaped quotes or url()
  // contain ';' or ':' themselves: stop the build rather than guess.
  if (/[&(]/.test(style)) {
    throw new Error(`prerender: cannot rewrite style attribute "${style}"`);
  }

  return style
    .split(';')
    .filter(declaration => declaration.trim().length > 0)
    .map(declaration => {
      const colon = declaration.indexOf(':');
      return `${declaration.slice(0, colon).trim()}: ${declaration.slice(colon + 1).trim()};`;
    })
    .join(' ');
}

/**
 * Build-time entry: returns the markup of the tool's first screen.
 * vite.config.ts writes it into #root of dist/index.html, and src/main.tsx
 * hydrates it in the browser.
 */
export function render(): string {
  return renderToString(<AppRoot />).replace(
    / style="([^"]*)"/g,
    (_match, style: string) => ` style="${toBrowserStyle(style)}"`
  );
}
