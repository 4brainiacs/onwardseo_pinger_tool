import { build, defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const processEnvDefine = {
  'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
};

/**
 * Renders the tool's first screen at build time and writes it, together with
 * the built CSS, into dist/index.html, so it is visible before the JS bundle
 * has loaded. src/main.tsx hydrates this markup in the browser.
 */
function prerenderFirstScreen(): Plugin {
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
          define: processEnvDefine,
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

export default defineConfig({
  plugins: [react(), prerenderFirstScreen()],
  base: './',
  define: processEnvDefine,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    sourcemap: false,
    target: 'es2019',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks: undefined
      },
      onwarn(warning, warn) {
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        warn(warning);
      }
    }
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    fs: {
      strict: false,
      allow: ['.']
    }
  },
  preview: {
    port: 4173,
    strictPort: true,
    host: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
});
