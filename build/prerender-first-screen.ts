import { build, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

/**
 * Renders the tool's first screen at build time and writes it, together with
 * the built CSS, into dist/index.html, so it is visible before the JS bundle
 * has loaded. src/main.tsx hydrates this markup in the browser.
 *
 * @param define the same `define` values the main build uses
 */
export function prerenderFirstScreen(define: Record<string, string>): Plugin {
  const emptyRoot = '<div id="root"></div>';
  let root = process.cwd();
  let outDir = 'dist';
  let enabled = false;

  return {
    name: 'prerender-first-screen',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
      enabled = !config.build.ssr;
    },
    async closeBundle() {
      if (!enabled) return;

      // Build src/prerender.tsx for Node into a throwaway folder and run it
      const tempDir = path.resolve(root, 'node_modules/.prerender');

      try {
        await build({
          configFile: false,
          root,
          publicDir: false,
          logLevel: 'error',
          plugins: [react()],
          define,
          build: {
            ssr: 'src/prerender.tsx',
            outDir: tempDir,
            emptyOutDir: true,
            minify: false,
            rollupOptions: {
              output: { format: 'esm', entryFileNames: 'prerender.mjs' },
              onwarn(warning, warn) {
                // Files written for the classic JSX runtime import React without using it
                if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return;
                warn(warning);
              }
            }
          }
        });

        const entry = pathToFileURL(path.join(tempDir, 'prerender.mjs')).href;
        const { render } = (await import(entry)) as { render: () => string };
        const markup = render();

        // Only React's text separators (<!-- -->) may be in there: src/main.tsx
        // removes them after hydration. Any other comment would stay in the DOM.
        if (!markup || /<!--(?! -->)/.test(markup)) {
          throw new Error('prerender: unexpected first-screen markup');
        }

        const indexFile = path.join(outDir, 'index.html');
        const page = fs.readFileSync(indexFile, 'utf8');
        if (!page.includes(emptyRoot)) {
          throw new Error(`prerender: ${emptyRoot} not found in ${indexFile}`);
        }

        // Put the built CSS into the page itself, so the pre-built first screen
        // can be painted without waiting for a second request
        const cssLinks = [...page.matchAll(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g)];
        if (cssLinks.length !== 1) {
          throw new Error(`prerender: expected 1 stylesheet link in ${indexFile}, found ${cssLinks.length}`);
        }
        const [cssLink, cssFile] = cssLinks[0];
        const css = fs.readFileSync(path.join(outDir, cssFile), 'utf8');
        if (css.includes('</style')) {
          throw new Error('prerender: the built CSS cannot be put into a <style> element');
        }

        fs.writeFileSync(
          indexFile,
          page
            .replace(emptyRoot, () => `<div id="root">${markup}</div>`)
            .replace(cssLink, () => `<style>${css}</style>`)
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  };
}
